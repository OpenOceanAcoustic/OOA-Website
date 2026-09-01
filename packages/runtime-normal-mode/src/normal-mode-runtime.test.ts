import { describe, expect, it, vi } from "vitest";
import { ENVIRONMENT_PRESETS } from "@ooa/environment";
import { createNormalModeRuntime } from "./index";
import type { NormalModePageRequest, NormalModePageResult, NormalModeRuntimeAdapter } from "./public-types";

const info = {
  packageName: "@openocean/field-normal-mode-kraken",
  packageVersion: "2.0.0",
  model: "Kraken fake",
  executionMode: "SINGLE_THREAD",
  threadCount: 1,
  memoryLimitBytes: 1024,
} as const;

describe("Normal Mode Runtime interface", () => {
  it("uses the injected adapter and disposes it once", async () => {
    const dispose = vi.fn(async () => undefined);
    const adapter: NormalModeRuntimeAdapter = {
      prepare: async () => info,
      importEnvironment: async () => ({
        sourceId: "source-1",
        environment: ENVIRONMENT_PRESETS.pekeris,
        documents: [{ name: "fixture.json", kind: "json" }],
        title: "fixture",
        frequencyHz: 100,
        waterDepthM: 200,
        sourceDepthM: 50,
        maximumRangeKm: 20,
        profilePoints: [[0, 1500], [200, 1500]],
        modelHints: {},
      }),
      run: vi.fn(async () => { throw new Error("not needed by this lifecycle test"); }),
      cancel: vi.fn(),
      dispose,
    };
    const runtime = createNormalModeRuntime({ adapter });
    await expect(runtime.prepare()).resolves.toEqual(info);
    await expect(runtime.importEnvironment([])).resolves.toMatchObject({ sourceId: "source-1" });
    await runtime.dispose();
    await runtime.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});

it("rejects a stale Normal Mode result after a newer request", async () => {
  let finishFirst!: (value: Omit<NormalModePageResult, "experimentId">) => void;
  const first = new Promise<Omit<NormalModePageResult, "experimentId">>((resolve) => { finishFirst = resolve; });
  const adapter = {
    prepare: async () => info,
    importEnvironment: vi.fn(),
    run: vi.fn()
      .mockImplementationOnce(async () => first)
      .mockResolvedValueOnce({ contractVersion: 1 } as Omit<NormalModePageResult, "experimentId">),
    cancel: vi.fn(),
    dispose: vi.fn(async () => undefined),
  } satisfies NormalModeRuntimeAdapter;
  const runtime = createNormalModeRuntime({ adapter });
  const stale = runtime.run({} as NormalModePageRequest);
  const latest = runtime.run({} as NormalModePageRequest);
  await expect(latest).resolves.toMatchObject({ experimentId: "normal-2" });
  finishFirst({ contractVersion: 1 } as Omit<NormalModePageResult, "experimentId">);
  await expect(stale).rejects.toMatchObject({ code: "CANCELLED" });
  expect(adapter.cancel).toHaveBeenCalledWith("superseded");
});

it("caches a synthesized single-mode field within its owning experiment", async () => {
  const rangesKm = new Float64Array([1, 2]);
  const depthsM = new Float64Array([0, 100]);
  const field = { rows: 2, columns: 2, rangesKm, depthsM, tlDb: new Float32Array(4), activeModeCount: 1 };
  const result = {
    contractVersion: 1,
    runtime: { mode: "wasm", engine: "fake", fallback: false, computeMs: 1 },
    environment: {
      profile: "fixture", waterDepthM: 100, sourceDepthM: 50, frequencyHz: 100,
      depthsM, soundSpeedMps: new Float64Array([1500, 1500]),
    },
    modes: {
      count: 1,
      depthsM,
      horizontalWavenumbersInterleaved: new Float64Array([1, 0]),
      groupVelocityMps: new Float64Array([1500]),
      modeShapesInterleaved: new Float64Array([1, 0, 1, 0]),
    },
    field,
    fullField: field,
    deltaField: { rows: 2, columns: 2, rangesKm, depthsM, values: new Float32Array(4) },
    metrics: { deltaRmsDb: 0, deltaMaxDb: 0 },
  } as Omit<NormalModePageResult, "experimentId">;
  const adapter = {
    prepare: async () => info,
    importEnvironment: vi.fn(),
    run: vi.fn(async () => result),
    cancel: vi.fn(),
    dispose: vi.fn(async () => undefined),
  } satisfies NormalModeRuntimeAdapter;
  const runtime = createNormalModeRuntime({ adapter });
  const experiment = await runtime.run({} as NormalModePageRequest);

  const first = runtime.singleModeField(experiment.experimentId, 0);
  expect(runtime.singleModeField(experiment.experimentId, 0)).toBe(first);
  await runtime.dispose();
  expect(() => runtime.singleModeField(experiment.experimentId, 0)).toThrow(/已释放/);
});
