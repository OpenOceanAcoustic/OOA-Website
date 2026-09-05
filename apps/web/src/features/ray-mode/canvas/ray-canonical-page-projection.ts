import {
  RAY_PAGE_AUTOMATIC_BEAM_COUNT,
  resolveRayFieldLaunchAngleCount,
} from "@ooa/runtime-ray";
import {
  MAX_SANITIZED_SSP_POINT_COUNT,
  sampleSspPointsByIndex,
  sanitizeSspPoints,
} from "@ooa/environment/ssp-profiles";

type NumericPair = readonly [number, number];

export const RAY_CANONICAL_PAGE_LIMITS = Object.freeze({
  waterDepthM: [50, 12_000] as const,
  frequencyHz: [20, 10_000] as const,
  maximumRangeKm: [0.1, 250] as const,
  bottomSoundSpeedMps: [1_400, 3_000] as const,
  bottomDensityKgM3: [1_000, 3_500] as const,
  bottomAttenuationDbPerWavelength: [0, 5] as const,
  sourceInsetM: 0,
  maximumSspPointCount: MAX_SANITIZED_SSP_POINT_COUNT,
  receiverGridRows: 201,
  receiverGridColumns: 201,
});

export interface RayCanonicalPageProjection {
  readonly waterDepthM: number;
  readonly sourceDepthM: number;
  readonly frequencyHz: number;
  readonly maximumRangeKm: number;
  readonly bottomSoundSpeedMps: number;
  readonly bottomDensityKgM3: number;
  readonly bottomAttenuationDbPerWavelength: number;
  /** Zero remains the Bellhop AUTO sentinel in the page request. */
  readonly beamCount: number;
  readonly effectiveBeamCount: number;
  readonly profilePoints: readonly NumericPair[];
  readonly projectionWarnings: readonly string[];
}

function clamp(value: number, [minimum, maximum]: readonly [number, number]): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function finiteOr(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatNumber(value: number): string {
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
}

function formatValue(value: number, unit: string): string {
  return `${formatNumber(value)}${unit ? ` ${unit}` : ""}`;
}

function appendUnique(warnings: string[], warning: string): void {
  if (warning && !warnings.includes(warning)) warnings.push(warning);
}

function appendScalarProjection(
  warnings: string[],
  label: string,
  original: number,
  actual: number,
  unit: string,
  supportedRange?: readonly [number, number],
): void {
  if (Object.is(original, actual)) return;
  const range = supportedRange
    ? `；支持范围 ${formatValue(supportedRange[0], unit)}–${formatValue(supportedRange[1], unit)}`
    : "";
  appendUnique(
    warnings,
    `${label}：原值 ${formatValue(original, unit)} → 页面实际值 ${formatValue(actual, unit)}${range}。`,
  );
}

function pointText(point: NumericPair): string {
  return `(${formatNumber(point[0])} m, ${formatNumber(point[1])} m/s)`;
}

function projectedSspPoint(point: NumericPair, waterDepthM: number): NumericPair {
  return [
    Math.round(clamp(point[0], [0, waterDepthM]) * 10) / 10,
    Math.round(clamp(point[1], [1_300, 2_000]) * 10) / 10,
  ];
}

function sspProjectionWarnings(
  warnings: string[],
  original: readonly NumericPair[],
  actual: readonly NumericPair[],
  waterDepthM: number,
): void {
  if (original.length !== actual.length) {
    appendUnique(
      warnings,
      `SSP 节点数：原值 ${formatNumber(original.length)} → 页面实际值 ${formatNumber(actual.length)}（最多保留 ${RAY_CANONICAL_PAGE_LIMITS.maximumSspPointCount} 个等距索引样本，首末节点必保留；0.1 m 量化后的同深度节点会合并）。`,
    );
  }

  const changed = (sampleSspPointsByIndex(original) as readonly NumericPair[])
    .map((point) => ({ original: point, actual: projectedSspPoint(point, waterDepthM) }))
    .filter(({ original: before, actual: after }) => before[0] !== after[0] || before[1] !== after[1]);
  if (changed.length > 0) {
    const examples = changed.slice(0, 3)
      .map(({ original: before, actual: after }) => `${pointText(before)} → ${pointText(after)}`)
      .join("；");
    appendUnique(
      warnings,
      `SSP 节点值：原值 → 页面实际值（深度/声速裁剪至 0–${formatNumber(waterDepthM)} m、1,300–2,000 m/s，并量化至 0.1）：${examples}${changed.length > 3 ? `；另有 ${changed.length - 3} 个节点变化` : ""}。`,
    );
  }

  const originalLastDepth = original.at(-1)?.[0];
  const actualLastDepth = actual.at(-1)?.[0];
  if (originalLastDepth !== undefined && actualLastDepth !== undefined
    && originalLastDepth !== actualLastDepth) {
    appendUnique(
      warnings,
      `SSP 覆盖深度：原值 0–${formatNumber(originalLastDepth)} m → 页面实际值 0–${formatNumber(actualLastDepth)} m。`,
    );
  }
}

function receiverGridDescription(imported: Readonly<Record<string, unknown>>): string {
  const ranges = Array.isArray(imported.receiverRangesM) ? imported.receiverRangesM : [];
  const depths = Array.isArray(imported.receiverDepthsM) ? imported.receiverDepthsM : [];
  if (ranges.length > 0 && depths.length > 0) {
    return `${formatNumber(depths.length)}×${formatNumber(ranges.length)}（原始深度轴×距离轴）`;
  }
  const pointCount = Number(imported.receiverPointCount);
  if (Number.isFinite(pointCount) && pointCount > 0) {
    return `${formatNumber(pointCount)} 个显式接收点`;
  }
  return "canonical 合约未保留原始接收轴";
}

export function projectCanonicalRayEnvironmentForPage(
  imported: Readonly<Record<string, unknown>>,
): RayCanonicalPageProjection {
  const existingWarnings = Array.isArray(imported.projectionWarnings)
    ? imported.projectionWarnings.map(String).filter(Boolean)
    : [];
  const warnings = [...new Set(existingWarnings)];
  const rawProfile = Array.isArray(imported.profilePoints)
    ? imported.profilePoints.map((point) => [Number(point?.[0]), Number(point?.[1])] as NumericPair)
    : [];
  if (rawProfile.length < 2) {
    throw new Error("环境文件中未找到至少两个有效的声速剖面节点");
  }

  const originalWaterDepthM = finiteOr(
    imported.waterDepthM,
    finiteOr(rawProfile.at(-1)?.[0], 5_000),
  );
  const waterDepthM = clamp(originalWaterDepthM, RAY_CANONICAL_PAGE_LIMITS.waterDepthM);
  appendScalarProjection(
    warnings,
    "水深",
    originalWaterDepthM,
    waterDepthM,
    "m",
    RAY_CANONICAL_PAGE_LIMITS.waterDepthM,
  );

  const profilePoints = sanitizeSspPoints(rawProfile, waterDepthM) as NumericPair[];
  if (profilePoints.length < 2) {
    throw new Error("SSP 经 Ray 页面裁剪和 0.1 精度量化后不足两个不同深度节点");
  }
  sspProjectionWarnings(warnings, rawProfile, profilePoints, waterDepthM);

  const sourceFallback = Math.min(1_000, waterDepthM / 2);
  const originalSourceDepthM = finiteOr(imported.sourceDepthM, sourceFallback);
  const sourceDepthM = Math.max(
    RAY_CANONICAL_PAGE_LIMITS.sourceInsetM,
    Math.min(waterDepthM - RAY_CANONICAL_PAGE_LIMITS.sourceInsetM, originalSourceDepthM),
  );
  appendScalarProjection(warnings, "声源深度", originalSourceDepthM, sourceDepthM, "m");

  const originalFrequencyHz = finiteOr(imported.frequencyHz, 500);
  const frequencyHz = clamp(originalFrequencyHz, RAY_CANONICAL_PAGE_LIMITS.frequencyHz);
  appendScalarProjection(
    warnings,
    "频率",
    originalFrequencyHz,
    frequencyHz,
    "Hz",
    RAY_CANONICAL_PAGE_LIMITS.frequencyHz,
  );

  const originalMaximumRangeKm = finiteOr(imported.maximumRangeKm, 100);
  const maximumRangeKm = clamp(
    originalMaximumRangeKm,
    RAY_CANONICAL_PAGE_LIMITS.maximumRangeKm,
  );
  appendScalarProjection(
    warnings,
    "最大距离",
    originalMaximumRangeKm,
    maximumRangeKm,
    "km",
    RAY_CANONICAL_PAGE_LIMITS.maximumRangeKm,
  );

  const originalBottomSoundSpeedMps = finiteOr(imported.bottomSoundSpeedMps, 1_700);
  const bottomSoundSpeedMps = clamp(
    originalBottomSoundSpeedMps,
    RAY_CANONICAL_PAGE_LIMITS.bottomSoundSpeedMps,
  );
  appendScalarProjection(
    warnings,
    "海底纵波声速",
    originalBottomSoundSpeedMps,
    bottomSoundSpeedMps,
    "m/s",
    RAY_CANONICAL_PAGE_LIMITS.bottomSoundSpeedMps,
  );

  const originalBottomDensityKgM3 = finiteOr(imported.bottomDensityKgM3, 1_800);
  const bottomDensityKgM3 = clamp(
    originalBottomDensityKgM3,
    RAY_CANONICAL_PAGE_LIMITS.bottomDensityKgM3,
  );
  appendScalarProjection(
    warnings,
    "海底密度",
    originalBottomDensityKgM3,
    bottomDensityKgM3,
    "kg/m³",
    RAY_CANONICAL_PAGE_LIMITS.bottomDensityKgM3,
  );

  const originalBottomAttenuation = finiteOr(
    imported.bottomAttenuationDbPerWavelength,
    0.5,
  );
  const bottomAttenuationDbPerWavelength = clamp(
    originalBottomAttenuation,
    RAY_CANONICAL_PAGE_LIMITS.bottomAttenuationDbPerWavelength,
  );
  appendScalarProjection(
    warnings,
    "海底吸收",
    originalBottomAttenuation,
    bottomAttenuationDbPerWavelength,
    "dB/λ",
    RAY_CANONICAL_PAGE_LIMITS.bottomAttenuationDbPerWavelength,
  );

  const originalBeamCount = finiteOr(imported.beamCount, RAY_PAGE_AUTOMATIC_BEAM_COUNT);
  const effectiveBeamCount = resolveRayFieldLaunchAngleCount(originalBeamCount);
  const beamCount = originalBeamCount === 0 ? 0 : effectiveBeamCount;
  if (originalBeamCount === 0) {
    appendUnique(
      warnings,
      `波束数：原值 AUTO (0) → 页面实际值 AUTO（浏览器自动策略为 ${formatNumber(effectiveBeamCount)} 条；不再误夹为 2 条）。`,
    );
  } else {
    appendScalarProjection(warnings, "波束数", originalBeamCount, effectiveBeamCount, "条");
  }

  appendUnique(
    warnings,
    `接收网格：原值 ${receiverGridDescription(imported)} → 页面实际值 ${RAY_CANONICAL_PAGE_LIMITS.receiverGridRows}×${RAY_CANONICAL_PAGE_LIMITS.receiverGridColumns} 等间距网格（深度 0–${formatNumber(waterDepthM)} m，距离 0.1–${formatNumber(maximumRangeKm)} km）。`,
  );

  return {
    waterDepthM,
    sourceDepthM,
    frequencyHz,
    maximumRangeKm,
    bottomSoundSpeedMps,
    bottomDensityKgM3,
    bottomAttenuationDbPerWavelength,
    beamCount,
    effectiveBeamCount,
    profilePoints,
    projectionWarnings: warnings,
  };
}
