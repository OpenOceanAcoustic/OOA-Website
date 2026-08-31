import type { AcousticEnvironment, EnvironmentDocument, ImportedEnvironment } from "@ooa/environment";
import type { RuntimeInfo, RuntimeLifecycle } from "@ooa/runtime-core";

export interface NormalModeRequest {
  readonly environment: AcousticEnvironment;
  readonly sourceDepthM: number;
  readonly receiverRangesM: Float64Array;
  readonly receiverDepthsM: Float64Array;
  readonly modeLimit: number;
  readonly meshPoints: number;
}

export interface NormalModeResult {
  readonly sourceDepthM: number;
  readonly receiverRangesM: Float64Array;
  readonly receiverDepthsM: Float64Array;
  readonly transmissionLossDb: Float32Array;
  readonly modeCounts: Uint32Array;
  readonly depthCounts: Uint32Array;
  readonly depthOffsets: Uint32Array;
  readonly shapeOffsets: Uint32Array;
  readonly wavenumberOffsets: Uint32Array;
  readonly depthsM: Float64Array;
  readonly wavenumbersInterleaved: Float64Array;
  readonly groupVelocityMps: Float64Array;
  readonly modeShapesInterleaved: Float64Array;
  readonly totalTimeMs: number;
}

export type NormalImportedEnvironment = ImportedEnvironment;

export interface NormalModeSdkAdapter {
  readonly info: RuntimeInfo;
  run(request: NormalModeRequest, signal: AbortSignal): Promise<NormalModeResult>;
  cancel(reason?: string): void;
  dispose(): Promise<void>;
}

export interface NormalModeRuntime extends RuntimeLifecycle {
  importEnvironment(files: EnvironmentDocument[]): Promise<NormalImportedEnvironment>;
  run(request: NormalModeRequest): Promise<NormalModeResult>;
}
