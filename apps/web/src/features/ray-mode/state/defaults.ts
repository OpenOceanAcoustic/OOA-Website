import { ENVIRONMENT_PRESETS } from "@ooa/environment";
import type { RayParameters } from "./types";
export const DEFAULT_RAY_PARAMETERS: RayParameters = Object.freeze({
  sourceDepthM: 1000,
  maximumRangeKm: 20,
  receiverDepthCount: 90,
  receiverRangeCount: 140,
  eigenrayReceiverRangeKm: 10,
  eigenrayReceiverDepthM: 1000,
  launchMinimumDegrees: -30,
  launchMaximumDegrees: 30,
  beamCount: 301,
  beamType: "gaussian-cartesian",
  fieldMode: "coherent",
  velocityEnabled: false,
});
export const DEFAULT_RAY_ENVIRONMENT = ENVIRONMENT_PRESETS.munk;
