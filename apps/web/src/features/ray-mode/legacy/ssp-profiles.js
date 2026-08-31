export const DEFAULT_WATER_DEPTH_M = 5000;

export const PROFILE_DEFAULTS = Object.freeze({
  munk: Object.freeze({
    waterDepthM: 5000,
    axisDepthM: 1300,
    gradientPercent: 100,
    sourceDepthM: 1000,
    frequencyHz: 500,
    bottomSpeedMps: 1700,
    bottomDensityKgm3: 1800,
    bottomAbsorptionDbPerWavelength: 0.5,
  }),
  surface: Object.freeze({
    waterDepthM: 5000,
    axisDepthM: 1300,
    gradientPercent: 100,
    sourceDepthM: 1000,
    frequencyHz: 500,
    bottomSpeedMps: 1700,
    bottomDensityKgm3: 1800,
    bottomAbsorptionDbPerWavelength: 0.5,
  }),
  constant: Object.freeze({
    waterDepthM: 5000,
    axisDepthM: 1300,
    gradientPercent: 100,
    sourceDepthM: 1000,
    frequencyHz: 500,
    bottomSpeedMps: 1700,
    bottomDensityKgm3: 1800,
    bottomAbsorptionDbPerWavelength: 0.5,
  }),
  pekeris: Object.freeze({
    waterDepthM: 200,
    axisDepthM: 100,
    gradientPercent: 100,
    sourceDepthM: 50,
    frequencyHz: 100,
    bottomSpeedMps: 1700,
    bottomDensityKgm3: 1800,
    bottomAbsorptionDbPerWavelength: 0.5,
  }),
  custom: Object.freeze({
    waterDepthM: 5000,
    axisDepthM: 1300,
    gradientPercent: 100,
    sourceDepthM: 1000,
    frequencyHz: 500,
    bottomSpeedMps: 1700,
    bottomDensityKgm3: 1800,
    bottomAbsorptionDbPerWavelength: 0.5,
  }),
});

const clamp = (value, lower, upper) => Math.max(lower, Math.min(upper, Number(value)));

export function profileDefaults(profile) {
  return PROFILE_DEFAULTS[profile] ?? PROFILE_DEFAULTS.munk;
}

export function sanitizeSspPoints(points, waterDepthM = DEFAULT_WATER_DEPTH_M) {
  const maximumDepth = clamp(waterDepthM, 50, 12000);
  const unique = new Map();
  if (Array.isArray(points)) {
    for (const point of points.slice(0, 512)) {
      if (!Array.isArray(point) || point.length < 2) continue;
      const depth = Math.round(clamp(point[0], 0, maximumDepth) * 10) / 10;
      const speed = Math.round(clamp(point[1], 1300, 2000) * 10) / 10;
      if (Number.isFinite(depth) && Number.isFinite(speed)) unique.set(depth, speed);
    }
  }
  return Array.from(unique, ([depth, speed]) => [depth, speed])
    .sort((left, right) => left[0] - right[0]);
}

function depthSamples(waterDepthM, stepM = 50) {
  const maximumDepth = clamp(waterDepthM, 50, 12000);
  const values = [];
  for (let depth = 0; depth < maximumDepth; depth += stepM) values.push(depth);
  if (values.at(-1) !== maximumDepth) values.push(maximumDepth);
  return values;
}

export function generateSspProfile({
  profile = "munk",
  axisDepthM = 1300,
  gradient = 1,
  waterDepthM,
  sspPoints = [],
} = {}) {
  const defaults = profileDefaults(profile);
  const maximumDepth = clamp(waterDepthM ?? defaults.waterDepthM, 50, 12000);
  if (profile === "custom" || profile === "env") {
    const samples = sanitizeSspPoints(sspPoints, maximumDepth);
    if (samples.length >= 2) {
      return {
        profile,
        waterDepthM: maximumDepth,
        depths: samples.map((point) => point[0]),
        speeds: samples.map((point) => point[1]),
      };
    }
    profile = "munk";
  }

  const axis = clamp(axisDepthM, 50, Math.max(50, maximumDepth - 20));
  const strength = clamp(gradient, 0.2, 2);
  const depths = depthSamples(maximumDepth);
  const speeds = depths.map((depth) => {
    if (profile === "constant" || profile === "pekeris") return 1500;
    if (profile === "surface") {
      const thermocline = 28 * Math.tanh((axis - depth) / 420);
      const deep = Math.max(0, depth - axis) * 0.012;
      return 1490 + strength * (thermocline + deep);
    }
    profile = "munk";
    const eta = clamp(2 * (depth - axis) / 1300, -8, 8);
    return 1500 * (1 + 0.00737 * strength * (eta + Math.exp(-eta) - 1));
  });
  return { profile, waterDepthM: maximumDepth, depths, speeds };
}

function interpolateSpeed(points, depth) {
  if (depth <= points[0][0]) return points[0][1];
  for (let index = 1; index < points.length; ++index) {
    const right = points[index];
    if (right[0] < depth) continue;
    const left = points[index - 1];
    const weight = (depth - left[0]) / Math.max(1e-12, right[0] - left[0]);
    return left[1] + weight * (right[1] - left[1]);
  }
  return points.at(-1)[1];
}

export function resampleSspPoints(points, waterDepthM, intervalM = 500) {
  const maximumDepth = clamp(waterDepthM, 50, 12000);
  const source = sanitizeSspPoints(points, maximumDepth);
  if (source.length < 2) return [];
  const depths = [];
  for (let depth = 0; depth < maximumDepth; depth += intervalM) depths.push(depth);
  if (depths.at(-1) !== maximumDepth) depths.push(maximumDepth);
  return depths.map((depth) => [
    depth,
    Math.round(interpolateSpeed(source, depth) * 10) / 10,
  ]);
}
