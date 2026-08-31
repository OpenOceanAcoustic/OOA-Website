import type { RayModeState } from "./types";
export const selectRayBusy = (state: RayModeState) => state.taskState === "running" || state.taskState === "preparing";
export const selectRayRuntimeTone = (state: RayModeState) => state.taskState === "error" ? "error" as const : selectRayBusy(state) ? "running" as const : state.taskState === "ready" ? "ready" as const : "idle" as const;
