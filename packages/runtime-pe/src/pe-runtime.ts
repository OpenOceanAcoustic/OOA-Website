import { RuntimeError, normalizeRuntimeError, type RuntimeInfo } from "@ooa/runtime-core";
import { parsePEEnvironmentFiles } from "@ooa/environment/model-file-import";
import { createPePageEngine } from "./page-engine";
import type {
  PeImportedEnvironment,
  PePageRequest,
  PePageResult,
  PeRuntime,
  PeRuntimeAdapter,
  PeVerticalProfile,
} from "./public-types";

type CanonicalPageEnvironment = Readonly<Record<string, unknown>> & {
  readonly title: string;
  readonly format: string;
  readonly profilePoints: readonly (readonly [number, number])[];
  readonly waterDepthM: number;
  readonly frequencyHz: number;
  readonly sourceDepthM: number;
  readonly maximumRangeKm: number;
  readonly maximumDepthM?: number;
  readonly rangeStepM?: number;
  readonly depthStepM?: number;
  readonly nPade?: number;
  readonly bottomSoundSpeedMps: number;
  readonly bottomDensityKgM3: number;
  readonly bottomAttenuationDbPerWavelength: number;
  readonly bathymetry: readonly (readonly [number, number])[];
};

function canonicalPeEnvironment(parsed: CanonicalPageEnvironment, files: readonly File[]): PeImportedEnvironment {
  const modelHints = {
    format: parsed.format,
    sourceDepthM: parsed.sourceDepthM,
    maximumRangeKm: parsed.maximumRangeKm,
    nativeTemplate: false,
  } as const;
  return {
    ...parsed,
    sourceId: "",
    maximumDepthM: parsed.maximumDepthM ?? parsed.waterDepthM,
    rangeStepM: parsed.rangeStepM ?? 10,
    depthStepM: parsed.depthStepM ?? 2,
    nPade: parsed.nPade ?? 4,
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

function createEngineAdapter(demonstration: boolean): PeRuntimeAdapter {
  const engine = createPePageEngine();
  return {
    prepare: demonstration ? async () => ({
      packageName: "@ooa/runtime-pe", packageVersion: "0.1.0",
      model: "RAM demonstration", executionMode: "SINGLE_THREAD", threadCount: 1,
      memoryLimitBytes: 0,
    }) : engine.prepare,
    importEnvironment: async (files) => {
      const parsed = await parsePEEnvironmentFiles(files, engine.importEnvironment) as
        PeImportedEnvironment | CanonicalPageEnvironment;
      return "sourceId" in parsed
        ? parsed as PeImportedEnvironment
        : canonicalPeEnvironment(parsed as CanonicalPageEnvironment, files);
    },
    run: async (request) => await (demonstration ? engine.runDemonstration(request) : engine.run(request)) as Omit<PePageResult, "experimentId">,
    cancel: engine.cancel,
    dispose: engine.dispose,
  };
}

export interface PeRuntimeOptions {
  readonly adapter?: PeRuntimeAdapter;
  readonly demonstration?: boolean;
}

export class PeRuntimeImpl implements PeRuntime {
  readonly #adapter: PeRuntimeAdapter;
  #disposed = false;
  #experimentSequence = 0;
  #info: RuntimeInfo | null = null;
  #preparing: Promise<RuntimeInfo> | null = null;
  #requestSequence = 0;
  #requestActive = false;
  readonly #experiments = new Map<string, PePageResult>();

  constructor(options: PeRuntimeOptions = {}) {
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

  async importEnvironment(files: readonly File[]): Promise<PeImportedEnvironment> {
    this.#assertActive();
    return this.#adapter.importEnvironment(files);
  }

  async run(request: PePageRequest): Promise<PePageResult> {
    this.#assertActive();
    const experimentId = `pe-${++this.#experimentSequence}`;
    if (this.#requestActive) this.#adapter.cancel("superseded");
    const requestId = ++this.#requestSequence;
    this.#requestActive = true;
    try {
      const result = await this.#adapter.run(request);
      if (requestId !== this.#requestSequence) throw new RuntimeError("CANCELLED", "较新的 PE 请求已替代当前请求");
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

  async selectPadeField(experimentId: string, nPade: number): Promise<PePageResult> {
    this.#assertActive();
    const experiment = this.#experiments.get(experimentId);
    if (experiment === undefined) throw new RuntimeError("INPUT_INVALID", `未知的 PE 实验 ${experimentId}`);
    return this.run({ ...experiment.parameters, nPade: Math.max(1, Math.min(10, Math.round(nPade))) });
  }

  verticalProfile(experimentId: string, rangeKm: number): PeVerticalProfile {
    this.#assertActive();
    const experiment = this.#experiments.get(experimentId);
    if (experiment === undefined) throw new RuntimeError("INPUT_INVALID", `未知的 PE 实验 ${experimentId}`);
    const ranges = experiment.field.rangesKm;
    let rangeIndex = 0;
    for (let index = 1; index < ranges.length; index += 1) {
      if (Math.abs(ranges[index]! - rangeKm) < Math.abs(ranges[rangeIndex]! - rangeKm)) rangeIndex = index;
    }
    const currentTlDb = new Float32Array(experiment.field.rows);
    const referenceTlDb = new Float32Array(experiment.referenceField.rows);
    for (let depthIndex = 0; depthIndex < experiment.field.rows; depthIndex += 1) {
      const offset = depthIndex * experiment.field.columns + rangeIndex;
      currentTlDb[depthIndex] = experiment.field.tlDb[offset]!;
      referenceTlDb[depthIndex] = experiment.referenceField.tlDb[offset]!;
    }
    return {
      rangeKm: ranges[rangeIndex]!, depthsM: experiment.field.depthsM,
      currentTlDb, referenceTlDb,
    };
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#adapter.cancel("disposed");
    this.#experiments.clear();
    await this.#adapter.dispose();
  }

  #assertActive(): void {
    if (this.#disposed) throw new RuntimeError("CANCELLED", "PE Runtime 已释放");
  }
}

export function createPeRuntime(options: PeRuntimeOptions = {}): PeRuntime {
  return new PeRuntimeImpl(options);
}
