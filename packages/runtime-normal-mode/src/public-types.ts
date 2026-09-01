import type { RuntimeInfo, RuntimeLifecycle } from "@ooa/runtime-core";
import type { ImportedModelEnvironment } from "@ooa/environment";

export type NumericPair = readonly [number, number];

export interface NormalImportedEnvironment extends ImportedModelEnvironment, Readonly<Record<string, unknown>> {
  readonly title: string;
  readonly frequencyHz: number;
  readonly waterDepthM: number;
  readonly sourceDepthM: number;
  readonly maximumRangeKm: number;
  readonly profilePoints: readonly NumericPair[];
  readonly modelHints: Readonly<Record<string, unknown>>;
}

export interface NormalModePageRequest {
  readonly contractVersion: 1;
  readonly model: string;
  readonly profile: string;
  readonly environmentTitle: string | null;
  readonly sspPoints: readonly NumericPair[];
  readonly frequencyHz: number;
  readonly sourceDepthM: number;
  readonly waterDepthM: number;
  readonly maximumRangeKm: number;
  readonly phaseSpeedLowMps: number;
  readonly phaseSpeedHighMps: number;
  readonly bottomSoundSpeedMps: number;
  readonly bottomDensityRelative: number;
  readonly bottomAttenuationDbPerWavelength: number;
  readonly interpolation: string;
  readonly sourceId: string | null;
  readonly modeLimit: number;
  readonly rangeCount: number;
  readonly depthCount: number;
}

export interface NormalModeField {
  readonly rows: number;
  readonly columns: number;
  readonly rangesKm: Float64Array;
  readonly depthsM: Float64Array;
  readonly tlDb: Float32Array;
  readonly activeModeCount?: number;
}

export interface NormalModePageResult {
  readonly experimentId: string;
  readonly contractVersion: 1;
  readonly runtime: {
    readonly mode: "wasm" | "demo";
    readonly engine: string;
    readonly fallback: boolean;
    readonly warning?: string;
    readonly computeMs: number;
    readonly nativeComputeMs?: number;
    readonly executionMode?: string;
    readonly threadCount?: number;
  };
  readonly environment: {
    readonly profile: string;
    readonly waterDepthM: number;
    readonly sourceDepthM: number;
    readonly frequencyHz: number;
    readonly depthsM: Float64Array;
    readonly soundSpeedMps: Float64Array;
  };
  readonly modes: {
    readonly count: number;
    readonly depthsM: Float64Array;
    readonly horizontalWavenumbersInterleaved: Float64Array;
    readonly phaseSpeedMps?: Float64Array;
    readonly groupVelocityMps: Float64Array;
    readonly modeShapesInterleaved: Float64Array;
  };
  readonly field: NormalModeField & { readonly activeModeCount: number };
  readonly fullField: NormalModeField;
  readonly deltaField: Omit<NormalModeField, "tlDb" | "activeModeCount"> & { readonly values: Float32Array };
  readonly metrics: {
    readonly deltaRmsDb: number;
    readonly deltaMaxDb: number;
    readonly comparedCellCount?: number;
  };
}

export interface NormalModeSingleField extends NormalModeField {
  readonly modeIndex: number;
  readonly modeNumber: number;
  readonly horizontalWavenumber: { readonly real: number; readonly imaginary: number };
  readonly sourceCouplingMagnitude: number;
}

export interface NormalModeRuntimeAdapter {
  prepare(): Promise<RuntimeInfo>;
  importEnvironment(files: readonly File[]): Promise<NormalImportedEnvironment>;
  run(request: NormalModePageRequest): Promise<Omit<NormalModePageResult, "experimentId">>;
  cancel(reason?: string): void;
  dispose(): Promise<void>;
}

export interface NormalModeRuntime extends RuntimeLifecycle {
  importEnvironment(files: readonly File[]): Promise<NormalImportedEnvironment>;
  run(request: NormalModePageRequest): Promise<NormalModePageResult>;
  singleModeField(experimentId: string, modeIndex: number): NormalModeSingleField;
}
