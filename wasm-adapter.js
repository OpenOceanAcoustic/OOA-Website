import {
  AttenuationUnit,
  AxisInput,
  BeamType,
  BeamWidthType,
  Bellhop2D,
  Bellhop2DInput,
  BoundaryCondition,
  BoundaryInterpolation,
  RunMode,
  RunStatus,
  SspInterpolation,
  VolumeAttenuation,
} from "@openocean/field-bellhop-2d";
import {
  DEFAULT_WATER_DEPTH_M,
  generateSspProfile,
} from "./ssp-profiles.js";

const MAX_RANGE_M = 100000;
// Browser-interactive defaults. The server version could spend minutes on a
// 1000 x 201 x 201 sweep; this keeps the native model responsive on laptops.
const DEFAULT_FIELD_LAUNCH_ANGLE_COUNT = 1000;
const EIGEN_LAUNCH_ANGLE_COUNT = 1000;
const DISPLAY_RAY_COUNT = 50;
const DISPLAY_RAY_BATCH_SIZE = 10;
const FIELD_RANGE_COUNT = 201;
const FIELD_DEPTH_COUNT = 201;
const ANGLE_MIN_DEG = -20.3;
const ANGLE_MAX_DEG = 20.3;
const MEMORY_LIMIT_BYTES = 768 * 1024 * 1024;
const FIELD_MEMORY_BUDGET_BYTES = 256 * 1024 * 1024;
export const FIELD_BEAM_TYPES = Object.freeze([
  BeamType.GEOMETRIC_CARTESIAN,
  BeamType.GEOMETRIC_RAY_CENTERED,
  BeamType.GAUSSIAN_CARTESIAN,
  BeamType.GAUSSIAN_RAY_CENTERED,
  BeamType.GAUSSIAN_SIMPLE,
]);
const FIELD_BEAM_TYPE_SET = new Set(FIELD_BEAM_TYPES);
const IMPORTED_FIELD_BEAM_TYPES = new Set([
  ...FIELD_BEAM_TYPES,
  BeamType.CERVENY_CARTESIAN,
  BeamType.CERVENY_RAY_CENTERED,
]);
const THREAD_COUNT = Math.min(
  4,
  Math.max(1, Math.floor((navigator.hardwareConcurrency || 2) / 2)),
);

let solverPromise;
let importedInput = null;

export function normalizeFieldBeamType(
  value,
  fallback = BeamType.GEOMETRIC_CARTESIAN,
) {
  const candidate = String(value ?? "").trim().toUpperCase();
  return FIELD_BEAM_TYPE_SET.has(candidate) ? candidate : fallback;
}

function normalizeImportedFieldBeamType(value, fallback) {
  const candidate = String(value ?? "").trim().toUpperCase();
  return IMPORTED_FIELD_BEAM_TYPES.has(candidate) ? candidate : fallback;
}

export function normalizeFieldRunMode(value, fallback = RunMode.INCOHERENT_TL) {
  const candidate = String(value ?? "").trim().toUpperCase();
  if (candidate === "COHERENT" || candidate === RunMode.COHERENT_TL) {
    return RunMode.COHERENT_TL;
  }
  if (candidate === "INCOHERENT" || candidate === RunMode.INCOHERENT_TL) {
    return RunMode.INCOHERENT_TL;
  }
  return fallback;
}

function configuredBeamType(payload) {
  if (!usesImportedEnvironment(payload)) {
    return normalizeFieldBeamType(payload?.beam_type);
  }
  const imported = normalizeImportedFieldBeamType(
    importedInput.options.beam.beamType,
    BeamType.GEOMETRIC_CARTESIAN,
  );
  return normalizeImportedFieldBeamType(payload?.beam_type, imported);
}

function configuredFieldRunMode(payload) {
  const importedRunMode = usesImportedEnvironment(payload)
    ? normalizeFieldRunMode(importedInput.options.beam.runMode, null)
    : null;
  return normalizeFieldRunMode(payload?.field_mode, importedRunMode ?? RunMode.INCOHERENT_TL);
}

function axisMaximum(axis) {
  if (axis.encoding === "EXPLICIT") return Math.max(...axis.values);
  return Math.max(axis.start, axis.end);
}

function axisMinimum(axis) {
  if (axis.encoding === "EXPLICIT") return Math.min(...axis.values);
  return Math.min(axis.start, axis.end);
}

function axisCount(axis) {
  return axis.encoding === "EXPLICIT" ? axis.values.length : axis.count;
}

function usesImportedEnvironment(payload) {
  return importedInput !== null && String(payload?.profile || "") === "env";
}

function payloadBathymetry(payload, maximumRangeM = null) {
  if (!Array.isArray(payload?.bathymetry)) return [];
  const points = payload.bathymetry
    .map((point) => {
      if (Array.isArray(point) || ArrayBuffer.isView(point)) {
        return [Number(point[0]), Number(point[1])];
      }
      if (point && typeof point === "object") {
        const rangeKm = point.rangeKm ?? point.range_km
          ?? (point.rangeM ?? point.range_m) / 1000;
        return [Number(rangeKm), Number(point.depthM ?? point.depth_m ?? point.depth)];
      }
      return [NaN, NaN];
    })
    .filter(([rangeKm, depthM]) => Number.isFinite(rangeKm)
      && Number.isFinite(depthM) && rangeKm >= 0 && depthM > 0)
    .sort((left, right) => left[0] - right[0])
    .filter((point, index, values) => index === 0 || point[0] > values[index - 1][0]);
  if (points.length === 0) return [];
  const maximumRangeKm = maximumRangeM === null ? null : maximumRangeM / 1000;
  if (points[0][0] > 0) points.unshift([0, points[0][1]]);
  if (maximumRangeKm === null) return points;
  const clipped = [];
  for (const point of points) {
    if (point[0] <= maximumRangeKm) {
      clipped.push(point);
      continue;
    }
    const previous = clipped.at(-1);
    if (previous && previous[0] < maximumRangeKm) {
      const weight = (maximumRangeKm - previous[0]) / (point[0] - previous[0]);
      clipped.push([maximumRangeKm, previous[1] + weight * (point[1] - previous[1])]);
    }
    break;
  }
  if (clipped.length === 0) clipped.push([0, points[0][1]]);
  if (clipped.at(-1)[0] < maximumRangeKm) {
    clipped.push([maximumRangeKm, clipped.at(-1)[1]]);
  }
  return clipped;
}

function hasRangeDependentBathymetry(payload) {
  const points = payloadBathymetry(payload);
  return points.length > 1 && points.some((point) => (
    Math.abs(point[1] - points[0][1]) > 1e-6
  ));
}

function fieldLaunchAngleCount(payload) {
  if (usesImportedEnvironment(payload)) return axisCount(importedInput.source.launchAngles);
  return Math.round(clamp(
    payload?.beam_count ?? DEFAULT_FIELD_LAUNCH_ANGLE_COUNT,
    2,
    20000,
  ));
}

function defaultLaunchAngleConfiguration() {
  return {
    minimum: ANGLE_MIN_DEG,
    maximum: ANGLE_MAX_DEG,
    minimumDegrees: ANGLE_MIN_DEG,
    maximumDegrees: ANGLE_MAX_DEG,
    anglesAreRadians: false,
  };
}

function launchAngleConfiguration(payload) {
  if (!usesImportedEnvironment(payload)) {
    const angles = Array.isArray(payload?.angle_range_degrees)
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
  const axis = importedInput.source.launchAngles;
  const minimum = axisMinimum(axis);
  const maximum = axisMaximum(axis);
  const anglesAreRadians = importedInput.source.launchAnglesAreRadians;
  const scale = anglesAreRadians ? 180 / Math.PI : 1;
  return {
    minimum,
    maximum,
    minimumDegrees: minimum * scale,
    maximumDegrees: maximum * scale,
    anglesAreRadians,
  };
}

function computationalLaunchAngleBounds(configuration, launchCount) {
  const touchesVertical = configuration.minimumDegrees <= -89.999
    || configuration.maximumDegrees >= 89.999;
  if (!touchesVertical || launchCount < 2) {
    return [configuration.minimum, configuration.maximum];
  }
  const halfStep = (configuration.maximum - configuration.minimum)
    / (2 * launchCount);
  return [configuration.minimum + halfStep, configuration.maximum - halfStep];
}

function launchAngleSamples(configuration, count) {
  const [minimum, maximum] = computationalLaunchAngleBounds(configuration, count);
  return Array.from({ length: count }, (_, index) => (
    count === 1 ? minimum : minimum + (maximum - minimum) * index / (count - 1)
  ));
}

function calculationDomain(payload) {
  if (!usesImportedEnvironment(payload)) {
    const waterDepthM = clamp(
      payload?.water_depth_m ?? DEFAULT_WATER_DEPTH_M,
      50,
      12000,
    );
    const maximumRangeM = clamp(
      (payload?.maximum_range_km ?? MAX_RANGE_M / 1000) * 1000,
      100,
      250000,
    );
    const bottomDepths = payloadBathymetry(payload, maximumRangeM).map((point) => point[1]);
    return {
      maximumRangeM,
      maximumDepthM: Math.max(waterDepthM, ...bottomDepths),
      waterDepthM,
    };
  }
  const { environment, receivers, options } = importedInput;
  const rangeLimits = [MAX_RANGE_M, axisMaximum(receivers.ranges)];
  if ("rangesM" in environment.ssp) {
    rangeLimits.push(Math.max(
      ...environment.ssp.rangesM.filter((value) => value > 0),
    ));
  }
  if (options.beam.maximumRangeM > 0) rangeLimits.push(options.beam.maximumRangeM);
  const maximumRangeM = Math.max(100, Math.min(
    ...rangeLimits.filter((value) => Number.isFinite(value) && value > 0),
  ));
  const boundaryDepths = [
    environment.boundary.surface.halfspace.depthM,
    environment.boundary.bottom.halfspace.depthM,
    ...environment.boundary.surface.points.map((point) => point.depthM),
    ...environment.boundary.bottom.points.map((point) => point.depthM),
  ];
  const waterDepthM = Math.max(...environment.ssp.depthsM);
  const maximumDepthM = Math.max(
    waterDepthM,
    options.beam.maximumDepthM,
    ...boundaryDepths,
  );
  return { maximumRangeM, maximumDepthM, waterDepthM };
}

function sspProfile(ssp) {
  const depths = Array.from(ssp.depthsM);
  let speeds;
  if ("compressionalSpeedMps" in ssp) {
    speeds = Array.from(ssp.compressionalSpeedMps);
  } else {
    const ranges = Array.from(ssp.rangesM);
    const rangeIndex = ranges.reduce((best, value, index) => (
      Math.abs(value) < Math.abs(ranges[best]) ? index : best
    ), 0);
    speeds = Array.from(ssp.soundSpeedMps).slice(
      rangeIndex * depths.length,
      (rangeIndex + 1) * depths.length,
    );
  }
  return { depths, speeds };
}

function importedProfile(payload) {
  if (usesImportedEnvironment(payload)) {
    const { depths, speeds } = sspProfile(importedInput.environment.ssp);
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

function displayedBathymetry(domain, payload) {
  if (!usesImportedEnvironment(payload)) {
    const customPoints = payloadBathymetry(payload, domain.maximumRangeM);
    if (customPoints.length > 1) return customPoints;
    return [[0, domain.waterDepthM], [domain.maximumRangeM / 1000, domain.waterDepthM]];
  }
  const bottom = importedInput.environment.boundary.bottom;
  const maximumRangeKm = domain.maximumRangeM / 1000;
  const sourcePoints = bottom.points.map(
    (point) => [point.rangeM / 1000, point.depthM],
  );
  const points = [];
  for (const point of sourcePoints) {
    if (point[0] < 0) continue;
    if (point[0] <= maximumRangeKm) { points.push(point); continue; }
    const previous = points.at(-1);
    if (previous !== undefined && previous[0] < maximumRangeKm) {
      const weight = (maximumRangeKm - previous[0]) / (point[0] - previous[0]);
      points.push([
        maximumRangeKm,
        previous[1] + weight * (point[1] - previous[1]),
      ]);
    }
    break;
  }
  if (points.length !== 0) return points;
  const depth = bottom.halfspace.depthM || domain.waterDepthM;
  return [[0, depth], [domain.maximumRangeM / 1000, depth]];
}

function plotMaximumDepthM(domain, payload) {
  if (!usesImportedEnvironment(payload)) {
    const bottomDepths = payloadBathymetry(payload, domain.maximumRangeM).map((point) => point[1]);
    const deepest = Math.max(domain.waterDepthM, ...bottomDepths);
    return bottomDepths.length === 0 ? domain.waterDepthM : Math.ceil(deepest * 1.05 / 100) * 100;
  }
  const bottomDepths = importedInput.environment.boundary.bottom.points.map(
    (point) => point.depthM,
  );
  const deepest = Math.max(domain.waterDepthM, ...bottomDepths);
  return Math.ceil(deepest * 1.05 / 100) * 100;
}

export function initializeWasm() {
  if (!solverPromise) {
    solverPromise = Bellhop2D.create({
      threadCount: THREAD_COUNT,
      memoryLimitBytes: MEMORY_LIMIT_BYTES,
    });
  }
  return solverPromise;
}

function firstAxisValue(axis, fallback) {
  if (axis.encoding === "EXPLICIT") return Number(axis.values[0] ?? fallback);
  return Number(axis.start ?? fallback);
}

/** Parse uploaded ENV/sidecar files with OOB inside the browser worker. */
export async function importEnvironment(files) {
  const solver = await initializeWasm();
  solver.cancel();
  const documents = await Promise.all([...files].map(async (file) => ({
    name: file.name,
    data: new Uint8Array(await file.arrayBuffer()),
  })));
  const input = await solver.importEnv(documents);
  importedInput = input;
  const ssp = input.environment.ssp;
  const { depths, speeds } = sspProfile(ssp);
  const bottom = input.environment.boundary.bottom.halfspace;
  const envPayload = { profile: "env" };
  const launchAngles = launchAngleConfiguration(envPayload);
  const domain = calculationDomain(envPayload);
  return {
    title: input.environment.title,
    frequency: input.environment.frequencyHz,
    sourceDepth: firstAxisValue(input.source.depths, 1000),
    sspPoints: depths.map((depth, index) => [depth, speeds[index]]),
    bottomSpeed: bottom.compressionalSpeedMps,
    bottomDensity: bottom.densityRelative * 1000,
    bottomAbsorption: bottom.compressionalAttenuation,
    rangeDependent: "rangesM" in ssp,
    maximumRangeKm: domain.maximumRangeM / 1000,
    maximumDepthM: domain.waterDepthM,
    angleRangeDegrees: [launchAngles.minimumDegrees, launchAngles.maximumDegrees],
    fieldRayCount: fieldLaunchAngleCount(envPayload),
    fieldGridRows: axisCount(input.receivers.depths),
    fieldGridColumns: axisCount(input.receivers.ranges),
    beamType: input.options.beam.beamType,
    runMode: input.options.beam.runMode,
    fieldMode: normalizeFieldRunMode(input.options.beam.runMode, null),
  };
}

function clamp(value, lower, upper) {
  return Math.max(lower, Math.min(upper, Number(value)));
}

function round(value, digits = 7) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function configuredInput(
  payload,
  runMode,
  launchCount,
  receiverDepths,
  receiverRanges,
  velocityEnabled = false,
  launchAngleValues = null,
  launchAngleOverride = null,
  maximumRangeOverrideM = null,
) {
  const profile = importedProfile(payload);
  const domain = calculationDomain(payload);
  const useImported = usesImportedEnvironment(payload);
  const launchAngles = launchAngleOverride ?? launchAngleConfiguration(payload);
  const customBottomPoints = useImported ? [] : payloadBathymetry(payload, domain.maximumRangeM)
    .map(([rangeKm, depthM]) => ({ rangeM: rangeKm * 1000, depthM }));
  const customBottomDepthM = customBottomPoints[0]?.depthM ?? domain.waterDepthM;
  const bottomSpeed = clamp(payload.bottom_speed ?? 1700, 1400, 3000);
  const bottomDensity = clamp(payload.bottom_density ?? 1800, 1000, 3500);
  const bottomAbsorption = clamp(payload.bottom_absorption ?? 0.5, 0, 5);
  const frequency = clamp(payload.frequency ?? 500, 20, 10000);
  const sourceDepth = clamp(payload.source_depth ?? 1000, 20, domain.waterDepthM - 20);
  const emptyHalfspace = {
    depthM: 0,
    compressionalSpeedMps: 0,
    compressionalAttenuation: 0,
    shearSpeedMps: 0,
    shearAttenuation: 0,
    densityRelative: 0,
    grainSize: 0,
  };
  const environment = {
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
  const receivers = {
    depths: receiverDepths,
    ranges: receiverRanges,
    radialVelocityMps: 0,
  };
  let builder;
  if (!useImported) {
    builder = Bellhop2DInput.easyStart({
      environment,
      source: { depths: AxisInput.explicit([sourceDepth]) },
      receivers,
      outputRequest: { runMode },
    });
  } else {
    const importedBoundary = importedInput.environment.boundary;
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
    const [minimumLaunchAngle, maximumLaunchAngle] = computationalLaunchAngleBounds(
      launchAngles,
      launchCount,
    );
    builder.source().launchAngles(
      AxisInput.linspace(minimumLaunchAngle, maximumLaunchAngle, launchCount),
      launchAngles.anglesAreRadians,
    );
  } else {
    builder.source().launchAngles(
      AxisInput.explicit(launchAngleValues),
      launchAngles.anglesAreRadians,
    );
  }
  builder.options().maximumRangeM(maximumRangeOverrideM ?? (
    useImported ? domain.maximumRangeM : domain.maximumRangeM + 1000
  ));
  // Beam influence is independent of the output RunMode. Apply it to both
  // display-ray and field inputs so the selected model is present in every
  // immutable SDK input/cache identity built by this adapter.
  const beamType = configuredBeamType(payload);
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
  const receiverRange = receiverRanges.encoding === "EXPLICIT"
    ? Math.max(...receiverRanges.values)
    : Math.max(receiverRanges.start, receiverRanges.end);
  const toleranceM = clamp(payload.tolerance ?? 1, 0.05, 25);
  builder.options().toleranceRadians(Math.max(1e-10, toleranceM / Math.max(1, receiverRange)));
  return {
    input: builder.build(),
    profile,
    bottom: { bottomSpeed, bottomDensity, bottomAbsorption },
  };
}

async function memoryFittedFieldConfiguration(payload, receiverDepths, receiverRanges) {
  const solver = await initializeWasm();
  const requestedCount = fieldLaunchAngleCount(payload);
  const runMode = configuredFieldRunMode(payload);
  const build = (count) => configuredInput(
    payload,
    runMode,
    count,
    receiverDepths,
    receiverRanges,
    true,
  );
  let configuration = build(requestedCount);
  let estimate = await solver.estimateMemory(configuration.input);
  if (estimate.estimatedPeakBytes <= FIELD_MEMORY_BUDGET_BYTES) {
    return {
      configuration, estimate, requestedCount, actualCount: requestedCount, runMode,
    };
  }
  const baseline = build(2);
  const baselineEstimate = await solver.estimateMemory(baseline.input);
  const bytesPerRay = Math.max(
    1,
    (estimate.estimatedPeakBytes - baselineEstimate.estimatedPeakBytes)
      / (requestedCount - 2),
  );
  let actualCount = Math.max(2, Math.min(
    requestedCount,
    Math.floor(
      2 + (FIELD_MEMORY_BUDGET_BYTES - baselineEstimate.estimatedPeakBytes)
        / bytesPerRay,
    ),
  ));
  configuration = build(actualCount);
  estimate = await solver.estimateMemory(configuration.input);
  if (estimate.estimatedPeakBytes > FIELD_MEMORY_BUDGET_BYTES) {
    const excessRays = Math.ceil(
      (estimate.estimatedPeakBytes - FIELD_MEMORY_BUDGET_BYTES) / bytesPerRay,
    );
    actualCount = Math.max(2, actualCount - excessRays);
    configuration = build(actualCount);
    estimate = await solver.estimateMemory(configuration.input);
  }
  return { configuration, estimate, requestedCount, actualCount, runMode };
}

async function execute(input) {
  const solver = await initializeWasm();
  const outcome = await solver.run(input);
  if (outcome.status !== RunStatus.SUCCEEDED || outcome.result === null) {
    const message = outcome.diagnostics.map((item) => item.message).join("; ");
    throw new Error(message || `Bellhop2D WASM run failed: ${outcome.status}`);
  }
  return outcome;
}

function rayViews(raySet) {
  const rays = [];
  for (let index = 0; index + 1 < raySet.offsets.length; ++index) {
    const start = raySet.offsets[index];
    const stop = raySet.offsets[index + 1];
    rays.push({
      angle: raySet.launchAnglesDegrees[index],
      points: raySet.pointsM.subarray(start * 2, stop * 2),
    });
  }
  return rays;
}

function clippedPath(points, stopRangeM, limit = 420) {
  if (points.length === 0) return [];
  const values = [];
  for (let index = 0; index < points.length; index += 2) {
    const range = points[index];
    const depth = points[index + 1];
    if (stopRangeM !== undefined && range > stopRangeM) {
      if (values.length === 0) values.push([range, depth]);
      else if (values.at(-1)[0] < stopRangeM) {
        const left = values.at(-1);
        const weight = (stopRangeM - left[0]) / Math.max(1e-12, range - left[0]);
        values.push([stopRangeM, left[1] + weight * (depth - left[1])]);
      }
      break;
    }
    values.push([range, depth]);
  }
  const selected = values.length <= limit
    ? values
    : Array.from({ length: limit }, (_, index) => (
      values[Math.floor(index * (values.length - 1) / (limit - 1))]
    ));
  return selected.map(([range, depth]) => [round(range / 1000, 4), round(depth, 3)]);
}

function velocityLevels(interleaved, count) {
  const values = new Float32Array(count);
  for (let index = 0; index < count; ++index) {
    const real = interleaved[index * 2] || 0;
    const imaginary = interleaved[index * 2 + 1] || 0;
    const magnitude = Math.max(Math.hypot(real, imaginary), 1.17549435e-38);
    values[index] = round(clamp(-20 * Math.log10(magnitude), 30, 120), 2);
  }
  return values;
}

export async function simulate(payload) {
  const started = performance.now();
  const domain = calculationDomain(payload);
  const ranges = AxisInput.linspace(100, domain.maximumRangeM, FIELD_RANGE_COUNT);
  const depths = AxisInput.linspace(0, domain.waterDepthM, FIELD_DEPTH_COUNT);
  const useImported = usesImportedEnvironment(payload);
  const fieldRanges = useImported ? importedInput.receivers.ranges : ranges;
  const fieldDepths = useImported ? importedInput.receivers.depths : depths;
  const displayAngles = launchAngleSamples(
    launchAngleConfiguration(payload),
    DISPLAY_RAY_COUNT,
  );
  const displayRays = [];
  let rayConfig;
  for (let start = 0; start < displayAngles.length; start += DISPLAY_RAY_BATCH_SIZE) {
    const batch = displayAngles.slice(start, start + DISPLAY_RAY_BATCH_SIZE);
    const configuration = configuredInput(
      payload,
      RunMode.RAY,
      batch.length,
      depths,
      ranges,
      false,
      batch,
    );
    rayConfig ??= configuration;
    const outcome = await execute(configuration.input);
    for (const ray of rayViews(outcome.result.rays())) {
      displayRays.push({
        angle: ray.angle,
        path: clippedPath(ray.points, domain.maximumRangeM),
      });
    }
  }
  const fieldSelection = await memoryFittedFieldConfiguration(
    payload,
    fieldDepths,
    fieldRanges,
  );
  const fieldOutcome = await execute(fieldSelection.configuration.input);
  const field = fieldOutcome.result.pressureField(0);
  const count = field.receiverDepthsM.length * field.receiverRangesM.length;
  const loss = Float32Array.from(field.transmissionLossDb, (value) => (
    round(clamp(Number.isFinite(value) ? value : 100, 40, 100), 2)
  ));
  return {
    profile: rayConfig.profile.profile,
    ssp: rayConfig.profile.depths.map((depth, index) => [
      depth,
      round(rayConfig.profile.speeds[index], 3),
    ]),
    rays: displayRays.map((ray) => ray.path),
    ray_angles_deg: displayRays.map((ray) => round(ray.angle)),
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
    thread_count: THREAD_COUNT,
    bottom: {
      speed_mps: rayConfig.bottom.bottomSpeed,
      density_kgm3: rayConfig.bottom.bottomDensity,
      absorption_db_per_wavelength: rayConfig.bottom.bottomAbsorption,
    },
    compute_ms: round(performance.now() - started, 2),
    engine: "OOB_BELLHOP2D_WASM_WORKER",
  };
}

function arrivals(result) {
  const set = result.arrivals();
  const start = set.offsets[0] || 0;
  const stop = set.offsets[1] || start;
  const values = [];
  for (let index = start; index < stop; ++index) {
    const real = set.amplitudesInterleaved[index * 2];
    const imaginary = set.amplitudesInterleaved[index * 2 + 1];
    const phase = (Math.atan2(imaginary, real) * 180 / Math.PI + 360) % 360;
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

function depthAtRange(points, targetM) {
  if (points.length === 0) return Number.NaN;
  for (let index = 0; index < points.length; index += 2) {
    if (points[index] < targetM) continue;
    if (index === 0) return points[1];
    const leftRange = points[index - 2];
    const leftDepth = points[index - 1];
    const weight = (targetM - leftRange) / Math.max(1e-12, points[index] - leftRange);
    return leftDepth + weight * (points[index + 1] - leftDepth);
  }
  return points[points.length - 1];
}

function pathLengthKm(points, stopRangeM) {
  const path = clippedPath(points, stopRangeM, 10000);
  let length = 0;
  for (let index = 1; index < path.length; ++index) {
    length += Math.hypot(
      (path[index][0] - path[index - 1][0]) * 1000,
      path[index][1] - path[index - 1][1],
    );
  }
  return length / 1000;
}

function rayKind(top, bottom) {
  if (top && bottom) return "海面+海底";
  if (top) return "海面反射";
  if (bottom) return "海底反射";
  return "直达/折射";
}

function combineRays(
  rayResult,
  arrivalResult,
  receiverRangeM,
  receiverDepthM,
  angleRange,
  maximumResidualM = null,
) {
  const rays = rayViews(rayResult.rays());
  const arrivalValues = arrivals(arrivalResult);
  const available = new Set(arrivalValues.map((_, index) => index));
  const coarseStep = (angleRange.maximumDegrees - angleRange.minimumDegrees)
    / (EIGEN_LAUNCH_ANGLE_COUNT - 1);
  const matchTolerance = Math.max(1e-4, 1.5 * coarseStep);
  const combined = rays.map((ray) => {
    let match = -1;
    let difference = Number.POSITIVE_INFINITY;
    for (const index of available) {
      const candidate = Math.abs(arrivalValues[index].launch_angle - ray.angle);
      if (candidate <= matchTolerance && candidate < difference) {
        match = index;
        difference = candidate;
      }
    }
    const residualM = depthAtRange(ray.points, receiverRangeM) - receiverDepthM;
    const arrivalValid = match >= 0 && (
      maximumResidualM === null || Math.abs(residualM) <= maximumResidualM
    );
    const arrival = arrivalValid ? arrivalValues[match] : {
      arrival_angle: 0,
      travel_time_s: null,
      amplitude_real: 0,
      amplitude_imaginary: 0,
      amplitude: null,
      phase_deg: null,
      top_bounces: 0,
      bottom_bounces: 0,
    };
    if (match >= 0) available.delete(match);
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
  combined.sort((left, right) => {
    if (left.arrival_valid !== right.arrival_valid) return left.arrival_valid ? -1 : 1;
    return (left.arrival_valid ? left.travel_time_s : left.launch_angle)
      - (right.arrival_valid ? right.travel_time_s : right.launch_angle);
  });
  return combined;
}

function serializeRays(items) {
  return items.map((item, index) => {
    const { pressure_real: _real, pressure_imaginary: _imaginary, ...publicItem } = item;
    return { id: index + 1, ...publicItem };
  });
}

export async function preciseEigenrays(payload) {
  const started = performance.now();
  const domain = calculationDomain(payload);
  const maximumReceiverRangeKm = Math.min(95, domain.maximumRangeM / 1000);
  const minimumReceiverRangeKm = Math.min(5, maximumReceiverRangeKm);
  const receiverRangeKm = clamp(
    payload.receiver_range ?? 50,
    minimumReceiverRangeKm,
    maximumReceiverRangeKm,
  );
  const receiverDepthM = clamp(payload.receiver_depth ?? 1000, 20, domain.waterDepthM - 20);
  const receiverRangeM = receiverRangeKm * 1000;
  const toleranceM = clamp(payload.tolerance ?? 1, 0.05, 25);
  const receiverRanges = AxisInput.explicit([receiverRangeM]);
  const receiverDepths = AxisInput.explicit([receiverDepthM]);
  const eigenAngleRange = defaultLaunchAngleConfiguration();
  const rangeDependentEnvironment = (usesImportedEnvironment(payload)
    && "rangesM" in importedInput.environment.ssp)
    || hasRangeDependentBathymetry(payload);
  const comparisonRequested = payload.include_equal_angle_comparison !== false;
  // Bellhop's conventional E/A modes are both redundant for a drag update and
  // unsuitable for this range-dependent ENV. The PC modes are the authoritative
  // precise result, so keep the 1,000-angle solve and omit only the blue baseline.
  const comparisonIncluded = comparisonRequested && !rangeDependentEnvironment;
  const eigenMaximumRangeM = Math.min(
    domain.maximumRangeM,
    receiverRangeM + 1000,
  );
  const inputFor = (mode, precise = false) => {
    const input = configuredInput(
      payload,
      mode,
      EIGEN_LAUNCH_ANGLE_COUNT,
      receiverDepths,
      receiverRanges,
      false,
      null,
      eigenAngleRange,
      eigenMaximumRangeM,
    ).input;
    return precise
      ? Bellhop2DInput.edit(input)
        .options().beamType(BeamType.PRECISE_EIGENRAY)
        .build()
      : input;
  };
  let equal = [];
  if (comparisonIncluded) {
    const equalRay = await execute(inputFor(RunMode.EIGENRAY));
    const equalArrival = await execute(inputFor(RunMode.ARRIVALS));
    equal = combineRays(
      equalRay.result,
      equalArrival.result,
      receiverRangeM,
      receiverDepthM,
      eigenAngleRange,
    );
  }
  const preciseRay = await execute(inputFor(RunMode.RAY, true));
  const preciseArrival = await execute(inputFor(RunMode.ARRIVALS, true));
  const precise = combineRays(
    preciseRay.result,
    preciseArrival.result,
    receiverRangeM,
    receiverDepthM,
    eigenAngleRange,
    toleranceM,
  ).filter((ray) => ray.arrival_valid);
  let pressureReal = 0;
  let pressureImaginary = 0;
  let incoherentPower = 0;
  for (const ray of precise) {
    if (!ray.arrival_valid) continue;
    pressureReal += ray.pressure_real;
    pressureImaginary += ray.pressure_imaginary;
    incoherentPower += ray.amplitude ** 2;
  }
  const rmse = (items) => Math.sqrt(
    items.reduce((sum, item) => sum + item.residual_m ** 2, 0)
      / Math.max(1, items.length),
  );
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
    coherent_tl_db: round(-20 * Math.log10(Math.max(1e-30, Math.hypot(
      pressureReal,
      pressureImaginary,
    ))), 2),
    incoherent_tl_db: round(-10 * Math.log10(Math.max(1e-30, incoherentPower)), 2),
    thread_count: THREAD_COUNT,
    compute_ms: round(performance.now() - started, 2),
    engine: "OOB_BELLHOP2D_MODE_E_PC_WASM_WORKER",
  };
}
