import { create } from "zustand";
import { DEFAULT_PE_ENVIRONMENT, DEFAULT_PE_PARAMETERS } from "./defaults";
import type { PeState } from "./types";
export const usePeStore = create<PeState>((set) => ({
  environment: DEFAULT_PE_ENVIRONMENT, parameters: DEFAULT_PE_PARAMETERS, status: "idle", message: "尚未加载 RAM",
  currentResult: null, referenceResult: null, difference: null, convergence: [],
  setEnvironment: (environment) => set({ environment }), patchParameters: (patch) => set((state) => ({ parameters: { ...state.parameters, ...patch } })),
  start: (message) => set({ status: "running", message }),
  complete: (currentResult, referenceResult, difference) => set({ currentResult, referenceResult, difference, status: "ready", message: "RAM 当前场与参考场计算完成" }),
  setConvergence: (convergence) => set({ convergence, status: "ready", message: "Padé 扫描完成" }),
  fail: (message) => set({ status: "error", message }), cancel: () => set({ status: "cancelled", message: "计算已取消" }),
}));
