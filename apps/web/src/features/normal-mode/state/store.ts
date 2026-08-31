import { create } from "zustand";
import { DEFAULT_NORMAL_ENVIRONMENT, DEFAULT_NORMAL_PARAMETERS } from "./defaults";
import type { NormalModeState } from "./types";
export const useNormalModeStore = create<NormalModeState>((set) => ({
  environment: DEFAULT_NORMAL_ENVIRONMENT, parameters: DEFAULT_NORMAL_PARAMETERS, selectedMode: 0,
  status: "idle", message: "尚未加载 Kraken", fullResult: null, truncatedResult: null,
  setEnvironment: (environment) => set({ environment }), patchParameters: (patch) => set((state) => ({ parameters: { ...state.parameters, ...patch } })),
  setSelectedMode: (selectedMode) => set({ selectedMode }),
  start: () => set({ status: "running", message: "Kraken 正在计算完整与截断模态场" }),
  complete: (fullResult, truncatedResult) => set({ fullResult, truncatedResult, status: "ready", message: "Kraken 计算完成" }),
  fail: (message) => set({ status: "error", message }), cancel: () => set({ status: "cancelled", message: "计算已取消" }),
}));
