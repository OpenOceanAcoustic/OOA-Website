import { loadPeSdkModule } from "./sdk-loader";
import { importPePageEnvironment } from "./environment-parser";
import { RuntimeError, normalizeRuntimeError } from "@ooa/runtime-core";
import { peImportErrorDetail } from "./pe-file-import";
export function createPePageEngine(): any {
    const PE_ADAPTER_CONTRACT: any = Object.freeze({
        method: "runPE(params)",
        inputVersion: 1,
        resultVersion: 1,
        fieldStorage: "row-major-depth-range",
        referencePolicy: "same-input-nPade-10",
    });
    function clamp(value: any, minimum: any, maximum: any): any { return Math.max(minimum, Math.min(maximum, Number(value))); }
    function number(value: any, fallback: any): any { const parsed: any = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
    function linspace(start: any, end: any, count: any): any {
        const values: any = new Float64Array(count);
        for (let index: any = 0; index < count; index += 1) {
            values[index] = count === 1 ? start : start + (end - start) * index / (count - 1);
        }
        return values;
    }
    function soundSpeed(profile: any, depth: any, maximumDepth: any): any {
        if (profile === "constant" || profile === "pekeris")
            return 1500;
        if (profile === "surface")
            return 1490 + 26 * Math.tanh((500 - depth) / 220) + 0.012 * Math.max(0, depth - 500);
        const axis: any = Math.min(1300, maximumDepth * 0.36);
        const eta: any = clamp(2 * (depth - axis) / Math.max(500, axis), -8, 8);
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
    function baseTransmissionLoss(rangeM: any, depthM: any, bathymetryM: any, params: any): any {
        const maximumRangeM: any = params.maximumRangeKm * 1000;
        const rangeFraction: any = rangeM / Math.max(1, maximumRangeM);
        const sourceDepth: any = params.sourceDepthM;
        const channelAxis: any = params.profile === "surface" ? 430 : params.maximumDepthM * 0.36;
        const spreading: any = 60 + 10 * Math.log10(1 + rangeM / 220);
        const channel: any = 9 * Math.pow((depthM - channelAxis) / Math.max(350, params.maximumDepthM * 0.42), 2);
        const direct: any = -8 * Math.exp(-Math.pow((depthM - sourceDepth - 0.19 * rangeM / 100) / 320, 2));
        const interference: any = 6.5 * Math.sin(0.0105 * depthM + 0.00031 * rangeM + 0.35 * Math.sin(rangeFraction * Math.PI * 3)) ** 2;
        const bottomPenalty: any = 12 * Math.exp(-Math.max(0, bathymetryM - depthM) / 170);
        return clamp(spreading + channel + direct + interference + bottomPenalty, 58, 124);
    }
    function truncationPattern(rangeFraction: any, depthFraction: any, bathymetryFraction: any, params: any): any {
        const angleStress: any = Math.sin(Math.PI * depthFraction) * Math.sin(Math.PI * rangeFraction * 3.2);
        const accumulated: any = Math.pow(rangeFraction, 1.35) * (0.58 * Math.sin(11 * rangeFraction + 8 * depthFraction)
            + 0.42 * Math.cos(5 * rangeFraction - 15 * depthFraction));
        const boundaryStress: any = Math.exp(-Math.max(0, bathymetryFraction - depthFraction) / 0.075)
            * Math.sin(18 * rangeFraction);
        return 0.42 * angleStress + 0.78 * accumulated + 0.35 * boundaryStress;
    }
    function padeCoefficient(nPade: any, referenceNPade: any): any {
        return 19 * (1 / Math.pow(nPade, 1.42) - 1 / Math.pow(referenceNPade, 1.42));
    }
    async function demonstrationResult(input: any, reason: any): Promise<any> {
        const started: any = performance.now();
        await new Promise((resolve: any): any => requestAnimationFrame(resolve));
        const params: any = {
            model: "ram",
            profile: input.profile || "pekeris",
            frequencyHz: clamp(input.frequencyHz ?? 100, 10, 1000),
            sourceDepthM: clamp(input.sourceDepthM ?? 500, 5, (input.maximumDepthM ?? 3000) - 5),
            maximumRangeKm: clamp(input.maximumRangeKm ?? 80, 2, 250),
            maximumDepthM: clamp(input.maximumDepthM ?? 3000, 200, 8000),
            waterDepthM: clamp(input.waterDepthM ?? 200, 50, input.maximumDepthM ?? 3000),
            rangeStepM: clamp(input.rangeStepM ?? 10, 1, 100),
            depthStepM: clamp(input.depthStepM ?? 1, 0.25, 10),
            nPade: Math.round(clamp(input.nPade ?? 4, 1, 10)),
            referenceNPade: Math.round(clamp(input.referenceNPade ?? 10, 1, 10)),
        };
        params.sourceDepthM = clamp(params.sourceDepthM, 1, params.waterDepthM - 1);
        const columns: any = Math.round(clamp(input.rangeCount ?? 181, 41, 281));
        const rows: any = Math.round(clamp(input.depthCount ?? 131, 41, 201));
        const rangesKm: any = linspace(0, params.maximumRangeKm, columns);
        const depthsM: any = linspace(0, params.maximumDepthM, rows);
        const environmentDepthsM: any = linspace(0, params.waterDepthM, 121);
        const soundSpeedMps: any = Float64Array.from(environmentDepthsM, (depth: any): any => {
            const sampled: any = interpolatedSoundSpeed(input.sspPoints, depth);
            return Number.isFinite(sampled) ? sampled : soundSpeed(params.profile, depth, params.waterDepthM);
        });
        const bathymetry: any = Array.from({ length: 81 }, (_: any, index: any): any => {
            const fraction: any = index / 80;
            return [fraction * params.maximumRangeKm, params.waterDepthM];
        });
        const currentTlDb: any = new Float32Array(rows * columns);
        const referenceTlDb: any = new Float32Array(rows * columns);
        const deltaTlDb: any = new Float32Array(rows * columns);
        const convergenceAccumulator: any = Array.from({ length: 10 }, (): any => ({ square: 0, maximum: 0, count: 0 }));
        let validCellCount: any = 0;
        let squareSum: any = 0;
        let maximumDifference: any = 0;
        const currentCoefficient: any = padeCoefficient(params.nPade, params.referenceNPade);
        for (let depthIndex: any = 0; depthIndex < rows; depthIndex += 1) {
            const depthM: any = depthsM[depthIndex];
            const depthFraction: any = depthM / params.maximumDepthM;
            for (let rangeIndex: any = 0; rangeIndex < columns; rangeIndex += 1) {
                const rangeKm: any = rangesKm[rangeIndex];
                const rangeFraction: any = rangeKm / params.maximumRangeKm;
                const bottomDepth: any = params.waterDepthM;
                const offset: any = depthIndex * columns + rangeIndex;
                if (depthM > bottomDepth) {
                    currentTlDb[offset] = Number.NaN;
                    referenceTlDb[offset] = Number.NaN;
                    deltaTlDb[offset] = Number.NaN;
                    continue;
                }
                const reference: any = baseTransmissionLoss(rangeKm * 1000, depthM, bottomDepth, params);
                const pattern: any = truncationPattern(rangeFraction, depthFraction, bottomDepth / params.maximumDepthM, params);
                const current: any = clamp(reference + currentCoefficient * pattern, 55, 125);
                const difference: any = current - reference;
                currentTlDb[offset] = current;
                referenceTlDb[offset] = reference;
                deltaTlDb[offset] = difference;
                squareSum += difference * difference;
                maximumDifference = Math.max(maximumDifference, Math.abs(difference));
                validCellCount += 1;
                for (let nPade: any = 1; nPade <= 10; nPade += 1) {
                    const error: any = padeCoefficient(nPade, params.referenceNPade) * pattern;
                    const accumulator: any = convergenceAccumulator[nPade - 1];
                    accumulator.square += error * error;
                    accumulator.maximum = Math.max(accumulator.maximum, Math.abs(error));
                    accumulator.count += 1;
                }
            }
        }
        return {
            contractVersion: 1,
            runtime: {
                mode: "demo",
                engine: "BROWSER_PE_DEMONSTRATOR",
                fallback: true,
                warning: reason || "PE WASM backend is not registered",
                computeMs: performance.now() - started,
            },
            parameters: params,
            environment: {
                depthsM: environmentDepthsM,
                soundSpeedMps,
                bathymetry,
            },
            field: { rows, columns, rangesKm, depthsM, tlDb: currentTlDb },
            referenceField: { rows, columns, rangesKm, depthsM, tlDb: referenceTlDb },
            deltaField: { rows, columns, rangesKm, depthsM, values: deltaTlDb },
            convergence: convergenceAccumulator.map((value: any, index: any): any => ({
                nPade: index + 1,
                rmsDb: Math.sqrt(value.square / Math.max(1, value.count)),
                maximumDb: value.maximum,
            })),
            metrics: {
                deltaRmsDb: Math.sqrt(squareSum / Math.max(1, validCellCount)),
                deltaMaxDb: maximumDifference,
                validCellCount,
            },
        };
    }
    function validateResult(result: any): any {
        if (!result || result.contractVersion !== 1)
            throw new Error("unsupported PE result contract");
        if (!result.field || !result.referenceField || !result.deltaField || !result.convergence) {
            throw new Error("incomplete PE result");
        }
        if (result.field.rows * result.field.columns !== result.field.tlDb.length) {
            throw new Error("PE field shape does not match TL storage");
        }
        return result;
    }
    let nativePackagePromise: any;
    let nativeSolverPromise: any;
    const nativeSweepCache: any = new Map();
    const importedInputCache: any = new Map();
    let nextImportedSourceId: any = 1;
    let latestNativeRequestId: any = 0;
    let nativeRequestActive: any = false;
    function loadNativePackage(): any {
        nativePackagePromise ??= loadPeSdkModule();
        return nativePackagePromise;
    }
    async function nativeSolver(): Promise<any> {
        nativeSolverPromise ??= loadNativePackage().then(({ RAM }: any): any => (RAM.create({ ...RAM.recommendedRuntime(), threadCount: 1 })));
        return nativeSolverPromise;
    }
    function nativeEnvironmentKey(params: any): any {
        return JSON.stringify({
            model: params.model,
            profile: params.profile,
            environmentTitle: params.environmentTitle,
            frequencyHz: params.frequencyHz,
            sourceDepthM: params.sourceDepthM,
            maximumRangeKm: params.maximumRangeKm,
            maximumDepthM: params.maximumDepthM,
            waterDepthM: params.waterDepthM,
            rangeStepM: params.rangeStepM,
            depthStepM: params.depthStepM,
            rangeCount: params.rangeCount,
            depthCount: params.depthCount,
            referenceNPade: params.referenceNPade,
            bottomSoundSpeedMps: params.bottomSoundSpeedMps,
            bottomDensityKgM3: params.bottomDensityKgM3,
            bottomAttenuationDbPerWavelength: params.bottomAttenuationDbPerWavelength,
            sspPoints: params.sspPoints,
            bathymetry: params.bathymetry,
            sourceId: params.sourceId,
        });
    }
    function trimNativeSweepCache(): any {
        while (nativeSweepCache.size > 3) {
            nativeSweepCache.delete(nativeSweepCache.keys().next().value);
        }
    }
    function numericArray(values: any): any {
        return Array.from(values || [], (value: any): any => number(value, 0));
    }
    function cloneDepthProfile(profile: any): any {
        return {
            depthsM: numericArray(profile?.depthsM),
            values: numericArray(profile?.values),
        };
    }
    function bathymetryDepthAt(points: any, rangeM: any): any {
        if (!points.length)
            return Number.POSITIVE_INFINITY;
        if (rangeM <= points[0].rangeM)
            return points[0].depthM;
        for (let index: any = 1; index < points.length; index += 1) {
            const right: any = points[index];
            if (rangeM <= right.rangeM) {
                const left: any = points[index - 1];
                const mix: any = (rangeM - left.rangeM) / Math.max(1e-12, right.rangeM - left.rangeM);
                return left.depthM + mix * (right.depthM - left.depthM);
            }
        }
        return points.at(-1).depthM;
    }
    function maskedTransmissionLoss(field: any, bathymetry: any): any {
        const ranges: any = field.receiverRangesM;
        const depths: any = field.receiverDepthsM;
        const output: any = new Float32Array(field.transmissionLossDb.length);
        for (let depthIndex: any = 0; depthIndex < depths.length; depthIndex += 1) {
            for (let rangeIndex: any = 0; rangeIndex < ranges.length; rangeIndex += 1) {
                const offset: any = depthIndex * ranges.length + rangeIndex;
                output[offset] = field.validityMask[offset] &&
                    depths[depthIndex] <= bathymetryDepthAt(bathymetry, ranges[rangeIndex])
                    ? field.transmissionLossDb[offset]
                    : Number.NaN;
            }
        }
        return output;
    }
    function profilesEqual(left: any, right: any, tolerance: any = 1e-9): any {
        if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length)
            return false;
        return left.every((point: any, index: any): any => (Array.isArray(point) && Array.isArray(right[index])
            && Math.abs(number(point[0], NaN) - number(right[index][0], NaN)) <= tolerance
            && Math.abs(number(point[1], NaN) - number(right[index][1], NaN)) <= tolerance));
    }
    function clonedRamInput(params: any, nativePackage: any): any {
        const imported: any = importedInputCache.get(params.sourceId);
        const original: any = imported?.input;
        if (!original || !imported)
            throw new Error("导入的 RAM 环境已失效，请重新选择 .in 文件");
        const input: any = {
            environment: {
                title: original.environment.title,
                frequencyHz: original.environment.frequencyHz,
                referenceSoundSpeedMps: original.environment.referenceSoundSpeedMps,
                bathymetry: original.environment.bathymetry.map((point: any): any => ({ ...point })),
                mediumSections: original.environment.mediumSections.map((section: any): any => ({
                    activationRangeM: section.activationRangeM,
                    waterSoundSpeedMps: cloneDepthProfile(section.waterSoundSpeedMps),
                    bottomCompressionalSpeedMps: cloneDepthProfile(section.bottomCompressionalSpeedMps),
                    bottomDensityKgM3: cloneDepthProfile(section.bottomDensityKgM3),
                    bottomCompressionalAttenuationDbPerWavelength: cloneDepthProfile(section.bottomCompressionalAttenuationDbPerWavelength),
                })),
            },
            source: { ...original.source },
            receivers: { depthsM: numericArray(original.receivers.depthsM) },
            options: { ...original.options },
            outputRequest: { ...original.outputRequest },
        };
        const baseline: any = imported.baseline;
        input.environment.frequencyHz = params.frequencyHz;
        input.source.depthM = params.sourceDepthM;
        input.outputRequest.maximumRangeM = params.maximumRangeKm * 1000;
        input.options.rangeStepM = params.rangeStepM;
        input.outputRequest.maximumDepthM = params.maximumDepthM;
        input.options.depthStepM = params.depthStepM;
        input.outputRequest.plotMaximumDepthM = params.maximumDepthM;
        input.options.padeTerms = params.nPade;
        const originalMaximumRangeM: any = number(baseline.maximumRangeKm, params.maximumRangeKm) * 1000;
        if (originalMaximumRangeM > 0 && Math.abs(originalMaximumRangeM - input.outputRequest.maximumRangeM) > 1e-9) {
            const rangeScale: any = input.outputRequest.maximumRangeM / originalMaximumRangeM;
            input.environment.bathymetry = input.environment.bathymetry.map((point: any): any => ({
                ...point,
                rangeM: point.rangeM * rangeScale,
            }));
            input.environment.mediumSections = input.environment.mediumSections.map((section: any): any => ({
                ...section,
                activationRangeM: section.activationRangeM * rangeScale,
            }));
        }
        const bottomShift: any = params.waterDepthM - number(baseline.waterDepthM, params.waterDepthM);
        if (Math.abs(bottomShift) > 1e-9) {
            input.environment.bathymetry = input.environment.bathymetry.map((point: any): any => ({
                ...point,
                depthM: Math.max(1e-6, point.depthM + bottomShift),
            }));
        }
        if (!profilesEqual(params.sspPoints, baseline.profilePoints)) {
            const points: any = params.sspPoints.map((point: any): any => [number(point[0], 0), number(point[1], 1500)]);
            if (points.at(-1)[0] < params.maximumDepthM) {
                points.push([params.maximumDepthM, points.at(-1)[1]]);
            }
            input.environment.referenceSoundSpeedMps = points[0][1];
            input.environment.mediumSections = input.environment.mediumSections.map((section: any): any => ({
                ...section,
                waterSoundSpeedMps: {
                    depthsM: points.map((point: any): any => point[0]),
                    values: points.map((point: any): any => point[1]),
                },
            }));
        }
        const bottomOverrides: any = [
            ["bottomCompressionalSpeedMps", "bottomSoundSpeedMps"],
            ["bottomDensityKgM3", "bottomDensityKgM3"],
            ["bottomCompressionalAttenuationDbPerWavelength", "bottomAttenuationDbPerWavelength"],
        ];
        for (const [profileKey, parameterKey] of bottomOverrides) {
            if (Math.abs(number(params[parameterKey], 0) - number(baseline[parameterKey], params[parameterKey])) <= 1e-9)
                continue;
            input.environment.mediumSections = input.environment.mediumSections.map((section: any): any => ({
                ...section,
                [profileKey]: {
                    ...section[profileKey],
                    values: numericArray(section[profileKey].values).map((): any => params[parameterKey]),
                },
            }));
        }
        return nativePackage.RAMInput.parse(input);
    }
    function ramInputFromCanonicalEnvironment(params: any, rangeOutputDecimation: any, depthOutputDecimation: any, nativePackage: any): any {
        const profilePoints: any = params.sspPoints.map((point: any): any => [
            number(point[0], 0),
            number(point[1], 1500),
        ]);
        if (profilePoints.at(-1)[0] < params.maximumDepthM) {
            profilePoints.push([params.maximumDepthM, profilePoints.at(-1)[1]]);
        }
        const maximumRangeM: any = params.maximumRangeKm * 1000;
        const suppliedBathymetry: any = Array.isArray(params.bathymetry)
            ? params.bathymetry.map((point: any): any => ({
                rangeM: number(point[0], 0) * 1000,
                depthM: number(point[1], params.waterDepthM),
            }))
            : [];
        const bathymetry: any = suppliedBathymetry.length
            ? suppliedBathymetry
            : [{ rangeM: 0, depthM: params.waterDepthM }, { rangeM: maximumRangeM, depthM: params.waterDepthM }];
        if (bathymetry.length === 1) {
            if (bathymetry[0].rangeM > 0)
                bathymetry.unshift({ rangeM: 0, depthM: bathymetry[0].depthM });
            else
                bathymetry.push({ rangeM: maximumRangeM, depthM: bathymetry[0].depthM });
        }
        return nativePackage.RAMInput.parse({
            environment: {
                title: params.environmentTitle || "OOA PE browser environment",
                frequencyHz: params.frequencyHz,
                referenceSoundSpeedMps: profilePoints[0][1],
                bathymetry,
                mediumSections: [{
                        activationRangeM: 0,
                        waterSoundSpeedMps: {
                            depthsM: profilePoints.map((point: any): any => point[0]),
                            values: profilePoints.map((point: any): any => point[1]),
                        },
                        bottomCompressionalSpeedMps: { depthsM: [0], values: [params.bottomSoundSpeedMps] },
                        bottomDensityKgM3: { depthsM: [0], values: [params.bottomDensityKgM3] },
                        bottomCompressionalAttenuationDbPerWavelength: {
                            depthsM: [0],
                            values: [params.bottomAttenuationDbPerWavelength],
                        },
                    }],
            },
            source: { depthM: params.sourceDepthM, rangeM: 0 },
            receivers: { depthsM: [params.sourceDepthM] },
            options: {
                phaseRatio: 0,
                rangeStepM: params.rangeStepM,
                rangeDecimation: rangeOutputDecimation,
                depthStepM: params.depthStepM,
                depthDecimation: depthOutputDecimation,
                padeTerms: params.nPade,
                stabilityConstraints: 1,
                stabilityRangeM: 0,
                stepAlignment: nativePackage.StepAlignmentPolicy.LEGACY_FIRST_CROSSING,
            },
            outputRequest: {
                maximumRangeM,
                maximumDepthM: params.maximumDepthM,
                plotMaximumDepthM: params.maximumDepthM,
                outputMode: nativePackage.OutputMode.IN_MEMORY,
            },
        });
    }
    async function calculateNativeSweep(params: any): Promise<any> {
        if (params.model !== "ram") {
            throw new Error("当前 WASM 版本只启用 RAM");
        }
        const maximumRangeM: any = params.maximumRangeKm * 1000;
        const waterDepthM: any = params.waterDepthM;
        const sourceDepthM: any = clamp(params.sourceDepthM, 0, waterDepthM - 1);
        const rangeSteps: any = Math.ceil(maximumRangeM / params.rangeStepM);
        const depthCells: any = Math.ceil(params.maximumDepthM / params.depthStepM);
        if (rangeSteps * depthCells * 10 > 150000000) {
            throw new RangeError("当前 dr、dz 与传播范围会产生过大的浏览器计算量，请增大步长或缩小计算域");
        }
        const rangeOutputDecimation: any = Math.max(1, Math.ceil(rangeSteps / Math.max(41, params.rangeCount || 181)));
        const depthOutputDecimation: any = Math.max(1, Math.ceil(depthCells / Math.max(41, params.depthCount || 131)));
        const nativePackage: any = await loadNativePackage();
        const input: any = params.sourceId
            ? clonedRamInput({ ...params, sourceDepthM }, nativePackage)
            : ramInputFromCanonicalEnvironment({ ...params, sourceDepthM }, rangeOutputDecimation, depthOutputDecimation, nativePackage);
        const solver: any = await nativeSolver();
        const fields: any = [];
        for (let padeTerms: any = 1; padeTerms <= 10; padeTerms += 1) {
            const edited: any = nativePackage.RAMInput.edit(input).options().padeTerms(padeTerms).build();
            const outcome: any = await solver.run(edited);
            if (!outcome.succeeded || !outcome.result) {
                const diagnostics: any = outcome.diagnostics
                    .map((issue: any): any => `${issue.path || "run"}: ${issue.message}`)
                    .join("; ");
                throw new Error(diagnostics || `RAM nPade=${padeTerms} failed with ${outcome.status}`);
            }
            fields.push({
                padeTerms,
                input: edited,
                field: outcome.result.pressureField(),
                computationTimeMs: outcome.timing.computationNs / 1e6,
                totalTimeMs: outcome.timing.totalNs / 1e6,
            });
        }
        const reference: any = fields.at(-1);
        return {
            fields,
            summaries: fields.map((field: any): any => comparePadeFields(field, reference)),
        };
    }
    function comparePadeFields(item: any, reference: any): any {
        const field: any = item.field;
        const referenceField: any = reference.field;
        if (field.receiverRangesM.length !== referenceField.receiverRangesM.length ||
            field.receiverDepthsM.length !== referenceField.receiverDepthsM.length ||
            field.transmissionLossDb.length !== referenceField.transmissionLossDb.length) {
            throw new RangeError("Padé sweep results do not share one field grid");
        }
        let pressureDifferenceSquared: any = 0;
        let referencePressureSquared: any = 0;
        let tlDifferenceSquared: any = 0;
        let maximumTlDifference: any = 0;
        let tlCount: any = 0;
        for (let index: any = 0; index < field.transmissionLossDb.length; index += 1) {
            if (!field.validityMask[index] || !referenceField.validityMask[index])
                continue;
            const realDifference: any = field.realPressure[index] - referenceField.realPressure[index];
            const imaginaryDifference: any = field.imaginaryPressure[index] - referenceField.imaginaryPressure[index];
            if (Number.isFinite(realDifference) && Number.isFinite(imaginaryDifference)) {
                pressureDifferenceSquared += realDifference * realDifference + imaginaryDifference * imaginaryDifference;
                const referenceReal: any = referenceField.realPressure[index];
                const referenceImaginary: any = referenceField.imaginaryPressure[index];
                referencePressureSquared += referenceReal * referenceReal + referenceImaginary * referenceImaginary;
            }
            const fieldTl: any = field.transmissionLossDb[index];
            const referenceTl: any = referenceField.transmissionLossDb[index];
            if (Number.isFinite(fieldTl) && Number.isFinite(referenceTl) &&
                fieldTl >= 40 && fieldTl <= 120 && referenceTl >= 40 && referenceTl <= 120) {
                const difference: any = fieldTl - referenceTl;
                tlDifferenceSquared += difference * difference;
                maximumTlDifference = Math.max(maximumTlDifference, Math.abs(difference));
                tlCount += 1;
            }
        }
        return {
            padeTerms: item.padeTerms,
            computationTimeMs: item.computationTimeMs,
            relativePressureL2: referencePressureSquared === 0
                ? (pressureDifferenceSquared === 0 ? 0 : Number.POSITIVE_INFINITY)
                : Math.sqrt(pressureDifferenceSquared / referencePressureSquared),
            transmissionLossRmseDb: tlCount ? Math.sqrt(tlDifferenceSquared / tlCount) : Number.NaN,
            maximumAbsoluteTransmissionLossDifferenceDb: tlCount ? maximumTlDifference : Number.NaN,
            comparedTransmissionLossSampleCount: tlCount,
        };
    }
    async function parseRamEnvironment(input: any): Promise<any> {
        if (!input || typeof input.text !== "string") {
            throw new TypeError("RAM import requires a text string");
        }
        const name: any = input.name || "ram.in";
        const nativePackage: any = await loadNativePackage();
        let nativeInput: any;
        try {
            nativeInput = nativePackage.RAMInput.fromRamIn({ name, text: input.text });
        }
        catch (error: any) {
            throw new RuntimeError("INPUT_INVALID", `RAM 输入无法解析：${peImportErrorDetail(error)}`, { cause: error });
        }
        const pageEnvironment: any = await importPePageEnvironment([{
                name,
                kind: "ram-in",
                content: input.text,
            }]);
        const sourceId: any = `pe-source-${nextImportedSourceId++}`;
        const firstSection: any = nativeInput.environment.mediumSections[0];
        const water: any = firstSection.waterSoundSpeedMps;
        const bathymetry: any = nativeInput.environment.bathymetry.map((point: any): any => [point.rangeM / 1000, point.depthM]);
        const profilePoints: any = Array.from(water.depthsM, (depth: any, index: any): any => [depth, water.values[index]]);
        const baseline: any = {
            waterDepthM: bathymetry[0]?.[1] ?? nativeInput.outputRequest.plotMaximumDepthM,
            maximumRangeKm: nativeInput.outputRequest.maximumRangeM / 1000,
            maximumDepthM: nativeInput.outputRequest.maximumDepthM,
            profilePoints,
            bottomSoundSpeedMps: firstSection.bottomCompressionalSpeedMps.values[0],
            bottomDensityKgM3: firstSection.bottomDensityKgM3.values[0],
            bottomAttenuationDbPerWavelength: firstSection.bottomCompressionalAttenuationDbPerWavelength.values[0],
        };
        importedInputCache.set(sourceId, {
            input: nativeInput,
            baseline,
            documents: [{ name, kind: "ram-in", content: input.text }],
        });
        while (importedInputCache.size > 3) {
            importedInputCache.delete(importedInputCache.keys().next().value);
        }
        return {
            ...pageEnvironment,
            sourceId,
            sourceFiles: [name],
            documents: [{ name, kind: "ram-in" }],
            title: nativeInput.environment.title,
            frequencyHz: nativeInput.environment.frequencyHz,
            sourceDepthM: nativeInput.source.depthM,
            maximumRangeKm: baseline.maximumRangeKm,
            maximumDepthM: baseline.maximumDepthM,
            waterDepthM: baseline.waterDepthM,
            rangeStepM: nativeInput.options.rangeStepM,
            depthStepM: nativeInput.options.depthStepM,
            nPade: nativeInput.options.padeTerms,
            profilePoints,
            bathymetry,
            bottomSoundSpeedMps: baseline.bottomSoundSpeedMps,
            bottomDensityKgM3: baseline.bottomDensityKgM3,
            bottomAttenuationDbPerWavelength: baseline.bottomAttenuationDbPerWavelength,
            modelHints: {
                ...pageEnvironment.modelHints,
                model: "RAM",
                mediumSectionCount: nativeInput.environment.mediumSections.length,
                receiverDepthCount: nativeInput.receivers.depthsM.length,
            },
        };
    }
    async function runNativePE(params: any): Promise<any> {
        const key: any = nativeEnvironmentKey(params);
        let sweepPromise: any = nativeSweepCache.get(key);
        if (!sweepPromise) {
            sweepPromise = calculateNativeSweep(params);
            nativeSweepCache.set(key, sweepPromise);
            trimNativeSweepCache();
            sweepPromise.catch((): any => {
                if (nativeSweepCache.get(key) === sweepPromise)
                    nativeSweepCache.delete(key);
            });
        }
        const sweep: any = await sweepPromise;
        const current: any = sweep.fields.find((field: any): any => field.padeTerms === params.nPade);
        const reference: any = sweep.fields.find((field: any): any => field.padeTerms === 10);
        if (!current || !reference)
            throw new Error("PE Padé sweep did not return the requested fields");
        const bathymetryPoints: any = reference.input.environment.bathymetry;
        const bathymetry: any = bathymetryPoints.map((point: any): any => [point.rangeM / 1000, point.depthM]);
        const rangesKm: any = Float64Array.from(reference.field.receiverRangesM, (value: any): any => value / 1000);
        const depthsM: any = Float64Array.from(reference.field.receiverDepthsM);
        const currentTl: any = maskedTransmissionLoss(current.field, bathymetryPoints);
        const referenceTl: any = maskedTransmissionLoss(reference.field, bathymetryPoints);
        const delta: any = new Float32Array(currentTl.length);
        let squareSum: any = 0;
        let maximumDifference: any = 0;
        let validCellCount: any = 0;
        for (let index: any = 0; index < delta.length; index += 1) {
            const left: any = currentTl[index];
            const right: any = referenceTl[index];
            if (!Number.isFinite(left) || !Number.isFinite(right)) {
                delta[index] = Number.NaN;
                continue;
            }
            const difference: any = left - right;
            delta[index] = difference;
            if (left >= 40 && left <= 120 && right >= 40 && right <= 120) {
                squareSum += difference * difference;
                maximumDifference = Math.max(maximumDifference, Math.abs(difference));
                validCellCount += 1;
            }
        }
        const currentSummary: any = sweep.summaries.find((summary: any): any => summary.padeTerms === params.nPade);
        const computeMs: any = sweep.fields.reduce((total: any, field: any): any => total + field.totalTimeMs, 0);
        const referenceProfile: any = reference.input.environment.mediumSections[0].waterSoundSpeedMps;
        return validateResult({
            contractVersion: 1,
            runtime: {
                mode: "wasm", engine: "OOB RAM · WASM", fallback: false,
                computeMs,
            },
            parameters: {
                ...params,
                sourceDepthM: current.input.source.depthM,
                maximumRangeKm: rangesKm.at(-1),
                maximumDepthM: depthsM.at(-1),
                referenceNPade: 10,
            },
            environment: {
                depthsM: Float64Array.from(referenceProfile.depthsM),
                soundSpeedMps: Float64Array.from(referenceProfile.values),
                bathymetry,
            },
            field: {
                rows: current.field.receiverDepthsM.length,
                columns: current.field.receiverRangesM.length,
                rangesKm, depthsM, tlDb: currentTl,
            },
            referenceField: {
                rows: reference.field.receiverDepthsM.length,
                columns: reference.field.receiverRangesM.length,
                rangesKm, depthsM, tlDb: referenceTl,
            },
            deltaField: {
                rows: current.field.receiverDepthsM.length,
                columns: current.field.receiverRangesM.length,
                rangesKm, depthsM, values: delta,
            },
            convergence: sweep.summaries.map((summary: any): any => ({
                nPade: summary.padeTerms,
                rmsDb: summary.transmissionLossRmseDb,
                maximumDb: summary.maximumAbsoluteTransmissionLossDifferenceDb,
                relativePressureL2: summary.relativePressureL2,
                computeMs: summary.computationTimeMs,
            })),
            metrics: {
                deltaRmsDb: validCellCount ? Math.sqrt(squareSum / validCellCount) : Number.NaN,
                deltaMaxDb: validCellCount ? maximumDifference : Number.NaN,
                validCellCount,
                relativePressureL2: currentSummary?.relativePressureL2 ?? Number.NaN,
            },
        });
    }
    function cancelledNativeRequest(): any {
        return new RuntimeError("CANCELLED", "A newer PE request replaced this calculation");
    }
    async function runLatestNativePE(params: any): Promise<any> {
        const requestId: any = ++latestNativeRequestId;
        if (nativeRequestActive && nativeSolverPromise) {
            const solver: any = await nativeSolverPromise;
            solver.cancel();
            nativeSweepCache.clear();
        }
        nativeRequestActive = true;
        try {
            const result: any = await runNativePE(params);
            if (requestId !== latestNativeRequestId)
                throw cancelledNativeRequest();
            return result;
        }
        finally {
            if (requestId === latestNativeRequestId)
                nativeRequestActive = false;
        }
    }
    async function runPE(params: any): Promise<any> {
        try {
            return await runLatestNativePE(params);
        }
        catch (error: any) {
            throw normalizeRuntimeError(error);
        }
    }
    function runPEDemonstration(params: any): any {
        return demonstrationResult(params, "URL requested the deterministic demo adapter");
    }
    async function preparePEEngine(): Promise<any> {
        const solver: any = await nativeSolver();
        return {
            packageName: "@openocean/field-pe-ram",
            packageVersion: "2.0.0",
            model: "RAM",
            executionMode: solver.runtime.executionMode,
            threadCount: solver.runtime.threadCount,
            memoryLimitBytes: solver.runtime.memoryLimitBytes,
        };
    }
    function cancelPEEngine(): any {
        if (nativeSolverPromise)
            void nativeSolverPromise.then((solver: any): any => solver.cancel());
        latestNativeRequestId += 1;
        nativeSweepCache.clear();
    }
    async function disposePEEngine(): Promise<any> {
        cancelPEEngine();
        importedInputCache.clear();
        const solverPromise: any = nativeSolverPromise;
        nativeSolverPromise = undefined;
        nativePackagePromise = undefined;
        const solver: any = solverPromise ? await solverPromise : null;
        if (solver)
            await solver.dispose();
    }
    return {
        prepare: preparePEEngine,
        importEnvironment: parseRamEnvironment,
        run: runPE,
        runDemonstration: runPEDemonstration,
        cancel: cancelPEEngine,
        dispose: disposePEEngine
    };
}
