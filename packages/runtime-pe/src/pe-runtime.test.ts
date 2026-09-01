import { describe, expect, it, vi } from "vitest";
import { ENVIRONMENT_PRESETS } from "@ooa/environment";
import { createPeRuntime } from "./index";
import type { PePageRequest, PePageResult, PeRuntimeAdapter } from "./public-types";

const info = {
  packageName: "@openocean/field-pe-ram",
  packageVersion: "2.0.0",
  model: "RAM fake",
  executionMode: "SINGLE_THREAD",
  threadCount: 1,
  memoryLimitBytes: 1024,
} as const;

describe("PE Runtime interface", () => {
  it("owns one injected adapter and disposes it once", async () => {
    const dispose = vi.fn(async () => undefined);
    const adapter: PeRuntimeAdapter = {
      prepare: async () => info,
      importEnvironment: async () => ({
        sourceId: "source-1", title: "fixture", frequencyHz: 100,
        environment: ENVIRONMENT_PRESETS.pekeris,
        documents: [{ name: "fixture.json", kind: "json" }],
        sourceDepthM: 50, waterDepthM: 200, maximumRangeKm: 20,
        maximumDepthM: 300, rangeStepM: 25, depthStepM: 2, nPade: 4,
        profilePoints: [[0, 1500], [200, 1500]], bathymetry: [[0, 200], [20, 200]],
        modelHints: {},
      }),
      run: vi.fn(async () => { throw new Error("not needed by this lifecycle test"); }),
      cancel: vi.fn(),
      dispose,
    };
    const runtime = createPeRuntime({ adapter });
    await expect(runtime.prepare()).resolves.toEqual(info);
    await expect(runtime.importEnvironment([])).resolves.toMatchObject({ sourceId: "source-1" });
    await runtime.dispose();
    await runtime.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});

it("rejects a stale PE result after a newer request", async () => {
  let finishFirst!: (value: Omit<PePageResult, "experimentId">) => void;
  const first = new Promise<Omit<PePageResult, "experimentId">>((resolve) => { finishFirst = resolve; });
  const adapter = {
    prepare: async () => info,
    importEnvironment: vi.fn(),
    run: vi.fn()
      .mockImplementationOnce(async () => first)
      .mockResolvedValueOnce({ contractVersion: 1 } as Omit<PePageResult, "experimentId">),
    cancel: vi.fn(),
    dispose: vi.fn(async () => undefined),
  } satisfies PeRuntimeAdapter;
  const runtime = createPeRuntime({ adapter });
  const stale = runtime.run({} as PePageRequest);
  const latest = runtime.run({} as PePageRequest);
  await expect(latest).resolves.toMatchObject({ experimentId: "pe-2" });
  finishFirst({ contractVersion: 1 } as Omit<PePageResult, "experimentId">);
  await expect(stale).rejects.toMatchObject({ code: "CANCELLED" });
  expect(adapter.cancel).toHaveBeenCalledWith("superseded");
});

it("serves vertical profiles from the retained experiment and reuses the adapter for Padé selection", async () => {
  const request = { nPade: 4 } as PePageRequest;
  const rangesKm = new Float64Array([0, 10]);
  const depthsM = new Float64Array([0, 100]);
  const result = {
    contractVersion: 1,
    parameters: request,
    field: { rows: 2, columns: 2, rangesKm, depthsM, tlDb: new Float32Array([1, 2, 3, 4]) },
    referenceField: { rows: 2, columns: 2, rangesKm, depthsM, tlDb: new Float32Array([5, 6, 7, 8]) },
  } as Omit<PePageResult, "experimentId">;
  const adapter = {
    prepare: async () => info,
    importEnvironment: vi.fn(),
    run: vi.fn(async () => result),
    cancel: vi.fn(),
    dispose: vi.fn(async () => undefined),
  } satisfies PeRuntimeAdapter;
  const runtime = createPeRuntime({ adapter });
  const experiment = await runtime.run(request);

  const profile = runtime.verticalProfile(experiment.experimentId, 9);
  expect(profile.rangeKm).toBe(10);
  expect(profile.currentTlDb).toEqual(new Float32Array([2, 4]));
  expect(profile.referenceTlDb).toEqual(new Float32Array([6, 8]));

  await runtime.selectPadeField(experiment.experimentId, 7);
  expect(adapter.run).toHaveBeenLastCalledWith(expect.objectContaining({ nPade: 7 }));
});
