import type { AcousticEnvironment } from "@ooa/environment";
import type { NormalModeResult } from "@ooa/runtime-normal-mode";
export interface NormalParameters { readonly sourceDepthM: number; readonly maximumRangeKm: number; readonly receiverRangeCount: number; readonly receiverDepthCount: number; readonly modeLimit: number; readonly truncatedModeLimit: number; readonly meshPoints: number; }
export interface NormalModeState {
  environment: AcousticEnvironment; parameters: NormalParameters; selectedMode: number;
  status: "idle" | "running" | "ready" | "error" | "cancelled"; message: string;
  fullResult: NormalModeResult | null; truncatedResult: NormalModeResult | null;
  setEnvironment(value: AcousticEnvironment): void; patchParameters(value: Partial<NormalParameters>): void;
  setSelectedMode(value: number): void; start(): void;
  complete(fullResult: NormalModeResult, truncatedResult: NormalModeResult): void; fail(message: string): void; cancel(): void;
}
