import type { RuntimeInfo } from "../diagnostics/runtime-info";

export interface RuntimeLifecycle {
  prepare(): Promise<RuntimeInfo>;
  cancel(reason?: string): void;
  dispose(): Promise<void>;
}
