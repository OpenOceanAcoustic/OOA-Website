import type { PeState } from "./types";
export const selectPeBusy = (state: PeState) => state.status === "running";
export const selectPeTone = (state: PeState) => state.status === "error" ? "error" as const : state.status === "running" ? "running" as const : state.status === "ready" ? "ready" as const : "idle" as const;
