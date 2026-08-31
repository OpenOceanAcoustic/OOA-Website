import type { AcousticEnvironment } from "@ooa/environment";
import type { FieldDifference, PeResult } from "@ooa/runtime-pe";
export interface PeParameters { readonly sourceDepthM: number; readonly maximumRangeKm: number; readonly maximumDepthM: number; readonly rangeStepM: number; readonly depthStepM: number; readonly rangeDecimation: number; readonly depthDecimation: number; readonly nPade: number; readonly inspectionRangeM: number; }
export interface ConvergencePoint { readonly nPade: number; readonly rms: number; readonly maximum: number; readonly totalTimeMs: number; }
export interface PeState {
  environment: AcousticEnvironment; parameters: PeParameters;
  status: "idle" | "running" | "ready" | "error" | "cancelled"; message: string;
  currentResult: PeResult | null; referenceResult: PeResult | null; difference: FieldDifference | null; convergence: readonly ConvergencePoint[];
  setEnvironment(value: AcousticEnvironment): void; patchParameters(value: Partial<PeParameters>): void;
  start(message: string): void; complete(current: PeResult, reference: PeResult, difference: FieldDifference): void;
  setConvergence(value: readonly ConvergencePoint[]): void; fail(message: string): void; cancel(): void;
}
