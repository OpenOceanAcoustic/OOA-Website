import { RuntimeError } from "@ooa/runtime-core";
import type { RayFieldRequest } from "./public-types";

export function assertRayRequest(request: RayFieldRequest): RayFieldRequest {
  if (request.receiverRangesM.length === 0 || request.receiverDepthsM.length === 0) {
    throw new RuntimeError("INPUT_INVALID", "接收距离和深度轴不能为空");
  }
  if (!Number.isInteger(request.beamCount) || request.beamCount < 2) {
    throw new RuntimeError("INPUT_INVALID", "beamCount 必须是至少为 2 的整数");
  }
  if (!["geometric-cartesian", "geometric-ray-centered", "gaussian-cartesian", "gaussian-ray-centered", "gaussian-simple"].includes(request.beamType)) {
    throw new RuntimeError("INPUT_INVALID", "不支持的 Bellhop BeamType");
  }
  if (!["coherent", "incoherent", "semicoherent"].includes(request.fieldMode)) {
    throw new RuntimeError("INPUT_INVALID", "不支持的 Bellhop 声场 RunMode");
  }
  if (request.sourceDepthM < 0 || request.sourceDepthM > request.environment.waterDepthM) {
    throw new RuntimeError("INPUT_INVALID", "声源深度必须位于水体内");
  }
  return request;
}
