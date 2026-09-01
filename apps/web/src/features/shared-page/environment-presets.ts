export type EnvironmentPresetKey = "pekeris" | "munk" | "surface" | "constant" | "custom";
export type ProfilePoint = readonly [depthM: number, soundSpeedMps: number];

export interface EnvironmentPreset {
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
  readonly frequencyHz: number;
  readonly sourceDepthM: number;
  readonly waterDepthM: number;
  readonly maximumDepthM: number;
  readonly maximumRangeKm: number;
  readonly bottomSoundSpeedMps: number;
  readonly bottomDensityKgM3: number;
  readonly bottomAttenuationDbPerWavelength: number;
  readonly phaseSpeedLowMps: number;
  readonly phaseSpeedHighMps: number;
  readonly rangeStepM: number;
  readonly depthStepM: number;
}

const PRESETS: Readonly<Record<EnvironmentPresetKey, EnvironmentPreset>> = {
  pekeris: {
    label: "Pekeris 均匀浅海波导",
    shortLabel: "PEKERIS / FLUID BOTTOM",
    description: "200 m 等声速水层 + 可穿透流体海底",
    frequencyHz: 100,
    sourceDepthM: 50,
    waterDepthM: 200,
    maximumDepthM: 300,
    maximumRangeKm: 20,
    bottomSoundSpeedMps: 1700,
    bottomDensityKgM3: 1800,
    bottomAttenuationDbPerWavelength: 0.5,
    phaseSpeedLowMps: 1400,
    phaseSpeedHighMps: 1700,
    rangeStepM: 25,
    depthStepM: 2,
  },
  munk: {
    label: "Munk 深海声道",
    shortLabel: "MUNK / DEEP CHANNEL",
    description: "经典深海声道，声道轴约 1,300 m",
    frequencyHz: 50,
    sourceDepthM: 1000,
    waterDepthM: 5000,
    maximumDepthM: 5500,
    maximumRangeKm: 30,
    bottomSoundSpeedMps: 1600,
    bottomDensityKgM3: 1600,
    bottomAttenuationDbPerWavelength: 0.1,
    phaseSpeedLowMps: 1400,
    phaseSpeedHighMps: 1700,
    rangeStepM: 50,
    depthStepM: 10,
  },
  surface: {
    label: "表层跃变",
    shortLabel: "THERMOCLINE / SURFACE",
    description: "上层正梯度与温跃层共同形成表层声道",
    frequencyHz: 100,
    sourceDepthM: 100,
    waterDepthM: 1000,
    maximumDepthM: 1200,
    maximumRangeKm: 30,
    bottomSoundSpeedMps: 1700,
    bottomDensityKgM3: 1800,
    bottomAttenuationDbPerWavelength: 0.5,
    phaseSpeedLowMps: 1400,
    phaseSpeedHighMps: 1800,
    rangeStepM: 25,
    depthStepM: 5,
  },
  constant: {
    label: "等声速水体",
    shortLabel: "ISOVELOCITY / CONTROL",
    description: "1,500 m/s 均匀水体，用作折射对照",
    frequencyHz: 100,
    sourceDepthM: 100,
    waterDepthM: 1000,
    maximumDepthM: 1200,
    maximumRangeKm: 30,
    bottomSoundSpeedMps: 1700,
    bottomDensityKgM3: 1800,
    bottomAttenuationDbPerWavelength: 0.5,
    phaseSpeedLowMps: 1450,
    phaseSpeedHighMps: 1750,
    rangeStepM: 25,
    depthStepM: 5,
  },
  custom: {
    label: "自定义 500 m 节点",
    shortLabel: "CUSTOM / 500 M NODES",
    description: "以 500 m 深度间隔初始化，可逐点编辑声速",
    frequencyHz: 50,
    sourceDepthM: 1000,
    waterDepthM: 5000,
    maximumDepthM: 5500,
    maximumRangeKm: 30,
    bottomSoundSpeedMps: 1600,
    bottomDensityKgM3: 1600,
    bottomAttenuationDbPerWavelength: 0.1,
    phaseSpeedLowMps: 1400,
    phaseSpeedHighMps: 1700,
    rangeStepM: 50,
    depthStepM: 10,
  },
};

export const ENVIRONMENT_PRESET_KEYS: readonly EnvironmentPresetKey[] = Object.freeze([
  "pekeris", "munk", "surface", "constant", "custom",
]);
export const ENVIRONMENT_PRESETS = Object.freeze(PRESETS);

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Number(value)));
}

function presetKey(value: string): EnvironmentPresetKey {
  return ENVIRONMENT_PRESET_KEYS.includes(value as EnvironmentPresetKey)
    ? value as EnvironmentPresetKey
    : "pekeris";
}

function munkSpeed(depthM: number, waterDepthM: number): number {
  const axisDepthM = Math.min(1300, waterDepthM * 0.45);
  const scaleDepthM = Math.max(250, Math.min(1300, waterDepthM * 0.65));
  const eta = clamp(2 * (depthM - axisDepthM) / scaleDepthM, -8, 8);
  return 1500 * (1 + 0.00737 * (eta + Math.exp(-eta) - 1));
}

function surfaceDuctSpeed(depthM: number, waterDepthM: number): number {
  const transitionDepthM = Math.min(500, waterDepthM * 0.42);
  const transitionScaleM = Math.max(80, Math.min(220, waterDepthM * 0.2));
  return 1490
    + 26 * Math.tanh((transitionDepthM - depthM) / transitionScaleM)
    + 0.012 * Math.max(0, depthM - transitionDepthM);
}

function interpolate(points: readonly ProfilePoint[], depthM: number): number {
  const first = points[0];
  const last = points.at(-1);
  if (first === undefined || last === undefined) return 1500;
  if (depthM <= first[0]) return first[1];
  for (let index = 1; index < points.length; index += 1) {
    const right = points[index];
    const left = points[index - 1];
    if (right !== undefined && left !== undefined && depthM <= right[0]) {
      const fraction = (depthM - left[0]) / Math.max(1e-12, right[0] - left[0]);
      return left[1] + fraction * (right[1] - left[1]);
    }
  }
  return last[1];
}

export function environmentPreset(key: string): EnvironmentPreset {
  return { ...PRESETS[presetKey(key)] };
}

export function normalizeProfilePoints(
  points: readonly ProfilePoint[] | readonly unknown[],
  waterDepthM: number,
  limit = 512,
): ProfilePoint[] {
  const maximumDepthM = clamp(waterDepthM, 10, 20000);
  const unique = new Map<number, number>();
  for (const point of Array.isArray(points) ? points.slice(0, limit) : []) {
    if (!Array.isArray(point) || point.length < 2) continue;
    const depthM = Number(point[0]);
    const soundSpeedMps = Number(point[1]);
    if (!Number.isFinite(depthM) || !Number.isFinite(soundSpeedMps)) continue;
    unique.set(
      Math.round(clamp(depthM, 0, maximumDepthM) * 1000) / 1000,
      Math.round(clamp(soundSpeedMps, 1300, 2200) * 1000) / 1000,
    );
  }
  let normalized: ProfilePoint[] = [...unique.entries()].sort((left, right) => left[0] - right[0]);
  if (normalized.length < 2) normalized = [[0, 1500], [maximumDepthM, 1500]];
  const first = normalized[0];
  if (first !== undefined && first[0] > 0) normalized.unshift([0, first[1]]);
  const last = normalized.at(-1);
  if (last !== undefined && last[0] < maximumDepthM) {
    normalized.push([maximumDepthM, last[1]]);
  } else if (last !== undefined) {
    normalized[normalized.length - 1] = [maximumDepthM, last[1]];
  }
  return normalized;
}

export function profilePointsForPreset(
  key: string,
  waterDepthM: number,
  customPoints: readonly ProfilePoint[] | null = null,
): ProfilePoint[] {
  const selected = presetKey(key);
  const maximumDepthM = clamp(waterDepthM, 10, 20000);
  if (selected === "custom" && customPoints !== null && customPoints.length >= 2) {
    return normalizeProfilePoints(customPoints, maximumDepthM);
  }
  if (selected === "pekeris" || selected === "constant") return [[0, 1500], [maximumDepthM, 1500]];
  const stepM = selected === "custom" ? 500 : Math.max(2, Math.min(50, maximumDepthM / 100));
  const count = Math.max(2, Math.ceil(maximumDepthM / stepM) + 1);
  const points: ProfilePoint[] = Array.from({ length: count }, (_, index) => {
    const depthM = index === count - 1 ? maximumDepthM : Math.min(maximumDepthM, index * stepM);
    let soundSpeedMps = 1500;
    if (selected === "munk" || selected === "custom") soundSpeedMps = munkSpeed(depthM, maximumDepthM);
    if (selected === "surface") soundSpeedMps = surfaceDuctSpeed(depthM, maximumDepthM);
    return [depthM, soundSpeedMps];
  });
  return normalizeProfilePoints(points, maximumDepthM);
}

export function resampleProfilePoints(
  points: readonly ProfilePoint[],
  waterDepthM: number,
  stepM = 500,
): ProfilePoint[] {
  const normalized = normalizeProfilePoints(points, waterDepthM);
  const count = Math.ceil(waterDepthM / stepM) + 1;
  return Array.from({ length: count }, (_, index) => {
    const depthM = index === count - 1 ? waterDepthM : index * stepM;
    return [depthM, interpolate(normalized, depthM)];
  });
}
