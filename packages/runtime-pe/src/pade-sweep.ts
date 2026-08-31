import type { PeRequest, PeResult, PeRuntime } from "./public-types";
export interface PadeSweepPoint { readonly nPade: number; readonly result: PeResult; }
export async function runPadeSweep(runtime: PeRuntime, request: PeRequest, values: readonly number[]): Promise<PadeSweepPoint[]> {
  const results: PadeSweepPoint[] = [];
  for (const nPade of values) results.push({ nPade, result: await runtime.run({ ...request, nPade }) });
  return results;
}
