import type { EigenrayResult, RayFieldResult, RaySdkResult } from "./public-types";

export function asRayField(result: RaySdkResult): RayFieldResult {
  if (result.kind !== "field") throw new TypeError(`Expected field result, received ${result.kind}`);
  return result;
}

export function asEigenrays(result: RaySdkResult): EigenrayResult {
  if (result.kind !== "eigenrays") throw new TypeError(`Expected eigenray result, received ${result.kind}`);
  return result;
}
