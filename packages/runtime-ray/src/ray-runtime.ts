import { RuntimeError, normalizeRuntimeError, type RuntimeInfo } from "@ooa/runtime-core";
import { createRayPageEngine } from "./page-engine";
import { createRayDemonstrationAdapter } from "./demonstration-adapter";
import type {
  EigenrayPageResult,
  RayImportedEnvironment,
  RayPageRequest,
  RayPageResult,
  RayRuntime,
  RayRuntimeAdapter,
} from "./public-types";

function createProductionAdapter(): RayRuntimeAdapter {
  const engine = createRayPageEngine();
  return {
    prepare: engine.prepare,
    importEnvironment: async (files) => await engine.importEnvironment(files) as RayImportedEnvironment,
    runField: async (request) => await engine.runField(request) as RayPageResult,
    findEigenrays: async (request) => await engine.findEigenrays(request) as EigenrayPageResult,
    cancel: engine.cancel,
    dispose: engine.dispose,
  };
}

export interface RayRuntimeOptions {
  readonly adapter?: RayRuntimeAdapter;
  readonly demonstration?: boolean;
}

export class RayRuntimeImpl implements RayRuntime {
  readonly #adapter: RayRuntimeAdapter;
  #disposed = false;
  #info: RuntimeInfo | null = null;
  #preparing: Promise<RuntimeInfo> | null = null;
  #requestSequence = 0;
  #requestActive = false;

  constructor(options: RayRuntimeOptions = {}) {
    this.#adapter = options.adapter ?? (options.demonstration ? createRayDemonstrationAdapter() : createProductionAdapter());
  }

  async prepare(): Promise<RuntimeInfo> {
    this.#assertActive();
    if (this.#info !== null) return this.#info;
    this.#preparing ??= this.#adapter.prepare();
    try {
      this.#info = await this.#preparing;
      return this.#info;
    } finally {
      this.#preparing = null;
    }
  }

  async importEnvironment(files: readonly File[]): Promise<RayImportedEnvironment> {
    this.#assertActive();
    return this.#adapter.importEnvironment(files);
  }

  async runField(request: RayPageRequest): Promise<RayPageResult> {
    return this.#runLatest(() => this.#adapter.runField(request));
  }

  async findEigenrays(request: RayPageRequest): Promise<EigenrayPageResult> {
    return this.#runLatest(() => this.#adapter.findEigenrays(request));
  }

  cancel(reason = "cancelled"): void {
    if (!this.#disposed) {
      this.#requestSequence += 1;
      this.#requestActive = false;
      this.#adapter.cancel(reason);
    }
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#adapter.cancel("disposed");
    await this.#adapter.dispose();
  }

  #assertActive(): void {
    if (this.#disposed) throw new RuntimeError("CANCELLED", "Ray Runtime 已释放");
  }

  async #runLatest<T>(operation: () => Promise<T>): Promise<T> {
    this.#assertActive();
    if (this.#requestActive) this.#adapter.cancel("superseded");
    const requestId = ++this.#requestSequence;
    this.#requestActive = true;
    try {
      const result = await operation();
      if (requestId !== this.#requestSequence) throw new RuntimeError("CANCELLED", "较新的 Ray 请求已替代当前请求");
      return result;
    } catch (error) {
      throw normalizeRuntimeError(error);
    } finally {
      if (requestId === this.#requestSequence) this.#requestActive = false;
    }
  }
}

export function createRayRuntime(options: RayRuntimeOptions = {}): RayRuntime {
  return new RayRuntimeImpl(options);
}
