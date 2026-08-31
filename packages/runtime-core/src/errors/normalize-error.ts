import { RuntimeError, type RuntimeErrorCode } from "./runtime-error";

export function normalizeRuntimeError(
  error: unknown,
  fallbackCode: RuntimeErrorCode = "RUN_FAILED",
): RuntimeError {
  if (error instanceof RuntimeError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/abort|cancel/i.test(message)) return new RuntimeError("CANCELLED", message, { cause: error });
  if (/memory|allocation|out of bounds/i.test(message)) {
    return new RuntimeError("MEMORY_LIMIT_EXCEEDED", message, { cause: error });
  }
  if (/worker/i.test(message)) return new RuntimeError("WORKER_CRASHED", message, { cause: error });
  return new RuntimeError(fallbackCode, message, { cause: error });
}
