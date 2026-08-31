import { ENVIRONMENT_PRESETS } from "@ooa/environment";
import { describe, expect, it, vi } from "vitest";
import { createRayRuntime, type RaySdkAdapter } from "./index";

describe("RayRuntime contract", () => {
  it("keeps typed-array results and delegates lifecycle to one SDK adapter", async () => {
    const transmissionLossDb = new Float64Array([42, 43]);
    const adapter: RaySdkAdapter = {
      info: {
        packageName: "@openocean/field-bellhop-2d",
        packageVersion: "2.0.0",
        model: "Bellhop2D",
        executionMode: "SINGLE_THREAD",
        threadCount: 1,
        memoryLimitBytes: 0,
      },
      run: vi.fn(async () => ({
        kind: "field" as const,
        receiverRangesM: new Float64Array([100, 200]),
        receiverDepthsM: new Float64Array([50]),
        transmissionLossDb,
        validityMask: new Uint8Array([1, 1]),
        totalTimeMs: 4,
      })),
      cancel: vi.fn(),
      dispose: vi.fn(async () => undefined),
    };
    const runtime = createRayRuntime({ loadSdk: async () => adapter });
    await runtime.prepare();
    const result = await runtime.runField({
      environment: ENVIRONMENT_PRESETS.pekeris,
      sourceDepthM: 50,
      receiverRangesM: new Float64Array([100, 200]),
      receiverDepthsM: new Float64Array([50]),
      launchAnglesDegrees: [-20, 20],
      beamCount: 101,
      beamType: "gaussian-cartesian",
      fieldMode: "coherent",
      velocityEnabled: false,
    });

    expect(result.transmissionLossDb).toBe(transmissionLossDb);
    runtime.cancel("new request");
    expect(adapter.cancel).toHaveBeenCalledWith("new request");
    await runtime.dispose();
    expect(adapter.dispose).toHaveBeenCalledOnce();
  });
});
