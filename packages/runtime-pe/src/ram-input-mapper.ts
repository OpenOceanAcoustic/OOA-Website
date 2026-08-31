import { RuntimeError } from "@ooa/runtime-core";
import type { PeRequest } from "./public-types";

export function assertPeRequest(request: PeRequest): PeRequest {
  if (request.rangeStepM <= 0 || request.depthStepM <= 0) throw new RuntimeError("INPUT_INVALID", "dr 和 dz 必须大于 0");
  if (!Number.isInteger(request.nPade) || request.nPade < 1) throw new RuntimeError("INPUT_INVALID", "nPade 必须是正整数");
  if (request.maximumRangeM <= 0 || request.maximumDepthM <= 0) throw new RuntimeError("INPUT_INVALID", "传播范围和深度必须大于 0");
  return request;
}
