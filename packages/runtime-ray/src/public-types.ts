import type {
  AcousticEnvironment,
  EnvironmentDocument,
  ImportedEnvironment,
} from "@ooa/environment";
import type { RuntimeInfo, RuntimeLifecycle } from "@ooa/runtime-core";

export type RayBeamType =
  | "geometric-cartesian"
  | "geometric-ray-centered"
  | "gaussian-cartesian"
  | "gaussian-ray-centered"
  | "gaussian-simple";
export type RayFieldMode = "coherent" | "incoherent" | "semicoherent";

export interface RayFieldRequest {
  readonly environment: AcousticEnvironment;
  readonly sourceDepthM: number;
  readonly receiverRangesM: Float64Array;
  readonly receiverDepthsM: Float64Array;
  readonly launchAnglesDegrees: readonly [number, number] | readonly number[];
  readonly beamCount: number;
  readonly beamType: RayBeamType;
  readonly fieldMode: RayFieldMode;
  readonly velocityEnabled: boolean;
}

export interface EigenrayRequest extends RayFieldRequest {}

export interface RayFieldResult {
  readonly kind: "field";
  readonly receiverRangesM: Float64Array;
  readonly receiverDepthsM: Float64Array;
  readonly transmissionLossDb: Float64Array;
  readonly validityMask: Uint8Array;
  readonly totalTimeMs: number;
}

export interface EigenrayResult {
  readonly kind: "eigenrays";
  readonly offsets: Uint32Array;
  readonly launchAnglesDegrees: Float64Array;
  readonly pointsM: Float64Array;
  readonly totalTimeMs: number;
}

export type RayImportedEnvironment = ImportedEnvironment;
export type RaySdkResult = RayFieldResult | EigenrayResult;
export type RaySdkRequest =
  | { readonly kind: "field"; readonly request: RayFieldRequest }
  | { readonly kind: "eigenrays"; readonly request: EigenrayRequest };

export interface RaySdkAdapter {
  readonly info: RuntimeInfo;
  run(request: RaySdkRequest, signal: AbortSignal): Promise<RaySdkResult>;
  cancel(reason?: string): void;
  dispose(): Promise<void>;
}

export interface RayRuntime extends RuntimeLifecycle {
  importEnvironment(files: EnvironmentDocument[]): Promise<RayImportedEnvironment>;
  runField(request: RayFieldRequest): Promise<RayFieldResult>;
  findEigenrays(request: EigenrayRequest): Promise<EigenrayResult>;
}
