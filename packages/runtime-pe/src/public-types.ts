import type { AcousticEnvironment, EnvironmentDocument, ImportedEnvironment } from "@ooa/environment";
import type { RuntimeInfo, RuntimeLifecycle } from "@ooa/runtime-core";

export interface PeRequest {
  readonly environment: AcousticEnvironment;
  readonly sourceDepthM: number;
  readonly maximumRangeM: number;
  readonly maximumDepthM: number;
  readonly receiverDepthsM: Float64Array;
  readonly rangeStepM: number;
  readonly depthStepM: number;
  readonly rangeDecimation: number;
  readonly depthDecimation: number;
  readonly nPade: number;
}

export interface PeResult {
  readonly receiverRangesM: Float64Array;
  readonly receiverDepthsM: Float64Array;
  readonly transmissionLossDb: Float32Array;
  readonly validityMask: Uint8Array;
  readonly lineRangesM: Float64Array;
  readonly lineTransmissionLossDb: Float32Array;
  readonly totalTimeMs: number;
}

export type PeImportedEnvironment = ImportedEnvironment;
export interface PeSdkAdapter {
  readonly info: RuntimeInfo;
  run(request: PeRequest, signal: AbortSignal): Promise<PeResult>;
  cancel(reason?: string): void;
  dispose(): Promise<void>;
}
export interface PeRuntime extends RuntimeLifecycle {
  importEnvironment(files: EnvironmentDocument[]): Promise<PeImportedEnvironment>;
  run(request: PeRequest): Promise<PeResult>;
}
