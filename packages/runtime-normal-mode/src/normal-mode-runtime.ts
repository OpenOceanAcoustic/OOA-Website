import { RuntimeError, TaskController, normalizeRuntimeError, type RuntimeInfo } from "@ooa/runtime-core";
import { importNormalModeEnvironment } from "./environment-parser";
import { assertNormalModeRequest } from "./kraken-input-mapper";
import { loadNormalModeSdk } from "./sdk-loader";
import { ModeCache } from "./mode-cache";
import type { NormalModeRequest, NormalModeResult, NormalModeRuntime, NormalModeSdkAdapter } from "./public-types";

export interface NormalModeRuntimeOptions { readonly loadSdk?: () => Promise<NormalModeSdkAdapter>; }

export class NormalModeRuntimeImpl implements NormalModeRuntime {
  readonly #loadSdk: () => Promise<NormalModeSdkAdapter>;
  readonly #tasks = new TaskController();
  readonly #cache = new ModeCache();
  #adapter: NormalModeSdkAdapter | null = null;
  #preparing: Promise<NormalModeSdkAdapter> | null = null;
  constructor(options: NormalModeRuntimeOptions = {}) { this.#loadSdk = options.loadSdk ?? loadNormalModeSdk; }
  async #backend() {
    if (this.#adapter !== null) return this.#adapter;
    this.#preparing ??= this.#loadSdk();
    try { this.#adapter = await this.#preparing; return this.#adapter; }
    finally { this.#preparing = null; }
  }
  async prepare(): Promise<RuntimeInfo> { return (await this.#backend()).info; }
  async importEnvironment(files: Parameters<NormalModeRuntime["importEnvironment"]>[0]) { return importNormalModeEnvironment(files); }
  async run(request: NormalModeRequest): Promise<NormalModeResult> {
    try {
      const validated = assertNormalModeRequest(request);
      const cacheKey = JSON.stringify({ environment: validated.environment, sourceDepthM: validated.sourceDepthM, receiverRangesM: Array.from(validated.receiverRangesM), receiverDepthsM: Array.from(validated.receiverDepthsM), modeLimit: validated.modeLimit, meshPoints: validated.meshPoints });
      const cached = this.#cache.get(cacheKey);
      if (cached !== undefined) { this.#tasks.cancel("cached request superseded the active request"); return cached; }
      const outcome = await this.#tasks.run(async ({ signal }) => (await this.#backend()).run(validated, signal));
      if (outcome.status === "completed") { this.#cache.set(cacheKey, outcome.value); return outcome.value; }
      throw new RuntimeError("CANCELLED", outcome.status === "cancelled" ? outcome.reason : "请求已过期");
    } catch (error) { throw normalizeRuntimeError(error); }
  }
  cancel(reason = "cancelled"): void { this.#tasks.cancel(reason); this.#adapter?.cancel(reason); }
  async dispose(): Promise<void> { this.cancel("disposed"); this.#cache.clear(); const adapter = this.#adapter; this.#adapter = null; if (adapter !== null) await adapter.dispose(); }
}

export function createNormalModeRuntime(options: NormalModeRuntimeOptions = {}): NormalModeRuntime {
  return new NormalModeRuntimeImpl(options);
}
