import { describe, expect, it } from "vitest";
import { parseEnvironmentDocuments, parseEnvironmentJson } from "./browser-page-import";

function fieldDocument() {
  return {
    documentInfo: { formatRevision: 4 },
    parameters: {
      title: "Adaptive FieldCase",
      source: {
        frequenciesHz: [230],
        pointsNedMeters: [[0, 0, 18]],
      },
      receiver: {
        geometry: {
          pointsNedMeters: [[0, 50_000, 1000], [0, 20_000, 500]],
        },
      },
      waterColumn: {
        representation: "PIECEWISE_VERTICAL_PROFILES",
        sections: [{
          beginMeters: 0,
          endMeters: 50_000,
          profile: {
            soundSpeed: {
              depthsMeters: [0, 1000, 3000],
              values: [1476.7, 1478.1, 1506.5],
              interpolation: "LINEAR",
            },
          },
        }],
      },
      seabed: {
        representation: "INVARIANT",
        geometry: {
          rangesMeters: [0, 20_000, 50_000],
          depthsMeters: [3000, 500, 3000],
        },
        condition: {
          material: {
            compressionalSoundSpeed: { value: 1550 },
            density: { value: 1500 },
            compressionalAttenuation: {
              depthsMeters: [0, 1800],
              values: [0.5, 10],
            },
          },
        },
      },
    },
    runs: [
      {
        backend: "ray_mode.bellhop.2d",
        options: {
          integration: { rangeBoxMeters: 50_000, depthBoxMeters: 3000 },
          launchAngles: {
            kind: "LINSPACE",
            minimumDegrees: -35,
            maximumDegrees: 45,
            angleCount: 161,
            anglesDegrees: [],
          },
        },
      },
      {
        backend: "normal_mode.kraken",
        options: {
          rangeSamplesMeters: [0, 50_000],
          depthSamplesMeters: [500, 1000],
          minimumPhaseSpeedMetersPerSecond: 1400,
          maximumPhaseSpeedMetersPerSecond: 1700,
        },
      },
      {
        backend: "pe.ram",
        options: {
          maximumRangeMeters: 50_000,
          maximumDepthMeters: 3500,
          rangeStepMeters: 25,
          depthStepMeters: 2,
          padeTermCount: 8,
        },
      },
    ],
  };
}

describe("adaptive browser environment import", () => {
  it("maps a FieldDocument v4 into all page-level model hints", () => {
    const parsed = parseEnvironmentJson(fieldDocument());

    expect(parsed).toMatchObject({
      title: "Adaptive FieldCase",
      format: "field-document-v4",
      adaptiveParser: "field-document",
      frequencyHz: 230,
      sourceDepthM: 18,
      waterDepthM: 3000,
      maximumRangeKm: 50,
      bottomSoundSpeedMps: 1550,
      bottomDensityKgM3: 1500,
      bottomAttenuationDbPerWavelength: 0.5,
      angleRangeDegrees: [-35, 45],
      beamCount: 161,
      phaseSpeedLowMps: 1400,
      phaseSpeedHighMps: 1700,
      maximumDepthM: 3500,
      rangeStepM: 25,
      depthStepM: 2,
      nPade: 8,
    });
    expect(parsed.profilePoints).toEqual([[0, 1476.7], [1000, 1478.1], [3000, 1506.5]]);
    expect(parsed.bathymetry).toEqual([[0, 3000], [20, 500], [50, 3000]]);
    expect(parsed.receiverRangesM).toEqual([50_000, 20_000]);
    expect(parsed.receiverDepthsM).toEqual([1000, 500]);
  });

  it("preserves Normal Mode zero phase-speed sentinels as automatic", () => {
    const document: any = structuredClone(fieldDocument());
    document.runs[1].options.minimumPhaseSpeedMetersPerSecond = 0;
    document.runs[1].options.maximumPhaseSpeedMetersPerSecond = 0;

    const parsed = parseEnvironmentJson(document);
    expect(parsed).toMatchObject({ phaseSpeedLowMps: 0, phaseSpeedHighMps: 0 });
  });

  it("sniffs JSON content even when a FieldDocument has an ENV suffix", () => {
    const parsed = parseEnvironmentDocuments([{
      name: "exported-model.env",
      data: JSON.stringify(fieldDocument()),
    }]);
    expect(parsed).toMatchObject({ format: "field-document-v4", title: "Adaptive FieldCase" });
  });
  it("rebases LOCAL_NED depths against a negative horizontal sea-surface datum", () => {
    const document: any = structuredClone(fieldDocument());
    document.parameters.waterColumn = {
      representation: "INVARIANT_VERTICAL_PROFILE",
      datumDepthMeters: 0,
      profile: {
        soundSpeed: {
          depthsMeters: [-5000, 2500, 5000],
          values: [1500, 1500, 1500],
          interpolation: "LINEAR",
        },
      },
    } as never;
    document.parameters.seaSurface = {
      condition: { kind: "MATERIAL_HALF_SPACE" },
      geometry: { representation: "HORIZONTAL", depthMeters: -5000 },
    };
    document.parameters.seabed.geometry = {
      representation: "HORIZONTAL",
      depthMeters: 5000,
    } as never;
    document.parameters.seabed.condition = {
      kind: "MATERIAL_HALF_SPACE",
      material: {
        kind: "FLUID",
        compressionalSoundSpeed: { value: 1500 },
        density: { value: 1000 },
        compressionalAttenuation: { value: 0 },
      },
    } as never;
    document.parameters.source.pointsNedMeters = [[0, 0, 2500]];
    document.parameters.receiver.geometry.pointsNedMeters = [[0, 1000, 0], [0, 1000, 5000]];

    const parsed = parseEnvironmentJson(document);
    expect(parsed.profilePoints).toEqual([[0, 1500], [7500, 1500], [10_000, 1500]]);
    expect(parsed).toMatchObject({
      waterDepthM: 10_000,
      sourceDepthM: 7500,
      depthDatumOffsetMeters: 5000,
      receiverDepthsM: [5000, 10_000],
      projectionMode: "EDITABLE_PREVIEW",
    });
    expect(parsed.projectionWarnings.join(" ")).toContain("MATERIAL_HALF_SPACE");
  });

  it("uses the official Ray reference profile for a range-depth sound-speed field", () => {
    const document: any = structuredClone(fieldDocument());
    document.parameters.waterColumn = {
      representation: "CONTINUOUS_PROPERTY_FIELDS",
      soundSpeed: {
        representation: "EXTRUDED_RANGE_DEPTH",
        propagationPlane: {
          originNorthEastMeters: [0, 0],
          directionNorthEast: [0, 1],
        },
        rangesMeters: [-1000, 1000],
        depthsMeters: [0, 3000],
        valuesRangeDepth: [1490, 1510, 1500, 1520],
        interpolation: "QUADRATIC",
      },
    } as never;
    const ray = document.runs[0];
    if (ray !== undefined) ray.options.qReferenceSoundSpeedsMetersPerSecond = [1495, 1515];

    const parsed = parseEnvironmentJson(document);
    expect(parsed.profilePoints).toEqual([[0, 1495], [3000, 1515]]);
    expect(parsed.profileProjection).toBe("RAY_REFERENCE_PROFILE");
    expect(parsed.projectionWarnings.join(" ")).toContain("距离相关声速场");
  });

  it("clips a dry wedge tip exactly outside the active model range", () => {
    const document: any = structuredClone(fieldDocument());
    document.parameters.seaSurface = {
      condition: { kind: "VACUUM" },
      geometry: { representation: "HORIZONTAL", depthMeters: 0 },
    };
    document.parameters.seabed.geometry = {
      representation: "EXTRUDED_PROFILE",
      rangesMeters: [0, 4000],
      depthsMeters: [200, 0],
    } as never;
    document.parameters.receiver.geometry.pointsNedMeters = [[0, 2900, 55]];
    const ray = document.runs[0];
    if (ray !== undefined) ray.options.integration.rangeBoxMeters = 3900;
    const normal = document.runs[1];
    if (normal !== undefined) normal.options.rangeSamplesMeters = [0, 2900];
    const pe = document.runs[2];
    if (pe !== undefined) pe.options.maximumRangeMeters = 3900;

    const parsed = parseEnvironmentJson(document);
    expect(parsed.maximumRangeKm).toBe(3.9);
    expect(parsed.bathymetry).toEqual([[0, 200], [3.9, 5]]);
  });

  it("selects water and seabed properties from the source-local piecewise section", () => {
    const document: any = structuredClone(fieldDocument());
    document.parameters.source.pointsNedMeters = [[0, 400, 50]];
    document.parameters.waterColumn = {
      representation: "PIECEWISE_VERTICAL_PROFILES",
      propagationPlane: {
        originNorthEastMeters: [0, 0],
        directionNorthEast: [0, 1],
      },
      sections: [
        {
          beginMeters: 0,
          endMeters: 300,
          profile: {
            soundSpeed: {
              depthsMeters: [0, 200],
              values: [1450, 1450],
              interpolation: "LINEAR",
            },
          },
        },
        {
          beginMeters: 300,
          endMeters: 1000,
          profile: {
            soundSpeed: {
              depthsMeters: [0, 400],
              values: [1500, 1510],
              interpolation: "LINEAR",
            },
          },
        },
      ],
    };
    const fluid = (soundSpeed: number) => ({
      kind: "MATERIAL_HALF_SPACE",
      material: {
        kind: "FLUID",
        compressionalSoundSpeed: { value: soundSpeed },
        density: { value: 1800 },
        compressionalAttenuation: { value: 0.5 },
      },
    });
    document.parameters.seabed = {
      representation: "PIECEWISE_ASSEMBLIES",
      sections: [
        { beginMeters: 0, endMeters: 300, assembly: { geometry: { representation: "HORIZONTAL", depthMeters: 200 }, condition: fluid(1600), layers: [], pointMaterials: [] } },
        { beginMeters: 300, endMeters: 1000, assembly: { geometry: { representation: "HORIZONTAL", depthMeters: 400 }, condition: fluid(1900), layers: [], pointMaterials: [] } },
      ],
    };

    const parsed = parseEnvironmentJson(document);
    expect(parsed.profilePoints).toEqual([[0, 1500], [400, 1510]]);
    expect(parsed.waterDepthM).toBe(400);
    expect(parsed.bottomSoundSpeedMps).toBe(1900);
    expect(parsed.projectionWarnings.join(" ")).toContain("分段");
  });
});
