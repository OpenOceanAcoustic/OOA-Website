import { cancellationReason } from "./cancellation";
import { LatestRequest } from "./latest-request";

export interface TaskContext {
  readonly requestId: number;
  readonly signal: AbortSignal;
}

export type TaskOutcome<T> =
  | { readonly status: "completed"; readonly value: T }
  | { readonly status: "cancelled"; readonly reason: string }
  | { readonly status: "stale" };

export class TaskController {
  readonly #requests = new LatestRequest();
  #active: AbortController | null = null;

  async run<T>(execute: (context: TaskContext) => Promise<T>): Promise<TaskOutcome<T>> {
    this.#active?.abort("superseded");
    const requestId = this.#requests.next();
    const controller = new AbortController();
    this.#active = controller;

    try {
      const value = await execute({ requestId, signal: controller.signal });
      if (!this.#requests.isLatest(requestId)) return { status: "stale" };
      if (controller.signal.aborted) {
        return { status: "cancelled", reason: cancellationReason(controller.signal) };
      }
      return { status: "completed", value };
    } catch (error) {
      if (!this.#requests.isLatest(requestId)) return { status: "stale" };
      if (controller.signal.aborted) {
        return { status: "cancelled", reason: cancellationReason(controller.signal) };
      }
      throw error;
    } finally {
      if (this.#active === controller) this.#active = null;
    }
  }

  cancel(reason = "cancelled"): void {
    this.#active?.abort(reason);
  }
}
