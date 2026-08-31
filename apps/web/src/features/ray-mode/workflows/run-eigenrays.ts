import type { RayRuntime } from "@ooa/runtime-ray";
import { useRayModeStore } from "../state/store";
import { createEigenrayRequest } from "./request";
export async function runRayEigenrays(runtime: RayRuntime): Promise<void> {
  const store = useRayModeStore.getState(); store.start("Bellhop2D 正在搜索精确本征声线");
  try { store.setEigenrayResult(await runtime.findEigenrays(createEigenrayRequest(store))); }
  catch (error) { useRayModeStore.getState().fail(error instanceof Error ? error.message : String(error)); }
}
