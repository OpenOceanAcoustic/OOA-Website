const PRESETS: any = {
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
export const ENVIRONMENT_PRESET_KEYS: any = Object.freeze(Object.keys(PRESETS));
export const ENVIRONMENT_PRESETS: any = Object.freeze(PRESETS);
function clamp(value: any, minimum: any, maximum: any): any {
    return Math.max(minimum, Math.min(maximum, Number(value)));
}
function munkSpeed(depthM: any, waterDepthM: any): any {
    const axisDepthM: any = Math.min(1300, waterDepthM * 0.45);
    const scaleDepthM: any = Math.max(250, Math.min(1300, waterDepthM * 0.65));
    const eta: any = clamp(2 * (depthM - axisDepthM) / scaleDepthM, -8, 8);
    return 1500 * (1 + 0.00737 * (eta + Math.exp(-eta) - 1));
}
function surfaceDuctSpeed(depthM: any, waterDepthM: any): any {
    const transitionDepthM: any = Math.min(500, waterDepthM * 0.42);
    const transitionScaleM: any = Math.max(80, Math.min(220, waterDepthM * 0.2));
    return 1490
        + 26 * Math.tanh((transitionDepthM - depthM) / transitionScaleM)
        + 0.012 * Math.max(0, depthM - transitionDepthM);
}
function interpolate(points: any, depthM: any): any {
    if (depthM <= points[0][0])
        return points[0][1];
    for (let index: any = 1; index < points.length; index += 1) {
        const right: any = points[index];
        if (depthM <= right[0]) {
            const left: any = points[index - 1];
            const fraction: any = (depthM - left[0]) / Math.max(1e-12, right[0] - left[0]);
            return left[1] + fraction * (right[1] - left[1]);
        }
    }
    return points.at(-1)[1];
}
export function environmentPreset(key: any): any {
    const preset: any = PRESETS[key] || PRESETS.pekeris;
    return { ...preset };
}
export function normalizeProfilePoints(points: any, waterDepthM: any, limit: any = 512): any {
    const maximumDepthM: any = clamp(waterDepthM, 10, 20000);
    const unique: any = new Map();
    for (const point of Array.isArray(points) ? points.slice(0, limit) : []) {
        if (!Array.isArray(point) || point.length < 2)
            continue;
        const depthM: any = Number(point[0]);
        const soundSpeedMps: any = Number(point[1]);
        if (!Number.isFinite(depthM) || !Number.isFinite(soundSpeedMps))
            continue;
        unique.set(Math.round(clamp(depthM, 0, maximumDepthM) * 1000) / 1000, Math.round(clamp(soundSpeedMps, 1300, 2200) * 1000) / 1000);
    }
    let normalized: any = [...unique.entries()].sort((left: any, right: any): any => left[0] - right[0]);
    if (normalized.length < 2)
        normalized = [[0, 1500], [maximumDepthM, 1500]];
    if (normalized[0][0] > 0)
        normalized.unshift([0, normalized[0][1]]);
    if (normalized.at(-1)[0] < maximumDepthM) {
        normalized.push([maximumDepthM, normalized.at(-1)[1]]);
    }
    else {
        normalized[normalized.length - 1][0] = maximumDepthM;
    }
    return normalized;
}
export function profilePointsForPreset(key: any, waterDepthM: any, customPoints: any = null): any {
    const maximumDepthM: any = clamp(waterDepthM, 10, 20000);
    if (key === "custom" && Array.isArray(customPoints) && customPoints.length >= 2) {
        return normalizeProfilePoints(customPoints, maximumDepthM);
    }
    if (key === "pekeris" || key === "constant") {
        return [[0, 1500], [maximumDepthM, 1500]];
    }
    const stepM: any = key === "custom"
        ? 500
        : Math.max(2, Math.min(50, maximumDepthM / 100));
    const count: any = Math.max(2, Math.ceil(maximumDepthM / stepM) + 1);
    const points: any = Array.from({ length: count }, (_: any, index: any): any => {
        const depthM: any = index === count - 1
            ? maximumDepthM
            : Math.min(maximumDepthM, index * stepM);
        let soundSpeedMps: any = 1500;
        if (key === "munk" || key === "custom")
            soundSpeedMps = munkSpeed(depthM, maximumDepthM);
        if (key === "surface")
            soundSpeedMps = surfaceDuctSpeed(depthM, maximumDepthM);
        return [depthM, soundSpeedMps];
    });
    return normalizeProfilePoints(points, maximumDepthM);
}
export function resampleProfilePoints(points: any, waterDepthM: any, stepM: any = 500): any {
    const normalized: any = normalizeProfilePoints(points, waterDepthM);
    const count: any = Math.ceil(waterDepthM / stepM) + 1;
    return Array.from({ length: count }, (_: any, index: any): any => {
        const depthM: any = index === count - 1 ? waterDepthM : index * stepM;
        return [depthM, interpolate(normalized, depthM)];
    });
}
