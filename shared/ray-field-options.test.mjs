import assert from "node:assert/strict";
import test from "node:test";

import {
  FIELD_BEAM_TYPES,
  normalizeFieldBeamType,
  normalizeFieldRunMode,
} from "../wasm-adapter.js";

test("Ray TL exposes the five browser field beam types", () => {
  assert.deepEqual(FIELD_BEAM_TYPES, [
    "GEOMETRIC_CARTESIAN",
    "GEOMETRIC_RAY_CENTERED",
    "GAUSSIAN_CARTESIAN",
    "GAUSSIAN_RAY_CENTERED",
    "GAUSSIAN_SIMPLE",
  ]);
});

test("precise eigenray cannot leak into the regular TL beam selector", () => {
  assert.equal(normalizeFieldBeamType("PRECISE_EIGENRAY"), "GEOMETRIC_CARTESIAN");
  assert.equal(normalizeFieldBeamType("CERVENY_CARTESIAN"), "GEOMETRIC_CARTESIAN");
  assert.equal(normalizeFieldBeamType("GAUSSIAN_SIMPLE"), "GAUSSIAN_SIMPLE");
});

test("field mode accepts only coherent and incoherent TL", () => {
  assert.equal(normalizeFieldRunMode("coherent"), "COHERENT_TL");
  assert.equal(normalizeFieldRunMode("INCOHERENT_TL"), "INCOHERENT_TL");
  assert.equal(normalizeFieldRunMode("SEMICOHERENT_TL"), "INCOHERENT_TL");
});
