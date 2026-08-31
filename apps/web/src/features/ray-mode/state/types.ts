import type { AcousticEnvironment } from "@ooa/environment";
import type { EigenrayResult, RayBeamType, RayFieldMode, RayFieldResult } from "@ooa/runtime-ray";

export type TaskState = "idle" | "preparing" | "running" | "ready" | "error" | "cancelled";

export interface RayParameters {
  readonly sourceDepthM: number;
  readonly maximumRangeKm: number;
  readonly receiverDepthCount: number;
  readonly receiverRangeCount: number;
  readonly eigenrayReceiverRangeKm: number;
  readonly eigenrayReceiverDepthM: number;
  readonly launchMinimumDegrees: number;
  readonly launchMaximumDegrees: number;
  readonly beamCount: number;
  readonly beamType: RayBeamType;
  readonly fieldMode: RayFieldMode;
  readonly velocityEnabled: boolean;
}

export interface RayModeState {
  environment: AcousticEnvironment;
  parameters: RayParameters;
  taskState: TaskState;
  message: string;
  fieldResult: RayFieldResult | null;
  eigenrayResult: EigenrayResult | null;
  setEnvironment(environment: AcousticEnvironment): void;
  patchParameters(patch: Partial<RayParameters>): void;
  start(message: string): void;
  setFieldResult(result: RayFieldResult): void;
  setEigenrayResult(result: EigenrayResult): void;
  fail(message: string): void;
  cancel(): void;
}
