import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { importEnvironmentDocuments, inferEnvironmentDocumentKind, validateEnvironment } from "./index";

const fixture = (name: string) => readFile(resolve(import.meta.dirname, "../../../tests/fixtures", name), "utf8");

describe("environment public interface", () => {
  it("imports the unified JSON document without losing model metadata", async () => {
    const imported = await importEnvironmentDocuments([{
      name: "pekeris.environment.json",
      kind: "json",
      content: JSON.stringify({
        title: "Pekeris",
        profilePoints: [[0, 1500], [200, 1500]],
        waterDepthM: 200,
        frequencyHz: 100,
        sourceDepthM: 50,
        maximumRangeKm: 20,
        bathymetry: [[0, 200], [20, 220]],
      }),
    }]);

    expect(imported.environment.title).toBe("Pekeris");
    expect(imported.environment.soundSpeedProfile).toEqual([
      { depthM: 0, speedMps: 1500 },
      { depthM: 200, speedMps: 1500 },
    ]);
    expect(imported.modelHints).toMatchObject({ sourceDepthM: 50, maximumRangeKm: 20 });
    expect(imported.environment.bathymetry).toEqual([
      { rangeM: 0, depthM: 200 },
      { rangeM: 20_000, depthM: 220 },
    ]);
  });

  it("imports a current FieldDocument through the public interface", async () => {
    const imported = await importEnvironmentDocuments([{
      name: "field-case.json",
      kind: "json",
      content: JSON.stringify({
        documentInfo: { formatRevision: 4 },
        parameters: {
          title: "FieldCase",
          source: { frequenciesHz: [80], pointsNedMeters: [[0, 0, 30]] },
          receiver: { geometry: { pointsNedMeters: [[0, 10_000, 50]] } },
          waterColumn: {
            profile: {
              soundSpeed: {
                depthsMeters: [0, 200],
                values: [1490, 1510],
              },
            },
          },
          seabed: {
            geometry: { rangesMeters: [0, 10_000], depthsMeters: [200, 220] },
            condition: {
              material: {
                compressionalSoundSpeed: { value: 1700 },
                density: { value: 1800 },
                compressionalAttenuation: { value: 0.5 },
              },
            },
          },
        },
        runs: [],
      }),
    }]);

    expect(imported.environment).toMatchObject({
      title: "FieldCase",
      frequencyHz: 80,
      waterDepthM: 200,
    });
    expect(imported.environment.bathymetry.at(-1)).toEqual({ rangeM: 10_000, depthM: 220 });
    expect(imported.modelHints).toMatchObject({ format: "field-document-v4", sourceDepthM: 30, maximumRangeKm: 10 });
  });

  it("rejects non-increasing SSP depths", () => {
    const issues = validateEnvironment({
      title: "bad",
      frequencyHz: 50,
      waterDepthM: 100,
      soundSpeedProfile: [
        { depthM: 50, speedMps: 1500 },
        { depthM: 20, speedMps: 1490 },
      ],
      bathymetry: [],
      bottom: { soundSpeedMps: 1700, densityKgM3: 1800, attenuationDbPerWavelength: 0.5 },
    });

    expect(issues).toContainEqual(expect.objectContaining({ path: "soundSpeedProfile[1].depthM" }));
  });

  it("validates and imports a same-stem Kraken ENV + FLP set", async () => {
    const imported = await importEnvironmentDocuments([
      { name: "MunkK.env", kind: "kraken-env", content: await fixture("MunkK.env") },
      { name: "MunkK.flp", kind: "kraken-flp", content: await fixture("MunkK.flp") },
    ]);

    expect(imported.documents).toHaveLength(2);
    expect(imported.environment).toMatchObject({ title: "BBMunk profile", frequencyHz: 50, waterDepthM: 5000 });
    expect(imported.environment.soundSpeedProfile).toHaveLength(27);
  });

  it("imports Bellhop ENV with same-stem SSP and BTY companions", async () => {
    const stem = "Pos1_SD200_100.0Hz_0IB";
    const imported = await importEnvironmentDocuments([
      { name: `${stem}.env`, kind: "bellhop-env", content: await fixture(`${stem}.env`) },
      { name: `${stem}.ssp`, kind: "bellhop-ssp", content: await fixture(`${stem}.ssp`) },
      { name: `${stem}.bty`, kind: "bellhop-bty", content: await fixture(`${stem}.bty`) },
    ]);

    expect(imported.environment).toMatchObject({
      title: "Acoustic Calculation",
      frequencyHz: 100,
      waterDepthM: 5956,
      bottom: { soundSpeedMps: 1600, densityKgM3: 1600, attenuationDbPerWavelength: 0.1 },
    });
    expect(imported.environment.soundSpeedProfile[0]).toEqual({ depthM: 0, speedMps: 1543.4 });
    expect(imported.environment.bathymetry).toHaveLength(30);
    expect(imported.environment.bathymetry.at(-1)).toEqual({ rangeM: 29_293.332, depthM: 5781.850437 });
    expect(imported.modelHints).toMatchObject({ sourceDepthM: 200, beamCount: 10_000 });
  });

  it("rejects a missing or mismatched Kraken FLP", async () => {
    const env = await fixture("MunkK.env");
    await expect(importEnvironmentDocuments([
      { name: "MunkK.env", kind: "kraken-env", content: env },
    ])).rejects.toThrow(/one.*\.env.*one.*\.flp/i);
    await expect(importEnvironmentDocuments([
      { name: "MunkK.env", kind: "kraken-env", content: env },
      { name: "other.flp", kind: "kraken-flp", content: await fixture("MunkK.flp") },
    ])).rejects.toThrow(/same stem/i);
  });

  it("imports a RAM .in and captures its run parameters as hints", async () => {
    const imported = await importEnvironmentDocuments([
      { name: "ram.in", kind: "ram-in", content: await fixture("ram.in") },
    ]);

    expect(imported.environment.frequencyHz).toBe(25);
    expect(imported.environment.bathymetry).toEqual([
      { rangeM: 0, depthM: 200 },
      { rangeM: 4000, depthM: 400 },
    ]);
    expect(imported.modelHints).toMatchObject({ sourceDepthM: 40, maximumRangeKm: 4, nPade: 8 });
  });

  it("classifies route-specific native file kinds", () => {
    expect(inferEnvironmentDocumentKind("case.env", "normal-mode")).toBe("kraken-env");
    expect(inferEnvironmentDocumentKind("case.flp", "normal-mode")).toBe("kraken-flp");
    expect(inferEnvironmentDocumentKind("case.ssp", "ray")).toBe("bellhop-ssp");
    expect(inferEnvironmentDocumentKind("case.bty", "ray")).toBe("bellhop-bty");
    expect(inferEnvironmentDocumentKind("ram.in", "pe")).toBe("ram-in");
  });
});
