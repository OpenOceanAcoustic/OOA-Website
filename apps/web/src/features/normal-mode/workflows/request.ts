import type { NormalModeRequest } from "@ooa/runtime-normal-mode";
import type { NormalModeState } from "../state/types";
function linspace(start: number, end: number, count: number) { return Float64Array.from({ length: count }, (_, index) => start + (end - start) * index / Math.max(1, count - 1)); }
export function createNormalRequest(state: NormalModeState, modeLimit: number): NormalModeRequest { return { environment: state.environment, sourceDepthM: state.parameters.sourceDepthM, receiverRangesM: linspace(0, state.parameters.maximumRangeKm * 1000, state.parameters.receiverRangeCount), receiverDepthsM: linspace(0, state.environment.waterDepthM, state.parameters.receiverDepthCount), modeLimit, meshPoints: state.parameters.meshPoints }; }
