import type { RayRuntime } from "@ooa/runtime-ray";
import { useRayModeStore } from "../state/store";
import { createRayRequest } from "./request";
export async function runRayField(runtime: RayRuntime): Promise<void> {
  const store = useRayModeStore.getState(); store.start("Bellhop2D 正在计算主声场");
  try { store.setFieldResult(await runtime.runField(createRayRequest(store))); }
  catch (error) { useRayModeStore.getState().fail(error instanceof Error ? error.message : String(error)); }
}
