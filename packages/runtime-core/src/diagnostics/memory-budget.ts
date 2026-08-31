import { RuntimeError } from "../errors/runtime-error";

export class MemoryBudget {
  constructor(readonly limitBytes: number) {}

  assertFits(estimatedBytes: number): void {
    if (this.limitBytes > 0 && estimatedBytes > this.limitBytes) {
      throw new RuntimeError(
        "MEMORY_LIMIT_EXCEEDED",
        `预计需要 ${estimatedBytes} bytes，超过运行上限 ${this.limitBytes} bytes`,
      );
    }
  }
}
