import { describe, expect, it } from "vitest";
import { synthesizeSingleModeField, type NormalModeResult } from "./index";

function fixture(): NormalModeResult {
  return {
    sourceDepthM: 50,
    receiverRangesM: new Float64Array([1, 2, 4]),
    receiverDepthsM: new Float64Array([0, 50, 100]),
    transmissionLossDb: new Float32Array(9),
    modeCounts: new Uint32Array([2]),
    depthCounts: new Uint32Array([2]),
    depthOffsets: new Uint32Array([0, 2]),
    shapeOffsets: new Uint32Array([0, 4]),
    wavenumberOffsets: new Uint32Array([0, 2]),
    depthsM: new Float64Array([0, 100]),
    wavenumbersInterleaved: new Float64Array([1, 0, 2, -0.1]),
    groupVelocityMps: new Float64Array([1500, 1490]),
    modeShapesInterleaved: new Float64Array([1, 0, 1, 0, 0.5, 0, 1.5, 0]),
    totalTimeMs: 1,
  };
}

describe("single-mode synthesis", () => {
  it("uses cylindrical spreading without normalizing the returned field", () => {
    const field = synthesizeSingleModeField(fixture(), 0);
    expect(field.modeNumber).toBe(1);
    expect(field.transmissionLossDb).toHaveLength(9);
    expect(Array.from(field.transmissionLossDb).every(Number.isFinite)).toBe(true);
    expect((field.transmissionLossDb[2] ?? 0) - (field.transmissionLossDb[0] ?? 0))
      .toBeCloseTo(20 * Math.log10(2), 4);
  });

  it("supports a complex wavenumber and rejects unavailable modes", () => {
    const field = synthesizeSingleModeField(fixture(), 1);
    expect(field.horizontalWavenumber).toEqual({ real: 2, imaginary: -0.1 });
    expect(() => synthesizeSingleModeField(fixture(), 2)).toThrow(/modeIndex/);
  });
});
