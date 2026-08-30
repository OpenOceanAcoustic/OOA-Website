const MAX_FILE_COUNT = 16;
const MAX_TOTAL_BYTES = 16 * 1024 * 1024;
const DEFAULT_ENVIRONMENT = Object.freeze({
  frequencyHz: 100,
  maximumRangeKm: 20,
  bottomSoundSpeedMps: 1700,
  bottomDensityKgM3: 1800,
  bottomAttenuationDbPerWavelength: 0.5,
  angleRangeDegrees: Object.freeze([-20, 20]),
  beamCount: 1000,
});

/**
 * Canonical environment contract shared by Ray, Normal Mode and PE pages.
 * Distances in `bathymetry` are kilometres; all profile and bathymetry depths
 * are metres; density is absolute kg/m³.
 *
 * @typedef {Object} CanonicalEnvironment
 * @property {string} title
 * @property {"json"|"bellhop-env"|string} format
 * @property {Array<[number, number]>} profilePoints depth m, speed m/s
 * @property {number} waterDepthM
 * @property {number} frequencyHz
 * @property {number} sourceDepthM
 * @property {number} maximumRangeKm
 * @property {number} bottomSoundSpeedMps
 * @property {number} bottomDensityKgM3
 * @property {number} bottomAttenuationDbPerWavelength
 * @property {Array<[number, number]>} bathymetry range km, depth m
 * @property {[number, number]} angleRangeDegrees
 * @property {number} beamCount
 */

const NUMBER_PATTERN = /[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[EeDd][-+]?\d+)?/g;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value, label) {
  const result = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(result)) throw new TypeError(`${label} must be a finite number`);
  return result;
}

function optionalFiniteNumber(value, fallback, label) {
  return value === undefined || value === null || value === ""
    ? fallback
    : finiteNumber(value, label);
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function valueAt(source, path) {
  let value = source;
  for (const key of path.split(".")) {
    if (!isObject(value) || !(key in value)) return undefined;
    value = value[key];
  }
  return value;
}

function firstPath(source, paths) {
  return firstDefined(...paths.map((path) => valueAt(source, path)));
}

function arrayValue(value) {
  if (Array.isArray(value)) return value;
  if (ArrayBuffer.isView(value)) return Array.from(value);
  return null;
}

function numbersIn(source) {
  return [...String(source).matchAll(NUMBER_PATTERN)]
    .map((match) => Number(match[0].replace(/[Dd]/, "E")));
}

function beforeSlash(source) {
  return String(source).split("/", 1)[0];
}

/** Remove a Bellhop `!` comment without treating punctuation inside quotes as a comment. */
export function stripBellhopComment(source) {
  let quote = null;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if ((character === "'" || character === '"')) {
      if (quote === character) quote = null;
      else if (quote === null) quote = character;
    } else if (character === "!" && quote === null) {
      return source.slice(0, index);
    }
  }
  return source;
}

function bellhopLines(source) {
  return String(source).replace(/^\uFEFF/, "").split(/\r?\n/)
    .map((line) => stripBellhopComment(line).trim())
    .filter(Boolean);
}

function quotedValue(source) {
  const match = String(source).match(/^\s*(['"])(.*?)\1/);
  return match?.[2]?.trim();
}

function sameWithinTolerance(left, right) {
  return Math.abs(left - right) <= Math.max(1e-7, Math.abs(right) * 1e-8);
}

function profilePoint(value, index) {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    const pair = Array.from(value);
    if (pair.length < 2) throw new TypeError(`profilePoints[${index}] must contain depth and speed`);
    return [
      finiteNumber(pair[0], `profilePoints[${index}][0]`),
      finiteNumber(pair[1], `profilePoints[${index}][1]`),
    ];
  }
  if (!isObject(value)) throw new TypeError(`profilePoints[${index}] is invalid`);
  return [
    finiteNumber(firstDefined(value.depthM, value.depth_m, value.depth, value.z), `profilePoints[${index}].depthM`),
    finiteNumber(firstDefined(
      value.speedMps,
      value.speed_m_s,
      value.soundSpeedMps,
      value.sound_speed_m_s,
      value.speed,
      value.c,
    ), `profilePoints[${index}].speedMps`),
  ];
}

function pointArrayFromContainer(container, allowGenericPoints = false) {
  const containerArray = arrayValue(container);
  if (containerArray !== null) return containerArray.map(profilePoint);
  if (!isObject(container)) return null;
  const direct = arrayValue(firstDefined(
    container.profilePoints,
    container.profile_points,
    container.sspPoints,
    container.ssp_points,
    allowGenericPoints ? container.points : undefined,
  ));
  if (direct !== null) return direct.map(profilePoint);

  const depths = arrayValue(firstDefined(
    container.depthsM,
    container.depths_m,
    container.soundSpeedDepthsM,
    container.sound_speed_depths_m,
    container.depths,
    container.z,
  ));
  const speeds = arrayValue(firstDefined(
    container.compressionalSpeedMps,
    container.soundSpeedMps,
    container.sound_speed_m_s,
    container.speedsMps,
    container.speeds_m_s,
    container.speeds,
    container.c,
  ));
  if (depths === null && speeds === null) return null;
  if (depths === null || speeds === null) {
    throw new TypeError("sound-speed depth and speed arrays must have the same length");
  }
  if (depths.length !== speeds.length) {
    const ranges = arrayValue(firstDefined(container.rangesM, container.ranges_m, container.ranges));
    if (ranges === null || speeds.length !== depths.length * ranges.length) {
      throw new TypeError("sound-speed depth and speed arrays must have compatible lengths");
    }
    const rangeIndex = ranges.reduce((best, range, index) => (
      Math.abs(finiteNumber(range, `ssp.ranges[${index}]`))
        < Math.abs(finiteNumber(ranges[best], `ssp.ranges[${best}]`)) ? index : best
    ), 0);
    return depths.map((depth, depthIndex) => profilePoint([
      depth,
      speeds[rangeIndex * depths.length + depthIndex],
    ], depthIndex));
  }
  return depths.map((depth, index) => profilePoint([depth, speeds[index]], index));
}

function jsonProfilePoints(source) {
  const containers = [
    [source, false],
    [source.environment, false],
    [source.ssp, true],
    [source.soundSpeedProfile, true],
    [source.sound_speed_profile, true],
    [source.environment?.ssp, true],
    [source.environment?.soundSpeedProfile, true],
    [source.environment?.sound_speed_profile, true],
  ];
  for (const [container, allowGenericPoints] of containers) {
    const points = pointArrayFromContainer(container, allowGenericPoints);
    if (points !== null) return points;
  }
  throw new TypeError("environment JSON does not contain a sound-speed profile");
}

function axisValues(axis) {
  const direct = arrayValue(axis);
  if (direct !== null) return direct.map((value, index) => finiteNumber(value, `axis[${index}]`));
  if (!isObject(axis)) return [];
  const values = arrayValue(firstDefined(axis.values, axis.valuesM, axis.values_m));
  if (values !== null) return values.map((value, index) => finiteNumber(value, `axis.values[${index}]`));
  const start = firstDefined(axis.start, axis.minimum, axis.min);
  const end = firstDefined(axis.end, axis.maximum, axis.max);
  return [start, end].filter((value) => value !== undefined && value !== null)
    .map((value, index) => finiteNumber(value, `axis[${index}]`));
}

function jsonSourceDepth(source) {
  const direct = firstPath(source, [
    "sourceDepthM", "source_depth_m", "sourceDepth", "source_depth",
    "source.depthM", "source.depth_m", "source.depth",
  ]);
  if (direct !== undefined) return direct;
  const depths = axisValues(firstPath(source, ["source.depths", "source.depthsM", "source.depths_m"]));
  return depths[0];
}

function jsonMaximumRangeKm(source) {
  const kilometres = firstPath(source, [
    "maximumRangeKm", "maximum_range_km", "rangeKm", "range_km",
    "receiverRangeKm", "receiver_range_km", "receiver_range",
  ]);
  if (kilometres !== undefined) return finiteNumber(kilometres, "maximumRangeKm");
  const metres = firstPath(source, [
    "maximumRangeM", "maximum_range_m", "options.beam.maximumRangeM",
    "options.beam.maximum_range_m",
  ]);
  if (metres !== undefined) return finiteNumber(metres, "maximumRangeM") / 1000;
  const receiverRanges = axisValues(firstPath(source, [
    "receivers.ranges", "receivers.rangesM", "receivers.ranges_m",
  ]));
  return receiverRanges.length === 0 ? undefined : Math.max(...receiverRanges) / 1000;
}

function jsonAngleRange(source) {
  const direct = arrayValue(firstPath(source, [
    "angleRangeDegrees", "angle_range_degrees", "launchAngleRangeDegrees",
    "launch_angle_range_degrees",
  ]));
  if (direct !== null) return direct;
  const minimum = firstPath(source, [
    "minimumAngleDegrees", "minimum_angle_degrees", "minimumLaunchAngleDegrees",
    "minimum_launch_angle_degrees", "launchAngles.minimumDegrees",
  ]);
  const maximum = firstPath(source, [
    "maximumAngleDegrees", "maximum_angle_degrees", "maximumLaunchAngleDegrees",
    "maximum_launch_angle_degrees", "launchAngles.maximumDegrees",
  ]);
  if (minimum !== undefined || maximum !== undefined) return [minimum, maximum];

  const launchAxis = firstPath(source, ["source.launchAngles", "source.launch_angles"]);
  const values = axisValues(launchAxis);
  if (values.length === 0) return undefined;
  const scale = firstPath(source, ["source.launchAnglesAreRadians", "source.launch_angles_are_radians"])
    ? 180 / Math.PI : 1;
  return [Math.min(...values) * scale, Math.max(...values) * scale];
}

function bathymetryPoint(value, index, tupleRangesAreMetres = false) {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    const pair = Array.from(value);
    if (pair.length < 2) throw new TypeError(`bathymetry[${index}] must contain range and depth`);
    const range = finiteNumber(pair[0], `bathymetry[${index}][0]`);
    return [tupleRangesAreMetres ? range / 1000 : range, finiteNumber(pair[1], `bathymetry[${index}][1]`)];
  }
  if (!isObject(value)) throw new TypeError(`bathymetry[${index}] is invalid`);
  const rangeKm = firstDefined(value.rangeKm, value.range_km, value.range);
  const rangeM = firstDefined(value.rangeM, value.range_m);
  const depthM = firstDefined(value.depthM, value.depth_m, value.depth, value.z);
  return [
    rangeKm !== undefined
      ? finiteNumber(rangeKm, `bathymetry[${index}].rangeKm`)
      : finiteNumber(rangeM, `bathymetry[${index}].rangeM`) / 1000,
    finiteNumber(depthM, `bathymetry[${index}].depthM`),
  ];
}

function jsonBathymetry(source) {
  const candidate = firstPath(source, [
    "bathymetry", "bottomProfile", "bottom_profile", "environment.bathymetry",
    "environment.boundary.bottom.points",
  ]);
  if (candidate === undefined || candidate === null) return null;
  if (Array.isArray(candidate) || ArrayBuffer.isView(candidate)) {
    const values = Array.from(candidate);
    const nativeBoundaryPoints = candidate === valueAt(source, "environment.boundary.bottom.points");
    return values.map((point, index) => bathymetryPoint(point, index, nativeBoundaryPoints));
  }
  if (!isObject(candidate)) throw new TypeError("bathymetry must be an array or range/depth object");
  const rangesKm = arrayValue(firstDefined(candidate.rangesKm, candidate.ranges_km));
  const rangesM = arrayValue(firstDefined(candidate.rangesM, candidate.ranges_m));
  const depths = arrayValue(firstDefined(candidate.depthsM, candidate.depths_m, candidate.depths));
  const ranges = rangesKm ?? rangesM;
  if (ranges === null || depths === null || ranges.length !== depths.length) {
    throw new TypeError("bathymetry range and depth arrays must have the same length");
  }
  return ranges.map((range, index) => [
    finiteNumber(range, `bathymetry.ranges[${index}]`) / (rangesM === null ? 1 : 1000),
    finiteNumber(depths[index], `bathymetry.depths[${index}]`),
  ]);
}

function normalizedBathymetry(points, waterDepthM, maximumRangeKm) {
  if (points === null || points.length === 0) {
    return [[0, waterDepthM], [maximumRangeKm, waterDepthM]];
  }
  if (points.length === 1) {
    return [[0, points[0][1]], [maximumRangeKm, points[0][1]]];
  }
  return points.map((point) => [point[0], point[1]]);
}

/**
 * Validate and copy the canonical browser environment contract.
 *
 * Profile endpoints are strict: the first node must be at 0 m and the last
 * node must equal `waterDepthM`. No sorting or clamping is performed here so
 * malformed imports cannot silently change their physical meaning.
 */
export function validateCanonicalEnvironment(value) {
  if (!isObject(value)) throw new TypeError("environment must be an object");
  const title = String(value.title ?? "").trim();
  const format = String(value.format ?? "").trim();
  if (!title) throw new TypeError("environment title must not be empty");
  if (!format) throw new TypeError("environment format must not be empty");

  const rawPoints = arrayValue(value.profilePoints);
  if (rawPoints === null || rawPoints.length < 2) {
    throw new TypeError("profilePoints must contain at least two nodes");
  }
  if (rawPoints.length > 20_000) throw new RangeError("profilePoints exceeds 20,000 nodes");
  const profilePoints = rawPoints.map(profilePoint);
  for (let index = 0; index < profilePoints.length; index += 1) {
    const [depth, speed] = profilePoints[index];
    if (depth < 0) throw new RangeError(`profilePoints[${index}] depth must be non-negative`);
    if (speed <= 0) throw new RangeError(`profilePoints[${index}] speed must be positive`);
    if (index > 0 && depth <= profilePoints[index - 1][0]) {
      throw new RangeError("profile depths must be strictly increasing");
    }
  }

  const waterDepthM = finiteNumber(value.waterDepthM, "waterDepthM");
  if (waterDepthM <= 0) throw new RangeError("waterDepthM must be positive");
  if (!sameWithinTolerance(profilePoints[0][0], 0)) {
    throw new RangeError("sound-speed profile must start at 0 m");
  }
  if (!sameWithinTolerance(profilePoints.at(-1)[0], waterDepthM)) {
    throw new RangeError("sound-speed profile must end at waterDepthM");
  }

  const frequencyHz = finiteNumber(value.frequencyHz, "frequencyHz");
  const sourceDepthM = finiteNumber(value.sourceDepthM, "sourceDepthM");
  const maximumRangeKm = finiteNumber(value.maximumRangeKm, "maximumRangeKm");
  const bottomSoundSpeedMps = finiteNumber(value.bottomSoundSpeedMps, "bottomSoundSpeedMps");
  const bottomDensityKgM3 = finiteNumber(value.bottomDensityKgM3, "bottomDensityKgM3");
  const bottomAttenuationDbPerWavelength = finiteNumber(
    value.bottomAttenuationDbPerWavelength,
    "bottomAttenuationDbPerWavelength",
  );
  if (frequencyHz <= 0) throw new RangeError("frequencyHz must be positive");
  if (sourceDepthM < 0 || sourceDepthM > waterDepthM) {
    throw new RangeError("sourceDepthM must lie inside the water column");
  }
  if (maximumRangeKm <= 0) throw new RangeError("maximumRangeKm must be positive");
  if (bottomSoundSpeedMps <= 0) throw new RangeError("bottomSoundSpeedMps must be positive");
  if (bottomDensityKgM3 <= 0) throw new RangeError("bottomDensityKgM3 must be positive");
  if (bottomAttenuationDbPerWavelength < 0) {
    throw new RangeError("bottomAttenuationDbPerWavelength must be non-negative");
  }

  const rawAngles = arrayValue(value.angleRangeDegrees);
  if (rawAngles === null || rawAngles.length !== 2) {
    throw new TypeError("angleRangeDegrees must contain exactly two values");
  }
  const angleRangeDegrees = rawAngles.map((angle, index) => finiteNumber(angle, `angleRangeDegrees[${index}]`));
  if (angleRangeDegrees[0] >= angleRangeDegrees[1]) {
    throw new RangeError("angleRangeDegrees must be strictly increasing");
  }
  if (angleRangeDegrees[0] < -90 || angleRangeDegrees[1] > 90) {
    throw new RangeError("angleRangeDegrees must stay within -90 to 90 degrees");
  }

  const beamCount = finiteNumber(value.beamCount, "beamCount");
  if (!Number.isInteger(beamCount) || beamCount < 0) {
    throw new RangeError("beamCount must be a non-negative integer");
  }

  const rawBathymetry = arrayValue(value.bathymetry);
  if (rawBathymetry === null || rawBathymetry.length < 2) {
    throw new TypeError("bathymetry must contain at least two points");
  }
  const bathymetry = rawBathymetry.map((point, index) => bathymetryPoint(point, index));
  for (let index = 0; index < bathymetry.length; index += 1) {
    if (bathymetry[index][1] <= 0) throw new RangeError(`bathymetry[${index}] depth must be positive`);
    if (index > 0 && bathymetry[index][0] <= bathymetry[index - 1][0]) {
      throw new RangeError("bathymetry ranges must be strictly increasing");
    }
  }

  return {
    ...value,
    title,
    format,
    profilePoints,
    waterDepthM,
    frequencyHz,
    sourceDepthM,
    maximumRangeKm,
    bottomSoundSpeedMps,
    bottomDensityKgM3,
    bottomAttenuationDbPerWavelength,
    bathymetry,
    angleRangeDegrees,
    beamCount,
  };
}

/** Parse and normalize a JSON string or already-decoded JSON environment. */
export function parseEnvironmentJson(source, options = {}) {
  let value = source;
  if (typeof source === "string") {
    try {
      value = JSON.parse(source.replace(/^\uFEFF/, ""));
    } catch (error) {
      throw new SyntaxError(`invalid environment JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (!isObject(value)) throw new TypeError("environment JSON root must be an object");

  const profilePoints = jsonProfilePoints(value);
  const inferredWaterDepth = profilePoints.at(-1)?.[0];
  const waterDepthM = optionalFiniteNumber(firstPath(value, [
    "waterDepthM", "water_depth_m", "maximumDepthM", "maximum_depth_m",
    "environment.waterDepthM", "environment.water_depth_m",
  ]), inferredWaterDepth, "waterDepthM");
  const frequencyHz = optionalFiniteNumber(firstPath(value, [
    "frequencyHz", "frequency_hz", "frequency", "environment.frequencyHz",
    "environment.frequency_hz", "environment.frequency",
  ]), DEFAULT_ENVIRONMENT.frequencyHz, "frequencyHz");
  const sourceDepthM = optionalFiniteNumber(
    jsonSourceDepth(value),
    Math.min(50, waterDepthM / 2),
    "sourceDepthM",
  );
  const maximumRangeKm = optionalFiniteNumber(
    jsonMaximumRangeKm(value),
    DEFAULT_ENVIRONMENT.maximumRangeKm,
    "maximumRangeKm",
  );

  const bottomSoundSpeedMps = optionalFiniteNumber(firstPath(value, [
    "bottomSoundSpeedMps", "bottom_sound_speed_m_s", "bottomSpeed", "bottom_speed",
    "seabed.compressionalSoundSpeedMps", "seabed.compressional_sound_speed_m_s",
    "bottom.compressionalSoundSpeedMps", "bottom.compressional_sound_speed_m_s",
    "environment.boundary.bottom.halfspace.compressionalSpeedMps",
  ]), DEFAULT_ENVIRONMENT.bottomSoundSpeedMps, "bottomSoundSpeedMps");

  const densityKg = firstPath(value, [
    "bottomDensityKgM3", "bottom_density_kg_m3", "bottomDensity", "bottom_density",
    "seabed.densityKgM3", "seabed.density_kg_m3", "bottom.densityKgM3",
  ]);
  const densityRelative = firstPath(value, [
    "bottomDensityRelative", "bottom_density_relative", "seabed.densityRelative",
    "environment.boundary.bottom.halfspace.densityRelative",
  ]);
  const bottomDensityKgM3 = densityKg !== undefined
    ? finiteNumber(densityKg, "bottomDensityKgM3")
    : optionalFiniteNumber(densityRelative, DEFAULT_ENVIRONMENT.bottomDensityKgM3 / 1000, "bottomDensityRelative") * 1000;

  const bottomAttenuationDbPerWavelength = optionalFiniteNumber(firstPath(value, [
    "bottomAttenuationDbPerWavelength", "bottom_attenuation_db_per_wavelength",
    "bottomAbsorption", "bottom_absorption", "seabed.attenuationDbPerWavelength",
    "seabed.attenuation_db_per_wavelength", "bottom.attenuationDbPerWavelength",
    "environment.boundary.bottom.halfspace.compressionalAttenuation",
  ]), DEFAULT_ENVIRONMENT.bottomAttenuationDbPerWavelength, "bottomAttenuationDbPerWavelength");

  const angleRangeDegrees = jsonAngleRange(value) ?? DEFAULT_ENVIRONMENT.angleRangeDegrees;
  const launchAxis = firstPath(value, ["source.launchAngles", "source.launch_angles"]);
  const launchAxisCount = isObject(launchAxis) && launchAxis.count !== undefined
    ? launchAxis.count
    : DEFAULT_ENVIRONMENT.beamCount;
  const beamCount = optionalFiniteNumber(firstPath(value, [
    "beamCount", "beam_count", "nbeams", "n_beams", "fieldRayCount", "field_ray_count",
    "options.beamCount", "options.beam_count", "source.launchAngleCount",
    "source.launch_angle_count", "source.launchAngles.count", "source.launch_angles.count",
  ]), launchAxisCount, "beamCount");

  const bathymetry = normalizedBathymetry(jsonBathymetry(value), waterDepthM, maximumRangeKm);
  return validateCanonicalEnvironment({
    title: String(firstPath(value, ["title", "name", "environment.title"])
      ?? options.title ?? "Imported JSON environment"),
    format: options.format ?? "json",
    profilePoints,
    waterDepthM,
    frequencyHz,
    sourceDepthM,
    maximumRangeKm,
    bottomSoundSpeedMps,
    bottomDensityKgM3,
    bottomAttenuationDbPerWavelength,
    bathymetry,
    angleRangeDegrees,
    beamCount,
    sourceFiles: options.sourceFiles ? [...options.sourceFiles] : undefined,
  });
}

function readBellhopAxis(lines, start, label) {
  if (start >= lines.length) throw new SyntaxError(`Bellhop ENV is missing ${label} count`);
  const countTokens = numbersIn(beforeSlash(lines[start]));
  if (countTokens.length === 0) throw new SyntaxError(`Bellhop ENV has an invalid ${label} count`);
  const count = countTokens[0];
  if (!Number.isInteger(count) || count < 1) throw new RangeError(`${label} count must be a positive integer`);
  const values = countTokens.slice(1);
  let cursor = start + 1;
  let terminated = lines[start].includes("/");
  while (!terminated && cursor < lines.length) {
    const line = lines[cursor];
    values.push(...numbersIn(beforeSlash(line)));
    terminated = line.includes("/") || values.length >= count;
    cursor += 1;
  }
  if (values.length === 0) throw new SyntaxError(`Bellhop ENV is missing ${label} values`);
  if (!terminated && values.length < count) throw new SyntaxError(`Bellhop ENV has an incomplete ${label} axis`);
  return { count, values, cursor };
}

function parseInlineBellhop(lines) {
  if (lines.length < 8) throw new SyntaxError("Bellhop ENV is incomplete");
  const title = quotedValue(lines[0]);
  const frequency = numbersIn(lines[1])[0];
  const mediaCount = numbersIn(lines[2])[0];
  const sspOption = quotedValue(lines[3]);
  if (title === undefined) throw new SyntaxError("Bellhop ENV title must be quoted");
  if (!Number.isFinite(frequency) || frequency <= 0) throw new SyntaxError("Bellhop ENV frequency is invalid");
  if (!Number.isInteger(mediaCount) || mediaCount < 1) throw new SyntaxError("Bellhop ENV media count is invalid");
  if (sspOption === undefined) throw new SyntaxError("Bellhop ENV SSP option must be quoted");

  let cursor = 4;
  const profilePoints = [];
  let waterDepthM = 0;
  for (let medium = 0; medium < mediaCount; medium += 1) {
    if (cursor >= lines.length) throw new SyntaxError(`Bellhop ENV is missing medium ${medium + 1}`);
    const header = numbersIn(beforeSlash(lines[cursor]));
    if (header.length < 3) throw new SyntaxError(`Bellhop ENV medium ${medium + 1} header is invalid`);
    const mediumBottomM = header[2];
    if (!Number.isFinite(mediumBottomM) || mediumBottomM <= waterDepthM) {
      throw new RangeError("Bellhop ENV medium depths must be strictly increasing");
    }
    cursor += 1;
    let reachedBottom = false;
    while (cursor < lines.length && quotedValue(lines[cursor]) === undefined) {
      const row = numbersIn(beforeSlash(lines[cursor]));
      if (row.length >= 2) {
        const point = [row[0], row[1]];
        if (profilePoints.length > 0 && sameWithinTolerance(profilePoints.at(-1)[0], point[0])) {
          profilePoints[profilePoints.length - 1] = point;
        } else {
          profilePoints.push(point);
        }
        if (point[0] >= mediumBottomM || sameWithinTolerance(point[0], mediumBottomM)) {
          reachedBottom = true;
          cursor += 1;
          break;
        }
      }
      cursor += 1;
    }
    if (!reachedBottom) throw new SyntaxError(`Bellhop ENV medium ${medium + 1} profile does not reach its bottom`);
    waterDepthM = mediumBottomM;
  }

  const bottomOption = quotedValue(lines[cursor]);
  if (bottomOption === undefined) throw new SyntaxError("Bellhop ENV bottom option is missing");
  cursor += 1;
  let bottomSoundSpeedMps = profilePoints.at(-1)?.[1] ?? DEFAULT_ENVIRONMENT.bottomSoundSpeedMps;
  let bottomDensityKgM3 = 1000;
  let bottomAttenuationDbPerWavelength = 0;
  const halfspace = cursor < lines.length ? numbersIn(beforeSlash(lines[cursor])) : [];
  const acousticHalfspace = ["A", "G"].includes(bottomOption[0]?.toUpperCase());
  if (halfspace.length >= 4 || (acousticHalfspace && halfspace.length >= 2)) {
    bottomSoundSpeedMps = halfspace[1];
    bottomDensityKgM3 = (halfspace[3] ?? 1) * 1000;
    bottomAttenuationDbPerWavelength = halfspace[4] ?? 0;
    cursor += 1;
  }

  const sourceDepths = readBellhopAxis(lines, cursor, "source depth");
  cursor = sourceDepths.cursor;
  const receiverDepths = readBellhopAxis(lines, cursor, "receiver depth");
  cursor = receiverDepths.cursor;
  const receiverRanges = readBellhopAxis(lines, cursor, "receiver range");
  cursor = receiverRanges.cursor;

  while (cursor < lines.length && quotedValue(lines[cursor]) === undefined) cursor += 1;
  if (cursor >= lines.length) throw new SyntaxError("Bellhop ENV run type is missing");
  const runType = quotedValue(lines[cursor]);
  cursor += 1;
  const beamTokens = cursor < lines.length ? numbersIn(beforeSlash(lines[cursor])) : [];
  if (beamTokens.length === 0) throw new SyntaxError("Bellhop ENV beam count is missing");
  const beamCount = Math.abs(beamTokens[0]);
  cursor += 1;
  const angles = cursor < lines.length ? numbersIn(beforeSlash(lines[cursor])) : [];
  if (angles.length < 2) throw new SyntaxError("Bellhop ENV launch-angle range is missing");
  cursor += 1;
  const box = cursor < lines.length ? numbersIn(beforeSlash(lines[cursor])) : [];

  const receiverMaximumKm = Math.max(...receiverRanges.values);
  const rangeCandidates = [receiverMaximumKm, box[2]]
    .filter((value) => Number.isFinite(value) && value > 0);
  const maximumRangeKm = rangeCandidates.length === 0
    ? DEFAULT_ENVIRONMENT.maximumRangeKm
    : Math.min(...rangeCandidates);

  return {
    title,
    frequencyHz: frequency,
    sspOption,
    bottomOption,
    runType,
    profilePoints,
    waterDepthM,
    sourceDepthM: sourceDepths.values[0],
    maximumRangeKm,
    bottomSoundSpeedMps,
    bottomDensityKgM3,
    bottomAttenuationDbPerWavelength,
    angleRangeDegrees: [angles[0], angles[1]],
    beamCount,
  };
}

/** Parse a range-dependent Bellhop `.ssp`, selecting the range nearest 0 km. */
export function parseBellhopSsp(source, baseProfilePoints) {
  const base = arrayValue(baseProfilePoints);
  if (base === null || base.length < 2) throw new TypeError("baseProfilePoints is required for a Bellhop SSP sidecar");
  const depths = base.map(profilePoint).map((point) => point[0]);
  const tokens = numbersIn(bellhopLines(source).join("\n"));
  const rangeCount = tokens[0];
  if (!Number.isInteger(rangeCount) || rangeCount < 1) throw new SyntaxError("Bellhop SSP range count is invalid");
  const required = 1 + rangeCount + rangeCount * depths.length;
  if (tokens.length < required) {
    throw new SyntaxError(`Bellhop SSP is incomplete: expected ${required} numeric values, found ${tokens.length}`);
  }
  const rangesKm = tokens.slice(1, 1 + rangeCount);
  const values = tokens.slice(1 + rangeCount, required);
  const rangeIndex = rangesKm.reduce((best, range, index) => (
    Math.abs(range) < Math.abs(rangesKm[best]) ? index : best
  ), 0);
  const profilePoints = depths.map((depth, depthIndex) => [
    depth,
    values[depthIndex * rangeCount + rangeIndex],
  ]);
  return { rangesKm, selectedRangeKm: rangesKm[rangeIndex], profilePoints };
}

/** Parse a Bellhop `.bty` into `[range km, depth m]` pairs. */
export function parseBellhopBathymetry(source) {
  const lines = bellhopLines(source);
  if (lines.length < 3 || quotedValue(lines[0]) === undefined) {
    throw new SyntaxError("Bellhop BTY interpolation option is missing");
  }
  const tokens = numbersIn(lines.slice(1).join("\n"));
  const count = tokens[0];
  if (!Number.isInteger(count) || count < 1) throw new SyntaxError("Bellhop BTY point count is invalid");
  if (tokens.length < 1 + count * 2) throw new SyntaxError("Bellhop BTY point data is incomplete");
  const points = Array.from({ length: count }, (_, index) => [
    tokens[1 + index * 2],
    tokens[2 + index * 2],
  ]);
  return { interpolation: quotedValue(lines[0]), points };
}

/** Parse a Bellhop ENV string and optional same-stem SSP/BTY sidecar strings. */
export function parseBellhopEnvironment(source, options = {}) {
  const parsed = parseInlineBellhop(bellhopLines(source));
  let profilePoints = parsed.profilePoints;
  let sspRangesKm;
  let selectedSspRangeKm;
  if (options.sspText !== undefined && options.sspText !== null) {
    const ssp = parseBellhopSsp(options.sspText, profilePoints);
    profilePoints = ssp.profilePoints;
    sspRangesKm = ssp.rangesKm;
    selectedSspRangeKm = ssp.selectedRangeKm;
  }
  let bathymetry = null;
  let bathymetryInterpolation;
  if (options.btyText !== undefined && options.btyText !== null) {
    const bty = parseBellhopBathymetry(options.btyText);
    bathymetry = bty.points;
    bathymetryInterpolation = bty.interpolation;
  }

  return validateCanonicalEnvironment({
    title: parsed.title,
    format: "bellhop-env",
    profilePoints,
    waterDepthM: parsed.waterDepthM,
    frequencyHz: parsed.frequencyHz,
    sourceDepthM: parsed.sourceDepthM,
    maximumRangeKm: parsed.maximumRangeKm,
    bottomSoundSpeedMps: parsed.bottomSoundSpeedMps,
    bottomDensityKgM3: parsed.bottomDensityKgM3,
    bottomAttenuationDbPerWavelength: parsed.bottomAttenuationDbPerWavelength,
    bathymetry: normalizedBathymetry(bathymetry, parsed.waterDepthM, parsed.maximumRangeKm),
    angleRangeDegrees: parsed.angleRangeDegrees,
    beamCount: parsed.beamCount,
    sspOption: parsed.sspOption,
    bottomOption: parsed.bottomOption,
    runType: parsed.runType,
    rangeDependent: Boolean(sspRangesKm && sspRangesKm.length > 1),
    sspRangesKm,
    selectedSspRangeKm,
    bathymetryInterpolation,
    sourceFiles: options.sourceFiles ? [...options.sourceFiles] : undefined,
  });
}

function documentText(document) {
  if (typeof document.data === "string") return document.data;
  if (typeof document.text === "string") return document.text;
  const value = firstDefined(document.data, document.bytes, document.buffer);
  if (value instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(value));
  if (ArrayBuffer.isView(value)) return new TextDecoder().decode(value);
  throw new TypeError(`environment document ${document.name} has no text or byte data`);
}

function documentBytes(document, text) {
  if (typeof document.size === "number" && Number.isFinite(document.size)) return document.size;
  return new TextEncoder().encode(text).byteLength;
}

/**
 * Pure document parser for Node tests and non-File browser integrations.
 * Documents use `{ name, data: string | Uint8Array }`.
 */
export function parseEnvironmentDocuments(documents) {
  const list = Array.from(documents ?? []);
  if (list.length < 1 || list.length > MAX_FILE_COUNT) {
    throw new RangeError(`environment import requires 1 to ${MAX_FILE_COUNT} files`);
  }
  const normalized = list.map((document) => {
    if (!isObject(document)) throw new TypeError("environment document must be an object");
    const name = String(document.name ?? "");
    if (!name || name.length > 255 || /[\\/]/.test(name) || name === "." || name === "..") {
      throw new TypeError(`invalid environment filename ${name || "(empty)"}`);
    }
    const text = documentText(document);
    return { name, lowerName: name.toLocaleLowerCase("en-US"), text, bytes: documentBytes(document, text) };
  });
  const names = new Set();
  for (const document of normalized) {
    if (names.has(document.lowerName)) throw new TypeError(`duplicate environment filename ${document.name}`);
    names.add(document.lowerName);
  }
  const totalBytes = normalized.reduce((sum, document) => sum + document.bytes, 0);
  if (totalBytes > MAX_TOTAL_BYTES) throw new RangeError("environment import exceeds the 16 MiB limit");

  const primary = normalized.filter((document) => /\.(?:env|json)$/i.test(document.name));
  if (primary.length !== 1) throw new TypeError("select exactly one .env or .json environment file");
  const extensions = normalized.map((document) => document.name.match(/(\.[^.]+)$/)?.[1]?.toLowerCase());
  if (extensions.some((extension) => ![".env", ".json", ".ssp", ".bty"].includes(extension))) {
    throw new TypeError("environment import supports only .env, .ssp, .bty and .json files");
  }

  const sourceFiles = normalized.map((document) => document.name);
  const main = primary[0];
  if (main.lowerName.endsWith(".json")) {
    if (normalized.length !== 1) throw new TypeError("JSON environment imports do not use Bellhop sidecar files");
    return parseEnvironmentJson(main.text, {
      title: main.name.slice(0, -5),
      sourceFiles,
    });
  }

  const stem = main.lowerName.slice(0, -4);
  const companions = normalized.filter((document) => document !== main);
  for (const companion of companions) {
    const companionStem = companion.lowerName.replace(/\.(?:ssp|bty)$/i, "");
    if (companionStem !== stem) {
      throw new TypeError(`Bellhop companion ${companion.name} must have the same stem as ${main.name}`);
    }
  }
  const ssp = companions.find((document) => document.lowerName.endsWith(".ssp"));
  const bty = companions.find((document) => document.lowerName.endsWith(".bty"));
  return parseBellhopEnvironment(main.text, {
    sspText: ssp?.text,
    btyText: bty?.text,
    sourceFiles,
  });
}

/** Read browser `File` objects, then delegate to the pure document parser. */
export async function parseEnvironmentFiles(files) {
  const list = Array.from(files ?? []);
  const documents = await Promise.all(list.map(async (file) => {
    if (!isObject(file)) throw new TypeError("environment file must be a File-like object");
    const name = String(file.name ?? "");
    if (typeof file.text === "function") {
      return { name, data: await file.text(), size: file.size };
    }
    if (typeof file.arrayBuffer === "function") {
      return { name, data: new Uint8Array(await file.arrayBuffer()), size: file.size };
    }
    if (file.data !== undefined || typeof file.text === "string") {
      return { name, data: firstDefined(file.data, file.text), size: file.size };
    }
    throw new TypeError(`environment file ${name || "(empty)"} cannot be read`);
  }));
  return parseEnvironmentDocuments(documents);
}
