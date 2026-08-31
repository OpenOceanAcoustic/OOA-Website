import { MemoryBudget } from "@ooa/runtime-core";

export function assertRayMemoryFits(estimatedBytes: number, limitBytes: number): void {
  new MemoryBudget(limitBytes).assertFits(estimatedBytes);
}
