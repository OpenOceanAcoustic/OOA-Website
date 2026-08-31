import { loadPeSdkModule } from "./sdk-loader";
import { importPePageEnvironment } from "./environment-parser";
import { RuntimeError, normalizeRuntimeError } from "@ooa/runtime-core";

/**
 * PE page adapter contract.
 *
 * A production backend registers `{ runPE(params) }` through
 * `installPEBackend`, or exposes the same object as `globalThis.OpenOceanPEWasm`.
 * The deterministic fallback uses the same typed result shape and is always
 * marked as demonstration data.
 */

let installedBackend = null;

export const PE_ADAPTER_CONTRACT = Object.freeze({
  method: "runPE(params)",
  inputVersion: 1,
  resultVersion: 1,
  fieldStorage: "row-major-depth-range",
  referencePolicy: "same-input-nPade-10",
});

export function installPEBackend(backend) {
  if (!backend || typeof backend.runPE !== "function") {
    throw new TypeError("PE backend must implement runPE(params)");
  }
  installedBackend = backend;
}

function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, Number(value))); }
function number(value, fallback) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }

function linspace(start, end, count) {
  const values = new Float64Array(count);
  for (let index = 0; index < count; index += 1) {
    values[index] = count === 1 ? start : start + (end - start) * index / (count - 1);
  }
  return values;
}

function soundSpeed(profile, depth, maximumDepth) {
  if (profile === "constant" || profile === "pekeris") return 1500;
  if (profile === "surface") return 1490 + 26 * Math.tanh((500 - depth) / 220) + 0.012 * Math.max(0, depth - 500);
  const axis = Math.min(1300, maximumDepth * 0.36);
  const eta = clamp(2 * (depth - axis) / Math.max(500, axis), -8, 8);
  return 1500 * (1 + 0.00737 * (eta + Math.exp(-eta) - 1));
}

function interpolatedSoundSpeed(points, depthM) {
  if (!Array.isArray(points) || points.length < 2) return Number.NaN;
  if (depthM <= points[0][0]) return points[0][1];
  for (let index = 1; index < points.length; index += 1) {
    const right = points[index];
    if (depthM <= right[0]) {
      const left = points[index - 1];
      const fraction = (depthM - left[0]) / Math.max(1e-12, right[0] - left[0]);
      return left[1] + fraction * (right[1] - left[1]);
    }
  }
  return points.at(-1)[1];
}

function baseTransmissionLoss(rangeM, depthM, bathymetryM, params) {
  const maximumRangeM = params.maximumRangeKm * 1000;
  const rangeFraction = rangeM / Math.max(1, maximumRangeM);
  const sourceDepth = params.sourceDepthM;
  const channelAxis = params.profile === "surface" ? 430 : params.maximumDepthM * 0.36;
  const spreading = 60 + 10 * Math.log10(1 + rangeM / 220);
  const channel = 9 * Math.pow((depthM - channelAxis) / Math.max(350, params.maximumDepthM * 0.42), 2);
  const direct = -8 * Math.exp(-Math.pow((depthM - sourceDepth - 0.19 * rangeM / 100) / 320, 2));
  const interference = 6.5 * Math.sin(
    0.0105 * depthM + 0.00031 * rangeM + 0.35 * Math.sin(rangeFraction * Math.PI * 3),
  ) ** 2;
  const bottomPenalty = 12 * Math.exp(-Math.max(0, bathymetryM - depthM) / 170);
  return clamp(spreading + channel + direct + interference + bottomPenalty, 58, 124);
}

function truncationPattern(rangeFraction, depthFraction, bathymetryFraction, params) {
  const angleStress = Math.sin(Math.PI * depthFraction) * Math.sin(Math.PI * rangeFraction * 3.2);
  const accumulated = Math.pow(rangeFraction, 1.35) * (
    0.58 * Math.sin(11 * rangeFraction + 8 * depthFraction)
    + 0.42 * Math.cos(5 * rangeFraction - 15 * depthFraction)
  );
  const boundaryStress = Math.exp(-Math.max(0, bathymetryFraction - depthFraction) / 0.075)
    * Math.sin(18 * rangeFraction);
  return 0.42 * angleStress + 0.78 * accumulated + 0.35 * boundaryStress;
}

function padeCoefficient(nPade, referenceNPade) {
  return 19 * (1 / Math.pow(nPade, 1.42) - 1 / Math.pow(referenceNPade, 1.42));
}

async function demonstrationResult(input, reason) {
  const started = performance.now();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const params = {
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
  const columns = Math.round(clamp(input.rangeCount ?? 181, 41, 281));
  const rows = Math.round(clamp(input.depthCount ?? 131, 41, 201));
  const rangesKm = linspace(0, params.maximumRangeKm, columns);
  const depthsM = linspace(0, params.maximumDepthM, rows);
  const environmentDepthsM = linspace(0, params.waterDepthM, 121);
  const soundSpeedMps = Float64Array.from(environmentDepthsM, (depth) => {
    const sampled = interpolatedSoundSpeed(input.sspPoints, depth);
    return Number.isFinite(sampled) ? sampled : soundSpeed(params.profile, depth, params.waterDepthM);
  });
  const bathymetry = Array.from({ length: 81 }, (_, index) => {
    const fraction = index / 80;
    return [fraction * params.maximumRangeKm, params.waterDepthM];
  });
  const currentTlDb = new Float32Array(rows * columns);
  const referenceTlDb = new Float32Array(rows * columns);
  const deltaTlDb = new Float32Array(rows * columns);
  const convergenceAccumulator = Array.from({ length: 10 }, () => ({ square: 0, maximum: 0, count: 0 }));
  let validCellCount = 0;
  let squareSum = 0;
  let maximumDifference = 0;
  const currentCoefficient = padeCoefficient(params.nPade, params.referenceNPade);
  for (let depthIndex = 0; depthIndex < rows; depthIndex += 1) {
    const depthM = depthsM[depthIndex];
    const depthFraction = depthM / params.maximumDepthM;
    for (let rangeIndex = 0; rangeIndex < columns; rangeIndex += 1) {
      const rangeKm = rangesKm[rangeIndex];
      const rangeFraction = rangeKm / params.maximumRangeKm;
      const bottomDepth = params.waterDepthM;
      const offset = depthIndex * columns + rangeIndex;
      if (depthM > bottomDepth) {
        currentTlDb[offset] = Number.NaN;
        referenceTlDb[offset] = Number.NaN;
        deltaTlDb[offset] = Number.NaN;
        continue;
      }
      const reference = baseTransmissionLoss(rangeKm * 1000, depthM, bottomDepth, params);
      const pattern = truncationPattern(rangeFraction, depthFraction, bottomDepth / params.maximumDepthM, params);
      const current = clamp(reference + currentCoefficient * pattern, 55, 125);
      const difference = current - reference;
      currentTlDb[offset] = current;
      referenceTlDb[offset] = reference;
      deltaTlDb[offset] = difference;
      squareSum += difference * difference;
      maximumDifference = Math.max(maximumDifference, Math.abs(difference));
      validCellCount += 1;
      for (let nPade = 1; nPade <= 10; nPade += 1) {
        const error = padeCoefficient(nPade, params.referenceNPade) * pattern;
        const accumulator = convergenceAccumulator[nPade - 1];
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
    convergence: convergenceAccumulator.map((value, index) => ({
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

function validateResult(result) {
  if (!result || result.contractVersion !== 1) throw new Error("unsupported PE result contract");
  if (!result.field || !result.referenceField || !result.deltaField || !result.convergence) {
    throw new Error("incomplete PE result");
  }
  if (result.field.rows * result.field.columns !== result.field.tlDb.length) {
    throw new Error("PE field shape does not match TL storage");
  }
  return result;
}

let nativePackagePromise;
let nativeSolverPromise;
const nativeSweepCache = new Map();
const importedInputCache = new Map();
let nextImportedSourceId = 1;
let latestNativeRequestId = 0;
let nativeRequestActive = false;

function loadNativePackage() {
  nativePackagePromise ??= loadPeSdkModule();
  return nativePackagePromise;
}

async function nativeSolver() {
  nativeSolverPromise ??= loadNativePackage().then(({ RAM }) => (
    RAM.create({ ...RAM.recommendedRuntime(), threadCount: 1 })
  ));
  return nativeSolverPromise;
}

function nativeEnvironmentKey(params) {
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

function trimNativeSweepCache() {
  while (nativeSweepCache.size > 3) {
    nativeSweepCache.delete(nativeSweepCache.keys().next().value);
  }
}

function numericArray(values) {
  return Array.from(values || [], (value) => number(value, 0));
}

function cloneDepthProfile(profile) {
  return {
    depthsM: numericArray(profile?.depthsM),
    values: numericArray(profile?.values),
  };
}

function bathymetryDepthAt(points, rangeM) {
  if (!points.length) return Number.POSITIVE_INFINITY;
  if (rangeM <= points[0].rangeM) return points[0].depthM;
  for (let index = 1; index < points.length; index += 1) {
    const right = points[index];
    if (rangeM <= right.rangeM) {
      const left = points[index - 1];
      const mix = (rangeM - left.rangeM) / Math.max(1e-12, right.rangeM - left.rangeM);
      return left.depthM + mix * (right.depthM - left.depthM);
    }
  }
  return points.at(-1).depthM;
}

function maskedTransmissionLoss(field, bathymetry) {
  const ranges = field.receiverRangesM;
  const depths = field.receiverDepthsM;
  const output = new Float32Array(field.transmissionLossDb.length);
  for (let depthIndex = 0; depthIndex < depths.length; depthIndex += 1) {
    for (let rangeIndex = 0; rangeIndex < ranges.length; rangeIndex += 1) {
      const offset = depthIndex * ranges.length + rangeIndex;
      output[offset] = field.validityMask[offset] &&
          depths[depthIndex] <= bathymetryDepthAt(bathymetry, ranges[rangeIndex])
        ? field.transmissionLossDb[offset]
        : Number.NaN;
    }
  }
  return output;
}

function profilesEqual(left, right, tolerance = 1e-9) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((point, index) => (
    Array.isArray(point) && Array.isArray(right[index])
    && Math.abs(number(point[0], NaN) - number(right[index][0], NaN)) <= tolerance
    && Math.abs(number(point[1], NaN) - number(right[index][1], NaN)) <= tolerance
  ));
}

function clonedRamInput(params, nativePackage) {
  const imported = importedInputCache.get(params.sourceId);
  const original = imported?.input;
  if (!original || !imported) throw new Error("导入的 RAM 环境已失效，请重新选择 .in 文件");
  const input = {
    environment: {
      title: original.environment.title,
      frequencyHz: original.environment.frequencyHz,
      referenceSoundSpeedMps: original.environment.referenceSoundSpeedMps,
      bathymetry: original.environment.bathymetry.map((point) => ({ ...point })),
      mediumSections: original.environment.mediumSections.map((section) => ({
        activationRangeM: section.activationRangeM,
        waterSoundSpeedMps: cloneDepthProfile(section.waterSoundSpeedMps),
        bottomCompressionalSpeedMps: cloneDepthProfile(section.bottomCompressionalSpeedMps),
        bottomDensityKgM3: cloneDepthProfile(section.bottomDensityKgM3),
        bottomCompressionalAttenuationDbPerWavelength: cloneDepthProfile(
          section.bottomCompressionalAttenuationDbPerWavelength,
        ),
      })),
    },
    source: { ...original.source },
    receivers: { depthsM: numericArray(original.receivers.depthsM) },
    options: { ...original.options },
    outputRequest: { ...original.outputRequest },
  };
  const baseline = imported.baseline;
  input.environment.frequencyHz = params.frequencyHz;
  input.source.depthM = params.sourceDepthM;
  input.outputRequest.maximumRangeM = params.maximumRangeKm * 1000;
  input.options.rangeStepM = params.rangeStepM;
  input.outputRequest.maximumDepthM = params.maximumDepthM;
  input.options.depthStepM = params.depthStepM;
  input.outputRequest.plotMaximumDepthM = params.maximumDepthM;
  input.options.padeTerms = params.nPade;

  const originalMaximumRangeM = number(baseline.maximumRangeKm, params.maximumRangeKm) * 1000;
  if (originalMaximumRangeM > 0 && Math.abs(originalMaximumRangeM - input.outputRequest.maximumRangeM) > 1e-9) {
    const rangeScale = input.outputRequest.maximumRangeM / originalMaximumRangeM;
    input.environment.bathymetry = input.environment.bathymetry.map((point) => ({
      ...point,
      rangeM: point.rangeM * rangeScale,
    }));
    input.environment.mediumSections = input.environment.mediumSections.map((section) => ({
      ...section,
      activationRangeM: section.activationRangeM * rangeScale,
    }));
  }
  const bottomShift = params.waterDepthM - number(baseline.waterDepthM, params.waterDepthM);
  if (Math.abs(bottomShift) > 1e-9) {
    input.environment.bathymetry = input.environment.bathymetry.map((point) => ({
      ...point,
      depthM: Math.max(1e-6, point.depthM + bottomShift),
    }));
  }

  if (!profilesEqual(params.sspPoints, baseline.profilePoints)) {
    const points = params.sspPoints.map((point) => [number(point[0], 0), number(point[1], 1500)]);
    if (points.at(-1)[0] < params.maximumDepthM) {
      points.push([params.maximumDepthM, points.at(-1)[1]]);
    }
    input.environment.referenceSoundSpeedMps = points[0][1];
    input.environment.mediumSections = input.environment.mediumSections.map((section) => ({
      ...section,
      waterSoundSpeedMps: {
        depthsM: points.map((point) => point[0]),
        values: points.map((point) => point[1]),
      },
    }));
  }

  const bottomOverrides = [
    ["bottomCompressionalSpeedMps", "bottomSoundSpeedMps"],
    ["bottomDensityKgM3", "bottomDensityKgM3"],
    ["bottomCompressionalAttenuationDbPerWavelength", "bottomAttenuationDbPerWavelength"],
  ];
  for (const [profileKey, parameterKey] of bottomOverrides) {
    if (Math.abs(number(params[parameterKey], 0) - number(baseline[parameterKey], params[parameterKey])) <= 1e-9) continue;
    input.environment.mediumSections = input.environment.mediumSections.map((section) => ({
      ...section,
      [profileKey]: {
        ...section[profileKey],
        values: numericArray(section[profileKey].values).map(() => params[parameterKey]),
      },
    }));
  }
  return nativePackage.RAMInput.parse(input);
}

function ramInputFromCanonicalEnvironment(
  params,
  rangeOutputDecimation,
  depthOutputDecimation,
  nativePackage,
) {
  const profilePoints = params.sspPoints.map((point) => [
    number(point[0], 0),
    number(point[1], 1500),
  ]);
  if (profilePoints.at(-1)[0] < params.maximumDepthM) {
    profilePoints.push([params.maximumDepthM, profilePoints.at(-1)[1]]);
  }
  const maximumRangeM = params.maximumRangeKm * 1000;
  const suppliedBathymetry = Array.isArray(params.bathymetry)
    ? params.bathymetry.map((point) => ({
      rangeM: number(point[0], 0) * 1000,
      depthM: number(point[1], params.waterDepthM),
    }))
    : [];
  const bathymetry = suppliedBathymetry.length
    ? suppliedBathymetry
    : [{ rangeM: 0, depthM: params.waterDepthM }, { rangeM: maximumRangeM, depthM: params.waterDepthM }];
  if (bathymetry.length === 1) {
    if (bathymetry[0].rangeM > 0) bathymetry.unshift({ rangeM: 0, depthM: bathymetry[0].depthM });
    else bathymetry.push({ rangeM: maximumRangeM, depthM: bathymetry[0].depthM });
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
          depthsM: profilePoints.map((point) => point[0]),
          values: profilePoints.map((point) => point[1]),
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

async function calculateNativeSweep(params) {
  if (params.model !== "ram") {
    throw new Error("当前 WASM 版本只启用 RAM");
  }
  const maximumRangeM = params.maximumRangeKm * 1000;
  const waterDepthM = params.waterDepthM;
  const sourceDepthM = clamp(params.sourceDepthM, 0, waterDepthM - 1);
  const rangeSteps = Math.ceil(maximumRangeM / params.rangeStepM);
  const depthCells = Math.ceil(params.maximumDepthM / params.depthStepM);
  if (rangeSteps * depthCells * 10 > 150_000_000) {
    throw new RangeError("当前 dr、dz 与传播范围会产生过大的浏览器计算量，请增大步长或缩小计算域");
  }
  const rangeOutputDecimation = Math.max(1, Math.ceil(rangeSteps / Math.max(41, params.rangeCount || 181)));
  const depthOutputDecimation = Math.max(1, Math.ceil(depthCells / Math.max(41, params.depthCount || 131)));
  const nativePackage = await loadNativePackage();
  const input = params.sourceId
    ? clonedRamInput({ ...params, sourceDepthM }, nativePackage)
    : ramInputFromCanonicalEnvironment(
      { ...params, sourceDepthM },
      rangeOutputDecimation,
      depthOutputDecimation,
      nativePackage,
    );
  const solver = await nativeSolver();
  const fields = [];
  for (let padeTerms = 1; padeTerms <= 10; padeTerms += 1) {
    const edited = nativePackage.RAMInput.edit(input).options().padeTerms(padeTerms).build();
    const outcome = await solver.run(edited);
    if (!outcome.succeeded || !outcome.result) {
      const diagnostics = outcome.diagnostics
        .map((issue) => `${issue.path || "run"}: ${issue.message}`)
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
  const reference = fields.at(-1);
  return {
    fields,
    summaries: fields.map((field) => comparePadeFields(field, reference)),
  };
}

function comparePadeFields(item, reference) {
  const field = item.field;
  const referenceField = reference.field;
  if (field.receiverRangesM.length !== referenceField.receiverRangesM.length ||
      field.receiverDepthsM.length !== referenceField.receiverDepthsM.length ||
      field.transmissionLossDb.length !== referenceField.transmissionLossDb.length) {
    throw new RangeError("Padé sweep results do not share one field grid");
  }
  let pressureDifferenceSquared = 0;
  let referencePressureSquared = 0;
  let tlDifferenceSquared = 0;
  let maximumTlDifference = 0;
  let tlCount = 0;
  for (let index = 0; index < field.transmissionLossDb.length; index += 1) {
    if (!field.validityMask[index] || !referenceField.validityMask[index]) continue;
    const realDifference = field.realPressure[index] - referenceField.realPressure[index];
    const imaginaryDifference = field.imaginaryPressure[index] - referenceField.imaginaryPressure[index];
    if (Number.isFinite(realDifference) && Number.isFinite(imaginaryDifference)) {
      pressureDifferenceSquared += realDifference * realDifference + imaginaryDifference * imaginaryDifference;
      const referenceReal = referenceField.realPressure[index];
      const referenceImaginary = referenceField.imaginaryPressure[index];
      referencePressureSquared += referenceReal * referenceReal + referenceImaginary * referenceImaginary;
    }
    const fieldTl = field.transmissionLossDb[index];
    const referenceTl = referenceField.transmissionLossDb[index];
    if (Number.isFinite(fieldTl) && Number.isFinite(referenceTl) &&
        fieldTl >= 40 && fieldTl <= 120 && referenceTl >= 40 && referenceTl <= 120) {
      const difference = fieldTl - referenceTl;
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

export async function parseRamEnvironment(input) {
  if (!input || typeof input.text !== "string") {
    throw new TypeError("RAM import requires a text string");
  }
  const name = input.name || "ram.in";
  const nativePackage = await loadNativePackage();
  let nativeInput;
  try {
    nativeInput = nativePackage.RAMInput.fromRamIn({ name, text: input.text });
  } catch (error) {
    throw new RuntimeError("INPUT_INVALID", "RAM .in 无法解析", { cause: error });
  }
  const pageEnvironment = await importPePageEnvironment([{
    name,
    kind: "ram-in",
    content: input.text,
  }]);
  const sourceId = `pe-source-${nextImportedSourceId++}`;
  const firstSection = nativeInput.environment.mediumSections[0];
  const water = firstSection.waterSoundSpeedMps;
  const bathymetry = nativeInput.environment.bathymetry.map(
    (point) => [point.rangeM / 1000, point.depthM],
  );
  const profilePoints = Array.from(
    water.depthsM,
    (depth, index) => [depth, water.values[index]],
  );
  const baseline = {
    waterDepthM: bathymetry[0]?.[1] ?? nativeInput.outputRequest.plotMaximumDepthM,
    maximumRangeKm: nativeInput.outputRequest.maximumRangeM / 1000,
    maximumDepthM: nativeInput.outputRequest.maximumDepthM,
    profilePoints,
    bottomSoundSpeedMps: firstSection.bottomCompressionalSpeedMps.values[0],
    bottomDensityKgM3: firstSection.bottomDensityKgM3.values[0],
    bottomAttenuationDbPerWavelength:
      firstSection.bottomCompressionalAttenuationDbPerWavelength.values[0],
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
    documents: undefined,
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

async function runNativePE(params) {
  const key = nativeEnvironmentKey(params);
  let sweepPromise = nativeSweepCache.get(key);
  if (!sweepPromise) {
    sweepPromise = calculateNativeSweep(params);
    nativeSweepCache.set(key, sweepPromise);
    trimNativeSweepCache();
    sweepPromise.catch(() => {
      if (nativeSweepCache.get(key) === sweepPromise) nativeSweepCache.delete(key);
    });
  }
  const sweep = await sweepPromise;
  const current = sweep.fields.find((field) => field.padeTerms === params.nPade);
  const reference = sweep.fields.find((field) => field.padeTerms === 10);
  if (!current || !reference) throw new Error("PE Padé sweep did not return the requested fields");
  const bathymetryPoints = reference.input.environment.bathymetry;
  const bathymetry = bathymetryPoints.map((point) => [point.rangeM / 1000, point.depthM]);
  const rangesKm = Float64Array.from(reference.field.receiverRangesM, (value) => value / 1000);
  const depthsM = Float64Array.from(reference.field.receiverDepthsM);
  const currentTl = maskedTransmissionLoss(current.field, bathymetryPoints);
  const referenceTl = maskedTransmissionLoss(reference.field, bathymetryPoints);
  const delta = new Float32Array(currentTl.length);
  let squareSum = 0;
  let maximumDifference = 0;
  let validCellCount = 0;
  for (let index = 0; index < delta.length; index += 1) {
    const left = currentTl[index];
    const right = referenceTl[index];
    if (!Number.isFinite(left) || !Number.isFinite(right)) {
      delta[index] = Number.NaN;
      continue;
    }
    const difference = left - right;
    delta[index] = difference;
    if (left >= 40 && left <= 120 && right >= 40 && right <= 120) {
      squareSum += difference * difference;
      maximumDifference = Math.max(maximumDifference, Math.abs(difference));
      validCellCount += 1;
    }
  }
  const currentSummary = sweep.summaries.find((summary) => summary.padeTerms === params.nPade);
  const computeMs = sweep.fields.reduce((total, field) => total + field.totalTimeMs, 0);
  const referenceProfile = reference.input.environment.mediumSections[0].waterSoundSpeedMps;
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
    convergence: sweep.summaries.map((summary) => ({
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

function cancelledNativeRequest() {
  return new RuntimeError("CANCELLED", "A newer PE request replaced this calculation");
}

async function runLatestNativePE(params) {
  const requestId = ++latestNativeRequestId;
  if (nativeRequestActive && nativeSolverPromise) {
    const solver = await nativeSolverPromise;
    solver.cancel();
    nativeSweepCache.clear();
  }
  nativeRequestActive = true;
  try {
    const result = await runNativePE(params);
    if (requestId !== latestNativeRequestId) throw cancelledNativeRequest();
    return result;
  } finally {
    if (requestId === latestNativeRequestId) nativeRequestActive = false;
  }
}

export async function runPE(params) {
  const backend = installedBackend || globalThis.OpenOceanPEWasm || null;
  if (backend && typeof backend.runPE === "function") {
    try {
      const result = validateResult(await backend.runPE(params));
      return { ...result, runtime: { ...result.runtime, mode: "wasm", fallback: false } };
    } catch (error) { throw error; }
  }
  if (new URLSearchParams(globalThis.location?.search || "").has("demo")) {
    return demonstrationResult(params, "URL requested the deterministic demo backend");
  }
  try {
    return await runLatestNativePE(params);
  } catch (error) {
    throw normalizeRuntimeError(error);
  }
}
