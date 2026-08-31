import { ENVIRONMENT_PRESETS } from "@ooa/environment";
import type { NormalParameters } from "./types";
export const DEFAULT_NORMAL_ENVIRONMENT = ENVIRONMENT_PRESETS.munk;
export const DEFAULT_NORMAL_PARAMETERS: NormalParameters = Object.freeze({ sourceDepthM: 1000, maximumRangeKm: 20, receiverRangeCount: 80, receiverDepthCount: 90, modeLimit: 120, truncatedModeLimit: 20, meshPoints: 0 });
