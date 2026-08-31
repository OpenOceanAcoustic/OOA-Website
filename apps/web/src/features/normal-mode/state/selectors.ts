import type { NormalModeState } from "./types";
export const selectNormalBusy = (state: NormalModeState) => state.status === "running";
export const selectNormalTone = (state: NormalModeState) => state.status === "error" ? "error" as const : state.status === "running" ? "running" as const : state.status === "ready" ? "ready" as const : "idle" as const;
