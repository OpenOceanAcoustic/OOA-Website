import type { NormalModeRuntime } from "@ooa/runtime-normal-mode";
import { useNormalModeStore } from "../state/store";
import { createNormalRequest } from "./request";
export async function runNormalMode(runtime: NormalModeRuntime): Promise<void> { const store = useNormalModeStore.getState(); store.start(); try { const full = await runtime.run(createNormalRequest(store, store.parameters.modeLimit)); const truncated = await runtime.run(createNormalRequest(useNormalModeStore.getState(), store.parameters.truncatedModeLimit)); useNormalModeStore.getState().complete(full, truncated); } catch (error) { useNormalModeStore.getState().fail(error instanceof Error ? error.message : String(error)); } }
