import { ENVIRONMENT_PRESETS } from "@ooa/environment";
import { describe, expect, it, vi } from "vitest";
import { createNormalModeRuntime, type NormalModeSdkAdapter } from "./index";

describe("NormalModeRuntime contract", () => {
  it("runs only Kraken and disposes its adapter", async () => {
    const modeShapesInterleaved = new Float64Array([1, 0, 0.5, 0]);
    const adapter: NormalModeSdkAdapter = {
      info: { packageName: "@openocean/field-normal-mode-kraken", packageVersion: "2.0.0", model: "Kraken", executionMode: "SINGLE_THREAD", threadCount: 1, memoryLimitBytes: 0 },
      run: vi.fn(async () => ({
        sourceDepthM: 50,
        receiverRangesM: new Float64Array([0, 1000]), receiverDepthsM: new Float64Array([0, 200]),
        transmissionLossDb: new Float32Array([0, 1, 2, 3]), modeCounts: new Uint32Array([1]),
        depthCounts: new Uint32Array([2]), depthOffsets: new Uint32Array([0, 2]),
        shapeOffsets: new Uint32Array([0, 2]), wavenumberOffsets: new Uint32Array([0, 1]),
        depthsM: new Float64Array([0, 200]), wavenumbersInterleaved: new Float64Array([1, 0]),
        groupVelocityMps: new Float64Array([1500]), modeShapesInterleaved, totalTimeMs: 3,
      })),
      cancel: vi.fn(), dispose: vi.fn(async () => undefined),
    };
    const runtime = createNormalModeRuntime({ loadSdk: async () => adapter });
    const request = {
      environment: ENVIRONMENT_PRESETS.pekeris, sourceDepthM: 50,
      receiverRangesM: new Float64Array([0, 1000]), receiverDepthsM: new Float64Array([0, 200]),
      modeLimit: 20, meshPoints: 200,
    };
    const result = await runtime.run(request);
    expect(await runtime.run(request)).toBe(result);
    expect(adapter.run).toHaveBeenCalledOnce();
    expect(result.modeShapesInterleaved).toBe(modeShapesInterleaved);
    await runtime.dispose();
    expect(adapter.dispose).toHaveBeenCalledOnce();
  });
});
