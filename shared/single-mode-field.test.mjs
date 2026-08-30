import assert from "node:assert/strict";
import test from "node:test";

import { synthesizeSingleModeField } from "../normal-mode/single-mode-field.js";

function fixture(wavenumbers = [1, 0, 2, -0.1]) {
  return {
    environment: { sourceDepthM: 50 },
    modes: {
      count: 2,
      depthsM: new Float64Array([0, 100]),
      horizontalWavenumbersInterleaved: new Float64Array(wavenumbers),
      modeShapesInterleaved: new Float64Array([
        1, 0, 1, 0,
        0.5, 0, 1.5, 0,
      ]),
    },
    field: {
      rows: 3,
      columns: 3,
      depthsM: new Float64Array([0, 50, 100]),
      rangesKm: new Float64Array([0.001, 0.002, 0.004]),
    },
  };
}

test("synthesizes Mode 1 on the declared field grid without normalization", () => {
  const field = synthesizeSingleModeField(fixture(), 0);
  assert.equal(field.modeNumber, 1);
  assert.equal(field.rows, 3);
  assert.equal(field.columns, 3);
  assert.equal(field.tlDb.length, 9);
  assert.ok(Array.from(field.tlDb).every(Number.isFinite));

  // With a constant mode shape and real k, only cylindrical spreading changes TL.
  const oneMetre = field.tlDb[0];
  const fourMetres = field.tlDb[2];
  assert.ok(Math.abs((fourMetres - oneMetre) - 20 * Math.log10(2)) < 1e-5);
});

test("supports an arbitrary higher mode and complex-k attenuation", () => {
  const field = synthesizeSingleModeField(fixture(), 1);
  assert.equal(field.modeNumber, 2);
  assert.deepEqual(field.horizontalWavenumber, { real: 2, imaginary: -0.1 });
  assert.ok(Array.from(field.tlDb).every(Number.isFinite));

  const oneMetre = field.tlDb[0];
  const fourMetres = field.tlDb[2];
  const expectedIncrease = 20 * Math.log10(2) + 20 * 0.1 * 3 / Math.LN10;
  assert.ok(Math.abs((fourMetres - oneMetre) - expectedIncrease) < 1e-4);

  // Receiver mode-shape interpolation is complex-linear and changes level by depth.
  assert.ok(field.tlDb[0] > field.tlDb[6]);
});

test("rejects a mode outside the returned spectrum", () => {
  assert.throws(() => synthesizeSingleModeField(fixture(), 2), /modeIndex/);
});
