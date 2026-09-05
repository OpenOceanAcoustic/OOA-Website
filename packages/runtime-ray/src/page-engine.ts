import { AttenuationUnit, AxisInput, BeamType, BeamWidthType, Bellhop2D, Bellhop2DInput, BoundaryCondition, BoundaryInterpolation, RunMode, RunStatus, SspInterpolation, VolumeAttenuation, } from "./sdk-loader";
import { importRayPageEnvironment } from "./environment-parser";
import { inferEnvironmentDocumentKind } from "@ooa/environment";
import { RuntimeError, normalizeRuntimeError } from "@ooa/runtime-core";
import { DEFAULT_WATER_DEPTH_M, generateSspProfile, } from "@ooa/environment/ssp-profiles";
import { resolveRayFieldLaunchAngleCount } from "./page-beam-count";
export function createRayPageEngine(): any {
    const MAX_RANGE_M: any = 100000;
    // Browser-interactive defaults. The server version could spend minutes on a
    // 1000 x 201 x 201 sweep; this keeps the native model responsive on laptops.
    const DEFAULT_FIELD_LAUNCH_ANGLE_COUNT: any = 1000;
    const EIGEN_LAUNCH_ANGLE_COUNT: any = 1000;
    const DISPLAY_RAY_COUNT: any = 50;
    const DISPLAY_RAY_BATCH_SIZE: any = 10;
    const FIELD_RANGE_COUNT: any = 201;
    const FIELD_DEPTH_COUNT: any = 201;
    const ANGLE_MIN_DEG: any = -20.3;
    const ANGLE_MAX_DEG: any = 20.3;
    const MEMORY_LIMIT_BYTES: any = 768 * 1024 * 1024;
    const FIELD_MEMORY_BUDGET_BYTES: any = 256 * 1024 * 1024;
    const FIELD_BEAM_TYPES: any = Object.freeze([
        BeamType.GEOMETRIC_CARTESIAN,
        BeamType.GEOMETRIC_RAY_CENTERED,
        BeamType.GAUSSIAN_CARTESIAN,
        BeamType.GAUSSIAN_RAY_CENTERED,
        BeamType.GAUSSIAN_SIMPLE,
    ]);
    const FIELD_BEAM_TYPE_SET: any = new Set(FIELD_BEAM_TYPES);
    const IMPORTED_FIELD_BEAM_TYPES: any = new Set([
        ...FIELD_BEAM_TYPES,
        BeamType.CERVENY_CARTESIAN,
        BeamType.CERVENY_RAY_CENTERED,
    ]);
    const THREAD_COUNT: any = Math.min(4, Math.max(1, Math.floor((navigator.hardwareConcurrency || 2) / 2)));
    let solverPromise: any;
    let activeThreadCount: any = 1;
    let activeExecutionMode: any = "SINGLE_THREAD";
    let importedInput: any = null;
    let importedDocuments: any = [];
    let importedSourceId: any = null;
    let nextImportedSourceId: any = 1;
    let latestPageRequestId: any = 0;
    let pageRequestActive: any = false;
    function cancelledRequest(): any {
        return new RuntimeError("CANCELLED", "A newer Ray Mode request replaced this calculation");
    }
    async function runLatestPageRequest(operation: any): Promise<any> {
        const requestId: any = ++latestPageRequestId;
        if (pageRequestActive && solverPromise) {
            const solver: any = await solverPromise;
            solver.cancel();
        }
        pageRequestActive = true;
        try {
            const result: any = await operation();
            if (requestId !== latestPageRequestId)
                throw cancelledRequest();
            return result;
        }
        finally {
            if (requestId === latestPageRequestId)
                pageRequestActive = false;
        }
    }
    function normalizeFieldBeamType(value: any, fallback: any = BeamType.GEOMETRIC_CARTESIAN): any {
        const candidate: any = String(value ?? "").trim().toUpperCase();
        return FIELD_BEAM_TYPE_SET.has(candidate) ? candidate : fallback;
    }
    function normalizeImportedFieldBeamType(value: any, fallback: any): any {
        const candidate: any = String(value ?? "").trim().toUpperCase();
        return IMPORTED_FIELD_BEAM_TYPES.has(candidate) ? candidate : fallback;
    }
    function normalizeFieldRunMode(value: any, fallback: any = RunMode.INCOHERENT_TL): any {
        const candidate: any = String(value ?? "").trim().toUpperCase();
        if (candidate === "COHERENT" || candidate === RunMode.COHERENT_TL) {
            return RunMode.COHERENT_TL;
        }
        if (candidate === "INCOHERENT" || candidate === RunMode.INCOHERENT_TL) {
            return RunMode.INCOHERENT_TL;
        }
        return fallback;
    }
    function configuredBeamType(payload: any): any {
        if (!usesImportedEnvironment(payload)) {
            return normalizeFieldBeamType(payload?.beam_type);
        }
        const imported: any = normalizeImportedFieldBeamType(importedInput.options.beam.beamType, BeamType.GEOMETRIC_CARTESIAN);
        return normalizeImportedFieldBeamType(payload?.beam_type, imported);
    }
    function configuredFieldRunMode(payload: any): any {
        const importedRunMode: any = usesImportedEnvironment(payload)
            ? normalizeFieldRunMode(importedInput.options.beam.runMode, null)
            : null;
        return normalizeFieldRunMode(payload?.field_mode, importedRunMode ?? RunMode.INCOHERENT_TL);
    }
    function axisMaximum(axis: any): any {
        if (axis.encoding === "EXPLICIT")
            return Math.max(...axis.values);
        return Math.max(axis.start, axis.end);
    }
    function axisMinimum(axis: any): any {
        if (axis.encoding === "EXPLICIT")
            return Math.min(...axis.values);
        return Math.min(axis.start, axis.end);
    }
    function axisCount(axis: any): any {
        return axis.encoding === "EXPLICIT" ? axis.values.length : axis.count;
    }
    function usesImportedEnvironment(payload: any): any {
        return importedInput !== null && String(payload?.profile || "") === "env";
    }
    function payloadBathymetry(payload: any, maximumRangeM: any = null): any {
        if (!Array.isArray(payload?.bathymetry))
            return [];
        const points: any = payload.bathymetry
            .map((point: any): any => {
            if (Array.isArray(point) || ArrayBuffer.isView(point)) {
                return [Number((point as any)[0]), Number((point as any)[1])];
            }
            if (point && typeof point === "object") {
                const rangeKm: any = point.rangeKm ?? point.range_km
                    ?? (point.rangeM ?? point.range_m) / 1000;
                return [Number(rangeKm), Number(point.depthM ?? point.depth_m ?? point.depth)];
            }
            return [NaN, NaN];
        })
            .filter(([rangeKm, depthM]: any): any => Number.isFinite(rangeKm)
            && Number.isFinite(depthM) && rangeKm >= 0 && depthM > 0)
            .sort((left: any, right: any): any => left[0] - right[0])
            .filter((point: any, index: any, values: any): any => index === 0 || point[0] > values[index - 1][0]);
        if (points.length === 0)
            return [];
        const maximumRangeKm: any = maximumRangeM === null ? null : maximumRangeM / 1000;
        if (points[0][0] > 0)
            points.unshift([0, points[0][1]]);
        if (maximumRangeKm === null)
            return points;
        const clipped: any = [];
        for (const point of points) {
            if (point[0] <= maximumRangeKm) {
                clipped.push(point);
                continue;
            }
            const previous: any = clipped.at(-1);
            if (previous && previous[0] < maximumRangeKm) {
                const weight: any = (maximumRangeKm - previous[0]) / (point[0] - previous[0]);
                clipped.push([maximumRangeKm, previous[1] + weight * (point[1] - previous[1])]);
            }
            break;
        }
        if (clipped.length === 0)
            clipped.push([0, points[0][1]]);
        if (clipped.at(-1)[0] < maximumRangeKm) {
            clipped.push([maximumRangeKm, clipped.at(-1)[1]]);
        }
        return clipped;
    }
    function hasRangeDependentBathymetry(payload: any): any {
        const points: any = payloadBathymetry(payload);
        return points.length > 1 && points.some((point: any): any => (Math.abs(point[1] - points[0][1]) > 1e-6));
    }
    function fieldLaunchAngleCount(payload: any): any {
        if (usesImportedEnvironment(payload))
            return axisCount(importedInput.source.launchAngles);
        return resolveRayFieldLaunchAngleCount(payload?.beam_count, DEFAULT_FIELD_LAUNCH_ANGLE_COUNT);
    }
    function defaultLaunchAngleConfiguration(): any {
        return {
            minimum: ANGLE_MIN_DEG,
            maximum: ANGLE_MAX_DEG,
            minimumDegrees: ANGLE_MIN_DEG,
            maximumDegrees: ANGLE_MAX_DEG,
            anglesAreRadians: false,
        };
    }
    function launchAngleConfiguration(payload: any): any {
        if (!usesImportedEnvironment(payload)) {
            const angles: any = Array.isArray(payload?.angle_range_degrees)
                ? payload.angle_range_degrees.map(Number) : [];
            if (angles.length === 2 && angles.every(Number.isFinite) && angles[0] < angles[1]) {
                return {
                    minimum: clamp(angles[0], -90, 90),
                    maximum: clamp(angles[1], -90, 90),
                    minimumDegrees: clamp(angles[0], -90, 90),
                    maximumDegrees: clamp(angles[1], -90, 90),
                    anglesAreRadians: false,
                };
            }
            return defaultLaunchAngleConfiguration();
        }
        const axis: any = importedInput.source.launchAngles;
        const minimum: any = axisMinimum(axis);
        const maximum: any = axisMaximum(axis);
        const anglesAreRadians: any = importedInput.source.launchAnglesAreRadians;
        const scale: any = anglesAreRadians ? 180 / Math.PI : 1;
        return {
            minimum,
            maximum,
            minimumDegrees: minimum * scale,
            maximumDegrees: maximum * scale,
            anglesAreRadians,
        };
    }
    function computationalLaunchAngleBounds(configuration: any, launchCount: any): any {
        const touchesVertical: any = configuration.minimumDegrees <= -89.999
            || configuration.maximumDegrees >= 89.999;
        if (!touchesVertical || launchCount < 2) {
            return [configuration.minimum, configuration.maximum];
        }
        const halfStep: any = (configuration.maximum - configuration.minimum)
            / (2 * launchCount);
        return [configuration.minimum + halfStep, configuration.maximum - halfStep];
    }
    function launchAngleSamples(configuration: any, count: any): any {
        const [minimum, maximum]: any = computationalLaunchAngleBounds(configuration, count);
        return Array.from({ length: count }, (_: any, index: any): any => (count === 1 ? minimum : minimum + (maximum - minimum) * index / (count - 1)));
    }
    function calculationDomain(payload: any): any {
        if (!usesImportedEnvironment(payload)) {
            const waterDepthM: any = clamp(payload?.water_depth_m ?? DEFAULT_WATER_DEPTH_M, 50, 12000);
            const maximumRangeM: any = clamp((payload?.maximum_range_km ?? MAX_RANGE_M / 1000) * 1000, 100, 250000);
            const bottomDepths: any = payloadBathymetry(payload, maximumRangeM).map((point: any): any => point[1]);
            return {
                maximumRangeM,
                maximumDepthM: Math.max(waterDepthM, ...bottomDepths),
                waterDepthM,
            };
        }
        const { environment, receivers, options }: any = importedInput;
        const rangeLimits: any = [MAX_RANGE_M, axisMaximum(receivers.ranges)];
        if ("rangesM" in environment.ssp) {
            rangeLimits.push(Math.max(...environment.ssp.rangesM.filter((value: any): any => value > 0)));
        }
        if (options.beam.maximumRangeM > 0)
            rangeLimits.push(options.beam.maximumRangeM);
        const maximumRangeM: any = Math.max(100, Math.min(...rangeLimits.filter((value: any): any => Number.isFinite(value) && value > 0)));
        const boundaryDepths: any = [
            environment.boundary.surface.halfspace.depthM,
            environment.boundary.bottom.halfspace.depthM,
            ...environment.boundary.surface.points.map((point: any): any => point.depthM),
            ...environment.boundary.bottom.points.map((point: any): any => point.depthM),
        ];
        const waterDepthM: any = Math.max(...environment.ssp.depthsM);
        const maximumDepthM: any = Math.max(waterDepthM, options.beam.maximumDepthM, ...boundaryDepths);
        return { maximumRangeM, maximumDepthM, waterDepthM };
    }
    function sspProfile(ssp: any): any {
        const depths: any = Array.from(ssp.depthsM);
        let speeds: any;
        if ("compressionalSpeedMps" in ssp) {
            speeds = Array.from(ssp.compressionalSpeedMps);
        }
        else {
            const ranges: any = Array.from(ssp.rangesM);
            const rangeIndex: any = ranges.reduce((best: any, value: any, index: any): any => (Math.abs(value) < Math.abs(ranges[best]) ? index : best), 0);
            speeds = Array.from(ssp.soundSpeedMps).slice(rangeIndex * depths.length, (rangeIndex + 1) * depths.length);
        }
        return { depths, speeds };
    }
    function importedProfile(payload: any): any {
        if (usesImportedEnvironment(payload)) {
            const { depths, speeds }: any = sspProfile(importedInput.environment.ssp);
            return { profile: "env", depths, speeds };
        }
        return generateSspProfile({
            profile: payload.profile,
            axisDepthM: payload.axis_depth,
            gradient: payload.gradient,
            waterDepthM: payload.water_depth_m,
            sspPoints: payload.ssp_points,
        });
    }
    function displayedBathymetry(domain: any, payload: any): any {
        if (!usesImportedEnvironment(payload)) {
            const customPoints: any = payloadBathymetry(payload, domain.maximumRangeM);
            if (customPoints.length > 1)
                return customPoints;
            return [[0, domain.waterDepthM], [domain.maximumRangeM / 1000, domain.waterDepthM]];
        }
        const bottom: any = importedInput.environment.boundary.bottom;
        const maximumRangeKm: any = domain.maximumRangeM / 1000;
        const sourcePoints: any = bottom.points.map((point: any): any => [point.rangeM / 1000, point.depthM]);
        const points: any = [];
        for (const point of sourcePoints) {
            if (point[0] < 0)
                continue;
            if (point[0] <= maximumRangeKm) {
                points.push(point);
                continue;
            }
            const previous: any = points.at(-1);
            if (previous !== undefined && previous[0] < maximumRangeKm) {
                const weight: any = (maximumRangeKm - previous[0]) / (point[0] - previous[0]);
                points.push([
                    maximumRangeKm,
                    previous[1] + weight * (point[1] - previous[1]),
                ]);
            }
            break;
        }
        if (points.length !== 0)
            return points;
        const depth: any = bottom.halfspace.depthM || domain.waterDepthM;
        return [[0, depth], [domain.maximumRangeM / 1000, depth]];
    }
    function plotMaximumDepthM(domain: any, payload: any): any {
        if (!usesImportedEnvironment(payload)) {
            const bottomDepths: any = payloadBathymetry(payload, domain.maximumRangeM).map((point: any): any => point[1]);
            const deepest: any = Math.max(domain.waterDepthM, ...bottomDepths);
            return bottomDepths.length === 0 ? domain.waterDepthM : Math.ceil(deepest * 1.05 / 100) * 100;
        }
        const bottomDepths: any = importedInput.environment.boundary.bottom.points.map((point: any): any => point.depthM);
        const deepest: any = Math.max(domain.waterDepthM, ...bottomDepths);
        return Math.ceil(deepest * 1.05 / 100) * 100;
    }
    function initializeWasm(): any {
        if (!solverPromise) {
            const supportsThreads: any = !import.meta.env.DEV && globalThis.crossOriginIsolated === true;
            const runtime: any = supportsThreads
                ? { ...Bellhop2D.recommendedRuntime(), threadCount: THREAD_COUNT }
                : { executionMode: "SINGLE_THREAD", threadCount: 1 };
            activeThreadCount = runtime.threadCount;
            activeExecutionMode = runtime.executionMode;
            solverPromise = Bellhop2D.create({
                ...runtime,
                memoryLimitBytes: MEMORY_LIMIT_BYTES,
            });
        }
        return solverPromise;
    }
    async function prepareRayEngine(): Promise<any> {
        await initializeWasm();
        return {
            packageName: "@openocean/field-bellhop-2d",
            packageVersion: "2.0.0",
            model: "Bellhop2D",
            executionMode: activeExecutionMode,
            threadCount: activeThreadCount,
            memoryLimitBytes: MEMORY_LIMIT_BYTES,
        };
    }
    function cancelRayEngine(): any {
        latestPageRequestId += 1;
        pageRequestActive = false;
        if (solverPromise)
            void solverPromise.then((solver: any): any => solver.cancel());
    }
    async function disposeRayEngine(): Promise<any> {
        cancelRayEngine();
        importedInput = null;
        importedDocuments = [];
        importedSourceId = null;
        const activeSolver: any = solverPromise;
        solverPromise = undefined;
        if (activeSolver)
            await (await activeSolver).dispose();
    }
    function firstAxisValue(axis: any, fallback: any): any {
        if (axis.encoding === "EXPLICIT")
            return Number(axis.values[0] ?? fallback);
        return Number(axis.start ?? fallback);
    }
    /** Parse uploaded ENV/sidecar files with OOB inside the browser worker. */
    async function importEnvironment(files: any): Promise<any> {
        const documents: any = await Promise.all([...files].map(async (file: any): Promise<any> => ({
            name: file.name,
            kind: inferEnvironmentDocumentKind(file.name, "ray"),
            content: await file.text(),
        })));
        const environment: any = documents.find((document: any): any => document.kind === "bellhop-env");
        if (!environment)
            throw new TypeError("Bellhop import requires one ENV file");
        const sidecar: any = (kind: any): any => {
            const document: any = documents.find((candidate: any): any => candidate.kind === kind);
            return document ? { name: document.name, text: document.content } : undefined;
        };
        let input: any;
        try {
            input = Bellhop2DInput.fromEnvironmentFiles({
                env: { name: environment.name, text: environment.content },
                ssp: sidecar("bellhop-ssp"),
                bty: sidecar("bellhop-bty"),
            });
        }
        catch (error: any) {
            const detail: any = error instanceof Error && error.message.trim()
                ? error.message.trim() : String(error || "未知错误");
            throw new RuntimeError("INPUT_INVALID", "Bellhop2D 原生环境解析失败：" + detail, { cause: error });
        }
        const pageEnvironment: any = await importRayPageEnvironment(documents);
        importedInput = input;
        importedDocuments = documents.map((document: any): any => ({ ...document }));
        importedSourceId = `ray-source-${nextImportedSourceId++}`;
        const profile: any = sspProfile(input.environment.ssp);
        const launchAngles: any = launchAngleConfiguration({ profile: "env" });
        const maximumRangeKm: any = calculationDomain({ profile: "env" }).maximumRangeM / 1000;
        return {
            ...pageEnvironment,
            sourceId: importedSourceId,
            sourceFiles: documents.map((document: any): any => document.name),
            sspPoints: profile.depths.map((depth: any, index: any): any => [depth, profile.speeds[index]]),
            frequency: input.environment.frequencyHz,
            sourceDepth: firstAxisValue(input.source.depths, pageEnvironment.sourceDepth),
            maximumRangeKm,
            maximumDepthM: calculationDomain({ profile: "env" }).maximumDepthM,
            angleRangeDegrees: [launchAngles.minimumDegrees, launchAngles.maximumDegrees],
            fieldRayCount: axisCount(input.source.launchAngles),
            fieldGridRows: axisCount(input.receivers.depths),
            fieldGridColumns: axisCount(input.receivers.ranges),
            beamType: input.options.beam.beamType,
            runMode: input.options.beam.runMode,
            fieldMode: input.options.beam.runMode,
            rangeDependent: "rangesM" in input.environment.ssp,
            documents: documents.map((document: any): any => ({ name: document.name, kind: document.kind })),
        };
    }
    function clamp(value: any, lower: any, upper: any): any {
        return Math.max(lower, Math.min(upper, Number(value)));
    }
    function round(value: any, digits: any = 7): any {
        const scale: any = 10 ** digits;
        return Math.round(value * scale) / scale;
    }
    function configuredInput(payload: any, runMode: any, launchCount: any, receiverDepths: any, receiverRanges: any, velocityEnabled: any = false, launchAngleValues: any = null, launchAngleOverride: any = null, maximumRangeOverrideM: any = null): any {
        const profile: any = importedProfile(payload);
        const domain: any = calculationDomain(payload);
        const useImported: any = usesImportedEnvironment(payload);
        const launchAngles: any = launchAngleOverride ?? launchAngleConfiguration(payload);
        const customBottomPoints: any = useImported ? [] : payloadBathymetry(payload, domain.maximumRangeM)
            .map(([rangeKm, depthM]: any): any => ({ rangeM: rangeKm * 1000, depthM }));
        const customBottomDepthM: any = customBottomPoints[0]?.depthM ?? domain.waterDepthM;
        const bottomSpeed: any = clamp(payload.bottom_speed ?? 1700, 1400, 3000);
        const bottomDensity: any = clamp(payload.bottom_density ?? 1800, 1000, 3500);
        const bottomAbsorption: any = clamp(payload.bottom_absorption ?? 0.5, 0, 5);
        const frequency: any = clamp(payload.frequency ?? 500, 20, 10000);
        const sourceDepth: any = clamp(payload.source_depth ?? 1000, 0, domain.waterDepthM);
        const emptyHalfspace: any = {
            depthM: 0,
            compressionalSpeedMps: 0,
            compressionalAttenuation: 0,
            shearSpeedMps: 0,
            shearAttenuation: 0,
            densityRelative: 0,
            grainSize: 0,
        };
        const environment: any = {
            title: "OOB interactive Munk laboratory",
            frequencyHz: frequency,
            frequenciesHz: [],
            ssp: {
                depthsM: profile.depths,
                compressionalSpeedMps: profile.speeds,
                densityRelative: [],
                compressionalAttenuation: [],
                shearSpeedMps: [],
                shearAttenuation: [],
                interpolation: SspInterpolation.C_LINEAR,
                attenuationUnit: AttenuationUnit.DB_PER_WAVELENGTH,
                volumeAttenuation: VolumeAttenuation.NONE,
                temperatureCelsius: 20,
                salinityPsu: 35,
                ph: 8,
                meanDepthM: domain.waterDepthM / 2,
            },
            boundary: {
                surface: {
                    condition: BoundaryCondition.VACUUM,
                    interpolation: BoundaryInterpolation.NONE,
                    halfspace: emptyHalfspace,
                    points: [],
                    pointMaterials: [],
                },
                bottom: {
                    condition: BoundaryCondition.HALF_SPACE,
                    interpolation: customBottomPoints.length > 1
                        ? BoundaryInterpolation.LINEAR_SHORT : BoundaryInterpolation.NONE,
                    halfspace: {
                        ...emptyHalfspace,
                        depthM: customBottomDepthM,
                        compressionalSpeedMps: bottomSpeed,
                        compressionalAttenuation: bottomAbsorption,
                        densityRelative: bottomDensity / 1000,
                    },
                    points: customBottomPoints,
                    pointMaterials: [],
                },
            },
        };
        const receivers: any = {
            depths: receiverDepths,
            ranges: receiverRanges,
            radialVelocityMps: 0,
        };
        let builder: any;
        if (!useImported) {
            builder = Bellhop2DInput.easyStart({
                environment,
                source: { depths: AxisInput.explicit([sourceDepth]) },
                receivers,
                outputRequest: { runMode },
            });
        }
        else {
            const importedBoundary: any = importedInput.environment.boundary;
            builder = Bellhop2DInput.edit(importedInput);
            builder.environment().frequencyHz(frequency);
            builder.environment().boundary({
                surface: importedBoundary.surface,
                bottom: {
                    ...importedBoundary.bottom,
                    halfspace: {
                        ...importedBoundary.bottom.halfspace,
                        compressionalSpeedMps: bottomSpeed,
                        compressionalAttenuation: bottomAbsorption,
                        densityRelative: bottomDensity / 1000,
                    },
                },
            });
            builder.source().depths(AxisInput.explicit([sourceDepth]));
            builder.receivers().depths(receiverDepths);
            builder.receivers().ranges(receiverRanges);
            builder.options().runMode(runMode);
        }
        if (launchAngleValues === null) {
            const [minimumLaunchAngle, maximumLaunchAngle]: any = computationalLaunchAngleBounds(launchAngles, launchCount);
            builder.source().launchAngles(AxisInput.linspace(minimumLaunchAngle, maximumLaunchAngle, launchCount), launchAngles.anglesAreRadians);
        }
        else {
            builder.source().launchAngles(AxisInput.explicit(launchAngleValues), launchAngles.anglesAreRadians);
        }
        builder.options().maximumRangeM(maximumRangeOverrideM ?? (useImported ? domain.maximumRangeM : domain.maximumRangeM + 1000));
        // Beam influence is independent of the output RunMode. Apply it to both
        // display-ray and field inputs so the selected model is present in every
        // immutable SDK input/cache identity built by this adapter.
        const beamType: any = configuredBeamType(payload);
        builder.options().beamType(beamType);
        if (useImported && beamType !== importedInput.options.beam.beamType) {
            // A user override must not inherit an ENV-only Cerveny width policy from
            // the original type. Keeping the original type, including Cerveny,
            // intentionally preserves the rest of the imported Beam configuration.
            builder.options().beamWidthType(BeamWidthType.NONE);
        }
        builder.options().maximumDepthM(domain.maximumDepthM + 100);
        // A bounded integration step is essential in the browser: Bellhop's
        // frequency-derived automatic step is server-grade and can take minutes
        // over a 100 km path. This matches the 50 m SSP sampling interval.
        builder.options().stepM(50);
        builder.options().velocityEnabled(velocityEnabled);
        const receiverRange: any = receiverRanges.encoding === "EXPLICIT"
            ? Math.max(...receiverRanges.values)
            : Math.max(receiverRanges.start, receiverRanges.end);
        const toleranceM: any = clamp(payload.tolerance ?? 1, 0.05, 25);
        builder.options().toleranceRadians(Math.max(1e-10, toleranceM / Math.max(1, receiverRange)));
        return {
            input: builder.build(),
            profile,
            bottom: { bottomSpeed, bottomDensity, bottomAbsorption },
        };
    }
    async function memoryFittedFieldConfiguration(payload: any, receiverDepths: any, receiverRanges: any): Promise<any> {
        const solver: any = await initializeWasm();
        const requestedCount: any = fieldLaunchAngleCount(payload);
        const runMode: any = configuredFieldRunMode(payload);
        const build: any = (count: any): any => configuredInput(payload, runMode, count, receiverDepths, receiverRanges, true);
        let configuration: any = build(requestedCount);
        let estimate: any = await solver.estimateMemory(configuration.input);
        if (estimate.estimatedPeakBytes <= FIELD_MEMORY_BUDGET_BYTES) {
            return {
                configuration, estimate, requestedCount, actualCount: requestedCount, runMode,
            };
        }
        const baseline: any = build(2);
        const baselineEstimate: any = await solver.estimateMemory(baseline.input);
        const bytesPerRay: any = Math.max(1, (estimate.estimatedPeakBytes - baselineEstimate.estimatedPeakBytes)
            / (requestedCount - 2));
        let actualCount: any = Math.max(2, Math.min(requestedCount, Math.floor(2 + (FIELD_MEMORY_BUDGET_BYTES - baselineEstimate.estimatedPeakBytes)
            / bytesPerRay)));
        configuration = build(actualCount);
        estimate = await solver.estimateMemory(configuration.input);
        if (estimate.estimatedPeakBytes > FIELD_MEMORY_BUDGET_BYTES) {
            const excessRays: any = Math.ceil((estimate.estimatedPeakBytes - FIELD_MEMORY_BUDGET_BYTES) / bytesPerRay);
            actualCount = Math.max(2, actualCount - excessRays);
            configuration = build(actualCount);
            estimate = await solver.estimateMemory(configuration.input);
        }
        return { configuration, estimate, requestedCount, actualCount, runMode };
    }
    async function execute(input: any): Promise<any> {
        const solver: any = await initializeWasm();
        const outcome: any = await solver.run(input);
        if (outcome.status !== RunStatus.SUCCEEDED || outcome.result === null) {
            const message: any = outcome.diagnostics.map((item: any): any => item.message).join("; ");
            throw new Error(message || `Bellhop2D WASM run failed: ${outcome.status}`);
        }
        return outcome;
    }
    function rayViews(raySet: any): any {
        const rays: any = [];
        for (let index: any = 0; index + 1 < raySet.offsets.length; ++index) {
            const start: any = raySet.offsets[index];
            const stop: any = raySet.offsets[index + 1];
            rays.push({
                angle: raySet.launchAnglesDegrees[index],
                points: raySet.pointsM.subarray(start * 2, stop * 2),
            });
        }
        return rays;
    }
    function clippedPath(points: any, stopRangeM: any, limit: any = 420): any {
        if (points.length === 0)
            return [];
        const values: any = [];
        for (let index: any = 0; index < points.length; index += 2) {
            const range: any = points[index];
            const depth: any = points[index + 1];
            if (stopRangeM !== undefined && range > stopRangeM) {
                if (values.length === 0)
                    values.push([range, depth]);
                else if (values.at(-1)[0] < stopRangeM) {
                    const left: any = values.at(-1);
                    const weight: any = (stopRangeM - left[0]) / Math.max(1e-12, range - left[0]);
                    values.push([stopRangeM, left[1] + weight * (depth - left[1])]);
                }
                break;
            }
            values.push([range, depth]);
        }
        const selected: any = values.length <= limit
            ? values
            : Array.from({ length: limit }, (_: any, index: any): any => (values[Math.floor(index * (values.length - 1) / (limit - 1))]));
        return selected.map(([range, depth]: any): any => [round(range / 1000, 4), round(depth, 3)]);
    }
    function velocityLevels(interleaved: any, count: any): any {
        const values: any = new Float32Array(count);
        for (let index: any = 0; index < count; ++index) {
            const real: any = interleaved[index * 2] || 0;
            const imaginary: any = interleaved[index * 2 + 1] || 0;
            const magnitude: any = Math.max(Math.hypot(real, imaginary), 1.17549435e-38);
            values[index] = round(clamp(-20 * Math.log10(magnitude), 30, 120), 2);
        }
        return values;
    }
    async function simulate(payload: any): Promise<any> {
        try {
            return await runLatestPageRequest((): any => simulateNative(payload));
        }
        catch (error: any) {
            throw normalizeRuntimeError(error);
        }
    }
    async function simulateNative(payload: any): Promise<any> {
        const started: any = performance.now();
        const domain: any = calculationDomain(payload);
        const ranges: any = AxisInput.linspace(100, domain.maximumRangeM, FIELD_RANGE_COUNT);
        const depths: any = AxisInput.linspace(0, domain.waterDepthM, FIELD_DEPTH_COUNT);
        const useImported: any = usesImportedEnvironment(payload);
        const fieldRanges: any = useImported ? importedInput.receivers.ranges : ranges;
        const fieldDepths: any = useImported ? importedInput.receivers.depths : depths;
        const displayAngles: any = launchAngleSamples(launchAngleConfiguration(payload), DISPLAY_RAY_COUNT);
        const displayRays: any = [];
        let rayConfig: any;
        for (let start: any = 0; start < displayAngles.length; start += DISPLAY_RAY_BATCH_SIZE) {
            const batch: any = displayAngles.slice(start, start + DISPLAY_RAY_BATCH_SIZE);
            const configuration: any = configuredInput(payload, RunMode.RAY, batch.length, depths, ranges, false, batch);
            rayConfig ??= configuration;
            const outcome: any = await execute(configuration.input);
            for (const ray of rayViews(outcome.result.rays())) {
                displayRays.push({
                    angle: ray.angle,
                    path: clippedPath(ray.points, domain.maximumRangeM),
                });
            }
        }
        const fieldSelection: any = await memoryFittedFieldConfiguration(payload, fieldDepths, fieldRanges);
        const fieldOutcome: any = await execute(fieldSelection.configuration.input);
        const field: any = fieldOutcome.result.pressureField(0);
        const count: any = field.receiverDepthsM.length * field.receiverRangesM.length;
        const loss: any = Float32Array.from(field.transmissionLossDb, (value: any): any => (round(clamp(Number.isFinite(value) ? value : 100, 40, 100), 2)));
        return {
            profile: rayConfig.profile.profile,
            ssp: rayConfig.profile.depths.map((depth: any, index: any): any => [
                depth,
                round(rayConfig.profile.speeds[index], 3),
            ]),
            rays: displayRays.map((ray: any): any => ray.path),
            ray_angles_deg: displayRays.map((ray: any): any => round(ray.angle)),
            loss: {
                cols: field.receiverRangesM.length,
                rows: field.receiverDepthsM.length,
                values: loss,
            },
            velocity: {
                cols: field.receiverRangesM.length,
                rows: field.receiverDepthsM.length,
                horizontal_db: velocityLevels(field.horizontalVelocityInterleaved, count),
                vertical_db: velocityLevels(field.verticalVelocityInterleaved, count),
                minimum_db: 30,
                maximum_db: 120,
                model: "OOB_WASM_NATIVE_VELOCITY",
                available: true,
            },
            display_ray_count: displayRays.length,
            field_ray_count: fieldSelection.actualCount,
            requested_field_ray_count: fieldSelection.requestedCount,
            field_memory_bytes: fieldSelection.estimate.estimatedPeakBytes,
            angle_range_degrees: [
                round(launchAngleConfiguration(payload).minimumDegrees, 4),
                round(launchAngleConfiguration(payload).maximumDegrees, 4),
            ],
            maximum_range_km: round(domain.maximumRangeM / 1000, 3),
            maximum_depth_m: round(plotMaximumDepthM(domain, payload), 3),
            bathymetry: displayedBathymetry(domain, payload),
            field_mode: fieldSelection.runMode,
            beam_type: fieldSelection.configuration.input.options.beam.beamType,
            thread_count: activeThreadCount,
            bottom: {
                speed_mps: rayConfig.bottom.bottomSpeed,
                density_kgm3: rayConfig.bottom.bottomDensity,
                absorption_db_per_wavelength: rayConfig.bottom.bottomAbsorption,
            },
            compute_ms: round(performance.now() - started, 2),
            engine: "OOB_BELLHOP2D_WASM_WORKER",
        };
    }
    function arrivals(result: any): any {
        const set: any = result.arrivals();
        const start: any = set.offsets[0] || 0;
        const stop: any = set.offsets[1] || start;
        const values: any = [];
        for (let index: any = start; index < stop; ++index) {
            const real: any = set.amplitudesInterleaved[index * 2];
            const imaginary: any = set.amplitudesInterleaved[index * 2 + 1];
            const phase: any = (Math.atan2(imaginary, real) * 180 / Math.PI + 360) % 360;
            values.push({
                launch_angle: set.sourceAnglesDegrees[index],
                arrival_angle: set.receiverAnglesDegrees[index],
                travel_time_s: set.delaysInterleaved[index * 2],
                amplitude_real: real,
                amplitude_imaginary: imaginary,
                amplitude: Math.hypot(real, imaginary),
                phase_deg: phase,
                top_bounces: set.topBounces[index],
                bottom_bounces: set.bottomBounces[index],
            });
        }
        return values;
    }
    function depthAtRange(points: any, targetM: any): any {
        if (points.length === 0)
            return Number.NaN;
        for (let index: any = 0; index < points.length; index += 2) {
            if (points[index] < targetM)
                continue;
            if (index === 0)
                return points[1];
            const leftRange: any = points[index - 2];
            const leftDepth: any = points[index - 1];
            const weight: any = (targetM - leftRange) / Math.max(1e-12, points[index] - leftRange);
            return leftDepth + weight * (points[index + 1] - leftDepth);
        }
        return points[points.length - 1];
    }
    function pathLengthKm(points: any, stopRangeM: any): any {
        const path: any = clippedPath(points, stopRangeM, 10000);
        let length: any = 0;
        for (let index: any = 1; index < path.length; ++index) {
            length += Math.hypot((path[index][0] - path[index - 1][0]) * 1000, path[index][1] - path[index - 1][1]);
        }
        return length / 1000;
    }
    function rayKind(top: any, bottom: any): any {
        if (top && bottom)
            return "海面+海底";
        if (top)
            return "海面反射";
        if (bottom)
            return "海底反射";
        return "直达/折射";
    }
    function combineRays(rayResult: any, arrivalResult: any, receiverRangeM: any, receiverDepthM: any, angleRange: any, maximumResidualM: any = null): any {
        const rays: any = rayViews(rayResult.rays());
        const arrivalValues: any = arrivals(arrivalResult);
        const available: any = new Set(arrivalValues.map((_: any, index: any): any => index));
        const coarseStep: any = (angleRange.maximumDegrees - angleRange.minimumDegrees)
            / (EIGEN_LAUNCH_ANGLE_COUNT - 1);
        const matchTolerance: any = Math.max(1e-4, 1.5 * coarseStep);
        const combined: any = rays.map((ray: any): any => {
            let match: any = -1;
            let difference: any = Number.POSITIVE_INFINITY;
            for (const index of available) {
                const candidate: any = Math.abs(arrivalValues[index].launch_angle - ray.angle);
                if (candidate <= matchTolerance && candidate < difference) {
                    match = index;
                    difference = candidate;
                }
            }
            const residualM: any = depthAtRange(ray.points, receiverRangeM) - receiverDepthM;
            const arrivalValid: any = match >= 0 && (maximumResidualM === null || Math.abs(residualM) <= maximumResidualM);
            const arrival: any = arrivalValid ? arrivalValues[match] : {
                arrival_angle: 0,
                travel_time_s: null,
                amplitude_real: 0,
                amplitude_imaginary: 0,
                amplitude: null,
                phase_deg: null,
                top_bounces: 0,
                bottom_bounces: 0,
            };
            if (match >= 0)
                available.delete(match);
            return {
                kind: arrivalValid
                    ? rayKind(arrival.top_bounces, arrival.bottom_bounces)
                    : "无到达记录",
                launch_angle: ray.angle,
                arrival_angle: arrival.arrival_angle,
                arrival_valid: arrivalValid,
                residual_m: residualM,
                top_bounces: arrival.top_bounces,
                bottom_bounces: arrival.bottom_bounces,
                travel_time_s: arrival.travel_time_s,
                amplitude: arrival.amplitude,
                phase_deg: arrival.phase_deg,
                path_length_km: pathLengthKm(ray.points, receiverRangeM),
                path: clippedPath(ray.points, Math.min(MAX_RANGE_M, receiverRangeM + 1000)),
                pressure_real: arrival.amplitude_real,
                pressure_imaginary: arrival.amplitude_imaginary,
            };
        });
        combined.sort((left: any, right: any): any => {
            if (left.arrival_valid !== right.arrival_valid)
                return left.arrival_valid ? -1 : 1;
            return (left.arrival_valid ? left.travel_time_s : left.launch_angle)
                - (right.arrival_valid ? right.travel_time_s : right.launch_angle);
        });
        return combined;
    }
    function serializeRays(items: any): any {
        return items.map((item: any, index: any): any => {
            const { pressure_real: _real, pressure_imaginary: _imaginary, ...publicItem }: any = item;
            return { id: index + 1, ...publicItem };
        });
    }
    async function preciseEigenrays(payload: any): Promise<any> {
        try {
            return await runLatestPageRequest((): any => preciseEigenraysNative(payload));
        }
        catch (error: any) {
            throw normalizeRuntimeError(error);
        }
    }
    async function preciseEigenraysNative(payload: any): Promise<any> {
        const started: any = performance.now();
        const domain: any = calculationDomain(payload);
        const maximumReceiverRangeKm: any = Math.min(95, domain.maximumRangeM / 1000);
        const minimumReceiverRangeKm: any = Math.min(5, maximumReceiverRangeKm);
        const receiverRangeKm: any = clamp(payload.receiver_range ?? 50, minimumReceiverRangeKm, maximumReceiverRangeKm);
        const receiverDepthM: any = clamp(payload.receiver_depth ?? 1000, 20, domain.waterDepthM - 20);
        const receiverRangeM: any = receiverRangeKm * 1000;
        const toleranceM: any = clamp(payload.tolerance ?? 1, 0.05, 25);
        const receiverRanges: any = AxisInput.explicit([receiverRangeM]);
        const receiverDepths: any = AxisInput.explicit([receiverDepthM]);
        const eigenAngleRange: any = defaultLaunchAngleConfiguration();
        const rangeDependentEnvironment: any = (usesImportedEnvironment(payload)
            && "rangesM" in importedInput.environment.ssp)
            || hasRangeDependentBathymetry(payload);
        const comparisonRequested: any = payload.include_equal_angle_comparison !== false;
        // Bellhop's conventional E/A modes are both redundant for a drag update and
        // unsuitable for this range-dependent ENV. The PC modes are the authoritative
        // precise result, so keep the 1,000-angle solve and omit only the blue baseline.
        const comparisonIncluded: any = comparisonRequested && !rangeDependentEnvironment;
        const eigenMaximumRangeM: any = Math.min(domain.maximumRangeM, receiverRangeM + 1000);
        const inputFor: any = (mode: any, precise: any = false): any => {
            const input: any = configuredInput(payload, mode, EIGEN_LAUNCH_ANGLE_COUNT, receiverDepths, receiverRanges, false, null, eigenAngleRange, eigenMaximumRangeM).input;
            return precise
                ? Bellhop2DInput.edit(input)
                    .options().beamType(BeamType.PRECISE_EIGENRAY)
                    .build()
                : input;
        };
        let equal: any = [];
        if (comparisonIncluded) {
            const equalRay: any = await execute(inputFor(RunMode.EIGENRAY));
            const equalArrival: any = await execute(inputFor(RunMode.ARRIVALS));
            equal = combineRays(equalRay.result, equalArrival.result, receiverRangeM, receiverDepthM, eigenAngleRange);
        }
        const preciseRay: any = await execute(inputFor(RunMode.RAY, true));
        const preciseArrival: any = await execute(inputFor(RunMode.ARRIVALS, true));
        const precise: any = combineRays(preciseRay.result, preciseArrival.result, receiverRangeM, receiverDepthM, eigenAngleRange, toleranceM).filter((ray: any): any => ray.arrival_valid);
        let pressureReal: any = 0;
        let pressureImaginary: any = 0;
        let incoherentPower: any = 0;
        for (const ray of precise) {
            if (!ray.arrival_valid)
                continue;
            pressureReal += ray.pressure_real;
            pressureImaginary += ray.pressure_imaginary;
            incoherentPower += ray.amplitude ** 2;
        }
        const rmse: any = (items: any): any => Math.sqrt(items.reduce((sum: any, item: any): any => sum + item.residual_m ** 2, 0)
            / Math.max(1, items.length));
        return {
            receiver: { range_km: receiverRangeKm, depth_m: receiverDepthM },
            maximum_range_km: round(domain.maximumRangeM / 1000, 3),
            maximum_depth_m: round(plotMaximumDepthM(domain, payload), 3),
            bathymetry: displayedBathymetry(domain, payload),
            launch_angle_count: EIGEN_LAUNCH_ANGLE_COUNT,
            receiver_count: 1,
            receiver_grid_shape: [1, 1],
            comparison_included: comparisonIncluded,
            comparison_skip_reason: comparisonIncluded
                ? null
                : (rangeDependentEnvironment ? "range_dependent_environment" : "interactive"),
            angle_range_degrees: [
                round(eigenAngleRange.minimumDegrees, 4),
                round(eigenAngleRange.maximumDegrees, 4),
            ],
            equal_angle_eigenrays: serializeRays(equal),
            eigenrays: serializeRays(precise),
            equal_angle_residual_rmse_m: comparisonIncluded ? round(rmse(equal), 4) : null,
            precise_residual_rmse_m: round(rmse(precise), 4),
            tolerance_m: toleranceM,
            iterations: null,
            coherent_tl_db: round(-20 * Math.log10(Math.max(1e-30, Math.hypot(pressureReal, pressureImaginary))), 2),
            incoherent_tl_db: round(-10 * Math.log10(Math.max(1e-30, incoherentPower)), 2),
            thread_count: activeThreadCount,
            compute_ms: round(performance.now() - started, 2),
            engine: "OOB_BELLHOP2D_MODE_E_PC_WASM_WORKER",
        };
    }
    return {
        prepare: prepareRayEngine,
        importEnvironment: importEnvironment,
        runField: simulate,
        findEigenrays: preciseEigenrays,
        cancel: cancelRayEngine,
        dispose: disposeRayEngine
    };
}
