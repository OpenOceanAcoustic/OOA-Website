import { compareFields, type PeRuntime } from "@ooa/runtime-pe";
import { REFERENCE_PADE } from "../state/defaults";
import { usePeStore } from "../state/store";
import { createPeRequest } from "./request";
export async function runPe(runtime: PeRuntime): Promise<void> { const state = usePeStore.getState(); state.start(`RAM nPade=${state.parameters.nPade}，参考=${REFERENCE_PADE}`); try { const current = await runtime.run(createPeRequest(state)); const reference = state.parameters.nPade === REFERENCE_PADE ? current : await runtime.run(createPeRequest(usePeStore.getState(), REFERENCE_PADE)); usePeStore.getState().complete(current, reference, compareFields(current.transmissionLossDb, reference.transmissionLossDb)); } catch (error) { usePeStore.getState().fail(error instanceof Error ? error.message : String(error)); } }
