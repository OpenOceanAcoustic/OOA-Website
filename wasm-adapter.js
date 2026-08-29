import {
  AttenuationUnit,
  AxisInput,
  Bellhop2D,
  Bellhop2DInput,
  BoundaryCondition,
  BoundaryInterpolation,
  RunMode,
  RunStatus,
  SspInterpolation,
  VolumeAttenuation,
} from "@openocean/field-bellhop-2d";

const DEPTH_M = 5000;
const MAX_RANGE_M = 100000;
// Browser-interactive defaults. The server version could spend minutes on a
// 1000 x 201 x 201 sweep; this keeps the native model responsive on laptops.
const FIELD_LAUNCH_ANGLE_COUNT = 1000;
const EIGEN_LAUNCH_ANGLE_COUNT = 1000;
const DISPLAY_RAY_COUNT = 15;
const FIELD_RANGE_COUNT = 201;
const FIELD_DEPTH_COUNT = 201;
const ANGLE_MIN_DEG = -20.3;
const ANGLE_MAX_DEG = 20.3;
const MEMORY_LIMIT_BYTES = 768 * 1024 * 1024;
const THREAD_COUNT = Math.min(
  4,
  Math.max(1, Math.floor((navigator.hardwareConcurrency || 2) / 2)),
);

let solverPromise;

export function initializeWasm() {
  if (!solverPromise) {
    solverPromise = Bellhop2D.create({
      threadCount: THREAD_COUNT,
      memoryLimitBytes: MEMORY_LIMIT_BYTES,
    });
  }
  return solverPromise;
}

function clamp(value, lower, upper) {
  return Math.max(lower, Math.min(upper, Number(value)));
}

function round(value, digits = 7) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function profileSamples(payload) {
  let profile = String(payload.profile || "munk");
  if (profile === "custom") {
    const samples = new Map();
    if (Array.isArray(payload.ssp_points)) {
      for (const point of payload.ssp_points.slice(0, 64)) {
        if (Array.isArray(point) && point.length >= 2) {
          samples.set(
            clamp(point[0], 0, DEPTH_M),
            clamp(point[1], 1400, 1650),
          );
        }
      }
    }
    if (samples.size >= 2) {
      const ordered = [...samples.entries()].sort((left, right) => left[0] - right[0]);
      return {
        profile,
        depths: ordered.map((item) => item[0]),
        speeds: ordered.map((item) => item[1]),
      };
    }
    profile = "munk";
  }

  const axis = clamp(payload.axis_depth ?? 1300, 300, 3000);
  const strength = clamp(payload.gradient ?? 1, 0.2, 2);
  const depths = Array.from({ length: 101 }, (_, index) => index * 50);
  const speeds = depths.map((depth) => {
    if (profile === "constant") return 1500;
    if (profile === "surface") {
      const thermocline = 28 * Math.tanh((axis - depth) / 420);
      const deep = Math.max(0, depth - axis) * 0.012;
      return 1490 + strength * (thermocline + deep);
    }
    profile = "munk";
    const eta = clamp(2 * (depth - axis) / 1300, -8, 8);
    return 1500 * (1 + 0.00737 * strength * (eta + Math.exp(-eta) - 1));
  });
  return { profile, depths, speeds };
}

function configuredInput(
  payload,
  runMode,
  launchCount,
  receiverDepths,
  receiverRanges,
  velocityEnabled = false,
) {
  const profile = profileSamples(payload);
  const bottomSpeed = clamp(payload.bottom_speed ?? 1700, 1400, 3000);
  const bottomDensity = clamp(payload.bottom_density ?? 1800, 1000, 3500);
  const bottomAbsorption = clamp(payload.bottom_absorption ?? 0.5, 0, 5);
  const frequency = clamp(payload.frequency ?? 500, 20, 10000);
  const sourceDepth = clamp(payload.source_depth ?? 1000, 20, DEPTH_M - 20);
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
      meanDepthM: DEPTH_M / 2,
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
        interpolation: BoundaryInterpolation.NONE,
        halfspace: {
          ...emptyHalfspace,
          depthM: DEPTH_M,
          compressionalSpeedMps: bottomSpeed,
          compressionalAttenuation: bottomAbsorption,
          densityRelative: bottomDensity / 1000,
        },
        points: [],
        pointMaterials: [],
      },
    },
  };
  const receivers = {
    depths: receiverDepths,
    ranges: receiverRanges,
    radialVelocityMps: 0,
  };
  const builder = Bellhop2DInput.easyStart({
    environment,
    source: { depths: AxisInput.explicit([sourceDepth]) },
    receivers,
    outputRequest: { runMode },
  });
  builder.source().launchAngles(
    AxisInput.linspace(ANGLE_MIN_DEG, ANGLE_MAX_DEG, launchCount),
    false,
  );
  builder.options().maximumRangeM(MAX_RANGE_M + 1000);
  builder.options().maximumDepthM(DEPTH_M + 100);
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
  const ranges = AxisInput.linspace(100, MAX_RANGE_M, FIELD_RANGE_COUNT);
  const depths = AxisInput.linspace(0, DEPTH_M, FIELD_DEPTH_COUNT);
  const rayConfig = configuredInput(
    payload,
    RunMode.RAY,
    DISPLAY_RAY_COUNT,
    depths,
    ranges,
  );
  const fieldConfig = configuredInput(
    payload,
    RunMode.INCOHERENT_TL,
    FIELD_LAUNCH_ANGLE_COUNT,
    depths,
    ranges,
    true,
  );
  const [rayOutcome, fieldOutcome] = await Promise.all([
    execute(rayConfig.input),
    execute(fieldConfig.input),
  ]);
  const rays = rayViews(rayOutcome.result.rays());
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
    rays: rays.map((ray) => clippedPath(ray.points, MAX_RANGE_M)),
    ray_angles_deg: rays.map((ray) => round(ray.angle)),
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
    },
    display_ray_count: rays.length,
    field_ray_count: FIELD_LAUNCH_ANGLE_COUNT,
    field_mode: "INCOHERENT_TL",
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

function combineRays(rayResult, arrivalResult, receiverRangeM, receiverDepthM) {
  const rays = rayViews(rayResult.rays());
  const arrivalValues = arrivals(arrivalResult);
  const available = new Set(arrivalValues.map((_, index) => index));
  const coarseStep = (ANGLE_MAX_DEG - ANGLE_MIN_DEG) / (EIGEN_LAUNCH_ANGLE_COUNT - 1);
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
    const arrivalValid = match >= 0;
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
    if (arrivalValid) available.delete(match);
    return {
      kind: arrivalValid
        ? rayKind(arrival.top_bounces, arrival.bottom_bounces)
        : "无到达记录",
      launch_angle: ray.angle,
      arrival_angle: arrival.arrival_angle,
      arrival_valid: arrivalValid,
      residual_m: depthAtRange(ray.points, receiverRangeM) - receiverDepthM,
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
  const receiverRangeKm = clamp(payload.receiver_range ?? 50, 5, 95);
  const receiverDepthM = clamp(payload.receiver_depth ?? 1000, 20, DEPTH_M - 20);
  const receiverRangeM = receiverRangeKm * 1000;
  const receiverRanges = AxisInput.explicit([receiverRangeM]);
  const receiverDepths = AxisInput.explicit([receiverDepthM]);
  const inputFor = (mode) => configuredInput(
    payload,
    mode,
    EIGEN_LAUNCH_ANGLE_COUNT,
    receiverDepths,
    receiverRanges,
  ).input;
  const [equalRay, equalArrival, preciseRay, preciseArrival] = await Promise.all([
    execute(inputFor(RunMode.EIGENRAY)),
    execute(inputFor(RunMode.ARRIVALS)),
    execute(inputFor(RunMode.PARTICLE_RAY)),
    execute(inputFor(RunMode.PARTICLE_ARRIVALS)),
  ]);
  const equal = combineRays(
    equalRay.result,
    equalArrival.result,
    receiverRangeM,
    receiverDepthM,
  );
  const precise = combineRays(
    preciseRay.result,
    preciseArrival.result,
    receiverRangeM,
    receiverDepthM,
  );
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
    launch_angle_count: EIGEN_LAUNCH_ANGLE_COUNT,
    angle_range_degrees: [ANGLE_MIN_DEG, ANGLE_MAX_DEG],
    equal_angle_eigenrays: serializeRays(equal),
    eigenrays: serializeRays(precise),
    equal_angle_residual_rmse_m: round(rmse(equal), 4),
    precise_residual_rmse_m: round(rmse(precise), 4),
    tolerance_m: clamp(payload.tolerance ?? 1, 0.05, 25),
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
