const MAX_FILE_COUNT: any = 16;
const MAX_TOTAL_BYTES: any = 32 * 1024 * 1024;
const MAX_RECEIVER_POINT_COUNT: any = 2_000_000;
const DEFAULT_ENVIRONMENT: any = Object.freeze({
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
const NUMBER_PATTERN: any = /[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[EeDd][-+]?\d+)?/g;
function isObject(value: any): any {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function finiteNumber(value: any, label: any): any {
    const result: any = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(result))
        throw new TypeError(`${label} must be a finite number`);
    return result;
}
function optionalFiniteNumber(value: any, fallback: any, label: any): any {
    return value === undefined || value === null || value === ""
        ? fallback
        : finiteNumber(value, label);
}
function firstDefined(...values: any): any {
    return values.find((value: any): any => value !== undefined && value !== null);
}
function valueAt(source: any, path: any): any {
    let value: any = source;
    for (const key of path.split(".")) {
        if (!isObject(value) || !(key in value))
            return undefined;
        value = value[key];
    }
    return value;
}
function firstPath(source: any, paths: any): any {
    return firstDefined(...paths.map((path: any): any => valueAt(source, path)));
}
function arrayValue(value: any): any {
    if (Array.isArray(value))
        return value;
    if (ArrayBuffer.isView(value))
        return Array.from(value as unknown as ArrayLike<unknown>);
    return null;
}
function numbersIn(source: any): any {
    return [...String(source).matchAll(NUMBER_PATTERN)]
        .map((match: any): any => Number(match[0].replace(/[Dd]/, "E")));
}
function beforeSlash(source: any): any {
    return String(source).split("/", 1)[0];
}
/** Remove a Bellhop `!` comment without treating punctuation inside quotes as a comment. */
export function stripBellhopComment(source: any): any {
    let quote: any = null;
    for (let index: any = 0; index < source.length; index += 1) {
        const character: any = source[index];
        if ((character === "'" || character === '"')) {
            if (quote === character)
                quote = null;
            else if (quote === null)
                quote = character;
        }
        else if (character === "!" && quote === null) {
            return source.slice(0, index);
        }
    }
    return source;
}
function bellhopLines(source: any): any {
    return String(source).replace(/^\uFEFF/, "").split(/\r?\n/)
        .map((line: any): any => stripBellhopComment(line).trim())
        .filter(Boolean);
}
function quotedValue(source: any): any {
    const match: any = String(source).match(/^\s*(['"])(.*?)\1/);
    return match?.[2]?.trim();
}
// ENV/BTY options may be quoted or bare; numeric records must remain numeric.
function optionValue(source: any): any {
    return quotedValue(source) ?? String(source).match(/^\s*([A-Za-z][A-Za-z0-9*]*)(?=\s|\/|$)/)?.[1];
}
function sameWithinTolerance(left: any, right: any): any {
    return Math.abs(left - right) <= Math.max(1e-7, Math.abs(right) * 1e-8);
}
function profilePoint(value: any, index: any): any {
    if (Array.isArray(value) || ArrayBuffer.isView(value)) {
        const pair: any = Array.from(value as unknown as ArrayLike<unknown>);
        if (pair.length < 2)
            throw new TypeError(`profilePoints[${index}] must contain depth and speed`);
        return [
            finiteNumber(pair[0], `profilePoints[${index}][0]`),
            finiteNumber(pair[1], `profilePoints[${index}][1]`),
        ];
    }
    if (!isObject(value))
        throw new TypeError(`profilePoints[${index}] is invalid`);
    return [
        finiteNumber(firstDefined(value.depthM, value.depth_m, value.depth, value.z), `profilePoints[${index}].depthM`),
        finiteNumber(firstDefined(value.speedMps, value.speed_m_s, value.soundSpeedMps, value.sound_speed_m_s, value.speed, value.c), `profilePoints[${index}].speedMps`),
    ];
}
function pointArrayFromContainer(container: any, allowGenericPoints: any = false): any {
    const containerArray: any = arrayValue(container);
    if (containerArray !== null)
        return containerArray.map(profilePoint);
    if (!isObject(container))
        return null;
    const direct: any = arrayValue(firstDefined(container.profilePoints, container.profile_points, container.sspPoints, container.ssp_points, allowGenericPoints ? container.points : undefined));
    if (direct !== null)
        return direct.map(profilePoint);
    const depths: any = arrayValue(firstDefined(container.depthsM, container.depths_m, container.soundSpeedDepthsM, container.sound_speed_depths_m, container.depths, container.z));
    const speeds: any = arrayValue(firstDefined(container.compressionalSpeedMps, container.soundSpeedMps, container.sound_speed_m_s, container.speedsMps, container.speeds_m_s, container.speeds, container.c));
    if (depths === null && speeds === null)
        return null;
    if (depths === null || speeds === null) {
        throw new TypeError("sound-speed depth and speed arrays must have the same length");
    }
    if (depths.length !== speeds.length) {
        const ranges: any = arrayValue(firstDefined(container.rangesM, container.ranges_m, container.ranges));
        if (ranges === null || speeds.length !== depths.length * ranges.length) {
            throw new TypeError("sound-speed depth and speed arrays must have compatible lengths");
        }
        const rangeIndex: any = ranges.reduce((best: any, range: any, index: any): any => (Math.abs(finiteNumber(range, `ssp.ranges[${index}]`))
            < Math.abs(finiteNumber(ranges[best], `ssp.ranges[${best}]`)) ? index : best), 0);
        return depths.map((depth: any, depthIndex: any): any => profilePoint([
            depth,
            speeds[rangeIndex * depths.length + depthIndex],
        ], depthIndex));
    }
    return depths.map((depth: any, index: any): any => profilePoint([depth, speeds[index]], index));
}
function jsonProfilePoints(source: any): any {
    const containers: any = [
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
        const points: any = pointArrayFromContainer(container, allowGenericPoints);
        if (points !== null)
            return points;
    }
    throw new TypeError("environment JSON does not contain a sound-speed profile");
}
function axisValues(axis: any): any {
    const direct: any = arrayValue(axis);
    if (direct !== null)
        return direct.map((value: any, index: any): any => finiteNumber(value, `axis[${index}]`));
    if (!isObject(axis))
        return [];
    const values: any = arrayValue(firstDefined(axis.values, axis.valuesM, axis.values_m));
    if (values !== null)
        return values.map((value: any, index: any): any => finiteNumber(value, `axis.values[${index}]`));
    const start: any = firstDefined(axis.start, axis.minimum, axis.min);
    const end: any = firstDefined(axis.end, axis.maximum, axis.max);
    return [start, end].filter((value: any): any => value !== undefined && value !== null)
        .map((value: any, index: any): any => finiteNumber(value, `axis[${index}]`));
}
function jsonSourceDepth(source: any): any {
    const direct: any = firstPath(source, [
        "sourceDepthM", "source_depth_m", "sourceDepth", "source_depth",
        "source.depthM", "source.depth_m", "source.depth",
    ]);
    if (direct !== undefined)
        return direct;
    const depths: any = axisValues(firstPath(source, ["source.depths", "source.depthsM", "source.depths_m"]));
    return depths[0];
}
function jsonMaximumRangeKm(source: any): any {
    const kilometres: any = firstPath(source, [
        "maximumRangeKm", "maximum_range_km", "rangeKm", "range_km",
        "receiverRangeKm", "receiver_range_km", "receiver_range",
    ]);
    if (kilometres !== undefined)
        return finiteNumber(kilometres, "maximumRangeKm");
    const metres: any = firstPath(source, [
        "maximumRangeM", "maximum_range_m", "options.beam.maximumRangeM",
        "options.beam.maximum_range_m",
    ]);
    if (metres !== undefined)
        return finiteNumber(metres, "maximumRangeM") / 1000;
    const receiverRanges: any = axisValues(firstPath(source, [
        "receivers.ranges", "receivers.rangesM", "receivers.ranges_m",
    ]));
    return receiverRanges.length === 0 ? undefined : Math.max(...receiverRanges) / 1000;
}
function jsonAngleRange(source: any): any {
    const direct: any = arrayValue(firstPath(source, [
        "angleRangeDegrees", "angle_range_degrees", "launchAngleRangeDegrees",
        "launch_angle_range_degrees",
    ]));
    if (direct !== null)
        return direct;
    const minimum: any = firstPath(source, [
        "minimumAngleDegrees", "minimum_angle_degrees", "minimumLaunchAngleDegrees",
        "minimum_launch_angle_degrees", "launchAngles.minimumDegrees",
    ]);
    const maximum: any = firstPath(source, [
        "maximumAngleDegrees", "maximum_angle_degrees", "maximumLaunchAngleDegrees",
        "maximum_launch_angle_degrees", "launchAngles.maximumDegrees",
    ]);
    if (minimum !== undefined || maximum !== undefined)
        return [minimum, maximum];
    const launchAxis: any = firstPath(source, ["source.launchAngles", "source.launch_angles"]);
    const values: any = axisValues(launchAxis);
    if (values.length === 0)
        return undefined;
    const scale: any = firstPath(source, ["source.launchAnglesAreRadians", "source.launch_angles_are_radians"])
        ? 180 / Math.PI : 1;
    return [Math.min(...values) * scale, Math.max(...values) * scale];
}
function bathymetryPoint(value: any, index: any, tupleRangesAreMetres: any = false): any {
    if (Array.isArray(value) || ArrayBuffer.isView(value)) {
        const pair: any = Array.from(value as unknown as ArrayLike<unknown>);
        if (pair.length < 2)
            throw new TypeError(`bathymetry[${index}] must contain range and depth`);
        const range: any = finiteNumber(pair[0], `bathymetry[${index}][0]`);
        return [tupleRangesAreMetres ? range / 1000 : range, finiteNumber(pair[1], `bathymetry[${index}][1]`)];
    }
    if (!isObject(value))
        throw new TypeError(`bathymetry[${index}] is invalid`);
    const rangeKm: any = firstDefined(value.rangeKm, value.range_km, value.range);
    const rangeM: any = firstDefined(value.rangeM, value.range_m);
    const depthM: any = firstDefined(value.depthM, value.depth_m, value.depth, value.z);
    return [
        rangeKm !== undefined
            ? finiteNumber(rangeKm, `bathymetry[${index}].rangeKm`)
            : finiteNumber(rangeM, `bathymetry[${index}].rangeM`) / 1000,
        finiteNumber(depthM, `bathymetry[${index}].depthM`),
    ];
}
function jsonBathymetry(source: any): any {
    const candidate: any = firstPath(source, [
        "bathymetry", "bottomProfile", "bottom_profile", "environment.bathymetry",
        "environment.boundary.bottom.points",
    ]);
    if (candidate === undefined || candidate === null)
        return null;
    if (Array.isArray(candidate) || ArrayBuffer.isView(candidate)) {
        const values: any = Array.from(candidate as unknown as ArrayLike<unknown>);
        const nativeBoundaryPoints: any = candidate === valueAt(source, "environment.boundary.bottom.points");
        return values.map((point: any, index: any): any => bathymetryPoint(point, index, nativeBoundaryPoints));
    }
    if (!isObject(candidate))
        throw new TypeError("bathymetry must be an array or range/depth object");
    const rangesKm: any = arrayValue(firstDefined(candidate.rangesKm, candidate.ranges_km));
    const rangesM: any = arrayValue(firstDefined(candidate.rangesM, candidate.ranges_m));
    const depths: any = arrayValue(firstDefined(candidate.depthsM, candidate.depths_m, candidate.depths));
    const ranges: any = rangesKm ?? rangesM;
    if (ranges === null || depths === null || ranges.length !== depths.length) {
        throw new TypeError("bathymetry range and depth arrays must have the same length");
    }
    return ranges.map((range: any, index: any): any => [
        finiteNumber(range, `bathymetry.ranges[${index}]`) / (rangesM === null ? 1 : 1000),
        finiteNumber(depths[index], `bathymetry.depths[${index}]`),
    ]);
}
function numericArray(value: any, label: any): any {
    const values: any = arrayValue(value);
    if (values === null)
        return [];
    return values.map((entry: any, index: any): any => finiteNumber(entry, String(label) + "[" + index + "]"));
}
function numericExtrema(values: any): any {
    let minimum: any = Infinity;
    let maximum: any = -Infinity;
    for (const value of values) {
        const numeric: any = Number(value);
        if (!Number.isFinite(numeric))
            continue;
        if (numeric < minimum)
            minimum = numeric;
        if (numeric > maximum)
            maximum = numeric;
    }
    return {
        minimum: minimum === Infinity ? undefined : minimum,
        maximum: maximum === -Infinity ? undefined : maximum,
    };
}
function positiveMaximum(...values: any): any {
    let maximum: any = undefined;
    const visit: any = (value: any): any => {
        const entries: any = arrayValue(value);
        if (entries !== null) {
            for (let index: any = 0; index < entries.length; index += 1)
                visit(entries[index]);
            return;
        }
        const numeric: any = Number(value);
        if (Number.isFinite(numeric) && numeric > 0 && (maximum === undefined || numeric > maximum))
            maximum = numeric;
    };
    for (const value of values)
        visit(value);
    return maximum;
}
function fieldDocumentRun(source: any, backends: any): any {
    const runs: any = arrayValue(source.runs) ?? [];
    return runs.find((run: any): any => isObject(run) && backends.includes(String(run.backend ?? "")));
}
function fieldDocumentProfile(parameters: any, source: any): any {
    const sections: any = arrayValue(parameters.waterColumn?.sections) ?? [];
    const sourcePoint: any = arrayValue(parameters.source?.pointsNedMeters)?.[0] ?? [0, 0, 0];
    const plane: any = parameters.waterColumn?.propagationPlane ?? parameters.waterColumn?.soundSpeed?.propagationPlane;
    const sourceRangeM: any = fieldDocumentPlaneCoordinate(sourcePoint, plane);
    const orderedSections: any = sections.slice().sort((left: any, right: any): any => {
        const contains: any = (section: any): any => Number(section?.beginMeters) <= sourceRangeM
            && sourceRangeM <= Number(section?.endMeters);
        return Number(contains(right)) - Number(contains(left));
    });
    const candidates: any = [
        { container: parameters.waterColumn?.profile?.soundSpeed },
        {
            container: parameters.waterColumn?.soundSpeed,
            warning: parameters.waterColumn?.soundSpeed?.representation === "EXTRUDED_RANGE_DEPTH"
                ? "距离相关声速场已投影为源位置的参考垂向剖面；网页参数编辑不会保留完整二维声速场。"
                : undefined,
        },
        ...orderedSections.map((section: any): any => ({
            container: section?.profile?.soundSpeed,
            warning: sections.length > 1
                ? "分段水体已投影为声源所在分段的垂向剖面；网页参数编辑不会保留其他距离分段。"
                : undefined,
        })),
    ];
    for (const descriptor of candidates) {
        const candidate: any = descriptor.container;
        if (!isObject(candidate))
            continue;
        const depths: any = numericArray(candidate.depthsMeters, "parameters.waterColumn.soundSpeed.depthsMeters");
        let speeds: any = numericArray(candidate.values, "parameters.waterColumn.soundSpeed.values");
        let profileProjection: any = undefined;
        if (depths.length > 0 && speeds.length === 0 && candidate.representation === "EXTRUDED_RANGE_DEPTH") {
            const ranges: any = numericArray(candidate.rangesMeters, "parameters.waterColumn.soundSpeed.rangesMeters");
            const grid: any = numericArray(candidate.valuesRangeDepth, "parameters.waterColumn.soundSpeed.valuesRangeDepth");
            if (ranges.length === 0 || grid.length !== ranges.length * depths.length) {
                throw new TypeError("FieldDocument range-depth sound speed must contain ranges × depths values");
            }
            const rayRun: any = fieldDocumentRun(source, ["ray_mode.bellhop.2d"]);
            const reference: any = numericArray(rayRun?.options?.qReferenceSoundSpeedsMetersPerSecond, "runs.bellhop.qReferenceSoundSpeedsMetersPerSecond");
            if (reference.length === depths.length) {
                speeds = reference;
                profileProjection = "RAY_REFERENCE_PROFILE";
            }
            else {
                let selected: any = 0;
                for (let index: any = 1; index < ranges.length; index += 1) {
                    if (Math.abs(ranges[index] - sourceRangeM) < Math.abs(ranges[selected] - sourceRangeM))
                        selected = index;
                }
                speeds = grid.slice(selected * depths.length, (selected + 1) * depths.length);
                profileProjection = "NEAREST_RANGE_SLICE";
            }
        }
        if (depths.length === 0 && speeds.length === 0)
            continue;
        if (depths.length !== speeds.length) {
            throw new TypeError("FieldDocument sound-speed depthsMeters and values must have the same length");
        }
        return {
            container: candidate,
            points: depths.map((depth: any, index: any): any => [depth, speeds[index]]),
            profileProjection,
            projectionWarnings: descriptor.warning ? [descriptor.warning] : [],
        };
    }
    throw new TypeError("FieldDocument does not contain a usable water-column sound-speed profile");
}
function fieldDocumentPlaneCoordinate(point: any, plane: any): any {
    const origin: any = arrayValue(plane?.originNorthEastMeters) ?? [0, 0];
    const direction: any = arrayValue(plane?.directionNorthEast) ?? [0, 1];
    const north: any = finiteNumber(point?.[0] ?? 0, "NED north coordinate");
    const east: any = finiteNumber(point?.[1] ?? 0, "NED east coordinate");
    const directionNorth: any = finiteNumber(direction[0] ?? 0, "propagationPlane.directionNorthEast[0]");
    const directionEast: any = finiteNumber(direction[1] ?? 1, "propagationPlane.directionNorthEast[1]");
    const norm: any = Math.hypot(directionNorth, directionEast);
    if (!(norm > 0))
        throw new RangeError("FieldDocument propagation-plane direction must be non-zero");
    return ((north - Number(origin[0] ?? 0)) * directionNorth
        + (east - Number(origin[1] ?? 0)) * directionEast) / norm;
}
function fieldDocumentBoundarySelection(boundary: any, sourceRangeM: any): any {
    if (!isObject(boundary))
        return { geometry: null, piecewise: false };
    if (isObject(boundary.geometry))
        return { geometry: boundary.geometry, assembly: boundary, piecewise: false };
    const sections: any = arrayValue(boundary.sections) ?? [];
    const selected: any = sections.find((section: any, index: any): any => {
        const begin: any = Number(section?.beginMeters);
        const end: any = Number(section?.endMeters);
        return Number.isFinite(begin) && Number.isFinite(end)
            && sourceRangeM >= begin
            && (sourceRangeM < end || (index === sections.length - 1 && sourceRangeM <= end));
    }) ?? sections[0];
    return {
        geometry: selected?.assembly?.geometry ?? null,
        assembly: selected?.assembly ?? null,
        piecewise: sections.length > 1,
    };
}
function fieldDocumentGeometryPoints(geometry: any, label: any): any {
    if (!isObject(geometry))
        return [];
    const ranges: any = numericArray(geometry.rangesMeters, String(label) + ".rangesMeters");
    const depths: any = numericArray(geometry.depthsMeters, String(label) + ".depthsMeters");
    if (ranges.length === 0 && depths.length === 0)
        return [];
    if (ranges.length !== depths.length)
        throw new TypeError(String(label) + " rangesMeters and depthsMeters must have the same length");
    const points: any = ranges.map((range: any, index: any): any => [range, depths[index]]);
    for (let index: any = 1; index < points.length; index += 1) {
        if (!(points[index][0] > points[index - 1][0]))
            throw new RangeError(String(label) + " rangesMeters must be strictly increasing");
    }
    return points;
}
function interpolatedLineValue(points: any, coordinate: any): any {
    if (points.length === 0)
        return undefined;
    if (coordinate <= points[0][0])
        return points[0][1];
    if (coordinate >= points.at(-1)[0])
        return points.at(-1)[1];
    for (let index: any = 1; index < points.length; index += 1) {
        const right: any = points[index];
        if (coordinate > right[0])
            continue;
        const left: any = points[index - 1];
        const fraction: any = (coordinate - left[0]) / (right[0] - left[0]);
        return left[1] + fraction * (right[1] - left[1]);
    }
    return points.at(-1)[1];
}
function fieldDocumentBoundaryDepth(geometry: any, points: any, rangeM: any, label: any): any {
    if (!isObject(geometry))
        return undefined;
    if (geometry.representation === "HORIZONTAL" || geometry.depthMeters !== undefined) {
        return finiteNumber(geometry.depthMeters, String(label) + ".depthMeters");
    }
    const result: any = interpolatedLineValue(points, rangeM);
    if (result === undefined)
        throw new TypeError(String(label) + " does not contain usable geometry");
    return result;
}
function fieldDocumentProfileValue(points: any, depthM: any): any {
    if (depthM <= points[0][0])
        return points[0][1];
    if (depthM >= points.at(-1)[0])
        return points.at(-1)[1];
    for (let index: any = 1; index < points.length; index += 1) {
        if (depthM > points[index][0])
            continue;
        const left: any = points[index - 1];
        const right: any = points[index];
        const fraction: any = (depthM - left[0]) / (right[0] - left[0]);
        return left[1] + fraction * (right[1] - left[1]);
    }
    return points.at(-1)[1];
}
function fieldDocumentDepthProjection(parameters: any, profile: any): any {
    const sourcePoint: any = arrayValue(parameters.source?.pointsNedMeters)?.[0] ?? [0, 0, 0];
    const plane: any = parameters.waterColumn?.propagationPlane
        ?? parameters.waterColumn?.soundSpeed?.propagationPlane
        ?? parameters.seaSurface?.geometry?.propagationPlane
        ?? parameters.seabed?.geometry?.propagationPlane;
    const sourceRangeM: any = fieldDocumentPlaneCoordinate(sourcePoint, plane);
    const surface: any = fieldDocumentBoundarySelection(parameters.seaSurface, sourceRangeM);
    const bottom: any = fieldDocumentBoundarySelection(parameters.seabed, sourceRangeM);
    const surfacePoints: any = fieldDocumentGeometryPoints(surface.geometry, "parameters.seaSurface.geometry");
    const bottomPoints: any = fieldDocumentGeometryPoints(bottom.geometry, "parameters.seabed.geometry");
    const surfaceDepthAt: any = (rangeM: any): any => fieldDocumentBoundaryDepth(
        surface.geometry,
        surfacePoints,
        rangeM,
        "parameters.seaSurface.geometry",
    ) ?? 0;
    const bottomDepthAt: any = (rangeM: any): any => fieldDocumentBoundaryDepth(
        bottom.geometry,
        bottomPoints,
        rangeM,
        "parameters.seabed.geometry",
    );
    const surfaceDepthM: any = surfaceDepthAt(sourceRangeM);
    const datumDepthM: any = parameters.waterColumn?.representation === "INVARIANT_VERTICAL_PROFILE"
        ? finiteNumber(parameters.waterColumn?.datumDepthMeters ?? 0, "parameters.waterColumn.datumDepthMeters")
        : 0;
    const shifted: any = profile.points.map((point: any): any => [
        point[0] + datumDepthM - surfaceDepthM,
        point[1],
    ]);
    const bottomDepthM: any = bottomDepthAt(sourceRangeM);
    const waterDepthM: any = bottomDepthM === undefined
        ? shifted.at(-1)?.[0]
        : bottomDepthM - surfaceDepthM;
    if (!(waterDepthM > 0))
        throw new RangeError("FieldDocument water-column thickness at the source must be positive");
    const needsBoundaryInterpolation: any = !sameWithinTolerance(shifted[0][0], 0)
        || !sameWithinTolerance(shifted.at(-1)[0], waterDepthM);
    const speedsConstant: any = shifted.every((point: any): any => sameWithinTolerance(point[1], shifted[0][1]));
    if (needsBoundaryInterpolation && profile.container.interpolation !== "LINEAR" && !speedsConstant) {
        throw new RangeError(
            "FIELD_DOCUMENT_MODEL_SPECIFIC_INTERPOLATOR_REQUIRED: source-local profile clipping requires "
            + String(profile.container.interpolation ?? "an unknown") + " interpolation",
        );
    }
    const profilePoints: any = [[0, fieldDocumentProfileValue(shifted, 0)]];
    for (const point of shifted) {
        if (point[0] > 0 && point[0] < waterDepthM)
            profilePoints.push([point[0], point[1]]);
    }
    profilePoints.push([waterDepthM, fieldDocumentProfileValue(shifted, waterDepthM)]);
    const warnings: any = [...profile.projectionWarnings];
    let lossy: any = warnings.length > 0;
    if (!sameWithinTolerance(surfaceDepthM, 0) || !sameWithinTolerance(datumDepthM, 0)) {
        warnings.push("LOCAL_NED 垂向坐标已相对声源处海面重基准。");
    }
    if (surfacePoints.length > 0) {
        warnings.push("距离相关海面已转换为局部水深/水厚预览；当前网页不会保留海面坡度。");
        lossy = true;
    }
    if (surface.piecewise || bottom.piecewise) {
        warnings.push("分段边界已选择声源所在分段用于网页预览。");
        lossy = true;
    }
    const surfaceCondition: any = String(surface.assembly?.condition?.kind ?? "VACUUM");
    if (surfaceCondition !== "VACUUM") {
        warnings.push("海面条件 " + surfaceCondition + " 超出当前网页自定义环境能力，计算将使用网页默认海面条件。");
        lossy = true;
    }
    const bottomCondition: any = bottom.assembly?.condition;
    const bottomMaterial: any = bottomCondition?.material;
    const bottomLayers: any = arrayValue(bottom.assembly?.layers) ?? [];
    const pointMaterials: any = arrayValue(bottom.assembly?.pointMaterials) ?? [];
    if (bottomCondition?.kind !== "MATERIAL_HALF_SPACE"
        || (isObject(bottomMaterial) && bottomMaterial.kind !== "FLUID")
        || bottomLayers.length > 0
        || pointMaterials.length > 0) {
        warnings.push("复杂海底边界/分层已投影为网页可编辑的等效底质参数，不能视为完整 FieldDocument 等价计算。");
        lossy = true;
    }
    const interpolation: any = String(profile.container.interpolation ?? "LINEAR");
    if (!["LINEAR", "SQUARED_SLOWNESS_LINEAR"].includes(interpolation)) {
        warnings.push("声速插值 " + interpolation + " 将按网页支持的插值方式预览。");
        lossy = true;
    }
    return {
        plane,
        profilePoints,
        waterDepthM,
        sourceRangeM,
        sourceDepthM: finiteNumber(sourcePoint[2] ?? surfaceDepthM, "parameters.source.pointsNedMeters[0][2]") - surfaceDepthM,
        surfaceDepthAt,
        bottomDepthAt,
        surfacePoints,
        bottomPoints,
        bottomMaterial,
        projectionMode: lossy ? "EDITABLE_PREVIEW" : "EXACT",
        projectionWarnings: [...new Set(warnings)],
        depthDatumOffsetMeters: datumDepthM - surfaceDepthM,
    };
}
function fieldDocumentBathymetry(projection: any, maximumRangeM: any): any {
    if (projection.bottomDepthAt(projection.sourceRangeM) === undefined)
        return null;
    if (!(maximumRangeM > 0))
        return null;
    const ranges: any = new Set([0, maximumRangeM]);
    for (const point of [...projection.surfacePoints, ...projection.bottomPoints]) {
        const relative: any = point[0] - projection.sourceRangeM;
        if (relative > 0 && relative < maximumRangeM)
            ranges.add(relative);
    }
    const result: any = [...ranges].sort((left: any, right: any): any => left - right)
        .map((rangeM: any): any => {
            const absoluteRangeM: any = projection.sourceRangeM + rangeM;
            const thicknessM: any = projection.bottomDepthAt(absoluteRangeM)
                - projection.surfaceDepthAt(absoluteRangeM);
            if (!(thicknessM > 0)) {
                throw new RangeError(
                    "FieldDocument seabed reaches a non-positive water depth inside the active model range",
                );
            }
            return [rangeM / 1000, thicknessM];
        });
    return result;
}
function fieldDocumentScalar(value: any, label: any): any {
    if (value === undefined || value === null)
        return undefined;
    if (!isObject(value))
        return finiteNumber(value, label);
    const values: any = arrayValue(value.values);
    const scalar: any = firstDefined(value.value, values?.[0]);
    return scalar === undefined ? undefined : finiteNumber(scalar, label);
}
function fieldDocumentNedPoints(value: any, label: any): any {
    const points: any = arrayValue(value) ?? [];
    return points.map((point: any, index: any): any => {
        const coordinates: any = arrayValue(point);
        if (coordinates === null || coordinates.length < 3) {
            throw new TypeError(String(label) + "[" + index + "] must contain north, east and depth coordinates");
        }
        return coordinates.slice(0, 3).map((coordinate: any, axis: any): any => finiteNumber(coordinate, String(label) + "[" + index + "][" + axis + "]"));
    });
}
function fieldDocumentReceiverSummary(value: any, label: any, sourcePoint: any, depthProjection: any = 0): any {
    const points: any = arrayValue(value) ?? [];
    if (points.length > MAX_RECEIVER_POINT_COUNT) {
        throw new RangeError(String(label) + " exceeds " + MAX_RECEIVER_POINT_COUNT.toLocaleString("en-US") + " points");
    }
    const ranges: any = new Set();
    const depths: any = new Set();
    let maximumRangeM: any = undefined;
    for (let index: any = 0; index < points.length; index += 1) {
        const coordinates: any = arrayValue(points[index]);
        if (coordinates === null || coordinates.length < 3) {
            throw new TypeError(String(label) + "[" + index + "] must contain north, east and depth coordinates");
        }
        const north: any = finiteNumber(coordinates[0], String(label) + "[" + index + "][0]");
        const east: any = finiteNumber(coordinates[1], String(label) + "[" + index + "][1]");
        const rawDepth: any = finiteNumber(coordinates[2], String(label) + "[" + index + "][2]");
        const range: any = Math.hypot(north - sourcePoint[0], east - sourcePoint[1]);
        const depth: any = typeof depthProjection === "function"
            ? depthProjection(range, rawDepth, north, east) : rawDepth + depthProjection;
        ranges.add(range);
        depths.add(depth);
        if (maximumRangeM === undefined || range > maximumRangeM)
            maximumRangeM = range;
    }
    return {
        receiverRangesM: [...ranges],
        receiverDepthsM: [...depths],
        receiverPointCount: points.length,
        maximumRangeM,
    };
}
function fieldDocumentOverlay(source: any): any {
    const parameters: any = source.parameters;
    if (!isObject(parameters) || !isObject(parameters.waterColumn) || !isObject(parameters.source))
        return null;
    const profile: any = fieldDocumentProfile(parameters, source);
    const projection: any = fieldDocumentDepthProjection(parameters, profile);
    const material: any = projection.bottomMaterial;
    const sourcePoints: any = fieldDocumentNedPoints(parameters.source.pointsNedMeters, "parameters.source.pointsNedMeters");
    const firstSource: any = sourcePoints[0] ?? [0, 0, Math.min(50, projection.waterDepthM / 2)];
    const receiver: any = fieldDocumentReceiverSummary(
        parameters.receiver?.geometry?.pointsNedMeters,
        "parameters.receiver.geometry.pointsNedMeters",
        firstSource,
        (_rangeM: any, rawDepthM: any, north: any, east: any): any => rawDepthM
            - projection.surfaceDepthAt(fieldDocumentPlaneCoordinate([north, east, rawDepthM], projection.plane)),
    );
    const receiverRangesM: any = receiver.receiverRangesM;
    const receiverDepthsM: any = receiver.receiverDepthsM;
    const rayRun: any = fieldDocumentRun(source, ["ray_mode.bellhop.2d"]);
    const normalRun: any = fieldDocumentRun(source, ["normal_mode.kraken", "normal_mode.krakenc"]);
    const peRun: any = fieldDocumentRun(source, ["pe.ram", "pe.ramgeo", "pe.rams"]);
    const rayOptions: any = rayRun?.options ?? {};
    const normalOptions: any = normalRun?.options ?? {};
    const peOptions: any = peRun?.options ?? {};
    const launchAngles: any = rayOptions.launchAngles ?? {};
    const explicitAngles: any = numericArray(launchAngles.anglesDegrees, "runs.bellhop.launchAngles.anglesDegrees");
    let angleProjection: any = undefined;
    let angleRangeDegrees: any = undefined;
    if (explicitAngles.length > 1) {
        const extrema: any = numericExtrema(explicitAngles);
        angleRangeDegrees = [extrema.minimum, extrema.maximum];
    }
    else if (Number.isFinite(Number(launchAngles.minimumDegrees)) && Number.isFinite(Number(launchAngles.maximumDegrees))) {
        angleRangeDegrees = [launchAngles.minimumDegrees, launchAngles.maximumDegrees];
    }
    if (angleRangeDegrees
        && (angleRangeDegrees[0] < -90 || angleRangeDegrees[1] > 90)) {
        angleRangeDegrees = [
            Math.max(-90, Number(angleRangeDegrees[0])),
            Math.min(90, Number(angleRangeDegrees[1])),
        ];
        angleProjection = "FORWARD_HALF_PLANE";
        projection.projectionMode = "EDITABLE_PREVIEW";
        projection.projectionWarnings.push("全圆周发射角已裁为网页支持的前向 -90°..90° 预览。");
    }
    const geometryRangesM: any = [...projection.surfacePoints, ...projection.bottomPoints]
        .map((point: any): any => point[0] - projection.sourceRangeM)
        .filter((range: any): any => range > 0);
    const normalRangesM: any = numericArray(normalOptions.rangeSamplesMeters, "runs.normalMode.rangeSamplesMeters");
    const activeMaximumRangeM: any = positiveMaximum(
        receiver.maximumRangeM,
        normalRangesM,
        rayOptions.integration?.rangeBoxMeters,
        peOptions.maximumRangeMeters,
    );
    const maximumRangeM: any = activeMaximumRangeM
        ?? positiveMaximum(geometryRangesM);
    const bathymetry: any = fieldDocumentBathymetry(projection, maximumRangeM);
    const revision: any = fieldDocumentScalar(source.documentInfo?.formatRevision, "documentInfo.formatRevision");
    const minimumPhaseSpeed: any = fieldDocumentScalar(normalOptions.minimumPhaseSpeedMetersPerSecond, "minimumPhaseSpeedMetersPerSecond");
    const maximumPhaseSpeed: any = fieldDocumentScalar(normalOptions.maximumPhaseSpeedMetersPerSecond, "maximumPhaseSpeedMetersPerSecond");
    return {
        title: String(parameters.title ?? "Imported FieldDocument"),
        format: revision === undefined ? "field-document" : "field-document-v" + revision,
        adaptiveParser: "field-document",
        fieldDocumentRevision: revision,
        profilePoints: projection.profilePoints,
        profileProjection: profile.profileProjection,
        angleProjection,
        projectionMode: projection.projectionMode,
        projectionWarnings: projection.projectionWarnings,
        depthDatumOffsetMeters: projection.depthDatumOffsetMeters,
        waterDepthM: projection.waterDepthM,
        frequencyHz: numericArray(parameters.source.frequenciesHz, "parameters.source.frequenciesHz")[0],
        sourceDepthM: projection.sourceDepthM,
        maximumRangeKm: maximumRangeM === undefined ? undefined : maximumRangeM / 1000,
        bottomSoundSpeedMps: fieldDocumentScalar(material?.compressionalSoundSpeed, "seabed compressional sound speed"),
        bottomDensityKgM3: fieldDocumentScalar(material?.density, "seabed density"),
        bottomAttenuationDbPerWavelength: fieldDocumentScalar(material?.compressionalAttenuation, "seabed attenuation"),
        bathymetry,
        angleRangeDegrees,
        beamCount: firstDefined(launchAngles.angleCount, explicitAngles.length || undefined),
        interpolation: profile.container.interpolation,
        receiverRangesM,
        receiverPointCount: receiver.receiverPointCount,
        receiverDepthsM,
        phaseSpeedLowMps: minimumPhaseSpeed,
        phaseSpeedHighMps: maximumPhaseSpeed,
        maximumDepthM: peOptions.maximumDepthMeters === undefined
            ? undefined
            : Number(peOptions.maximumDepthMeters) - projection.surfaceDepthAt(projection.sourceRangeM),
        rangeStepM: peOptions.rangeStepMeters,
        depthStepM: peOptions.depthStepMeters,
        nPade: peOptions.padeTermCount,
    };
}
function normalizedBathymetry(points: any, waterDepthM: any, maximumRangeKm: any): any {
    if (points === null || points.length === 0) {
        return [[0, waterDepthM], [maximumRangeKm, waterDepthM]];
    }
    if (points.length === 1) {
        return [[0, points[0][1]], [maximumRangeKm, points[0][1]]];
    }
    return points.map((point: any): any => [point[0], point[1]]);
}
/**
 * Validate and copy the canonical browser environment contract.
 *
 * Profile endpoints are strict: the first node must be at 0 m and the last
 * node must equal `waterDepthM`. No sorting or clamping is performed here so
 * malformed imports cannot silently change their physical meaning.
 */
export function validateCanonicalEnvironment(value: any): any {
    if (!isObject(value))
        throw new TypeError("environment must be an object");
    const title: any = String(value.title ?? "").trim();
    const format: any = String(value.format ?? "").trim();
    if (!title)
        throw new TypeError("environment title must not be empty");
    if (!format)
        throw new TypeError("environment format must not be empty");
    const rawPoints: any = arrayValue(value.profilePoints);
    if (rawPoints === null || rawPoints.length < 2) {
        throw new TypeError("profilePoints must contain at least two nodes");
    }
    if (rawPoints.length > 20000)
        throw new RangeError("profilePoints exceeds 20,000 nodes");
    const profilePoints: any = rawPoints.map(profilePoint);
    for (let index: any = 0; index < profilePoints.length; index += 1) {
        const [depth, speed]: any = profilePoints[index];
        if (depth < 0)
            throw new RangeError(`profilePoints[${index}] depth must be non-negative`);
        if (speed <= 0)
            throw new RangeError(`profilePoints[${index}] speed must be positive`);
        if (index > 0 && depth <= profilePoints[index - 1][0]) {
            throw new RangeError("profile depths must be strictly increasing");
        }
    }
    const waterDepthM: any = finiteNumber(value.waterDepthM, "waterDepthM");
    if (waterDepthM <= 0)
        throw new RangeError("waterDepthM must be positive");
    if (!sameWithinTolerance(profilePoints[0][0], 0)) {
        throw new RangeError("sound-speed profile must start at 0 m");
    }
    if (!sameWithinTolerance(profilePoints.at(-1)[0], waterDepthM)) {
        throw new RangeError("sound-speed profile must end at waterDepthM");
    }
    const frequencyHz: any = finiteNumber(value.frequencyHz, "frequencyHz");
    const sourceDepthM: any = finiteNumber(value.sourceDepthM, "sourceDepthM");
    const maximumRangeKm: any = finiteNumber(value.maximumRangeKm, "maximumRangeKm");
    const bottomSoundSpeedMps: any = finiteNumber(value.bottomSoundSpeedMps, "bottomSoundSpeedMps");
    const bottomDensityKgM3: any = finiteNumber(value.bottomDensityKgM3, "bottomDensityKgM3");
    const bottomAttenuationDbPerWavelength: any = finiteNumber(value.bottomAttenuationDbPerWavelength, "bottomAttenuationDbPerWavelength");
    if (frequencyHz <= 0)
        throw new RangeError("frequencyHz must be positive");
    if (sourceDepthM < 0 || sourceDepthM > waterDepthM) {
        throw new RangeError("sourceDepthM must lie inside the water column");
    }
    if (maximumRangeKm <= 0)
        throw new RangeError("maximumRangeKm must be positive");
    if (bottomSoundSpeedMps <= 0)
        throw new RangeError("bottomSoundSpeedMps must be positive");
    if (bottomDensityKgM3 <= 0)
        throw new RangeError("bottomDensityKgM3 must be positive");
    if (bottomAttenuationDbPerWavelength < 0) {
        throw new RangeError("bottomAttenuationDbPerWavelength must be non-negative");
    }
    const rawAngles: any = arrayValue(value.angleRangeDegrees);
    if (rawAngles === null || rawAngles.length !== 2) {
        throw new TypeError("angleRangeDegrees must contain exactly two values");
    }
    const angleRangeDegrees: any = rawAngles.map((angle: any, index: any): any => finiteNumber(angle, `angleRangeDegrees[${index}]`));
    if (angleRangeDegrees[0] >= angleRangeDegrees[1]) {
        throw new RangeError("angleRangeDegrees must be strictly increasing");
    }
    if (angleRangeDegrees[0] < -90 || angleRangeDegrees[1] > 90) {
        throw new RangeError("angleRangeDegrees must stay within -90 to 90 degrees");
    }
    const beamCount: any = finiteNumber(value.beamCount, "beamCount");
    if (!Number.isInteger(beamCount) || beamCount < 0) {
        throw new RangeError("beamCount must be a non-negative integer");
    }
    const rawBathymetry: any = arrayValue(value.bathymetry);
    if (rawBathymetry === null || rawBathymetry.length < 2) {
        throw new TypeError("bathymetry must contain at least two points");
    }
    const bathymetry: any = rawBathymetry.map((point: any, index: any): any => bathymetryPoint(point, index));
    for (let index: any = 0; index < bathymetry.length; index += 1) {
        if (bathymetry[index][1] <= 0)
            throw new RangeError(`bathymetry[${index}] depth must be positive`);
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
export function parseEnvironmentJson(source: any, options: any = {}): any {
    let value: any = source;
    if (typeof source === "string") {
        try {
            value = JSON.parse(source.replace(/^\uFEFF/, ""));
        }
        catch (error: any) {
            throw new SyntaxError(`invalid environment JSON: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    if (!isObject(value))
        throw new TypeError("environment JSON root must be an object");
    const fieldDocument: any = fieldDocumentOverlay(value);
    if (fieldDocument !== null)
        value = { ...value, ...fieldDocument };
    const profilePoints: any = jsonProfilePoints(value);
    const inferredWaterDepth: any = profilePoints.at(-1)?.[0];
    const waterDepthM: any = optionalFiniteNumber(firstPath(value, [
        "waterDepthM", "water_depth_m", "maximumDepthM", "maximum_depth_m",
        "environment.waterDepthM", "environment.water_depth_m",
    ]), inferredWaterDepth, "waterDepthM");
    const frequencyHz: any = optionalFiniteNumber(firstPath(value, [
        "frequencyHz", "frequency_hz", "frequency", "environment.frequencyHz",
        "environment.frequency_hz", "environment.frequency",
    ]), DEFAULT_ENVIRONMENT.frequencyHz, "frequencyHz");
    const sourceDepthM: any = optionalFiniteNumber(jsonSourceDepth(value), Math.min(50, waterDepthM / 2), "sourceDepthM");
    const maximumRangeKm: any = optionalFiniteNumber(jsonMaximumRangeKm(value), DEFAULT_ENVIRONMENT.maximumRangeKm, "maximumRangeKm");
    const bottomSoundSpeedMps: any = optionalFiniteNumber(firstPath(value, [
        "bottomSoundSpeedMps", "bottom_sound_speed_m_s", "bottomSpeed", "bottom_speed",
        "seabed.compressionalSoundSpeedMps", "seabed.compressional_sound_speed_m_s",
        "bottom.compressionalSoundSpeedMps", "bottom.compressional_sound_speed_m_s",
        "environment.boundary.bottom.halfspace.compressionalSpeedMps",
    ]), DEFAULT_ENVIRONMENT.bottomSoundSpeedMps, "bottomSoundSpeedMps");
    const densityKg: any = firstPath(value, [
        "bottomDensityKgM3", "bottom_density_kg_m3", "bottomDensity", "bottom_density",
        "seabed.densityKgM3", "seabed.density_kg_m3", "bottom.densityKgM3",
    ]);
    const densityRelative: any = firstPath(value, [
        "bottomDensityRelative", "bottom_density_relative", "seabed.densityRelative",
        "environment.boundary.bottom.halfspace.densityRelative",
    ]);
    const bottomDensityKgM3: any = densityKg !== undefined
        ? finiteNumber(densityKg, "bottomDensityKgM3")
        : optionalFiniteNumber(densityRelative, DEFAULT_ENVIRONMENT.bottomDensityKgM3 / 1000, "bottomDensityRelative") * 1000;
    const bottomAttenuationDbPerWavelength: any = optionalFiniteNumber(firstPath(value, [
        "bottomAttenuationDbPerWavelength", "bottom_attenuation_db_per_wavelength",
        "bottomAbsorption", "bottom_absorption", "seabed.attenuationDbPerWavelength",
        "seabed.attenuation_db_per_wavelength", "bottom.attenuationDbPerWavelength",
        "environment.boundary.bottom.halfspace.compressionalAttenuation",
    ]), DEFAULT_ENVIRONMENT.bottomAttenuationDbPerWavelength, "bottomAttenuationDbPerWavelength");
    const angleRangeDegrees: any = jsonAngleRange(value) ?? DEFAULT_ENVIRONMENT.angleRangeDegrees;
    const launchAxis: any = firstPath(value, ["source.launchAngles", "source.launch_angles"]);
    const launchAxisCount: any = isObject(launchAxis) && launchAxis.count !== undefined
        ? launchAxis.count
        : DEFAULT_ENVIRONMENT.beamCount;
    const beamCount: any = optionalFiniteNumber(firstPath(value, [
        "beamCount", "beam_count", "nbeams", "n_beams", "fieldRayCount", "field_ray_count",
        "options.beamCount", "options.beam_count", "source.launchAngleCount",
        "source.launch_angle_count", "source.launchAngles.count", "source.launch_angles.count",
    ]), launchAxisCount, "beamCount");
    const bathymetry: any = normalizedBathymetry(jsonBathymetry(value), waterDepthM, maximumRangeKm);
    return validateCanonicalEnvironment({
        ...(fieldDocument ?? {}),
        title: String(firstPath(value, ["title", "name", "environment.title"])
            ?? options.title ?? "Imported JSON environment"),
        format: options.format ?? fieldDocument?.format ?? "json",
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
function readBellhopAxis(lines: any, start: any, label: any): any {
    if (start >= lines.length)
        throw new SyntaxError(`Bellhop ENV is missing ${label} count`);
    const countTokens: any = numbersIn(beforeSlash(lines[start]));
    if (countTokens.length === 0)
        throw new SyntaxError(`Bellhop ENV has an invalid ${label} count`);
    const count: any = countTokens[0];
    if (!Number.isInteger(count) || count < 1)
        throw new RangeError(`${label} count must be a positive integer`);
    const values: any = countTokens.slice(1);
    let cursor: any = start + 1;
    let terminated: any = lines[start].includes("/");
    while (!terminated && cursor < lines.length) {
        const line: any = lines[cursor];
        values.push(...numbersIn(beforeSlash(line)));
        terminated = line.includes("/") || values.length >= count;
        cursor += 1;
    }
    if (values.length === 0)
        throw new SyntaxError(`Bellhop ENV is missing ${label} values`);
    if (!terminated && values.length < count)
        throw new SyntaxError(`Bellhop ENV has an incomplete ${label} axis`);
    return { count, values, cursor };
}
function parseInlineBellhop(lines: any): any {
    if (lines.length < 8)
        throw new SyntaxError("Bellhop ENV is incomplete");
    const title: any = quotedValue(lines[0]);
    const frequency: any = numbersIn(lines[1])[0];
    const mediaCount: any = numbersIn(lines[2])[0];
    const sspOption: any = optionValue(lines[3]);
    if (title === undefined)
        throw new SyntaxError("Bellhop ENV title must be quoted");
    if (!Number.isFinite(frequency) || frequency <= 0)
        throw new SyntaxError("Bellhop ENV frequency is invalid");
    if (!Number.isInteger(mediaCount) || mediaCount < 1)
        throw new SyntaxError("Bellhop ENV media count is invalid");
    if (sspOption === undefined)
        throw new SyntaxError("Bellhop ENV SSP option is missing or invalid");
    let cursor: any = 4;
    const profilePoints: any = [];
    let waterDepthM: any = 0;
    for (let medium: any = 0; medium < mediaCount; medium += 1) {
        if (cursor >= lines.length)
            throw new SyntaxError(`Bellhop ENV is missing medium ${medium + 1}`);
        const header: any = numbersIn(beforeSlash(lines[cursor]));
        if (header.length < 3)
            throw new SyntaxError(`Bellhop ENV medium ${medium + 1} header is invalid`);
        const mediumBottomM: any = header[2];
        if (!Number.isFinite(mediumBottomM) || mediumBottomM <= waterDepthM) {
            throw new RangeError("Bellhop ENV medium depths must be strictly increasing");
        }
        cursor += 1;
        let reachedBottom: any = false;
        while (cursor < lines.length && optionValue(lines[cursor]) === undefined) {
            const row: any = numbersIn(beforeSlash(lines[cursor]));
            if (row.length >= 2) {
                const point: any = [row[0], row[1]];
                if (profilePoints.length > 0 && sameWithinTolerance(profilePoints.at(-1)[0], point[0])) {
                    profilePoints[profilePoints.length - 1] = point;
                }
                else {
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
        if (!reachedBottom)
            throw new SyntaxError(`Bellhop ENV medium ${medium + 1} profile does not reach its bottom`);
        waterDepthM = mediumBottomM;
    }
    const bottomOption: any = optionValue(lines[cursor]);
    if (bottomOption === undefined)
        throw new SyntaxError("Bellhop ENV bottom option is missing");
    cursor += 1;
    let bottomSoundSpeedMps: any = profilePoints.at(-1)?.[1] ?? DEFAULT_ENVIRONMENT.bottomSoundSpeedMps;
    let bottomDensityKgM3: any = 1000;
    let bottomAttenuationDbPerWavelength: any = 0;
    const halfspace: any = cursor < lines.length ? numbersIn(beforeSlash(lines[cursor])) : [];
    const acousticHalfspace: any = ["A", "G"].includes(bottomOption[0]?.toUpperCase());
    if (halfspace.length >= 4 || (acousticHalfspace && halfspace.length >= 2)) {
        bottomSoundSpeedMps = halfspace[1];
        bottomDensityKgM3 = (halfspace[3] ?? 1) * 1000;
        bottomAttenuationDbPerWavelength = halfspace[4] ?? 0;
        cursor += 1;
    }
    const sourceDepths: any = readBellhopAxis(lines, cursor, "source depth");
    cursor = sourceDepths.cursor;
    const receiverDepths: any = readBellhopAxis(lines, cursor, "receiver depth");
    cursor = receiverDepths.cursor;
    const receiverRanges: any = readBellhopAxis(lines, cursor, "receiver range");
    cursor = receiverRanges.cursor;
    while (cursor < lines.length && optionValue(lines[cursor]) === undefined)
        cursor += 1;
    if (cursor >= lines.length)
        throw new SyntaxError("Bellhop ENV run type is missing");
    const runType: any = optionValue(lines[cursor]);
    cursor += 1;
    const beamTokens: any = cursor < lines.length ? numbersIn(beforeSlash(lines[cursor])) : [];
    if (beamTokens.length === 0)
        throw new SyntaxError("Bellhop ENV beam count is missing");
    const beamCount: any = Math.abs(beamTokens[0]);
    cursor += 1;
    const angles: any = cursor < lines.length ? numbersIn(beforeSlash(lines[cursor])) : [];
    if (angles.length < 2)
        throw new SyntaxError("Bellhop ENV launch-angle range is missing");
    cursor += 1;
    const box: any = cursor < lines.length ? numbersIn(beforeSlash(lines[cursor])) : [];
    const receiverMaximumKm: any = Math.max(...receiverRanges.values);
    const rangeCandidates: any = [receiverMaximumKm, box[2]]
        .filter((value: any): any => Number.isFinite(value) && value > 0);
    const maximumRangeKm: any = rangeCandidates.length === 0
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
export function parseBellhopSsp(source: any, baseProfilePoints: any): any {
    const base: any = arrayValue(baseProfilePoints);
    if (base === null || base.length < 2)
        throw new TypeError("baseProfilePoints is required for a Bellhop SSP sidecar");
    const depths: any = base.map(profilePoint).map((point: any): any => point[0]);
    const tokens: any = numbersIn(bellhopLines(source).join("\n"));
    const rangeCount: any = tokens[0];
    if (!Number.isInteger(rangeCount) || rangeCount < 1)
        throw new SyntaxError("Bellhop SSP range count is invalid");
    const required: any = 1 + rangeCount + rangeCount * depths.length;
    if (tokens.length < required) {
        throw new SyntaxError(`Bellhop SSP is incomplete: expected ${required} numeric values, found ${tokens.length}`);
    }
    const rangesKm: any = tokens.slice(1, 1 + rangeCount);
    const values: any = tokens.slice(1 + rangeCount, required);
    const rangeIndex: any = rangesKm.reduce((best: any, range: any, index: any): any => (Math.abs(range) < Math.abs(rangesKm[best]) ? index : best), 0);
    const profilePoints: any = depths.map((depth: any, depthIndex: any): any => [
        depth,
        values[depthIndex * rangeCount + rangeIndex],
    ]);
    return { rangesKm, selectedRangeKm: rangesKm[rangeIndex], profilePoints };
}
/** Parse a Bellhop `.bty` into `[range km, depth m]` pairs. */
export function parseBellhopBathymetry(source: any): any {
    const lines: any = bellhopLines(source);
    if (lines.length < 3 || optionValue(lines[0]) === undefined) {
        throw new SyntaxError("Bellhop BTY interpolation option is missing");
    }
    const tokens: any = numbersIn(lines.slice(1).join("\n"));
    const count: any = tokens[0];
    if (!Number.isInteger(count) || count < 1)
        throw new SyntaxError("Bellhop BTY point count is invalid");
    if (tokens.length < 1 + count * 2)
        throw new SyntaxError("Bellhop BTY point data is incomplete");
    const points: any = Array.from({ length: count }, (_: any, index: any): any => [
        tokens[1 + index * 2],
        tokens[2 + index * 2],
    ]);
    return { interpolation: optionValue(lines[0]), points };
}
/** Parse a Bellhop ENV string and optional same-stem SSP/BTY sidecar strings. */
export function parseBellhopEnvironment(source: any, options: any = {}): any {
    const parsed: any = parseInlineBellhop(bellhopLines(source));
    let profilePoints: any = parsed.profilePoints;
    let sspRangesKm: any;
    let selectedSspRangeKm: any;
    if (options.sspText !== undefined && options.sspText !== null) {
        const ssp: any = parseBellhopSsp(options.sspText, profilePoints);
        profilePoints = ssp.profilePoints;
        sspRangesKm = ssp.rangesKm;
        selectedSspRangeKm = ssp.selectedRangeKm;
    }
    let bathymetry: any = null;
    let bathymetryInterpolation: any;
    if (options.btyText !== undefined && options.btyText !== null) {
        const bty: any = parseBellhopBathymetry(options.btyText);
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
function documentText(document: any): any {
    if (typeof document.data === "string")
        return document.data;
    if (typeof document.text === "string")
        return document.text;
    const value: any = firstDefined(document.data, document.bytes, document.buffer);
    if (value instanceof ArrayBuffer)
        return new TextDecoder().decode(new Uint8Array(value));
    if (ArrayBuffer.isView(value))
        return new TextDecoder().decode(value);
    throw new TypeError(`environment document ${document.name} has no text or byte data`);
}
function documentBytes(document: any, text: any): any {
    if (typeof document.size === "number" && Number.isFinite(document.size))
        return document.size;
    return new TextEncoder().encode(text).byteLength;
}
/**
 * Pure document parser for Node tests and non-File browser integrations.
 * Documents use `{ name, data: string | Uint8Array }`.
 */
export function parseEnvironmentDocuments(documents: any): any {
    const list: any = Array.from(documents ?? []);
    if (list.length < 1 || list.length > MAX_FILE_COUNT) {
        throw new RangeError(`environment import requires 1 to ${MAX_FILE_COUNT} files`);
    }
    const normalized: any = list.map((document: any): any => {
        if (!isObject(document))
            throw new TypeError("environment document must be an object");
        const name: any = String(document.name ?? "");
        if (!name || name.length > 255 || /[\\/]/.test(name) || name === "." || name === "..") {
            throw new TypeError(`invalid environment filename ${name || "(empty)"}`);
        }
        const text: any = documentText(document);
        return { name, lowerName: name.toLocaleLowerCase("en-US"), text, bytes: documentBytes(document, text) };
    });
    const names: any = new Set();
    for (const document of normalized) {
        if (names.has(document.lowerName))
            throw new TypeError(`duplicate environment filename ${document.name}`);
        names.add(document.lowerName);
    }
    const totalBytes: any = normalized.reduce((sum: any, document: any): any => sum + document.bytes, 0);
    if (totalBytes > MAX_TOTAL_BYTES)
        throw new RangeError("environment import exceeds the 32 MiB limit");
    const primary: any = normalized.filter((document: any): any => /\.(?:env|json)$/i.test(document.name));
    if (primary.length !== 1)
        throw new TypeError("select exactly one .env or .json environment file");
    const extensions: any = normalized.map((document: any): any => document.name.match(/(\.[^.]+)$/)?.[1]?.toLowerCase());
    if (extensions.some((extension: any): any => ![".env", ".json", ".ssp", ".bty"].includes(extension))) {
        throw new TypeError("environment import supports only .env, .ssp, .bty and .json files");
    }
    const sourceFiles: any = normalized.map((document: any): any => document.name);
    const main: any = primary[0];
    const looksLikeJson: any = main.text.replace(/^\uFEFF/, "").trimStart().startsWith("{");
    if (main.lowerName.endsWith(".json") || looksLikeJson) {
        if (normalized.length !== 1)
            throw new TypeError("JSON environment imports do not use Bellhop sidecar files");
        return parseEnvironmentJson(main.text, {
            title: main.name.slice(0, -5),
            sourceFiles,
        });
    }
    const stem: any = main.lowerName.slice(0, -4);
    const companions: any = normalized.filter((document: any): any => document !== main);
    for (const companion of companions) {
        const companionStem: any = companion.lowerName.replace(/\.(?:ssp|bty)$/i, "");
        if (companionStem !== stem) {
            throw new TypeError(`Bellhop companion ${companion.name} must have the same stem as ${main.name}`);
        }
    }
    const ssp: any = companions.find((document: any): any => document.lowerName.endsWith(".ssp"));
    const bty: any = companions.find((document: any): any => document.lowerName.endsWith(".bty"));
    return parseBellhopEnvironment(main.text, {
        sspText: ssp?.text,
        btyText: bty?.text,
        sourceFiles,
    });
}
/** Read browser `File` objects, then delegate to the pure document parser. */
export async function parseEnvironmentFiles(files: any): Promise<any> {
    const list: any = Array.from(files ?? []);
    const documents: any = await Promise.all(list.map(async (file: any): Promise<any> => {
        if (!isObject(file))
            throw new TypeError("environment file must be a File-like object");
        const name: any = String(file.name ?? "");
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
