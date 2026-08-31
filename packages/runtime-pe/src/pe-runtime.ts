import { RuntimeError, TaskController, normalizeRuntimeError, type RuntimeInfo } from "@ooa/runtime-core";
import { importPeEnvironment } from "./environment-parser";
import { assertPeRequest } from "./ram-input-mapper";
import { loadPeSdk } from "./sdk-loader";
import type { PeRequest, PeResult, PeRuntime, PeSdkAdapter } from "./public-types";

export interface PeRuntimeOptions { readonly loadSdk?: () => Promise<PeSdkAdapter>; }
export class PeRuntimeImpl implements PeRuntime {
  readonly #loadSdk: () => Promise<PeSdkAdapter>; readonly #tasks = new TaskController();
  #adapter: PeSdkAdapter | null = null; #preparing: Promise<PeSdkAdapter> | null = null;
  constructor(options: PeRuntimeOptions = {}) { this.#loadSdk = options.loadSdk ?? loadPeSdk; }
  async #backend() { if (this.#adapter !== null) return this.#adapter; this.#preparing ??= this.#loadSdk(); try { this.#adapter = await this.#preparing; return this.#adapter; } finally { this.#preparing = null; } }
  async prepare(): Promise<RuntimeInfo> { return (await this.#backend()).info; }
  async importEnvironment(files: Parameters<PeRuntime["importEnvironment"]>[0]) { return importPeEnvironment(files); }
  async run(request: PeRequest): Promise<PeResult> {
    try {
      const outcome = await this.#tasks.run(async ({ signal }) => (await this.#backend()).run(assertPeRequest(request), signal));
      if (outcome.status === "completed") return outcome.value;
      throw new RuntimeError("CANCELLED", outcome.status === "cancelled" ? outcome.reason : "请求已过期");
    } catch (error) { throw normalizeRuntimeError(error); }
  }
  cancel(reason = "cancelled"): void { this.#tasks.cancel(reason); this.#adapter?.cancel(reason); }
  async dispose(): Promise<void> { this.cancel("disposed"); const adapter = this.#adapter; this.#adapter = null; if (adapter !== null) await adapter.dispose(); }
}
export function createPeRuntime(options: PeRuntimeOptions = {}): PeRuntime { return new PeRuntimeImpl(options); }
