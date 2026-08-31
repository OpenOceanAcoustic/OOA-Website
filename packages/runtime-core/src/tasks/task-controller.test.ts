import { describe, expect, it } from "vitest";
import { TaskController } from "./task-controller";

describe("TaskController", () => {
  it("cancels the previous task and marks its late result stale", async () => {
    const controller = new TaskController();
    let finishFirst!: (value: string) => void;
    const first = controller.run(() => new Promise<string>((resolve) => {
      finishFirst = resolve;
    }));
    const second = controller.run(async () => "new result");
    finishFirst("old result");

    await expect(second).resolves.toEqual({ status: "completed", value: "new result" });
    await expect(first).resolves.toEqual({ status: "stale" });
  });

  it("exposes cancellation to the active task", async () => {
    const controller = new TaskController();
    const active = controller.run(({ signal }) => new Promise<string>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    }));
    controller.cancel("route changed");

    await expect(active).resolves.toEqual({ status: "cancelled", reason: "route changed" });
  });
});
