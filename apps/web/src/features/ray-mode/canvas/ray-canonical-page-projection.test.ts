import { describe, expect, it } from "vitest";
import { projectCanonicalRayEnvironmentForPage } from "./ray-canonical-page-projection";

function canonical(overrides: Record<string, unknown> = {}) {
  return {
    title: "projection audit",
    profilePoints: [[0, 1_500], [200, 1_500]],
    waterDepthM: 200,
    sourceDepthM: 50,
    frequencyHz: 100,
    maximumRangeKm: 20,
    bottomSoundSpeedMps: 1_700,
    bottomDensityKgM3: 1_800,
    bottomAttenuationDbPerWavelength: 0.5,
    beamCount: 100,
    ...overrides,
  };
}

describe("Ray canonical page projection audit", () => {
  it("records every scalar clamp as original value to actual value", () => {
    const projection = projectCanonicalRayEnvironmentForPage(canonical({
      profilePoints: [[0, 1_200.04], [20_000, 2_100.06]],
      waterDepthM: 20_000,
      sourceDepthM: 19_999,
      frequencyHz: 20_000,
      maximumRangeKm: 400,
      bottomSoundSpeedMps: 1_200,
      bottomDensityKgM3: 500,
      bottomAttenuationDbPerWavelength: 10,
      beamCount: 0,
      receiverRangesM: [100, 200],
      receiverDepthsM: [0, 50, 100],
      projectionWarnings: ["上游投影限制。"],
    }));

    expect(projection).toMatchObject({
      waterDepthM: 12_000,
      sourceDepthM: 11_980,
      frequencyHz: 10_000,
      maximumRangeKm: 250,
      bottomSoundSpeedMps: 1_400,
      bottomDensityKgM3: 1_000,
      bottomAttenuationDbPerWavelength: 5,
      beamCount: 0,
      effectiveBeamCount: 1_000,
      profilePoints: [[0, 1_300], [12_000, 2_000]],
    });
    const audit = projection.projectionWarnings.join("\n");
    expect(audit).toContain("上游投影限制。");
    expect(audit).toContain("水深：原值 20,000 m → 页面实际值 12,000 m");
    expect(audit).toContain("声源深度：原值 19,999 m → 页面实际值 11,980 m");
    expect(audit).toContain("频率：原值 20,000 Hz → 页面实际值 10,000 Hz");
    expect(audit).toContain("最大距离：原值 400 km → 页面实际值 250 km");
    expect(audit).toContain("海底纵波声速：原值 1,200 m/s → 页面实际值 1,400 m/s");
    expect(audit).toContain("海底密度：原值 500 kg/m³ → 页面实际值 1,000 kg/m³");
    expect(audit).toContain("海底吸收：原值 10 dB/λ → 页面实际值 5 dB/λ");
    expect(audit).toContain("波束数：原值 AUTO (0) → 页面实际值 AUTO");
    expect(audit).toContain("接收网格：原值 3×2");
    expect(audit).toContain("页面实际值 201×201");
    expect(audit).toContain("(0 m, 1,200.04 m/s) → (0 m, 1,300 m/s)");
  });

  it("reports SSP sampling and quantization while preserving depth coverage", () => {
    const profilePoints = Array.from(
      { length: 513 },
      (_, depth) => [depth, 1_500.04] as const,
    );
    const projection = projectCanonicalRayEnvironmentForPage(canonical({
      profilePoints,
      waterDepthM: 512,
    }));
    const audit = projection.projectionWarnings.join("\n");

    expect(projection.profilePoints).toHaveLength(512);
    expect(projection.profilePoints.at(-1)?.[0]).toBe(512);
    expect(audit).toContain("SSP 节点数：原值 513 → 页面实际值 512");
    expect(audit).toContain("等距索引样本，首末节点必保留");
    expect(audit).not.toContain("SSP 覆盖深度");
    expect(audit).toContain("(0 m, 1,500.04 m/s) → (0 m, 1,500 m/s)");
  });

  it("still discloses the fixed receiver grid when scalar values are unchanged", () => {
    const projection = projectCanonicalRayEnvironmentForPage(canonical());

    expect(projection.projectionWarnings).toEqual([
      expect.stringContaining("canonical 合约未保留原始接收轴 → 页面实际值 201×201"),
    ]);
  });
});
