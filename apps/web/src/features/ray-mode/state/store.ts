import { create } from "zustand";
import { DEFAULT_RAY_ENVIRONMENT, DEFAULT_RAY_PARAMETERS } from "./defaults";
import type { RayModeState } from "./types";
export const useRayModeStore = create<RayModeState>((set) => ({
  environment: DEFAULT_RAY_ENVIRONMENT, parameters: DEFAULT_RAY_PARAMETERS,
  taskState: "idle", message: "尚未加载 WASM", fieldResult: null, eigenrayResult: null,
  setEnvironment: (environment) => set({ environment }),
  patchParameters: (patch) => set((state) => ({ parameters: { ...state.parameters, ...patch } })),
  start: (message) => set({ taskState: "running", message }),
  setFieldResult: (fieldResult) => set({ fieldResult, taskState: "ready", message: "Bellhop2D 声场计算完成" }),
  setEigenrayResult: (eigenrayResult) => set({ eigenrayResult, taskState: "ready", message: "本征声线搜索完成" }),
  fail: (message) => set({ taskState: "error", message }),
  cancel: () => set({ taskState: "cancelled", message: "计算已取消" }),
}));
