/** Pure teaching-profile helpers shared by the Ray page and its runtime. */
export const DEFAULT_WATER_DEPTH_M: any = 5000;
export const PROFILE_DEFAULTS: any = Object.freeze({
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
export const MAX_SANITIZED_SSP_POINT_COUNT: any = 512;
/**
 * Bound profile work to a browser-safe size without discarding the deep end.
 * Sampling is deterministic and evenly spaced in source-index space.
 */
export function sampleSspPointsByIndex(points: any): any {
    if (!Array.isArray(points) || points.length <= MAX_SANITIZED_SSP_POINT_COUNT)
        return Array.isArray(points) ? points : [];
    const lastIndex: any = points.length - 1;
    const sampleLastIndex: any = MAX_SANITIZED_SSP_POINT_COUNT - 1;
    return Array.from({ length: MAX_SANITIZED_SSP_POINT_COUNT }, (_: any, index: any): any => {
        const sourceIndex: any = Math.round(index * lastIndex / sampleLastIndex);
        return points[sourceIndex];
    });
}

const clamp: any = (value: any, lower: any, upper: any): any => Math.max(lower, Math.min(upper, Number(value)));
export function profileDefaults(profile: any): any {
    return PROFILE_DEFAULTS[profile] ?? PROFILE_DEFAULTS.munk;
}
export function sanitizeSspPoints(points: any, waterDepthM: any = DEFAULT_WATER_DEPTH_M): any {
    const maximumDepth: any = clamp(waterDepthM, 50, 12000);
    const unique: any = new Map();
    if (Array.isArray(points)) {
        for (const point of sampleSspPointsByIndex(points)) {
            if (!Array.isArray(point) || point.length < 2)
                continue;
            const depth: any = Math.round(clamp(point[0], 0, maximumDepth) * 10) / 10;
            const speed: any = Math.round(clamp(point[1], 1300, 2000) * 10) / 10;
            if (Number.isFinite(depth) && Number.isFinite(speed))
                unique.set(depth, speed);
        }
    }
    return Array.from(unique, ([depth, speed]: any): any => [depth, speed])
        .sort((left: any, right: any): any => left[0] - right[0]);
}
function depthSamples(waterDepthM: any, stepM: any = 50): any {
    const maximumDepth: any = clamp(waterDepthM, 50, 12000);
    const values: any = [];
    for (let depth: any = 0; depth < maximumDepth; depth += stepM)
        values.push(depth);
    if (values.at(-1) !== maximumDepth)
        values.push(maximumDepth);
    return values;
}
export function generateSspProfile({ profile = "munk", axisDepthM = 1300, gradient = 1, waterDepthM, sspPoints = [], }: any = {}): any {
    const defaults: any = profileDefaults(profile);
    const maximumDepth: any = clamp(waterDepthM ?? defaults.waterDepthM, 50, 12000);
    if (profile === "custom" || profile === "env") {
        const samples: any = sanitizeSspPoints(sspPoints, maximumDepth);
        if (samples.length >= 2) {
            return {
                profile,
                waterDepthM: maximumDepth,
                depths: samples.map((point: any): any => point[0]),
                speeds: samples.map((point: any): any => point[1]),
            };
        }
        profile = "munk";
    }
    const axis: any = clamp(axisDepthM, 50, Math.max(50, maximumDepth - 20));
    const strength: any = clamp(gradient, 0.2, 2);
    const depths: any = depthSamples(maximumDepth);
    const speeds: any = depths.map((depth: any): any => {
        if (profile === "constant" || profile === "pekeris")
            return 1500;
        if (profile === "surface") {
            const thermocline: any = 28 * Math.tanh((axis - depth) / 420);
            const deep: any = Math.max(0, depth - axis) * 0.012;
            return 1490 + strength * (thermocline + deep);
        }
        profile = "munk";
        const eta: any = clamp(2 * (depth - axis) / 1300, -8, 8);
        return 1500 * (1 + 0.00737 * strength * (eta + Math.exp(-eta) - 1));
    });
    return { profile, waterDepthM: maximumDepth, depths, speeds };
}
function interpolateSpeed(points: any, depth: any): any {
    if (depth <= points[0][0])
        return points[0][1];
    for (let index: any = 1; index < points.length; ++index) {
        const right: any = points[index];
        if (right[0] < depth)
            continue;
        const left: any = points[index - 1];
        const weight: any = (depth - left[0]) / Math.max(1e-12, right[0] - left[0]);
        return left[1] + weight * (right[1] - left[1]);
    }
    return points.at(-1)[1];
}
export function resampleSspPoints(points: any, waterDepthM: any, intervalM: any = 500): any {
    const maximumDepth: any = clamp(waterDepthM, 50, 12000);
    const source: any = sanitizeSspPoints(points, maximumDepth);
    if (source.length < 2)
        return [];
    const depths: any = [];
    for (let depth: any = 0; depth < maximumDepth; depth += intervalM)
        depths.push(depth);
    if (depths.at(-1) !== maximumDepth)
        depths.push(maximumDepth);
    return depths.map((depth: any): any => [
        depth,
        Math.round(interpolateSpeed(source, depth) * 10) / 10,
    ]);
}
