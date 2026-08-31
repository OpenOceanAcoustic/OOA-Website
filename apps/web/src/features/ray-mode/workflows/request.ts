import type { RayFieldRequest } from "@ooa/runtime-ray";
import type { RayModeState } from "../state/types";
function linspace(start: number, end: number, count: number): Float64Array { return Float64Array.from({ length: count }, (_, index) => start + (end - start) * index / Math.max(1, count - 1)); }
export function createRayRequest(state: RayModeState): RayFieldRequest {
  return {
    environment: state.environment,
    sourceDepthM: state.parameters.sourceDepthM,
    receiverRangesM: linspace(100, state.parameters.maximumRangeKm * 1000, state.parameters.receiverRangeCount),
    receiverDepthsM: linspace(1, state.environment.waterDepthM - 1, state.parameters.receiverDepthCount),
    launchAnglesDegrees: [state.parameters.launchMinimumDegrees, state.parameters.launchMaximumDegrees],
    beamCount: state.parameters.beamCount,
    beamType: state.parameters.beamType,
    fieldMode: state.parameters.fieldMode,
    velocityEnabled: state.parameters.velocityEnabled,
  };
}

export function createEigenrayRequest(state: RayModeState): RayFieldRequest {
  return {
    ...createRayRequest(state),
    receiverRangesM: Float64Array.of(state.parameters.eigenrayReceiverRangeKm * 1000),
    receiverDepthsM: Float64Array.of(state.parameters.eigenrayReceiverDepthM),
  };
}
