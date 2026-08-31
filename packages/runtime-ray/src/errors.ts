import { normalizeRuntimeError, type RuntimeError } from "@ooa/runtime-core";

export function normalizeRayError(error: unknown): RuntimeError {
  return normalizeRuntimeError(error, "RUN_FAILED");
}
