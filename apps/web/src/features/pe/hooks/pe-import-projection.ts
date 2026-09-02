import { normalizeProfilePoints, type ProfilePoint } from "../../shared-page/environment-presets";

export interface PeImportProjectionInput {
  readonly imported: Readonly<Record<string, unknown>> & {
    readonly profilePoints?: readonly ProfilePoint[];
    readonly sourceId?: unknown;
  };
  readonly current: Readonly<{
    frequencyHz: unknown;
    sourceDepthM: unknown;
    maximumRangeKm: unknown;
    maximumDepthM: unknown;
    rangeStepM: unknown;
    depthStepM: unknown;
    nPade: unknown;
  }>;
  readonly fallbackWaterDepthM: number;
}

export interface PeImportProjection {
  readonly values: {
    readonly frequencyHz: number;
    readonly sourceDepthM: number;
    readonly waterDepthM: number;
    readonly maximumRangeKm: number;
    readonly maximumDepthM: number;
    readonly rangeStepM: number;
    readonly depthStepM: number;
    readonly nPade: number;
    readonly bottomSoundSpeedMps: number;
    readonly bottomDensityKgM3: number;
    readonly bottomAttenuationDbPerWavelength: number;
  };
  readonly profilePoints: readonly ProfilePoint[];
  readonly warnings: readonly string[];
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

/** Applies PE page safety limits without reducing imported material precision. */
export function projectPeImport(input: PeImportProjectionInput): PeImportProjection {
  const { imported, current } = input;
  const warnings: string[] = [];
  const waterDepthM = bounded(warnings, "水深/m", imported.waterDepthM,
    input.fallbackWaterDepthM, 50, 8000);
  const frequencyHz = bounded(warnings, "频率/Hz", imported.frequencyHz,
    finite(current.frequencyHz) ?? 100, 10, 1000);
  const sourceDepthM = bounded(warnings, "声源深度/m", imported.sourceDepthM,
    finite(current.sourceDepthM) ?? 50, 1, waterDepthM - 1);
  const maximumRangeKm = bounded(warnings, "最大距离/km", imported.maximumRangeKm,
    finite(current.maximumRangeKm) ?? 20, 2, 250);
  const maximumDepthM = bounded(warnings, "计算域深度/m", imported.maximumDepthM,
    finite(current.maximumDepthM) ?? 300, waterDepthM, 10000);
  const rangeStepM = bounded(warnings, "距离步长/m", imported.rangeStepM,
    finite(current.rangeStepM) ?? 25, 1, 100);
  const depthStepM = bounded(warnings, "深度步长/m", imported.depthStepM,
    finite(current.depthStepM) ?? 2, 0.25, 20);
  const rawNPade = finite(imported.nPade);
  const boundedNPade = bounded(warnings, "Padé项数", imported.nPade,
    finite(current.nPade) ?? 4, 1, 10);
  const nPade = Math.round(boundedNPade);
  if (rawNPade !== null && Math.abs(nPade - boundedNPade) > 1e-9) {
    warnings.push(`Padé项数 ${compact(boundedNPade)}→${compact(nPade)}（整数）`);
  }

  // These stay full precision in state and in PePageRequest. HTML step values
  // affect editing ergonomics only; they must not quantize imported materials.
  const bottomSoundSpeedMps = bounded(warnings, "海底声速/(m/s)", imported.bottomSoundSpeedMps,
    1700, 1400, 3000);
  const bottomDensityKgM3 = bounded(warnings, "海底密度/(kg/m³)", imported.bottomDensityKgM3,
    1800, 1000, 3500);
  const bottomAttenuationDbPerWavelength = bounded(warnings, "海底吸收/(dB/λ)",
    imported.bottomAttenuationDbPerWavelength, 0.5, 0, 5);

  const rawProfile = numericPairs(imported.profilePoints);
  const profilePoints = normalizeProfilePoints(rawProfile, waterDepthM);
  const profileChanged = !pointsEqual(rawProfile, profilePoints);
  if (profileChanged) {
    warnings.push(`SSP ${rawProfile.length}节点→${profilePoints.length}节点（安全裁剪/端点补齐）`);
  }

  const nativeTemplate = typeof imported.sourceId === "string" && imported.sourceId.length > 0;
  const receiverRanges = unknownArray(imported.receiverRangesM);
  const receiverDepths = unknownArray(imported.receiverDepthsM);
  if (!nativeTemplate) {
    const importedGrid = receiverRanges.length > 0 || receiverDepths.length > 0 ? `${receiverRanges.length}×${receiverDepths.length}` : "未提供";
    warnings.push(`接收网格 ${importedGrid}→RAM 步进/抽取网格（目标约 181×131）`);
  }

  if (nativeTemplate) {
    const originalWaterDepth = finite(imported.waterDepthM);
    if (originalWaterDepth !== null && Math.abs(originalWaterDepth - waterDepthM) > 1e-9) {
      warnings.push(`地形深度整体平移 ${compact(waterDepthM - originalWaterDepth)}m`);
    }
    const originalRange = finite(imported.maximumRangeKm);
    if (originalRange !== null && originalRange > 0 && Math.abs(originalRange - maximumRangeKm) > 1e-9) {
      warnings.push(`地形/介质距离按 ${compact(originalRange)}→${compact(maximumRangeKm)}km 比例缩放`);
    }
    const mediumSectionCount = finite((imported.modelHints as Readonly<Record<string, unknown>> | undefined)?.mediumSectionCount) ?? 0;
    if (profileChanged && mediumSectionCount > 1) {
      warnings.push(`${compact(mediumSectionCount)}个介质段水体声速→同一可编辑SSP`);
    }
  }

  return {
    values: {
      frequencyHz,
      sourceDepthM,
      waterDepthM,
      maximumRangeKm,
      maximumDepthM,
      rangeStepM,
      depthStepM,
      nPade,
      bottomSoundSpeedMps,
      bottomDensityKgM3,
      bottomAttenuationDbPerWavelength,
    },
    profilePoints,
    warnings,
  };
}

export function peProjectionMessage(parserWarnings: readonly string[], warnings: readonly string[]): string {
  const combined = [...new Set([...parserWarnings, ...warnings])];
  return combined.length === 0 ? "" : ` 可编辑预览：${combined.join("；")}`;
}
