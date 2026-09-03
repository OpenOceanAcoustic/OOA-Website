import { describe, expect, it } from "vitest";
import { normalProjectionMessage, projectNormalImport } from "./normal-import-projection";

const current = {
  frequencyHz: "100",
  sourceDepthM: "50",
  maximumRangeKm: "20",
  phaseSpeedLowMps: "1400",
  phaseSpeedHighMps: "1700",
};

describe("projectNormalImport", () => {
  it("keeps zero FieldDocument phase-speed sentinels as auto", () => {
    const result = projectNormalImport({
      imported: {
        format: "field-document-v4",
        profilePoints: [[0, 1500], [100, 1500]],
        waterDepthM: 100,
        frequencyHz: 50,
        sourceDepthM: 25,
        maximumRangeKm: 10,
        phaseSpeedLowMps: 0,
        phaseSpeedHighMps: 0,
        bottomSoundSpeedMps: 1700,
        bottomDensityKgM3: 1800,
        bottomAttenuationDbPerWavelength: 0.5,
      },
      current,
      fallbackWaterDepthM: 100,
    });

    expect(result.values.phaseSpeedLowMps).toBe(0);
    expect(result.values.phaseSpeedHighMps).toBe(0);
    expect(result.notes).toContain("相速度边界 0/0（0=自动，已保留）");
    expect(result.warnings).not.toEqual(expect.arrayContaining([
      expect.stringContaining("相速度"),
    ]));
  });

  it("reports clamps, SSP normalization, receiver replacement and flat-bottom projection", () => {
    const result = projectNormalImport({
      imported: {
        format: "field-document-v4",
        profilePoints: [[10, 1200], [9000, 2300]],
        bathymetry: [[0, 100], [10, 200]],
        receiverRangesM: [1000, 2000],
        receiverDepthsM: [10, 20],
        waterDepthM: 9000,
        frequencyHz: 5,
        sourceDepthM: 9000,
        maximumRangeKm: 300,
        phaseSpeedLowMps: 1200,
        phaseSpeedHighMps: 2600,
        bottomSoundSpeedMps: 3500,
        bottomDensityKgM3: 5000,
        bottomAttenuationDbPerWavelength: 7,
        interpolation: "CUBIC_SPLINE",
      },
      current,
      fallbackWaterDepthM: 9000,
    });

    expect(result.values).toMatchObject({
      waterDepthM: 8000,
      frequencyHz: 10,
      sourceDepthM: 7999,
      maximumRangeKm: 250,
      phaseSpeedLowMps: 1300,
      phaseSpeedHighMps: 2400,
      bottomSoundSpeedMps: 3000,
      bottomDensityKgM3: 3500,
      bottomAttenuationDbPerWavelength: 5,
      interpolation: "linear",
    });
    expect(result.warnings).toEqual(expect.arrayContaining([
      "水深/m 9000→8000",
      "SSP 2节点→3节点（安全裁剪/端点补齐）",
      "接收网格 2×2→页面固定 161×121 等距网格",
      "海底地形 2节点→8000m 水平海底（不直接传入）",
      "插值 CUBIC_SPLINE→LINEAR",
    ]));
    expect(normalProjectionMessage([], result)).toContain("可编辑预览：");
  });
});
