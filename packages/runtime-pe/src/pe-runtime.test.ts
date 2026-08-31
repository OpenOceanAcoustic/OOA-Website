import { ENVIRONMENT_PRESETS } from "@ooa/environment";
import { describe, expect, it, vi } from "vitest";
import { createPeRuntime, type PeSdkAdapter } from "./index";

describe("PeRuntime contract", () => {
  it("runs only RAM and keeps the field buffers intact", async () => {
    const transmissionLossDb = new Float32Array([20, 21]);
    const adapter: PeSdkAdapter = {
      info: { packageName: "@openocean/field-pe-ram", packageVersion: "2.0.0", model: "RAM", executionMode: "SINGLE_THREAD", threadCount: 1, memoryLimitBytes: 0 },
      run: vi.fn(async () => ({
        receiverRangesM: new Float64Array([0, 10]), receiverDepthsM: new Float64Array([100]),
        transmissionLossDb, validityMask: new Uint8Array([1, 1]),
        lineRangesM: new Float64Array([0, 10]), lineTransmissionLossDb: new Float32Array([20, 21]),
        totalTimeMs: 2,
      })),
      cancel: vi.fn(), dispose: vi.fn(async () => undefined),
    };
    const runtime = createPeRuntime({ loadSdk: async () => adapter });
    const result = await runtime.run({
      environment: ENVIRONMENT_PRESETS.munk, sourceDepthM: 1000, maximumRangeM: 1000,
      maximumDepthM: 5000, receiverDepthsM: new Float64Array([100]), rangeStepM: 10,
      depthStepM: 5, rangeDecimation: 1, depthDecimation: 1, nPade: 4,
    });
    expect(result.transmissionLossDb).toBe(transmissionLossDb);
  });
});
