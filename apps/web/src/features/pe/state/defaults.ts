import { ENVIRONMENT_PRESETS } from "@ooa/environment";
import type { PeParameters } from "./types";
export const DEFAULT_PE_ENVIRONMENT = ENVIRONMENT_PRESETS.munk;
export const DEFAULT_PE_PARAMETERS: PeParameters = Object.freeze({ sourceDepthM: 1000, maximumRangeKm: 2, maximumDepthM: 5000, rangeStepM: 10, depthStepM: 5, rangeDecimation: 2, depthDecimation: 2, nPade: 4, inspectionRangeM: 1000 });
export const REFERENCE_PADE = 10;
