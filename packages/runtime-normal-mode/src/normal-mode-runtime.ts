import { RuntimeError, normalizeRuntimeError, type RuntimeInfo } from "@ooa/runtime-core";
import { parseNormalModeEnvironmentFiles } from "@ooa/environment/model-file-import";
import { createNormalModePageEngine } from "./page-engine";
import { synthesizeSingleModeField } from "./single-mode-field";
import type {
  NormalImportedEnvironment,
  NormalModePageRequest,
  NormalModePageResult,
  NormalModeSingleField,
  NormalModeRuntime,
  NormalModeRuntimeAdapter,
} from "./public-types";

type CanonicalPageEnvironment = Readonly<Record<string, unknown>> & {
  readonly title: string;
  readonly format: string;
  readonly profilePoints: readonly (readonly [number, number])[];
  readonly waterDepthM: number;
  readonly frequencyHz: number;
  readonly sourceDepthM: number;
  readonly maximumRangeKm: number;
  readonly bottomSoundSpeedMps: number;
  readonly bottomDensityKgM3: number;
  readonly bottomAttenuationDbPerWavelength: number;
  readonly bathymetry: readonly (readonly [number, number])[];
  readonly sourceFiles?: readonly string[];
};

function canonicalNormalEnvironment(parsed: CanonicalPageEnvironment, files: readonly File[]): NormalImportedEnvironment {
  const modelHints = {
    format: parsed.format,
    sourceDepthM: parsed.sourceDepthM,
    maximumRangeKm: parsed.maximumRangeKm,
    nativeTemplate: false,
  } as const;
  return {
    ...parsed,
    sourceId: "",
    environment: {
      title: parsed.title,
      frequencyHz: parsed.frequencyHz,
      waterDepthM: parsed.waterDepthM,
      soundSpeedProfile: parsed.profilePoints.map(([depthM, speedMps]) => ({ depthM, speedMps })),
      bathymetry: parsed.bathymetry.map(([rangeKm, depthM]) => ({ rangeM: rangeKm * 1000, depthM })),
      bottom: {
        soundSpeedMps: parsed.bottomSoundSpeedMps,
        densityKgM3: parsed.bottomDensityKgM3,
        attenuationDbPerWavelength: parsed.bottomAttenuationDbPerWavelength,
      },
    },
    modelHints,
    documents: files.map((file) => ({ name: file.name, kind: "json" as const })),
  };
}

function createEngineAdapter(demonstration: boolean): NormalModeRuntimeAdapter {
  const engine = createNormalModePageEngine();
  return {
    prepare: demonstration ? async () => ({
      packageName: "@ooa/runtime-normal-mode", packageVersion: "0.1.0",
      model: "Kraken demonstration", executionMode: "SINGLE_THREAD", threadCount: 1,
      memoryLimitBytes: 0,
    }) : engine.prepare,
    importEnvironment: async (files) => {
      const parsed = await parseNormalModeEnvironmentFiles(files, engine.importEnvironment) as
        NormalImportedEnvironment | CanonicalPageEnvironment;
      return "sourceId" in parsed
        ? parsed as NormalImportedEnvironment
        : canonicalNormalEnvironment(parsed as CanonicalPageEnvironment, files);
    },
    run: async (request) => await (demonstration ? engine.runDemonstration(request) : engine.run(request)) as Omit<NormalModePageResult, "experimentId">,
    cancel: engine.cancel,
    dispose: engine.dispose,
  };
}

export interface NormalModeRuntimeOptions {
  readonly adapter?: NormalModeRuntimeAdapter;
  readonly demonstration?: boolean;
}

export class NormalModeRuntimeImpl implements NormalModeRuntime {
  readonly #adapter: NormalModeRuntimeAdapter;
  #disposed = false;
  #experimentSequence = 0;
  #info: RuntimeInfo | null = null;
  #preparing: Promise<RuntimeInfo> | null = null;
  #requestSequence = 0;
  #requestActive = false;
  readonly #experiments = new Map<string, NormalModePageResult>();
  readonly #singleModeFields = new Map<string, NormalModeSingleField>();

  constructor(options: NormalModeRuntimeOptions = {}) {
    this.#adapter = options.adapter ?? createEngineAdapter(options.demonstration === true);
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

  async importEnvironment(files: readonly File[]): Promise<NormalImportedEnvironment> {
    this.#assertActive();
    return this.#adapter.importEnvironment(files);
  }

  async run(request: NormalModePageRequest): Promise<NormalModePageResult> {
    this.#assertActive();
    const experimentId = `normal-${++this.#experimentSequence}`;
    if (this.#requestActive) this.#adapter.cancel("superseded");
    const requestId = ++this.#requestSequence;
    this.#requestActive = true;
    try {
      const result = await this.#adapter.run(request);
      if (requestId !== this.#requestSequence) throw new RuntimeError("CANCELLED", "较新的 Normal Mode 请求已替代当前请求");
      const experiment = { ...result, experimentId };
      this.#experiments.set(experimentId, experiment);
      while (this.#experiments.size > 3) this.#experiments.delete(this.#experiments.keys().next().value!);
      return experiment;
    } catch (error) {
      throw normalizeRuntimeError(error);
    } finally {
      if (requestId === this.#requestSequence) this.#requestActive = false;
    }
  }

  cancel(reason = "cancelled"): void {
    if (!this.#disposed) {
      this.#requestSequence += 1;
      this.#requestActive = false;
      this.#adapter.cancel(reason);
    }
  }

  singleModeField(experimentId: string, modeIndex: number): NormalModeSingleField {
    this.#assertActive();
    const key = `${experimentId}:${modeIndex}`;
    const cached = this.#singleModeFields.get(key);
    if (cached !== undefined) return cached;
    const experiment = this.#experiments.get(experimentId);
    if (experiment === undefined) throw new RuntimeError("INPUT_INVALID", `未知的 Normal Mode 实验 ${experimentId}`);
    const field = synthesizeSingleModeField(experiment, modeIndex);
    this.#singleModeFields.set(key, field);
    return field;
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#adapter.cancel("disposed");
    this.#experiments.clear();
    this.#singleModeFields.clear();
    await this.#adapter.dispose();
  }

  #assertActive(): void {
    if (this.#disposed) throw new RuntimeError("CANCELLED", "Normal Mode Runtime 已释放");
  }
}

export function createNormalModeRuntime(options: NormalModeRuntimeOptions = {}): NormalModeRuntime {
  return new NormalModeRuntimeImpl(options);
}
