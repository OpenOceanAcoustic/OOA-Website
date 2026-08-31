import { loadLegacyNormalModeSdkModule } from "@ooa/runtime-normal-mode/legacy-sdk";
import { importNormalModePageEnvironment } from "@ooa/runtime-normal-mode";

/**
 * Normal Mode page adapter contract.
 *
 * A production backend registers `{ runNormalMode(params) }` through
 * `installNormalModeBackend`, or exposes the same object as
 * `globalThis.OpenOceanNormalModeWasm`. Until then, this module returns a
 * deterministic browser-only demonstration result with the identical shape.
 */

let installedBackend = null;

export const NORMAL_MODE_ADAPTER_CONTRACT = Object.freeze({
  method: "runNormalMode(params)",
  inputVersion: 1,
  resultVersion: 1,
  complexStorage: "interleaved-real-imaginary",
  fieldStorage: "row-major-depth-range",
  modeShapeStorage: "row-major-mode-depth-interleaved-complex",
});

export function installNormalModeBackend(backend) {
  if (!backend || typeof backend.runNormalMode !== "function") {
    throw new TypeError("Normal Mode backend must implement runNormalMode(params)");
  }
  installedBackend = backend;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value)));
}

function linspace(start, end, count) {
  const values = new Float64Array(count);
  for (let index = 0; index < count; index += 1) {
    values[index] = count === 1 ? start : start + (end - start) * index / (count - 1);
  }
  return values;
}

function soundSpeed(profile, depth, waterDepth) {
  if (profile === "constant" || profile === "pekeris") return 1500;
  if (profile === "surface") {
    const transition = Math.tanh((650 - depth) / 270);
    return 1491 + 23 * transition + 0.009 * Math.max(0, depth - 650);
  }
  const axis = Math.min(1500, waterDepth * 0.29);
  const eta = clamp(2 * (depth - axis) / Math.max(600, axis), -8, 8);
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

function makeEnvironment(params) {
  const waterDepthM = clamp(params.waterDepthM ?? 200, 50, 8000);
  const depthsM = linspace(0, waterDepthM, 121);
  const soundSpeedMps = Float64Array.from(depthsM, (depth) => (
    Number.isFinite(interpolatedSoundSpeed(params.sspPoints, depth))
      ? interpolatedSoundSpeed(params.sspPoints, depth)
      : soundSpeed(params.profile || "pekeris", depth, waterDepthM)
  ));
  return { waterDepthM, depthsM, soundSpeedMps };
}

function modeShapeValue(modeIndex, depth, waterDepth) {
  const order = modeIndex + 1;
  const normalizedDepth = depth / waterDepth;
  const envelope = 0.72 + 0.28 * Math.exp(-Math.pow((normalizedDepth - 0.3) / 0.36, 2));
  const real = Math.sin(order * Math.PI * normalizedDepth) * envelope;
  const imaginary = 0;
  return [real, imaginary];
}

function makeModes(params, environment) {
  const frequencyHz = clamp(params.frequencyHz ?? 75, 10, 1000);
  const minimumSpeed = Math.min(...environment.soundSpeedMps);
  const maximumSpeed = Math.max(...environment.soundSpeedMps);
  const contrast = Math.sqrt(Math.max(0.008, (maximumSpeed - minimumSpeed) / minimumSpeed));
  const estimated = Math.round(2 * environment.waterDepthM * frequencyHz / minimumSpeed * contrast);
  const modeCount = Math.round(clamp(estimated, 12, 112));
  const modeDepthsM = environment.depthsM.slice();
  const horizontalWavenumbersInterleaved = new Float64Array(modeCount * 2);
  const groupVelocityMps = new Float64Array(modeCount);
  const modeShapesInterleaved = new Float64Array(modeCount * modeDepthsM.length * 2);
  const referenceSpeed = minimumSpeed + 0.31 * (maximumSpeed - minimumSpeed);
  const omega = 2 * Math.PI * frequencyHz;
  const referenceWavenumber = omega / referenceSpeed;
  for (let mode = 0; mode < modeCount; mode += 1) {
    const vertical = (mode + 0.68) * Math.PI / environment.waterDepthM;
    const real = Math.sqrt(Math.max(referenceWavenumber ** 2 * 0.12, referenceWavenumber ** 2 - vertical ** 2));
    // Native Kraken uses Im(k) < 0 for attenuation with exp(-i k r).
    const imaginary = -0.24 * 1.2e-7 * (1 + 20 * (mode / Math.max(1, modeCount - 1)) ** 3);
    horizontalWavenumbersInterleaved[mode * 2] = real;
    horizontalWavenumbersInterleaved[mode * 2 + 1] = imaginary;
    groupVelocityMps[mode] = clamp(omega / real * (0.985 - 0.055 * mode / modeCount), 1380, 1750);
    for (let depthIndex = 0; depthIndex < modeDepthsM.length; depthIndex += 1) {
      const [shapeReal, shapeImaginary] = modeShapeValue(
        mode,
        modeDepthsM[depthIndex],
        environment.waterDepthM,
      );
      const offset = (mode * modeDepthsM.length + depthIndex) * 2;
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

function pressurePlane(params, environment, modes, rangeAxisM, depthAxisM, modeLimit) {
  const values = new Float64Array(rangeAxisM.length * depthAxisM.length * 2);
  const sourceDepth = clamp(params.sourceDepthM ?? 800, 1, environment.waterDepthM - 1);
  const sourceIndex = Math.round(sourceDepth / environment.waterDepthM * (modes.depthsM.length - 1));
  for (let depthIndex = 0; depthIndex < depthAxisM.length; depthIndex += 1) {
    const modeDepthIndex = Math.round(depthIndex / Math.max(1, depthAxisM.length - 1) * (modes.depthsM.length - 1));
    for (let rangeIndex = 0; rangeIndex < rangeAxisM.length; rangeIndex += 1) {
      const rangeM = Math.max(100, rangeAxisM[rangeIndex]);
      let real = 0;
      let imaginary = 0;
      for (let mode = 0; mode < modeLimit; mode += 1) {
        const sourceOffset = (mode * modes.depthsM.length + sourceIndex) * 2;
        const receiverOffset = (mode * modes.depthsM.length + modeDepthIndex) * 2;
        const sourceReal = modes.modeShapesInterleaved[sourceOffset];
        const sourceImaginary = modes.modeShapesInterleaved[sourceOffset + 1];
        const receiverReal = modes.modeShapesInterleaved[receiverOffset];
        const receiverImaginary = modes.modeShapesInterleaved[receiverOffset + 1];
        const couplingReal = sourceReal * receiverReal - sourceImaginary * receiverImaginary;
        const couplingImaginary = sourceReal * receiverImaginary + sourceImaginary * receiverReal;
        const kr = modes.horizontalWavenumbersInterleaved[mode * 2];
        const imaginaryWavenumber = modes.horizontalWavenumbersInterleaved[mode * 2 + 1];
        const spreading = Math.exp(imaginaryWavenumber * rangeM) / Math.sqrt(1 + rangeM / 700);
        const phase = kr * rangeM - Math.PI / 4;
        const cosine = Math.cos(phase);
        const sine = Math.sin(phase);
        const weight = spreading / Math.sqrt(Math.max(kr, 1e-8));
        real += weight * (couplingReal * cosine - couplingImaginary * sine);
        imaginary += weight * (couplingReal * sine + couplingImaginary * cosine);
      }
      const offset = (depthIndex * rangeAxisM.length + rangeIndex) * 2;
      values[offset] = real;
      values[offset + 1] = imaginary;
    }
  }
  return values;
}

function toTransmissionLoss(pressure, normalization) {
  const values = new Float32Array(pressure.length / 2);
  for (let index = 0; index < values.length; index += 1) {
    const magnitude = Math.max(1e-12, Math.hypot(pressure[index * 2], pressure[index * 2 + 1]));
    values[index] = clamp(60 - 20 * Math.log10(magnitude / normalization), 60, 120);
  }
  return values;
}

function maximumMagnitude(pressure) {
  let maximum = 1e-12;
  for (let index = 0; index < pressure.length; index += 2) {
    maximum = Math.max(maximum, Math.hypot(pressure[index], pressure[index + 1]));
  }
  return maximum;
}

async function demonstrationResult(params, reason) {
  const started = performance.now();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const environment = makeEnvironment(params);
  const modes = makeModes(params, environment);
  const columns = Math.round(clamp(params.rangeCount ?? 161, 41, 241));
  const rows = Math.round(clamp(params.depthCount ?? 121, 41, 181));
  const maximumRangeKm = clamp(params.maximumRangeKm ?? 100, 5, 250);
  const rangesKm = linspace(0.1, maximumRangeKm, columns);
  const rangesM = Float64Array.from(rangesKm, (value) => value * 1000);
  const depthsM = linspace(0, environment.waterDepthM, rows);
  const activeModeCount = Math.round(clamp(params.modeLimit ?? 24, 1, modes.count));
  const fullPressure = pressurePlane(params, environment, modes, rangesM, depthsM, modes.count);
  const truncatedPressure = activeModeCount === modes.count
    ? fullPressure.slice()
    : pressurePlane(params, environment, modes, rangesM, depthsM, activeModeCount);
  const normalization = maximumMagnitude(fullPressure);
  const fullTlDb = toTransmissionLoss(fullPressure, normalization);
  const truncatedTlDb = toTransmissionLoss(truncatedPressure, normalization);
  const deltaTlDb = new Float32Array(fullTlDb.length);
  let squareSum = 0;
  let maximumDifference = 0;
  for (let index = 0; index < deltaTlDb.length; index += 1) {
    const difference = truncatedTlDb[index] - fullTlDb[index];
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

function validateResult(result) {
  if (!result || result.contractVersion !== 1) throw new Error("unsupported Normal Mode result contract");
  if (!result.modes || !result.field || !result.deltaField) throw new Error("incomplete Normal Mode result");
  if (result.field.rows * result.field.columns !== result.field.tlDb.length) {
    throw new Error("Normal Mode field shape does not match TL storage");
  }
  return result;
}

let normalPackagePromise;
let normalSolverPromise;
const fullRunCache = new Map();
const limitedRunCache = new Map();
const FULL_MODE_LIMIT = 9999;
const MODE_SHAPE_DEPTH_SAMPLES = 401;
const MINIMUM_FLOAT32_MAGNITUDE = 1.1754943508222875e-38;

function loadNormalPackage() {
  normalPackagePromise ??= loadLegacyNormalModeSdkModule();
  return normalPackagePromise;
}

async function normalSolver() {
  if (!normalSolverPromise) {
    const pending = loadNormalPackage().then(({ Kraken }) => (
      Kraken.create(import.meta.env.DEV
        ? { executionMode: "SINGLE_THREAD", threadCount: 1 }
        : Kraken.recommendedRuntime())
    ));
    normalSolverPromise = pending;
    pending.catch(() => {
      if (normalSolverPromise === pending) normalSolverPromise = null;
    });
  }
  return normalSolverPromise;
}

function normalEnvironmentKey(params) {
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
  });
}

function trimNormalCaches() {
  while (fullRunCache.size > 3) fullRunCache.delete(fullRunCache.keys().next().value);
  while (limitedRunCache.size > 12) limitedRunCache.delete(limitedRunCache.keys().next().value);
}

async function makeNativeInput(params, modeLimit) {
  if (params.model !== "kraken") {
    throw new Error("当前 WASM 版本只启用 Kraken");
  }
  const {
    AcousticAttenuationUnit,
    BoundaryKind,
    KrakenInput,
    KrakenOutputRequest,
    SourceModel,
    WaveguideInterpolation,
  } = await loadNormalPackage();
  const waterDepthM = clamp(params.waterDepthM ?? 200, 50, 8000);
  const maximumRangeM = clamp(params.maximumRangeKm ?? 20, 0.001, 250) * 1000;
  const rangeCount = Math.round(clamp(params.rangeCount ?? 161, 2, 2048));
  const depthCount = Math.round(clamp(params.depthCount ?? 121, 2, 2048));
  const rangesM = linspace(0, maximumRangeM, rangeCount);
  const receiverDepthsM = linspace(0, waterDepthM, depthCount);
  const modeDepthsM = linspace(0, waterDepthM, MODE_SHAPE_DEPTH_SAMPLES);
  const profilePoints = nativeProfilePoints(params, waterDepthM);
  const profileDepthsM = Float64Array.from(profilePoints, (point) => point[0]);
  const profileSoundSpeedMps = Float64Array.from(profilePoints, (point) => point[1]);
  const zeros = new Float64Array(profilePoints.length);
  const waterDensity = Float64Array.from(profilePoints, () => 1);
  const attenuationUnit = AcousticAttenuationUnit.DB_PER_WAVELENGTH;
  const top = {
    kind: BoundaryKind.VACUUM,
    compressionalSpeedMps: 0,
    compressionalAttenuation: 0,
    shearSpeedMps: 0,
    shearAttenuation: 0,
    densityRelative: 0,
    attenuationUnit,
  };
  const bottom = {
    kind: BoundaryKind.MATERIAL_HALF_SPACE,
    compressionalSpeedMps: params.bottomSoundSpeedMps,
    compressionalAttenuation: params.bottomAttenuationDbPerWavelength,
    shearSpeedMps: 0,
    shearAttenuation: 0,
    densityRelative: params.bottomDensityRelative,
    attenuationUnit,
  };
  const environment = {
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
  const source = {
    depthsM: [clamp(params.sourceDepthM ?? 50, 0, waterDepthM)],
    model: SourceModel.POINT,
    directivity: [],
  };
  const receivers = { rangesM, depthsM: receiverDepthsM };
  const outputRequest = {
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

function nativeProfilePoints(params, waterDepthM) {
  const source = Array.isArray(params.sspPoints) ? params.sspPoints : [];
  const points = source
    .map((point) => [Number(point?.[0]), Number(point?.[1])])
    .filter(([depth, speed]) => Number.isFinite(depth) && Number.isFinite(speed) && speed > 0)
    .map(([depth, speed]) => [clamp(depth, 0, waterDepthM), speed])
    .sort((left, right) => left[0] - right[0]);
  const unique = [];
  for (const point of points) {
    if (unique.length && Math.abs(unique.at(-1)[0] - point[0]) < 1e-9) unique[unique.length - 1] = point;
    else unique.push(point);
  }
  if (!unique.length) {
    const fallback = makeEnvironment(params);
    return Array.from(fallback.depthsM, (depth, index) => [depth, fallback.soundSpeedMps[index]]);
  }
  if (unique[0][0] > 0) unique.unshift([0, unique[0][1]]);
  if (unique.at(-1)[0] < waterDepthM) unique.push([waterDepthM, unique.at(-1)[1]]);
  if (unique.length === 1) unique.push([waterDepthM, unique[0][1]]);
  return unique;
}

function nativeInterpolation(value, WaveguideInterpolation) {
  switch (String(value || "linear").trim().toUpperCase().replaceAll("-", "_")) {
    case "SQUARED_SLOWNESS_LINEAR": return WaveguideInterpolation.SQUARED_SLOWNESS_LINEAR;
    case "CUBIC":
    case "CUBIC_SPLINE": return WaveguideInterpolation.CUBIC_SPLINE;
    case "PCHIP": return WaveguideInterpolation.PCHIP;
    default: return WaveguideInterpolation.LINEAR;
  }
}

export async function parseKrakenEnvironment(input) {
  if (!input || typeof input.envText !== "string" || typeof input.flpText !== "string") {
    throw new TypeError("Kraken import requires envText and flpText strings");
  }
  return importNormalModePageEnvironment([
    { name: input.envName || "environment.env", kind: "kraken-env", content: input.envText },
    { name: input.flpName || "environment.flp", kind: "kraken-flp", content: input.flpText },
  ]);
}

function requestedModeLimit(params) {
  const value = Math.round(Number(params.modeLimit));
  return Number.isFinite(value) ? Math.max(1, value) : 24;
}

function outcomeFailure(outcome) {
  const diagnostics = Array.from(outcome?.diagnostics || [], (issue) => {
    const location = issue.path ? ` (${issue.path})` : "";
    return `${issue.code || "KRAKEN_RUN_FAILED"}${location}: ${issue.message || "unknown error"}`;
  });
  return diagnostics.length ? diagnostics.join("; ") : `Kraken run failed with status ${outcome?.status || "UNKNOWN"}`;
}

async function rawNormalRun(input, modeLimit) {
  const [solver, { RunStatus }] = await Promise.all([normalSolver(), loadNormalPackage()]);
  const outcome = await solver.run(input);
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

function cachedNormalRuns(params) {
  const key = normalEnvironmentKey(params);
  let full = fullRunCache.get(key);
  if (!full) {
    full = makeNativeInput(params, FULL_MODE_LIMIT)
      .then((input) => rawNormalRun(input, FULL_MODE_LIMIT));
    fullRunCache.set(key, full);
    full.catch(() => fullRunCache.delete(key));
  }
  const requested = requestedModeLimit(params);
  const limitedKey = `${key}|${requested}`;
  let limited = limitedRunCache.get(limitedKey);
  if (!limited) {
    limited = full.then(async (fullResult) => {
      const available = firstModeProfile(fullResult.modes).count;
      if (requested >= available) return fullResult;
      const { KrakenInput } = await loadNormalPackage();
      const limitedInput = KrakenInput.edit(fullResult.input)
        .options().modeLimit(requested)
        .build();
      return rawNormalRun(limitedInput, requested);
    });
    limitedRunCache.set(limitedKey, limited);
    limited.catch(() => limitedRunCache.delete(limitedKey));
  }
  trimNormalCaches();
  return { full, limited };
}

function asFloat64(values) {
  return values instanceof Float64Array ? values : Float64Array.from(values || []);
}

function asFloat32(values) {
  return values instanceof Float32Array ? values : Float32Array.from(values || []);
}

function pressureFieldToDepthRangeTl(rawField) {
  const frequencyCount = rawField.frequenciesHz.length;
  const columns = rawField.receiverRangesM.length;
  const rows = rawField.receiverDepthsM.length;
  const pressure = asFloat32(rawField.pressureInterleaved);
  const expectedLength = frequencyCount * columns * rows * 2;
  if (!frequencyCount || !columns || !rows || pressure.length !== expectedLength) {
    throw new Error(`Kraken pressure storage has ${pressure.length} values; expected ${expectedLength}`);
  }
  const tlDb = new Float32Array(rows * columns);
  // Kraken exposes [frequency][range][depth][real/imaginary]. The page heatmap
  // consumes depth-major rows, so transpose the first frequency plane here.
  for (let rangeIndex = 0; rangeIndex < columns; rangeIndex += 1) {
    for (let depthIndex = 0; depthIndex < rows; depthIndex += 1) {
      const source = (rangeIndex * rows + depthIndex) * 2;
      const magnitude = Math.hypot(pressure[source], pressure[source + 1]);
      tlDb[depthIndex * columns + rangeIndex] = Number.isFinite(magnitude)
        ? -20 * Math.log10(Math.max(MINIMUM_FLOAT32_MAGNITUDE, magnitude))
        : Number.NaN;
    }
  }
  return { rows, columns, tlDb };
}

function firstModeProfile(rawModes) {
  if (!rawModes?.modeCounts?.length) throw new Error("Kraken did not return a mode profile");
  const profileIndex = 0;
  const count = Number(rawModes.modeCounts[profileIndex]);
  const depthCount = Number(rawModes.depthCounts[profileIndex]);
  const depthOffset = Number(rawModes.depthOffsets[profileIndex]);
  const wavenumberOffset = Number(rawModes.wavenumberOffsets[profileIndex]);
  const shapeOffset = Number(rawModes.shapeOffsets[profileIndex]);
  const nextShapeOffset = Number(rawModes.shapeOffsets[profileIndex + 1]);
  if (!Number.isInteger(count) || count < 1 || !Number.isInteger(depthCount) || depthCount < 2) {
    throw new Error("Kraken returned invalid mode/depth counts");
  }
  if (nextShapeOffset - shapeOffset !== count * depthCount) {
    throw new Error("Kraken mode-shape offsets do not match the profile dimensions");
  }
  const depthsM = asFloat64(rawModes.depthsM).slice(depthOffset, depthOffset + depthCount);
  const horizontalWavenumbersInterleaved = asFloat64(rawModes.wavenumbersInterleaved)
    .slice(wavenumberOffset * 2, (wavenumberOffset + count) * 2);
  const groupVelocityMps = asFloat64(rawModes.groupVelocityMps)
    .slice(wavenumberOffset, wavenumberOffset + count);
  const modeShapesInterleaved = asFloat64(rawModes.modeShapesInterleaved)
    .slice(shapeOffset * 2, nextShapeOffset * 2);
  const frequencyHz = Number(rawModes.frequenciesHz[profileIndex]);
  const angularFrequency = 2 * Math.PI * frequencyHz;
  const phaseSpeedMps = Float64Array.from({ length: count }, (_, index) => (
    angularFrequency / Math.max(1e-12, horizontalWavenumbersInterleaved[index * 2])
  ));
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

function nativeSampledEnvironment(params, modeDepths) {
  const depthsM = asFloat64(modeDepths);
  const soundSpeedMps = Float64Array.from(
    depthsM,
    (depth) => interpolatedSoundSpeed(params.sspPoints, depth),
  );
  return { depthsM, soundSpeedMps };
}

async function runNativeNormalMode(params) {
  const started = performance.now();
  const { full, limited } = cachedNormalRuns(params);
  const [fullRaw, activeRaw] = await Promise.all([full, limited]);
  const profile = firstModeProfile(fullRaw.modes);
  const fullField = pressureFieldToDepthRangeTl(fullRaw.field);
  const activeField = activeRaw === fullRaw
    ? fullField
    : pressureFieldToDepthRangeTl(activeRaw.field);
  const { rows, columns } = fullField;
  const fullTlDb = fullField.tlDb;
  const activeTlDb = activeField.tlDb;
  if (activeField.rows !== rows || activeField.columns !== columns) {
    throw new Error("Kraken full and truncated fields use different grids");
  }
  if (fullTlDb.length !== activeTlDb.length) {
    throw new Error("Kraken full and truncated fields use different grids");
  }
  const deltaTlDb = new Float32Array(fullTlDb.length);
  let squareSum = 0;
  let maximumDifference = 0;
  let compared = 0;
  for (let index = 0; index < deltaTlDb.length; index += 1) {
    const active = activeTlDb[index];
    const complete = fullTlDb[index];
    if (!Number.isFinite(active) || !Number.isFinite(complete)) {
      deltaTlDb[index] = Number.NaN;
      continue;
    }
    const difference = active - complete;
    deltaTlDb[index] = difference;
    if (active >= 40 && active <= 140 && complete >= 40 && complete <= 140) {
      squareSum += difference * difference;
      maximumDifference = Math.max(maximumDifference, Math.abs(difference));
      compared += 1;
    }
  }
  const rangesKm = Float64Array.from(fullRaw.field.receiverRangesM, (value) => value / 1000);
  const fieldDepthsM = asFloat64(fullRaw.field.receiverDepthsM);
  const modeDepthsM = profile.depthsM;
  const environment = nativeSampledEnvironment(params, modeDepthsM);
  const activeModeCount = Math.min(profile.count, activeRaw.modeLimit);
  const solver = await normalSolver();
  const nativeComputeMs = Number(fullRaw.outcome.timing.computationNs || 0) / 1e6
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

export async function runNormalMode(params) {
  const backend = installedBackend || globalThis.OpenOceanNormalModeWasm || null;
  if (backend && typeof backend.runNormalMode === "function") {
    try {
      const result = validateResult(await backend.runNormalMode(params));
      return {
        ...result,
        runtime: { ...result.runtime, mode: "wasm", fallback: false },
      };
    } catch (error) { throw error; }
  }
  if (new URLSearchParams(globalThis.location?.search || "").has("demo")) {
    return demonstrationResult(params, "URL requested the deterministic demo backend");
  }
  return runNativeNormalMode(params);
}
