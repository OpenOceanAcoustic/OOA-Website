import type { RuntimeInfo, RuntimeLifecycle } from "@ooa/runtime-core";
import type { ImportedModelEnvironment } from "@ooa/environment";

export type NumericPair = readonly [number, number];

export interface PeImportedEnvironment extends ImportedModelEnvironment, Readonly<Record<string, unknown>> {
  readonly title: string;
  readonly frequencyHz: number;
  readonly sourceDepthM: number;
  readonly waterDepthM: number;
  readonly maximumRangeKm: number;
  readonly maximumDepthM: number;
  readonly rangeStepM: number;
  readonly depthStepM: number;
  readonly nPade: number;
  readonly profilePoints: readonly NumericPair[];
  readonly bathymetry: readonly NumericPair[];
  readonly modelHints: Readonly<Record<string, unknown>>;
}

export interface PePageRequest {
  readonly contractVersion: 1;
  readonly model: string;
  readonly profile: string;
  readonly environmentTitle: string | null;
  readonly sspPoints: readonly NumericPair[];
  readonly frequencyHz: number;
  readonly sourceDepthM: number;
  readonly waterDepthM: number;
  readonly maximumRangeKm: number;
  readonly maximumDepthM: number;
  readonly rangeStepM: number;
  readonly depthStepM: number;
  readonly bottomSoundSpeedMps: number;
  readonly bottomDensityKgM3: number;
  readonly bottomAttenuationDbPerWavelength: number;
  readonly bathymetry: readonly NumericPair[] | null;
  readonly sourceId: string | null;
  readonly nPade: number;
  readonly referenceNPade: 10;
  readonly rangeCount: number;
  readonly depthCount: number;
}

export interface PeField {
  readonly rows: number;
  readonly columns: number;
  readonly rangesKm: Float64Array;
  readonly depthsM: Float64Array;
  readonly tlDb: Float32Array;
}

export interface PePageResult {
  readonly experimentId: string;
  readonly contractVersion: 1;
  readonly runtime: {
    readonly mode: "wasm" | "demo";
    readonly engine: string;
    readonly fallback: boolean;
    readonly warning?: string;
    readonly computeMs: number;
  };
  readonly parameters: PePageRequest;
  readonly environment: {
    readonly depthsM: Float64Array;
    readonly soundSpeedMps: Float64Array;
    readonly bathymetry: readonly NumericPair[];
  };
  readonly field: PeField;
  readonly referenceField: PeField;
  readonly deltaField: Omit<PeField, "tlDb"> & { readonly values: Float32Array };
  readonly convergence: readonly {
    readonly nPade: number;
    readonly rmsDb: number;
    readonly maximumDb: number;
    readonly relativePressureL2?: number;
    readonly computeMs?: number;
  }[];
  readonly metrics: {
    readonly deltaRmsDb: number;
    readonly deltaMaxDb: number;
    readonly validCellCount: number;
    readonly relativePressureL2?: number;
  };
}

export interface PeVerticalProfile {
  readonly rangeKm: number;
  readonly depthsM: Float64Array;
  readonly currentTlDb: Float32Array;
  readonly referenceTlDb: Float32Array;
}

export interface PeRuntimeAdapter {
  prepare(): Promise<RuntimeInfo>;
  importEnvironment(files: readonly File[]): Promise<PeImportedEnvironment>;
  run(request: PePageRequest): Promise<Omit<PePageResult, "experimentId">>;
  cancel(reason?: string): void;
  dispose(): Promise<void>;
}

export interface PeRuntime extends RuntimeLifecycle {
  importEnvironment(files: readonly File[]): Promise<PeImportedEnvironment>;
  run(request: PePageRequest): Promise<PePageResult>;
  selectPadeField(experimentId: string, nPade: number): Promise<PePageResult>;
  verticalProfile(experimentId: string, rangeKm: number): PeVerticalProfile;
}
