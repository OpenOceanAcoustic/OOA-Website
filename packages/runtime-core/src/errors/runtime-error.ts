export type RuntimeErrorCode =
  | "LOCAL_PACKAGE_MISSING"
  | "SDK_LOAD_FAILED"
  | "WASM_LOAD_FAILED"
  | "CROSS_ORIGIN_ISOLATION_REQUIRED"
  | "INPUT_INVALID"
  | "MEMORY_LIMIT_EXCEEDED"
  | "RUN_FAILED"
  | "WORKER_CRASHED"
  | "CANCELLED";

export class RuntimeError extends Error {
  readonly code: RuntimeErrorCode;
  override readonly cause?: unknown;

  constructor(code: RuntimeErrorCode, message: string, options: { readonly cause?: unknown } = {}) {
    super(message);
    this.name = "RuntimeError";
    this.code = code;
    if ("cause" in options) this.cause = options.cause;
  }
}
