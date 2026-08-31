import { describe, expect, it, vi } from "vitest";
import { createRayRuntime } from "./index";
import type { RayPageRequest, RayPageResult, RayRuntimeAdapter } from "./public-types";

const info = {
  packageName: "@openocean/field-bellhop-2d",
  packageVersion: "2.0.0",
  model: "Bellhop2D fake",
  executionMode: "SINGLE_THREAD",
  threadCount: 1,
  memoryLimitBytes: 1024,
} as const;

describe("Ray Runtime interface", () => {
  it("owns one injected adapter and disposes it once", async () => {
    const dispose = vi.fn(async () => undefined);
    const adapter: RayRuntimeAdapter = {
      prepare: async () => info,
      importEnvironment: vi.fn(async () => { throw new Error("not needed by this lifecycle test"); }),
      runField: vi.fn(async () => { throw new Error("not needed by this lifecycle test"); }),
      findEigenrays: vi.fn(async () => { throw new Error("not needed by this lifecycle test"); }),
      cancel: vi.fn(),
      dispose,
    };
    const runtime = createRayRuntime({ adapter });
    await expect(runtime.prepare()).resolves.toEqual(info);
    runtime.cancel("new request");
    expect(adapter.cancel).toHaveBeenCalledWith("new request");
    await runtime.dispose();
    await runtime.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});

it("rejects a stale Ray result after a newer request", async () => {
  let finishFirst!: (value: RayPageResult) => void;
  const first = new Promise<RayPageResult>((resolve) => { finishFirst = resolve; });
  const adapter = {
    prepare: async () => info,
    importEnvironment: vi.fn(),
    runField: vi.fn()
      .mockImplementationOnce(async () => first)
      .mockResolvedValueOnce({ engine: "fake" } as RayPageResult),
    findEigenrays: vi.fn(),
    cancel: vi.fn(),
    dispose: vi.fn(async () => undefined),
  } satisfies RayRuntimeAdapter;
  const runtime = createRayRuntime({ adapter });
  const stale = runtime.runField({} as RayPageRequest);
  const latest = runtime.runField({} as RayPageRequest);
  await expect(latest).resolves.toMatchObject({ engine: "fake" });
  finishFirst({ engine: "stale" } as RayPageResult);
  await expect(stale).rejects.toMatchObject({ code: "CANCELLED" });
  expect(adapter.cancel).toHaveBeenCalledWith("superseded");
});
