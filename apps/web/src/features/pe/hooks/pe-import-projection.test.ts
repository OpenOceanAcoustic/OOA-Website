import { describe, expect, it } from "vitest";
import { peProjectionMessage, projectPeImport } from "./pe-import-projection";

const current = {
  frequencyHz: "100",
  sourceDepthM: "50",
  maximumRangeKm: "20",
  maximumDepthM: "300",
  rangeStepM: "25",
  depthStepM: "2",
  nPade: "4",
};

describe("projectPeImport", () => {
  it("keeps imported material precision while rounding only the integer Padé option", () => {
    const result = projectPeImport({
      imported: {
        profilePoints: [[0, 1500], [200, 1500]],
        waterDepthM: 200,
        frequencyHz: 100,
        sourceDepthM: 50,
        maximumRangeKm: 20,
        maximumDepthM: 300,
        rangeStepM: 2.5,
        depthStepM: 0.75,
        nPade: 4.4,
        bottomSoundSpeedMps: 1700.25,
        bottomDensityKgM3: 1800.75,
        bottomAttenuationDbPerWavelength: 0.123456,
      },
      current,
      fallbackWaterDepthM: 200,
    });

    expect(result.values).toMatchObject({
      nPade: 4,
      bottomSoundSpeedMps: 1700.25,
      bottomDensityKgM3: 1800.75,
      bottomAttenuationDbPerWavelength: 0.123456,
    });
    expect(result.warnings).toContain("Padé项数 4.4→4（整数）");
    expect(result.warnings.join(" ")).not.toContain("海底声速");
  });

  it("lists browser clamps and canonical receiver-grid replacement", () => {
    const result = projectPeImport({
      imported: {
        profilePoints: [[10, 1200], [9000, 2300]],
        waterDepthM: 9000,
        frequencyHz: 5,
        sourceDepthM: 9000,
        maximumRangeKm: 500,
        maximumDepthM: 20000,
        rangeStepM: 0.1,
        depthStepM: 0.1,
        nPade: 20,
        bottomSoundSpeedMps: 1700,
        bottomDensityKgM3: 1800,
        bottomAttenuationDbPerWavelength: 0.5,
        receiverRangesM: [1000, 2000],
        receiverDepthsM: [10, 20, 30],
      },
      current,
      fallbackWaterDepthM: 9000,
    });

    expect(result.values).toMatchObject({
      waterDepthM: 8000,
      frequencyHz: 10,
      sourceDepthM: 7999,
      maximumRangeKm: 250,
      maximumDepthM: 10000,
      rangeStepM: 1,
      depthStepM: 0.25,
      nPade: 10,
    });
    expect(peProjectionMessage([], result.warnings)).toContain(
      "接收网格 2×3→RAM 步进/抽取网格（目标约 181×131）",
    );
  });

  it("reports native terrain scaling when a safe bound changes its domain", () => {
    const result = projectPeImport({
      imported: {
        sourceId: "native-1",
        modelHints: { mediumSectionCount: 1 },
        profilePoints: [[0, 1500], [9000, 1500]],
        waterDepthM: 9000,
        frequencyHz: 100,
        sourceDepthM: 50,
        maximumRangeKm: 500,
        maximumDepthM: 9500,
        rangeStepM: 10,
        depthStepM: 1,
        nPade: 4,
        bottomSoundSpeedMps: 1700,
        bottomDensityKgM3: 1800,
        bottomAttenuationDbPerWavelength: 0.5,
      },
      current,
      fallbackWaterDepthM: 9000,
    });

    expect(result.warnings).toEqual(expect.arrayContaining([
      "地形深度整体平移 -1000m",
      "地形/介质距离按 500→250km 比例缩放",
    ]));
  });
});
