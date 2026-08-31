import { RuntimeError } from "@ooa/runtime-core";
import type { NormalModeRequest } from "./public-types";

export function assertNormalModeRequest(request: NormalModeRequest): NormalModeRequest {
  if (!Number.isInteger(request.modeLimit) || request.modeLimit < 1) {
    throw new RuntimeError("INPUT_INVALID", "modeLimit 必须是正整数");
  }
  if (!Number.isInteger(request.meshPoints) || request.meshPoints < 0) {
    throw new RuntimeError("INPUT_INVALID", "meshPoints 必须是非负整数");
  }
  if (request.receiverRangesM.length === 0 || request.receiverDepthsM.length === 0) {
    throw new RuntimeError("INPUT_INVALID", "Kraken 接收轴不能为空");
  }
  return request;
}
