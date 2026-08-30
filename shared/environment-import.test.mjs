import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseBellhopEnvironment,
  parseEnvironmentDocuments,
  parseEnvironmentFiles,
  parseEnvironmentJson,
} from "./environment-import.js";

const fixtureStem = new URL("../tests/Pos1_SD200_100.0Hz_0IB", import.meta.url);

async function fixture(extension) {
  return readFile(new URL(`${fixtureStem.pathname}${extension}`, import.meta.url), "utf8");
}

test("parses Bellhop ENV with range-dependent SSP and bathymetry sidecars", async () => {
  const [env, ssp, bty] = await Promise.all([fixture(".env"), fixture(".ssp"), fixture(".bty")]);
  const result = parseEnvironmentDocuments([
    { name: "Pos1_SD200_100.0Hz_0IB.env", data: env },
    { name: "Pos1_SD200_100.0Hz_0IB.ssp", data: ssp },
    { name: "Pos1_SD200_100.0Hz_0IB.bty", data: bty },
  ]);

  assert.equal(result.title, "Acoustic Calculation");
  assert.equal(result.format, "bellhop-env");
  assert.equal(result.frequencyHz, 100);
  assert.equal(result.sourceDepthM, 200);
  assert.equal(result.waterDepthM, 5956);
  assert.equal(result.maximumRangeKm, 29);
  assert.equal(result.bottomSoundSpeedMps, 1600);
  assert.equal(result.bottomDensityKgM3, 1600);
  assert.equal(result.bottomAttenuationDbPerWavelength, 0.1);
  assert.deepEqual(result.angleRangeDegrees, [-90, 90]);
  assert.equal(result.beamCount, 10000);
  assert.equal(result.rangeDependent, true);
  assert.deepEqual(result.profilePoints[0], [0, 1543.4]);
  assert.deepEqual(result.profilePoints.at(-1), [5956, 1557.9]);
  assert.equal(result.bathymetry.length, 30);
  assert.deepEqual(result.bathymetry[0], [0, 5944]);
  assert.deepEqual(result.bathymetry.at(-1), [29.293332, 5781.850437]);
});

test("Bellhop ENV remains usable without optional sidecars", async () => {
  const result = parseBellhopEnvironment(await fixture(".env"));
  assert.deepEqual(result.profilePoints[0], [0, 1543.36]);
  assert.deepEqual(result.profilePoints.at(-1), [5956, 1557.94]);
  assert.deepEqual(result.bathymetry, [[0, 5956], [29, 5956]]);
  assert.equal(result.rangeDependent, false);
});

test("normalizes existing snake_case and nested JSON fields", () => {
  const result = parseEnvironmentJson({
    name: "JSON Pekeris",
    frequency_hz: 250,
    source_depth_m: 40,
    maximum_range_km: 12,
    maximum_depth_m: 200,
    sound_speed_depths_m: [0, 100, 200],
    sound_speed_m_s: [1500, 1495, 1500],
    bottom_sound_speed_m_s: 1750,
    bottom_density_relative: 1.9,
    bottom_attenuation_db_per_wavelength: 0.25,
    angle_range_degrees: [-30, 35],
    n_beams: 500,
    bathymetry: [[0, 200], [12, 230]],
  });

  assert.equal(result.title, "JSON Pekeris");
  assert.equal(result.format, "json");
  assert.deepEqual(result.profilePoints, [[0, 1500], [100, 1495], [200, 1500]]);
  assert.equal(result.bottomDensityKgM3, 1900);
  assert.deepEqual(result.bathymetry, [[0, 200], [12, 230]]);
});

test("accepts a direct sound_speed_profile point array", () => {
  const result = parseEnvironmentJson({
    title: "Direct profile",
    sound_speed_profile: [[0, 1500], [200, 1498]],
  });
  assert.deepEqual(result.profilePoints, [[0, 1500], [200, 1498]]);
  assert.equal(result.waterDepthM, 200);
});

test("normalizes native Bellhop-shaped nested JSON", () => {
  const result = parseEnvironmentJson({
    environment: {
      title: "Native input",
      frequencyHz: 50,
      ssp: { depthsM: [0, 500], compressionalSpeedMps: [1510, 1490] },
      boundary: {
        bottom: {
          halfspace: {
            compressionalSpeedMps: 1650,
            densityRelative: 1.7,
            compressionalAttenuation: 0.2,
          },
          points: [{ rangeM: 0, depthM: 500 }, { rangeM: 10_000, depthM: 520 }],
        },
      },
    },
    source: {
      depths: { encoding: "LINEAR", start: 100, end: 100, count: 1 },
      launchAngles: { encoding: "LINEAR", start: -0.2, end: 0.2, count: 301 },
      launchAnglesAreRadians: true,
    },
    receivers: { ranges: { encoding: "LINEAR", start: 0, end: 10_000, count: 101 } },
    options: { beam: { maximumRangeM: 10_000 } },
  });

  assert.equal(result.sourceDepthM, 100);
  assert.equal(result.maximumRangeKm, 10);
  assert.equal(result.bottomDensityKgM3, 1700);
  assert.equal(result.beamCount, 301);
  assert.ok(Math.abs(result.angleRangeDegrees[0] + 11.4591559) < 1e-6);
  assert.deepEqual(result.bathymetry, [[0, 500], [10, 520]]);
});

test("selects the native 2D SSP column nearest zero range", () => {
  const result = parseEnvironmentJson({
    title: "Native 2D SSP",
    environment: {
      frequencyHz: 100,
      ssp: {
        depthsM: [0, 200],
        rangesM: [-5000, 0, 5000],
        soundSpeedMps: [1510, 1511, 1500, 1501, 1490, 1491],
      },
    },
  });
  assert.deepEqual(result.profilePoints, [[0, 1500], [200, 1501]]);
});

test("rejects unsorted profiles and endpoint mismatches", () => {
  assert.throws(() => parseEnvironmentJson({
    profile_points: [[0, 1500], [100, 1490], [80, 1500]],
    water_depth_m: 80,
  }), /strictly increasing/);
  assert.throws(() => parseEnvironmentJson({
    profile_points: [[10, 1500], [100, 1490]],
    water_depth_m: 100,
  }), /start at 0 m/);
  assert.throws(() => parseEnvironmentJson({
    profile_points: [[0, 1500], [100, 1490]],
    water_depth_m: 120,
  }), /end at waterDepthM/);
});

test("browser File-like API delegates to the same pure parser", async () => {
  const result = await parseEnvironmentFiles([{
    name: "small.json",
    size: 128,
    async text() {
      return JSON.stringify({
        title: "Small",
        profilePoints: [[0, 1500], [200, 1500]],
        waterDepthM: 200,
      });
    },
  }]);
  assert.equal(result.title, "Small");
  assert.equal(result.frequencyHz, 100);
  assert.deepEqual(result.bathymetry, [[0, 200], [20, 200]]);
});

test("documented Pekeris JSON and ENV examples stay importable", async () => {
  const [json, env] = await Promise.all([
    readFile(new URL("../tests/Pekeris.environment.json", import.meta.url), "utf8"),
    readFile(new URL("../tests/Pekeris.env", import.meta.url), "utf8"),
  ]);
  const fromJson = parseEnvironmentDocuments([{ name: "Pekeris.environment.json", data: json }]);
  const fromEnv = parseEnvironmentDocuments([{ name: "Pekeris.env", data: env }]);
  assert.equal(fromJson.title, "Pekeris JSON Example");
  assert.equal(fromEnv.title, "Pekeris Browser Test");
  assert.deepEqual(fromJson.profilePoints, fromEnv.profilePoints);
  assert.equal(fromJson.bottomDensityKgM3, 1800);
  assert.equal(fromEnv.bottomDensityKgM3, 1800);
});

test("sloped JSON preserves terrain, launch angles, and beam count", async () => {
  const json = await readFile(new URL("../tests/Slope.environment.json", import.meta.url), "utf8");
  const result = parseEnvironmentDocuments([{ name: "Slope.environment.json", data: json }]);
  assert.deepEqual(result.bathymetry, [[0, 240], [10, 200], [20, 250]]);
  assert.deepEqual(result.angleRangeDegrees, [-35, 30]);
  assert.equal(result.beamCount, 600);
});
