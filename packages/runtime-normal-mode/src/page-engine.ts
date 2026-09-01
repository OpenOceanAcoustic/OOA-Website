import { loadNormalModeSdkModule } from "./sdk-loader";
import { importNormalModePageEnvironment } from "./environment-parser";
import { RuntimeError, normalizeRuntimeError } from "@ooa/runtime-core";
export function createNormalModePageEngine(): any {
    const NORMAL_MODE_ADAPTER_CONTRACT: any = Object.freeze({
        method: "runNormalMode(params)",
        inputVersion: 1,
        resultVersion: 1,
        complexStorage: "interleaved-real-imaginary",
        fieldStorage: "row-major-depth-range",
        modeShapeStorage: "row-major-mode-depth-interleaved-complex",
    });
    function clamp(value: any, minimum: any, maximum: any): any {
        return Math.max(minimum, Math.min(maximum, Number(value)));
    }
    function linspace(start: any, end: any, count: any): any {
        const values: any = new Float64Array(count);
        for (let index: any = 0; index < count; index += 1) {
            values[index] = count === 1 ? start : start + (end - start) * index / (count - 1);
        }
        return values;
    }
    function soundSpeed(profile: any, depth: any, waterDepth: any): any {
        if (profile === "constant" || profile === "pekeris")
            return 1500;
        if (profile === "surface") {
            const transition: any = Math.tanh((650 - depth) / 270);
            return 1491 + 23 * transition + 0.009 * Math.max(0, depth - 650);
        }
        const axis: any = Math.min(1500, waterDepth * 0.29);
        const eta: any = clamp(2 * (depth - axis) / Math.max(600, axis), -8, 8);
        return 1500 * (1 + 0.00737 * (eta + Math.exp(-eta) - 1));
    }
    function interpolatedSoundSpeed(points: any, depthM: any): any {
        if (!Array.isArray(points) || points.length < 2)
            return Number.NaN;
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
    function makeEnvironment(params: any): any {
        const waterDepthM: any = clamp(params.waterDepthM ?? 200, 50, 8000);
        const depthsM: any = linspace(0, waterDepthM, 121);
        const soundSpeedMps: any = Float64Array.from(depthsM, (depth: any): any => (Number.isFinite(interpolatedSoundSpeed(params.sspPoints, depth))
            ? interpolatedSoundSpeed(params.sspPoints, depth)
            : soundSpeed(params.profile || "pekeris", depth, waterDepthM)));
        return { waterDepthM, depthsM, soundSpeedMps };
    }
    function modeShapeValue(modeIndex: any, depth: any, waterDepth: any): any {
        const order: any = modeIndex + 1;
        const normalizedDepth: any = depth / waterDepth;
        const envelope: any = 0.72 + 0.28 * Math.exp(-Math.pow((normalizedDepth - 0.3) / 0.36, 2));
        const real: any = Math.sin(order * Math.PI * normalizedDepth) * envelope;
        const imaginary: any = 0;
        return [real, imaginary];
    }
    function makeModes(params: any, environment: any): any {
        const frequencyHz: any = clamp(params.frequencyHz ?? 75, 10, 1000);
        const minimumSpeed: any = Math.min(...environment.soundSpeedMps);
        const maximumSpeed: any = Math.max(...environment.soundSpeedMps);
        const contrast: any = Math.sqrt(Math.max(0.008, (maximumSpeed - minimumSpeed) / minimumSpeed));
        const estimated: any = Math.round(2 * environment.waterDepthM * frequencyHz / minimumSpeed * contrast);
        const modeCount: any = Math.round(clamp(estimated, 12, 112));
        const modeDepthsM: any = environment.depthsM.slice();
        const horizontalWavenumbersInterleaved: any = new Float64Array(modeCount * 2);
        const groupVelocityMps: any = new Float64Array(modeCount);
        const modeShapesInterleaved: any = new Float64Array(modeCount * modeDepthsM.length * 2);
        const referenceSpeed: any = minimumSpeed + 0.31 * (maximumSpeed - minimumSpeed);
        const omega: any = 2 * Math.PI * frequencyHz;
        const referenceWavenumber: any = omega / referenceSpeed;
        for (let mode: any = 0; mode < modeCount; mode += 1) {
            const vertical: any = (mode + 0.68) * Math.PI / environment.waterDepthM;
            const real: any = Math.sqrt(Math.max(referenceWavenumber ** 2 * 0.12, referenceWavenumber ** 2 - vertical ** 2));
            // Native Kraken uses Im(k) < 0 for attenuation with exp(-i k r).
            const imaginary: any = -0.24 * 1.2e-7 * (1 + 20 * (mode / Math.max(1, modeCount - 1)) ** 3);
            horizontalWavenumbersInterleaved[mode * 2] = real;
            horizontalWavenumbersInterleaved[mode * 2 + 1] = imaginary;
            groupVelocityMps[mode] = clamp(omega / real * (0.985 - 0.055 * mode / modeCount), 1380, 1750);
            for (let depthIndex: any = 0; depthIndex < modeDepthsM.length; depthIndex += 1) {
                const [shapeReal, shapeImaginary]: any = modeShapeValue(mode, modeDepthsM[depthIndex], environment.waterDepthM);
                const offset: any = (mode * modeDepthsM.length + depthIndex) * 2;
                modeShapesInterleaved[offset] = shapeReal;
                modeShapesInterleaved[offset + 1] = shapeImaginary;
            }
        }
        return {
            count: modeCount,
            depthsM: modeDepthsM,
            horizontalWavenumbersInterleaved,
            groupVelocityMps,
            modeShapesInterleaved,
        };
    }
    function pressurePlane(params: any, environment: any, modes: any, rangeAxisM: any, depthAxisM: any, modeLimit: any): any {
        const values: any = new Float64Array(rangeAxisM.length * depthAxisM.length * 2);
        const sourceDepth: any = clamp(params.sourceDepthM ?? 800, 1, environment.waterDepthM - 1);
        const sourceIndex: any = Math.round(sourceDepth / environment.waterDepthM * (modes.depthsM.length - 1));
        for (let depthIndex: any = 0; depthIndex < depthAxisM.length; depthIndex += 1) {
            const modeDepthIndex: any = Math.round(depthIndex / Math.max(1, depthAxisM.length - 1) * (modes.depthsM.length - 1));
            for (let rangeIndex: any = 0; rangeIndex < rangeAxisM.length; rangeIndex += 1) {
                const rangeM: any = Math.max(100, rangeAxisM[rangeIndex]);
                let real: any = 0;
                let imaginary: any = 0;
                for (let mode: any = 0; mode < modeLimit; mode += 1) {
                    const sourceOffset: any = (mode * modes.depthsM.length + sourceIndex) * 2;
                    const receiverOffset: any = (mode * modes.depthsM.length + modeDepthIndex) * 2;
                    const sourceReal: any = modes.modeShapesInterleaved[sourceOffset];
                    const sourceImaginary: any = modes.modeShapesInterleaved[sourceOffset + 1];
                    const receiverReal: any = modes.modeShapesInterleaved[receiverOffset];
                    const receiverImaginary: any = modes.modeShapesInterleaved[receiverOffset + 1];
                    const couplingReal: any = sourceReal * receiverReal - sourceImaginary * receiverImaginary;
                    const couplingImaginary: any = sourceReal * receiverImaginary + sourceImaginary * receiverReal;
                    const kr: any = modes.horizontalWavenumbersInterleaved[mode * 2];
                    const imaginaryWavenumber: any = modes.horizontalWavenumbersInterleaved[mode * 2 + 1];
                    const spreading: any = Math.exp(imaginaryWavenumber * rangeM) / Math.sqrt(1 + rangeM / 700);
                    const phase: any = kr * rangeM - Math.PI / 4;
                    const cosine: any = Math.cos(phase);
                    const sine: any = Math.sin(phase);
                    const weight: any = spreading / Math.sqrt(Math.max(kr, 1e-8));
                    real += weight * (couplingReal * cosine - couplingImaginary * sine);
                    imaginary += weight * (couplingReal * sine + couplingImaginary * cosine);
                }
                const offset: any = (depthIndex * rangeAxisM.length + rangeIndex) * 2;
                values[offset] = real;
                values[offset + 1] = imaginary;
            }
        }
        return values;
    }
    function toTransmissionLoss(pressure: any, normalization: any): any {
        const values: any = new Float32Array(pressure.length / 2);
        for (let index: any = 0; index < values.length; index += 1) {
            const magnitude: any = Math.max(1e-12, Math.hypot(pressure[index * 2], pressure[index * 2 + 1]));
            values[index] = clamp(60 - 20 * Math.log10(magnitude / normalization), 60, 120);
        }
        return values;
    }
    function maximumMagnitude(pressure: any): any {
        let maximum: any = 1e-12;
        for (let index: any = 0; index < pressure.length; index += 2) {
            maximum = Math.max(maximum, Math.hypot(pressure[index], pressure[index + 1]));
        }
        return maximum;
    }
    async function demonstrationResult(params: any, reason: any): Promise<any> {
        const started: any = performance.now();
        await new Promise((resolve: any): any => requestAnimationFrame(resolve));
        const environment: any = makeEnvironment(params);
        const modes: any = makeModes(params, environment);
        const columns: any = Math.round(clamp(params.rangeCount ?? 161, 41, 241));
        const rows: any = Math.round(clamp(params.depthCount ?? 121, 41, 181));
        const maximumRangeKm: any = clamp(params.maximumRangeKm ?? 100, 5, 250);
        const rangesKm: any = linspace(0.1, maximumRangeKm, columns);
        const rangesM: any = Float64Array.from(rangesKm, (value: any): any => value * 1000);
        const depthsM: any = linspace(0, environment.waterDepthM, rows);
        const activeModeCount: any = Math.round(clamp(params.modeLimit ?? 24, 1, modes.count));
        const fullPressure: any = pressurePlane(params, environment, modes, rangesM, depthsM, modes.count);
        const truncatedPressure: any = activeModeCount === modes.count
            ? fullPressure.slice()
            : pressurePlane(params, environment, modes, rangesM, depthsM, activeModeCount);
        const normalization: any = maximumMagnitude(fullPressure);
        const fullTlDb: any = toTransmissionLoss(fullPressure, normalization);
        const truncatedTlDb: any = toTransmissionLoss(truncatedPressure, normalization);
        const deltaTlDb: any = new Float32Array(fullTlDb.length);
        let squareSum: any = 0;
        let maximumDifference: any = 0;
        for (let index: any = 0; index < deltaTlDb.length; index += 1) {
            const difference: any = truncatedTlDb[index] - fullTlDb[index];
            deltaTlDb[index] = difference;
            squareSum += difference * difference;
            maximumDifference = Math.max(maximumDifference, Math.abs(difference));
        }
        return {
            contractVersion: 1,
            runtime: {
                mode: "demo",
                engine: "BROWSER_MODAL_DEMONSTRATOR",
                fallback: true,
                warning: reason || "Normal Mode WASM backend is not registered",
                computeMs: performance.now() - started,
            },
            environment: {
                profile: params.profile || "munk",
                waterDepthM: environment.waterDepthM,
                sourceDepthM: clamp(params.sourceDepthM ?? 800, 1, environment.waterDepthM - 1),
                frequencyHz: clamp(params.frequencyHz ?? 75, 10, 1000),
                depthsM: environment.depthsM,
                soundSpeedMps: environment.soundSpeedMps,
            },
            modes,
            field: {
                rows,
                columns,
                rangesKm,
                depthsM,
                tlDb: truncatedTlDb,
                activeModeCount,
            },
            fullField: { rows, columns, rangesKm, depthsM, tlDb: fullTlDb },
            deltaField: { rows, columns, rangesKm, depthsM, values: deltaTlDb },
            metrics: {
                deltaRmsDb: Math.sqrt(squareSum / Math.max(1, deltaTlDb.length)),
                deltaMaxDb: maximumDifference,
            },
        };
    }
    function validateResult(result: any): any {
        if (!result || result.contractVersion !== 1)
            throw new Error("unsupported Normal Mode result contract");
        if (!result.modes || !result.field || !result.deltaField)
            throw new Error("incomplete Normal Mode result");
        if (result.field.rows * result.field.columns !== result.field.tlDb.length) {
            throw new Error("Normal Mode field shape does not match TL storage");
        }
        return result;
    }
    let normalPackagePromise: any;
    let normalSolverPromise: any;
    const fullRunCache: any = new Map();
    const limitedRunCache: any = new Map();
    const importedInputCache: any = new Map();
    let nextImportedSourceId: any = 1;
    let latestNativeRequestId: any = 0;
    let nativeRequestActive: any = false;
    const FULL_MODE_LIMIT: any = 9999;
    const MODE_SHAPE_DEPTH_SAMPLES: any = 401;
    const MINIMUM_FLOAT32_MAGNITUDE: any = 1.1754943508222875e-38;
    function loadNormalPackage(): any {
        normalPackagePromise ??= loadNormalModeSdkModule();
        return normalPackagePromise;
    }
    async function normalSolver(): Promise<any> {
        if (!normalSolverPromise) {
            const pending: any = loadNormalPackage().then(({ Kraken }: any): any => (Kraken.create(!import.meta.env.DEV && globalThis.crossOriginIsolated === true
                ? Kraken.recommendedRuntime()
                : { executionMode: "SINGLE_THREAD", threadCount: 1 })));
            normalSolverPromise = pending;
            pending.catch((): any => {
                if (normalSolverPromise === pending)
                    normalSolverPromise = null;
            });
        }
        return normalSolverPromise;
    }
    function normalEnvironmentKey(params: any): any {
        return JSON.stringify({
            model: params.model,
            profile: params.profile,
            environmentTitle: params.environmentTitle,
            frequencyHz: params.frequencyHz,
            sourceDepthM: params.sourceDepthM,
            waterDepthM: params.waterDepthM,
            maximumRangeKm: params.maximumRangeKm,
            phaseSpeedLowMps: params.phaseSpeedLowMps,
            phaseSpeedHighMps: params.phaseSpeedHighMps,
            bottomSoundSpeedMps: params.bottomSoundSpeedMps,
            bottomDensityRelative: params.bottomDensityRelative,
            bottomAttenuationDbPerWavelength: params.bottomAttenuationDbPerWavelength,
            interpolation: params.interpolation,
            sspPoints: params.sspPoints,
            rangeCount: params.rangeCount,
            depthCount: params.depthCount,
            sourceId: params.sourceId,
        });
    }
    function trimNormalCaches(): any {
        while (fullRunCache.size > 3)
            fullRunCache.delete(fullRunCache.keys().next().value);
        while (limitedRunCache.size > 12)
            limitedRunCache.delete(limitedRunCache.keys().next().value);
    }
    function profilePointsEqual(left: any, right: any, tolerance: any = 1e-9): any {
        if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length)
            return false;
        return left.every((point: any, index: any): any => (Array.isArray(point) && Array.isArray(right[index])
            && Math.abs(Number(point[0]) - Number(right[index][0])) <= tolerance
            && Math.abs(Number(point[1]) - Number(right[index][1])) <= tolerance));
    }
    async function makeNativeInput(params: any, modeLimit: any): Promise<any> {
        if (params.model !== "kraken") {
            throw new Error("当前 WASM 版本只启用 Kraken");
        }
        const { AcousticAttenuationUnit, BoundaryKind, KrakenInput, KrakenOutputRequest, SourceModel, WaveguideInterpolation, }: any = await loadNormalPackage();
        const imported: any = importedInputCache.get(params.sourceId);
        if (imported) {
            let builder: any = KrakenInput.edit(imported.input);
            const baseline: any = imported.baseline;
            if (Math.abs(params.frequencyHz - baseline.frequencyHz) > 1e-9) {
                builder = builder.environment().frequencyHz(params.frequencyHz);
            }
            if (Math.abs(params.phaseSpeedLowMps - baseline.phaseSpeedLowMps) > 1e-9
                || Math.abs(params.phaseSpeedHighMps - baseline.phaseSpeedHighMps) > 1e-9) {
                builder = builder.environment().phaseSpeedBoundsMps(params.phaseSpeedLowMps, params.phaseSpeedHighMps);
            }
            if (Math.abs(params.sourceDepthM - baseline.sourceDepthM) > 1e-9) {
                builder = builder.source().depthsM([params.sourceDepthM]);
                builder = builder.outputRequest().modeSamplingM([params.sourceDepthM], imported.input.outputRequest.modeReceiverDepthsM);
            }
            if (Math.abs(params.maximumRangeKm - baseline.maximumRangeKm) > 1e-9) {
                const rangesM: any = linspace(0, params.maximumRangeKm * 1000, params.rangeCount);
                builder = builder.receivers().rangesM(rangesM);
                builder = builder.outputRequest().rangeSamplesM(rangesM);
            }
            const profileChanged: any = !profilePointsEqual(params.sspPoints, baseline.profilePoints)
                || Math.abs(params.waterDepthM - baseline.waterDepthM) > 1e-9
                || Math.abs(params.bottomSoundSpeedMps - baseline.bottomSoundSpeedMps) > 1e-9
                || Math.abs(params.bottomDensityRelative - baseline.bottomDensityRelative) > 1e-9
                || Math.abs(params.bottomAttenuationDbPerWavelength
                    - baseline.bottomAttenuationDbPerWavelength) > 1e-9
                || nativeInterpolation(params.interpolation, WaveguideInterpolation)
                    !== baseline.interpolation;
            if (profileChanged) {
                const points: any = nativeProfilePoints(params, params.waterDepthM);
                const firstProfile: any = imported.input.environment.profiles[0];
                const firstLayer: any = firstProfile.layers[0];
                const count: any = points.length;
                const fill: any = (values: any, fallback: any): any => Float64Array.from({ length: count }, (): any => Number(values?.[0] ?? fallback));
                const profiles: any = imported.input.environment.profiles.map((profile: any, index: any): any => (index === 0
                    ? {
                        ...profile,
                        interpolation: nativeInterpolation(params.interpolation, WaveguideInterpolation),
                        layers: [{
                                ...firstLayer,
                                depthsM: Float64Array.from(points, (point: any): any => point[0]),
                                compressionalSpeedMps: Float64Array.from(points, (point: any): any => point[1]),
                                shearSpeedMps: fill(firstLayer.shearSpeedMps, 0),
                                densityRelative: fill(firstLayer.densityRelative, 1),
                                compressionalAttenuation: fill(firstLayer.compressionalAttenuation, 0),
                                shearAttenuation: fill(firstLayer.shearAttenuation, 0),
                            }, ...profile.layers.slice(1)],
                        bottom: {
                            ...profile.bottom,
                            compressionalSpeedMps: params.bottomSoundSpeedMps,
                            densityRelative: params.bottomDensityRelative,
                            compressionalAttenuation: params.bottomAttenuationDbPerWavelength,
                        },
                    }
                    : profile));
                builder = builder.environment().profiles(profiles);
            }
            if (Math.abs(params.waterDepthM - baseline.waterDepthM) > 1e-9) {
                const depthsM: any = linspace(0, params.waterDepthM, params.depthCount);
                const modeDepthsM: any = linspace(0, params.waterDepthM, MODE_SHAPE_DEPTH_SAMPLES);
                builder = builder.receivers().depthsM(depthsM);
                builder = builder.outputRequest().depthSamplesM(depthsM);
                builder = builder.outputRequest().modeSamplingM(Math.abs(params.sourceDepthM - baseline.sourceDepthM) > 1e-9
                    ? [params.sourceDepthM]
                    : imported.input.outputRequest.modeSourceDepthsM, modeDepthsM);
            }
            return builder.options().modeLimit(modeLimit).build();
        }
        const waterDepthM: any = clamp(params.waterDepthM ?? 200, 50, 8000);
        const maximumRangeM: any = clamp(params.maximumRangeKm ?? 20, 0.001, 250) * 1000;
        const rangeCount: any = Math.round(clamp(params.rangeCount ?? 161, 2, 2048));
        const depthCount: any = Math.round(clamp(params.depthCount ?? 121, 2, 2048));
        const rangesM: any = linspace(0, maximumRangeM, rangeCount);
        const receiverDepthsM: any = linspace(0, waterDepthM, depthCount);
        const modeDepthsM: any = linspace(0, waterDepthM, MODE_SHAPE_DEPTH_SAMPLES);
        const profilePoints: any = nativeProfilePoints(params, waterDepthM);
        const profileDepthsM: any = Float64Array.from(profilePoints, (point: any): any => point[0]);
        const profileSoundSpeedMps: any = Float64Array.from(profilePoints, (point: any): any => point[1]);
        const zeros: any = new Float64Array(profilePoints.length);
        const waterDensity: any = Float64Array.from(profilePoints, (): any => 1);
        const attenuationUnit: any = AcousticAttenuationUnit.DB_PER_WAVELENGTH;
        const top: any = {
            kind: BoundaryKind.VACUUM,
            compressionalSpeedMps: 0,
            compressionalAttenuation: 0,
            shearSpeedMps: 0,
            shearAttenuation: 0,
            densityRelative: 0,
            attenuationUnit,
        };
        const bottom: any = {
            kind: BoundaryKind.MATERIAL_HALF_SPACE,
            compressionalSpeedMps: params.bottomSoundSpeedMps,
            compressionalAttenuation: params.bottomAttenuationDbPerWavelength,
            shearSpeedMps: 0,
            shearAttenuation: 0,
            densityRelative: params.bottomDensityRelative,
            attenuationUnit,
        };
        const environment: any = {
            title: params.environmentTitle || "OOA Normal Mode browser modal comparison",
            frequencyHz: params.frequencyHz,
            profiles: [{
                    beginRangeM: 0,
                    interpolation: nativeInterpolation(params.interpolation, WaveguideInterpolation),
                    layers: [{
                            id: "water",
                            elastic: false,
                            meshPoints: 0,
                            compressionalAttenuationUnit: attenuationUnit,
                            shearAttenuationUnit: attenuationUnit,
                            depthsM: profileDepthsM,
                            compressionalSpeedMps: profileSoundSpeedMps,
                            shearSpeedMps: zeros,
                            densityRelative: waterDensity,
                            compressionalAttenuation: zeros,
                            shearAttenuation: zeros,
                        }],
                    top,
                    bottom,
                }],
            phaseSpeedLowMps: params.phaseSpeedLowMps,
            phaseSpeedHighMps: params.phaseSpeedHighMps,
        };
        const source: any = {
            depthsM: [clamp(params.sourceDepthM ?? 50, 0, waterDepthM)],
            model: SourceModel.POINT,
            directivity: [],
        };
        const receivers: any = { rangesM, depthsM: receiverDepthsM };
        const outputRequest: any = {
            ...KrakenOutputRequest.modesAndField(),
            rangeSamplesM: rangesM,
            depthSamplesM: receiverDepthsM,
            modeSourceDepthsM: source.depthsM,
            modeReceiverDepthsM: modeDepthsM,
        };
        return KrakenInput.easyStart({ environment, source, receivers, outputRequest })
            .options().modeLimit(modeLimit)
            .options().rootAccuracyRangeM(0.001)
            .options().meshPointsPerLayer(4000)
            .build();
    }
    function nativeProfilePoints(params: any, waterDepthM: any): any {
        const source: any = Array.isArray(params.sspPoints) ? params.sspPoints : [];
        const points: any = source
            .map((point: any): any => [Number(point?.[0]), Number(point?.[1])])
            .filter(([depth, speed]: any): any => Number.isFinite(depth) && Number.isFinite(speed) && speed > 0)
            .map(([depth, speed]: any): any => [clamp(depth, 0, waterDepthM), speed])
            .sort((left: any, right: any): any => left[0] - right[0]);
        const unique: any = [];
        for (const point of points) {
            if (unique.length && Math.abs(unique.at(-1)[0] - point[0]) < 1e-9)
                unique[unique.length - 1] = point;
            else
                unique.push(point);
        }
        if (!unique.length) {
            const fallback: any = makeEnvironment(params);
            return Array.from(fallback.depthsM, (depth: any, index: any): any => [depth, fallback.soundSpeedMps[index]]);
        }
        if (unique[0][0] > 0)
            unique.unshift([0, unique[0][1]]);
        if (unique.at(-1)[0] < waterDepthM)
            unique.push([waterDepthM, unique.at(-1)[1]]);
        if (unique.length === 1)
            unique.push([waterDepthM, unique[0][1]]);
        return unique;
    }
    function nativeInterpolation(value: any, WaveguideInterpolation: any): any {
        switch (String(value || "linear").trim().toUpperCase().replaceAll("-", "_")) {
            case "SQUARED_SLOWNESS_LINEAR": return WaveguideInterpolation.SQUARED_SLOWNESS_LINEAR;
            case "CUBIC":
            case "CUBIC_SPLINE": return WaveguideInterpolation.CUBIC_SPLINE;
            case "PCHIP": return WaveguideInterpolation.PCHIP;
            default: return WaveguideInterpolation.LINEAR;
        }
    }
    async function parseKrakenEnvironment(input: any): Promise<any> {
        if (!input || typeof input.envText !== "string" || typeof input.flpText !== "string") {
            throw new TypeError("Kraken import requires envText and flpText strings");
        }
        const envName: any = input.envName || "environment.env";
        const flpName: any = input.flpName || "environment.flp";
        const documents: any = [
            { name: envName, kind: "kraken-env", content: input.envText },
            { name: flpName, kind: "kraken-flp", content: input.flpText },
        ];
        const { KrakenInput }: any = await loadNormalPackage();
        let nativeInput: any;
        try {
            nativeInput = KrakenInput.fromEnvironmentFiles({
                env: { name: envName, text: input.envText },
                flp: { name: flpName, text: input.flpText },
            });
        }
        catch (error: any) {
            throw new RuntimeError("INPUT_INVALID", "Kraken ENV/FLP 无法解析", { cause: error });
        }
        const pageEnvironment: any = await importNormalModePageEnvironment(documents);
        const sourceId: any = `normal-source-${nextImportedSourceId++}`;
        const rangesM: any = nativeInput.receivers.rangesM;
        const firstProfile: any = nativeInput.environment.profiles[0];
        const firstLayer: any = firstProfile?.layers[0];
        const profilePoints: any = firstLayer
            ? Array.from(firstLayer.depthsM, (depth: any, index: any): any => [depth, firstLayer.compressionalSpeedMps[index]])
            : pageEnvironment.profilePoints;
        const baseline: any = {
            frequencyHz: nativeInput.environment.frequencyHz,
            sourceDepthM: Number(nativeInput.source.depthsM[0] ?? pageEnvironment.sourceDepthM),
            maximumRangeKm: Math.max(...rangesM) / 1000,
            phaseSpeedLowMps: nativeInput.environment.phaseSpeedLowMps,
            phaseSpeedHighMps: nativeInput.environment.phaseSpeedHighMps,
            waterDepthM: pageEnvironment.waterDepthM,
            profilePoints,
            interpolation: firstProfile.interpolation,
            bottomSoundSpeedMps: firstProfile.bottom.compressionalSpeedMps,
            bottomDensityRelative: firstProfile.bottom.densityRelative,
            bottomAttenuationDbPerWavelength: firstProfile.bottom.compressionalAttenuation,
        };
        importedInputCache.set(sourceId, {
            input: nativeInput,
            baseline,
            documents: documents.map((document: any): any => ({ ...document })),
        });
        while (importedInputCache.size > 3) {
            importedInputCache.delete(importedInputCache.keys().next().value);
        }
        return {
            ...pageEnvironment,
            sourceId,
            sourceFiles: [envName, flpName],
            documents: documents.map((document: any): any => ({ name: document.name, kind: document.kind })),
            frequencyHz: baseline.frequencyHz,
            sourceDepthM: baseline.sourceDepthM,
            maximumRangeKm: baseline.maximumRangeKm,
            phaseSpeedLowMps: baseline.phaseSpeedLowMps,
            phaseSpeedHighMps: baseline.phaseSpeedHighMps,
            profilePoints,
            receiverRangesM: rangesM.slice(),
            receiverDepthsM: nativeInput.receivers.depthsM.slice(),
            modelHints: {
                ...pageEnvironment.modelHints,
                model: "Kraken",
                profileCount: nativeInput.environment.profiles.length,
                receiverRangeCount: rangesM.length,
                receiverDepthCount: nativeInput.receivers.depthsM.length,
            },
        };
    }
    function requestedModeLimit(params: any): any {
        const value: any = Math.round(Number(params.modeLimit));
        return Number.isFinite(value) ? Math.max(1, value) : 24;
    }
    function outcomeFailure(outcome: any): any {
        const diagnostics: any = Array.from(outcome?.diagnostics || [], (issue: any): any => {
            const location: any = issue.path ? ` (${issue.path})` : "";
            return `${issue.code || "KRAKEN_RUN_FAILED"}${location}: ${issue.message || "unknown error"}`;
        });
        return diagnostics.length ? diagnostics.join("; ") : `Kraken run failed with status ${outcome?.status || "UNKNOWN"}`;
    }
    async function rawNormalRun(input: any, modeLimit: any): Promise<any> {
        const [solver, { RunStatus }]: any = await Promise.all([normalSolver(), loadNormalPackage()]);
        const outcome: any = await solver.run(input);
        if (outcome?.status !== RunStatus.SUCCEEDED || !outcome.result) {
            throw new Error(outcomeFailure(outcome));
        }
        return {
            input,
            modeLimit,
            outcome,
            field: outcome.result.pressureField(0),
            modes: outcome.result.modes(),
        };
    }
    function cachedNormalRuns(params: any): any {
        const key: any = normalEnvironmentKey(params);
        let full: any = fullRunCache.get(key);
        if (!full) {
            full = makeNativeInput(params, FULL_MODE_LIMIT)
                .then((input: any): any => rawNormalRun(input, FULL_MODE_LIMIT));
            fullRunCache.set(key, full);
            full.catch((): any => {
                if (fullRunCache.get(key) === full)
                    fullRunCache.delete(key);
            });
        }
        const requested: any = requestedModeLimit(params);
        const limitedKey: any = `${key}|${requested}`;
        let limited: any = limitedRunCache.get(limitedKey);
        if (!limited) {
            limited = full.then(async (fullResult: any): Promise<any> => {
                const available: any = firstModeProfile(fullResult.modes).count;
                if (requested >= available)
                    return fullResult;
                const { KrakenInput }: any = await loadNormalPackage();
                const limitedInput: any = KrakenInput.edit(fullResult.input)
                    .options().modeLimit(requested)
                    .build();
                return rawNormalRun(limitedInput, requested);
            });
            limitedRunCache.set(limitedKey, limited);
            limited.catch((): any => {
                if (limitedRunCache.get(limitedKey) === limited)
                    limitedRunCache.delete(limitedKey);
            });
        }
        trimNormalCaches();
        return { full, limited };
    }
    function asFloat64(values: any): any {
        return values instanceof Float64Array ? values : Float64Array.from(values || []);
    }
    function asFloat32(values: any): any {
        return values instanceof Float32Array ? values : Float32Array.from(values || []);
    }
    function pressureFieldToDepthRangeTl(rawField: any): any {
        const frequencyCount: any = rawField.frequenciesHz.length;
        const columns: any = rawField.receiverRangesM.length;
        const rows: any = rawField.receiverDepthsM.length;
        const pressure: any = asFloat32(rawField.pressureInterleaved);
        const expectedLength: any = frequencyCount * columns * rows * 2;
        if (!frequencyCount || !columns || !rows || pressure.length !== expectedLength) {
            throw new Error(`Kraken pressure storage has ${pressure.length} values; expected ${expectedLength}`);
        }
        const tlDb: any = new Float32Array(rows * columns);
        // Kraken exposes [frequency][range][depth][real/imaginary]. The page heatmap
        // consumes depth-major rows, so transpose the first frequency plane here.
        for (let rangeIndex: any = 0; rangeIndex < columns; rangeIndex += 1) {
            for (let depthIndex: any = 0; depthIndex < rows; depthIndex += 1) {
                const source: any = (rangeIndex * rows + depthIndex) * 2;
                const magnitude: any = Math.hypot(pressure[source], pressure[source + 1]);
                tlDb[depthIndex * columns + rangeIndex] = Number.isFinite(magnitude)
                    ? -20 * Math.log10(Math.max(MINIMUM_FLOAT32_MAGNITUDE, magnitude))
                    : Number.NaN;
            }
        }
        return { rows, columns, tlDb };
    }
    function firstModeProfile(rawModes: any): any {
        if (!rawModes?.modeCounts?.length)
            throw new Error("Kraken did not return a mode profile");
        const profileIndex: any = 0;
        const count: any = Number(rawModes.modeCounts[profileIndex]);
        const depthCount: any = Number(rawModes.depthCounts[profileIndex]);
        const depthOffset: any = Number(rawModes.depthOffsets[profileIndex]);
        const wavenumberOffset: any = Number(rawModes.wavenumberOffsets[profileIndex]);
        const shapeOffset: any = Number(rawModes.shapeOffsets[profileIndex]);
        const nextShapeOffset: any = Number(rawModes.shapeOffsets[profileIndex + 1]);
        if (!Number.isInteger(count) || count < 1 || !Number.isInteger(depthCount) || depthCount < 2) {
            throw new Error("Kraken returned invalid mode/depth counts");
        }
        if (nextShapeOffset - shapeOffset !== count * depthCount) {
            throw new Error("Kraken mode-shape offsets do not match the profile dimensions");
        }
        const depthsM: any = asFloat64(rawModes.depthsM).slice(depthOffset, depthOffset + depthCount);
        const horizontalWavenumbersInterleaved: any = asFloat64(rawModes.wavenumbersInterleaved)
            .slice(wavenumberOffset * 2, (wavenumberOffset + count) * 2);
        const groupVelocityMps: any = asFloat64(rawModes.groupVelocityMps)
            .slice(wavenumberOffset, wavenumberOffset + count);
        const modeShapesInterleaved: any = asFloat64(rawModes.modeShapesInterleaved)
            .slice(shapeOffset * 2, nextShapeOffset * 2);
        const frequencyHz: any = Number(rawModes.frequenciesHz[profileIndex]);
        const angularFrequency: any = 2 * Math.PI * frequencyHz;
        const phaseSpeedMps: any = Float64Array.from({ length: count }, (_: any, index: any): any => (angularFrequency / Math.max(1e-12, horizontalWavenumbersInterleaved[index * 2])));
        return {
            count,
            frequencyHz,
            depthsM,
            horizontalWavenumbersInterleaved,
            phaseSpeedMps,
            groupVelocityMps,
            modeShapesInterleaved,
        };
    }
    function nativeSampledEnvironment(params: any, modeDepths: any): any {
        const depthsM: any = asFloat64(modeDepths);
        const soundSpeedMps: any = Float64Array.from(depthsM, (depth: any): any => interpolatedSoundSpeed(params.sspPoints, depth));
        return { depthsM, soundSpeedMps };
    }
    async function runNativeNormalMode(params: any): Promise<any> {
        const started: any = performance.now();
        const { full, limited }: any = cachedNormalRuns(params);
        const [fullRaw, activeRaw]: any = await Promise.all([full, limited]);
        const profile: any = firstModeProfile(fullRaw.modes);
        const fullField: any = pressureFieldToDepthRangeTl(fullRaw.field);
        const activeField: any = activeRaw === fullRaw
            ? fullField
            : pressureFieldToDepthRangeTl(activeRaw.field);
        const { rows, columns }: any = fullField;
        const fullTlDb: any = fullField.tlDb;
        const activeTlDb: any = activeField.tlDb;
        if (activeField.rows !== rows || activeField.columns !== columns) {
            throw new Error("Kraken full and truncated fields use different grids");
        }
        if (fullTlDb.length !== activeTlDb.length) {
            throw new Error("Kraken full and truncated fields use different grids");
        }
        const deltaTlDb: any = new Float32Array(fullTlDb.length);
        let squareSum: any = 0;
        let maximumDifference: any = 0;
        let compared: any = 0;
        for (let index: any = 0; index < deltaTlDb.length; index += 1) {
            const active: any = activeTlDb[index];
            const complete: any = fullTlDb[index];
            if (!Number.isFinite(active) || !Number.isFinite(complete)) {
                deltaTlDb[index] = Number.NaN;
                continue;
            }
            const difference: any = active - complete;
            deltaTlDb[index] = difference;
            if (active >= 40 && active <= 140 && complete >= 40 && complete <= 140) {
                squareSum += difference * difference;
                maximumDifference = Math.max(maximumDifference, Math.abs(difference));
                compared += 1;
            }
        }
        const rangesKm: any = Float64Array.from(fullRaw.field.receiverRangesM, (value: any): any => value / 1000);
        const fieldDepthsM: any = asFloat64(fullRaw.field.receiverDepthsM);
        const modeDepthsM: any = profile.depthsM;
        const environment: any = nativeSampledEnvironment(params, modeDepthsM);
        const activeModeCount: any = Math.min(profile.count, activeRaw.modeLimit);
        const solver: any = await normalSolver();
        const nativeComputeMs: any = Number(fullRaw.outcome.timing.computationNs || 0) / 1e6
            + (activeRaw === fullRaw ? 0 : Number(activeRaw.outcome.timing.computationNs || 0) / 1e6);
        return validateResult({
            contractVersion: 1,
            runtime: {
                mode: "wasm", engine: "OOB KRAKEN · WASM", fallback: false,
                computeMs: performance.now() - started,
                nativeComputeMs,
                executionMode: solver.runtime.executionMode,
                threadCount: solver.runtime.threadCount,
            },
            environment: {
                profile: params.profile,
                waterDepthM: params.waterDepthM,
                sourceDepthM: fullRaw.field.sourceDepthM ?? params.sourceDepthM,
                frequencyHz: profile.frequencyHz,
                depthsM: environment.depthsM,
                soundSpeedMps: environment.soundSpeedMps,
            },
            modes: {
                count: profile.count,
                depthsM: modeDepthsM,
                horizontalWavenumbersInterleaved: profile.horizontalWavenumbersInterleaved,
                phaseSpeedMps: profile.phaseSpeedMps,
                groupVelocityMps: profile.groupVelocityMps,
                modeShapesInterleaved: profile.modeShapesInterleaved,
            },
            field: {
                rows, columns, rangesKm, depthsM: fieldDepthsM,
                tlDb: activeTlDb, activeModeCount,
            },
            fullField: { rows, columns, rangesKm, depthsM: fieldDepthsM, tlDb: fullTlDb },
            deltaField: { rows, columns, rangesKm, depthsM: fieldDepthsM, values: deltaTlDb },
            metrics: {
                deltaRmsDb: compared ? Math.sqrt(squareSum / compared) : Number.NaN,
                deltaMaxDb: compared ? maximumDifference : Number.NaN,
                comparedCellCount: compared,
            },
        });
    }
    function cancelledNativeRequest(): any {
        return new RuntimeError("CANCELLED", "A newer Normal Mode request replaced this calculation");
    }
    async function runLatestNativeNormalMode(params: any): Promise<any> {
        const requestId: any = ++latestNativeRequestId;
        if (nativeRequestActive && normalSolverPromise) {
            const solver: any = await normalSolverPromise;
            solver.cancel();
            fullRunCache.clear();
            limitedRunCache.clear();
        }
        nativeRequestActive = true;
        try {
            const result: any = await runNativeNormalMode(params);
            if (requestId !== latestNativeRequestId)
                throw cancelledNativeRequest();
            return result;
        }
        finally {
            if (requestId === latestNativeRequestId)
                nativeRequestActive = false;
        }
    }
    async function runNormalMode(params: any): Promise<any> {
        try {
            return await runLatestNativeNormalMode(params);
        }
        catch (error: any) {
            throw normalizeRuntimeError(error);
        }
    }
    function runNormalModeDemonstration(params: any): any {
        return demonstrationResult(params, "URL requested the deterministic demo adapter");
    }
    async function prepareNormalModeEngine(): Promise<any> {
        const solver: any = await normalSolver();
        return {
            packageName: "@openocean/field-normal-mode-kraken",
            packageVersion: "2.0.0",
            model: "Kraken",
            executionMode: solver.runtime.executionMode,
            threadCount: solver.runtime.threadCount,
            memoryLimitBytes: solver.runtime.memoryLimitBytes,
        };
    }
    function cancelNormalModeEngine(): any {
        if (normalSolverPromise)
            void normalSolverPromise.then((solver: any): any => solver.cancel());
        latestNativeRequestId += 1;
        fullRunCache.clear();
        limitedRunCache.clear();
    }
    async function disposeNormalModeEngine(): Promise<any> {
        cancelNormalModeEngine();
        importedInputCache.clear();
        const solverPromise: any = normalSolverPromise;
        normalSolverPromise = undefined;
        normalPackagePromise = undefined;
        const solver: any = solverPromise ? await solverPromise : null;
        if (solver)
            await solver.dispose();
    }
    return {
        prepare: prepareNormalModeEngine,
        importEnvironment: parseKrakenEnvironment,
        run: runNormalMode,
        runDemonstration: runNormalModeDemonstration,
        cancel: cancelNormalModeEngine,
        dispose: disposeNormalModeEngine
    };
}
