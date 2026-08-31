import { RuntimeError, TaskController, type RuntimeInfo } from "@ooa/runtime-core";
import { importRayEnvironment } from "./environment-parser";
import { normalizeRayError } from "./errors";
import { assertRayRequest } from "./input-mapper";
import { asEigenrays, asRayField } from "./result-mapper";
import { loadRaySdk } from "./sdk-loader";
import type {
  EigenrayRequest,
  EigenrayResult,
  RayFieldRequest,
  RayFieldResult,
  RayRuntime,
  RaySdkAdapter,
} from "./public-types";

export interface RayRuntimeOptions {
  readonly loadSdk?: () => Promise<RaySdkAdapter>;
}

export class RayRuntimeImpl implements RayRuntime {
  readonly #loadSdk: () => Promise<RaySdkAdapter>;
  readonly #tasks = new TaskController();
  #adapter: RaySdkAdapter | null = null;
  #preparing: Promise<RaySdkAdapter> | null = null;

  constructor(options: RayRuntimeOptions = {}) {
    this.#loadSdk = options.loadSdk ?? loadRaySdk;
  }

  async #backend(): Promise<RaySdkAdapter> {
    if (this.#adapter !== null) return this.#adapter;
    this.#preparing ??= this.#loadSdk();
    try {
      this.#adapter = await this.#preparing;
      return this.#adapter;
    } finally {
      this.#preparing = null;
    }
  }

  async prepare(): Promise<RuntimeInfo> {
    return (await this.#backend()).info;
  }

  async importEnvironment(files: Parameters<RayRuntime["importEnvironment"]>[0]) {
    return importRayEnvironment(files);
  }

  async runField(request: RayFieldRequest): Promise<RayFieldResult> {
    try {
      const outcome = await this.#tasks.run(async ({ signal }) =>
        (await this.#backend()).run({ kind: "field", request: assertRayRequest(request) }, signal));
      if (outcome.status === "completed") return asRayField(outcome.value);
      throw new RuntimeError("CANCELLED", outcome.status === "cancelled" ? outcome.reason : "请求已过期");
    } catch (error) {
      throw normalizeRayError(error);
    }
  }

  async findEigenrays(request: EigenrayRequest): Promise<EigenrayResult> {
    try {
      const outcome = await this.#tasks.run(async ({ signal }) =>
        (await this.#backend()).run({ kind: "eigenrays", request: assertRayRequest(request) }, signal));
      if (outcome.status === "completed") return asEigenrays(outcome.value);
      throw new RuntimeError("CANCELLED", outcome.status === "cancelled" ? outcome.reason : "请求已过期");
    } catch (error) {
      throw normalizeRayError(error);
    }
  }

  cancel(reason = "cancelled"): void {
    this.#tasks.cancel(reason);
    this.#adapter?.cancel(reason);
  }

  async dispose(): Promise<void> {
    this.cancel("disposed");
    const adapter = this.#adapter;
    this.#adapter = null;
    if (adapter !== null) await adapter.dispose();
  }
}

export function createRayRuntime(options: RayRuntimeOptions = {}): RayRuntime {
  return new RayRuntimeImpl(options);
}
