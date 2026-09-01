import { describe, expect, it } from "vitest";
import type { NormalModePageResult } from "./public-types";
import { synthesizeSingleModeField } from "./single-mode-field";

function fixture(): NormalModePageResult {
  const rangesKm = new Float64Array([1, 2, 4]);
  const fieldDepthsM = new Float64Array([0, 50, 100]);
  const field = {
    rows: 3,
    columns: 3,
    rangesKm,
    depthsM: fieldDepthsM,
    tlDb: new Float32Array(9),
    activeModeCount: 2,
  };
  return {
    experimentId: "normal-fixture",
    contractVersion: 1,
    runtime: { mode: "wasm", engine: "fake", fallback: false, computeMs: 1 },
    environment: {
      profile: "fixture",
      waterDepthM: 100,
      sourceDepthM: 50,
      frequencyHz: 100,
      depthsM: fieldDepthsM,
      soundSpeedMps: new Float64Array([1500, 1500, 1500]),
    },
    modes: {
      count: 2,
      depthsM: new Float64Array([0, 100]),
      horizontalWavenumbersInterleaved: new Float64Array([1, 0, 2, -0.1]),
      groupVelocityMps: new Float64Array([1500, 1490]),
      modeShapesInterleaved: new Float64Array([1, 0, 1, 0, 0.5, 0, 1.5, 0]),
    },
    field,
    fullField: field,
    deltaField: { rows: 3, columns: 3, rangesKm, depthsM: fieldDepthsM, values: new Float32Array(9) },
    metrics: { deltaRmsDb: 0, deltaMaxDb: 0 },
  };
}

describe("single-mode synthesis", () => {
  it("uses cylindrical spreading without normalizing the field", () => {
    const field = synthesizeSingleModeField(fixture(), 0);
    expect(field.modeNumber).toBe(1);
    expect(field.tlDb).toHaveLength(9);
    expect(Array.from(field.tlDb).every(Number.isFinite)).toBe(true);
    expect((field.tlDb[2] ?? 0) - (field.tlDb[0] ?? 0)).toBeCloseTo(20 * Math.log10(2), 4);
  });

  it("supports complex wavenumbers and rejects unavailable modes", () => {
    expect(synthesizeSingleModeField(fixture(), 1).horizontalWavenumber)
      .toEqual({ real: 2, imaginary: -0.1 });
    expect(() => synthesizeSingleModeField(fixture(), 2)).toThrow(/modeIndex/);
  });
});
