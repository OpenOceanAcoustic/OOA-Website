import { normalizeProfilePoints, type ProfilePoint } from "../../shared-page/environment-presets";

export interface NormalImportProjectionInput {
  readonly imported: Readonly<Record<string, unknown>> & {
    readonly profilePoints?: readonly ProfilePoint[];
    readonly sourceId?: unknown;
  };
  readonly current: Readonly<{
    frequencyHz: unknown;
    sourceDepthM: unknown;
    maximumRangeKm: unknown;
    phaseSpeedLowMps: unknown;
    phaseSpeedHighMps: unknown;
  }>;
  readonly fallbackWaterDepthM: number;
}

export interface NormalImportProjection {
  readonly values: {
    readonly frequencyHz: number;
    readonly sourceDepthM: number;
    readonly waterDepthM: number;
    readonly maximumRangeKm: number;
    readonly phaseSpeedLowMps: number;
    readonly phaseSpeedHighMps: number;
    readonly bottomSoundSpeedMps: number;
    readonly bottomDensityKgM3: number;
    readonly bottomAttenuationDbPerWavelength: number;
    readonly interpolation: "linear" | "squared-slowness-linear";
  };
  readonly profilePoints: readonly ProfilePoint[];
  readonly warnings: readonly string[];
  readonly notes: readonly string[];
}

function finite(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function compact(value: number): string {
  return Number(value.toPrecision(12)).toString();
}

function original(value: unknown): string {
  const parsed = finite(value);
  return parsed === null ? "缺失" : compact(parsed);
}

function bounded(
  warnings: string[],
  label: string,
  raw: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = finite(raw);
  const value = parsed ?? fallback;
  const projected = Math.max(minimum, Math.min(maximum, value));
  if (parsed === null || Math.abs(projected - value) > 1e-9) {
    warnings.push(`${label} ${original(raw)}→${compact(projected)}`);
  }
  return projected;
}

function phaseSpeed(
  warnings: string[],
  raw: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  fieldDocument: boolean,
  label: string,
): number {
  const parsed = finite(raw);
  const value = parsed ?? (fieldDocument ? 0 : fallback);
  if (value === 0) return 0;
  const projected = Math.max(minimum, Math.min(maximum, value));
  if (parsed === null || Math.abs(projected - value) > 1e-9) {
    warnings.push(`${label} ${original(raw)}→${compact(projected)}`);
  }
  return projected;
}

function pointsEqual(left: readonly ProfilePoint[], right: readonly ProfilePoint[]): boolean {
  return left.length === right.length && left.every((point, index) => {
    const candidate = right[index];
    return candidate !== undefined
      && Math.abs(point[0] - candidate[0]) <= 1e-9
      && Math.abs(point[1] - candidate[1]) <= 1e-9;
  });
}

function unknownArray(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) return value;
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    return Array.from(value as unknown as ArrayLike<unknown>);
  }
  return [];
}

function numericPairs(value: unknown): readonly ProfilePoint[] {
  return unknownArray(value).flatMap((point) => {
    if (!Array.isArray(point)) return [];
    const x = finite(point[0]);
    const y = finite(point[1]);
    return x === null || y === null ? [] : [[x, y] as ProfilePoint];
  });
}


/**
 * Applies the Normal page's browser-safe bounds and records every lossy import
 * projection. Native Kraken templates remain untouched when their editable
 * values do not cross a page bound.
 */
export function projectNormalImport(input: NormalImportProjectionInput): NormalImportProjection {
  const { imported, current } = input;
  const warnings: string[] = [];
  const notes: string[] = [];
  const format = String(imported.format ?? "").toUpperCase();
  const fieldDocument = format.startsWith("FIELD-DOCUMENT");
  const waterDepthM = bounded(warnings, "水深/m", imported.waterDepthM,
    input.fallbackWaterDepthM, 50, 8000);
  const frequencyHz = bounded(warnings, "频率/Hz", imported.frequencyHz,
    finite(current.frequencyHz) ?? 100, 10, 1000);
  const sourceDepthM = bounded(warnings, "声源深度/m", imported.sourceDepthM,
    finite(current.sourceDepthM) ?? 50, 1, waterDepthM - 1);
  const maximumRangeKm = bounded(warnings, "最大距离/km", imported.maximumRangeKm,
    finite(current.maximumRangeKm) ?? 20, 2, 250);
  const phaseSpeedLowMps = phaseSpeed(warnings, imported.phaseSpeedLowMps,
    finite(current.phaseSpeedLowMps) ?? 1400, 1300, 1900, fieldDocument, "最小相速度/(m/s)");
  const phaseSpeedHighMps = phaseSpeed(warnings, imported.phaseSpeedHighMps,
    finite(current.phaseSpeedHighMps) ?? 1700, 1400, 2400, fieldDocument, "最大相速度/(m/s)");
  if (phaseSpeedLowMps === 0 || phaseSpeedHighMps === 0) {
    notes.push(`相速度边界 ${compact(phaseSpeedLowMps)}/${compact(phaseSpeedHighMps)}（0=自动，已保留）`);
  }
  const bottomSoundSpeedMps = bounded(warnings, "海底声速/(m/s)", imported.bottomSoundSpeedMps,
    1700, 1400, 3000);
  const bottomDensityKgM3 = bounded(warnings, "海底密度/(kg/m³)", imported.bottomDensityKgM3,
    1800, 1000, 3500);
  const bottomAttenuationDbPerWavelength = bounded(warnings, "海底吸收/(dB/λ)",
    imported.bottomAttenuationDbPerWavelength, 0.5, 0, 5);

  const rawInterpolation = String(imported.interpolation ?? "LINEAR").trim().toUpperCase().replaceAll("-", "_");
  const interpolation = rawInterpolation === "SQUARED_SLOWNESS_LINEAR"
    ? "squared-slowness-linear" : "linear";
  if (rawInterpolation !== "LINEAR" && rawInterpolation !== "SQUARED_SLOWNESS_LINEAR") {
    warnings.push(`插值 ${rawInterpolation || "缺失"}→LINEAR`);
  }

  const rawProfile = numericPairs(imported.profilePoints);
  const profilePoints = normalizeProfilePoints(rawProfile, waterDepthM);
  if (!pointsEqual(rawProfile, profilePoints)) {
    warnings.push(`SSP ${rawProfile.length}节点→${profilePoints.length}节点（安全裁剪/端点补齐）`);
  }

  const nativeTemplate = typeof imported.sourceId === "string" && imported.sourceId.length > 0;
  const receiverRanges = unknownArray(imported.receiverRangesM);
  const receiverDepths = unknownArray(imported.receiverDepthsM);
  const bathymetry = numericPairs(imported.bathymetry);
  if (!nativeTemplate) {
    const importedGrid = receiverRanges.length > 0 || receiverDepths.length > 0
      ? `${receiverRanges.length}×${receiverDepths.length}` : "未提供";
    warnings.push(`接收网格 ${importedGrid}→页面固定 161×121 等距网格`);
    warnings.push(`海底地形 ${bathymetry.length > 0 ? `${bathymetry.length}节点` : "未提供"}→${compact(waterDepthM)}m 水平海底（不直接传入）`);
  } else {
    const originalWaterDepth = finite(imported.waterDepthM);
    if (originalWaterDepth !== null && Math.abs(originalWaterDepth - waterDepthM) > 1e-9
      && receiverDepths.length > 0) {
      warnings.push(`接收深度网格 ${receiverDepths.length}点→121点等距网格`);
    }
    const originalRange = finite(imported.maximumRangeKm);
    if (originalRange !== null && Math.abs(originalRange - maximumRangeKm) > 1e-9
      && receiverRanges.length > 0) {
      warnings.push(`接收距离网格 ${receiverRanges.length}点→161点等距网格`);
    }
  }

  return {
    values: {
      frequencyHz,
      sourceDepthM,
      waterDepthM,
      maximumRangeKm,
      phaseSpeedLowMps,
      phaseSpeedHighMps,
      bottomSoundSpeedMps,
      bottomDensityKgM3,
      bottomAttenuationDbPerWavelength,
      interpolation,
    },
    profilePoints,
    warnings,
    notes,
  };
}

export function normalProjectionMessage(
  parserWarnings: readonly string[],
  audit: Pick<NormalImportProjection, "warnings" | "notes">,
): string {
  const warnings = [...new Set([...parserWarnings, ...audit.warnings])];
  const warningText = warnings.length === 0 ? "" : ` · 可编辑预览：${warnings.join("；")}`;
  const noteText = audit.notes.length === 0 ? "" : ` · ${audit.notes.join("；")}`;
  return `${warningText}${noteText}`;
}
