"""In-process adapter from the teaching API to OOB Bellhop2D.

All acoustic calculations in this module are executed by the native OOB
solver.  Python only builds typed inputs and serializes the read-only NumPy
views owned by Bellhop's ``ResultHandle``.
"""

from __future__ import annotations

import math
import os
from typing import Any


DEPTH_M = 5000.0
MAX_RANGE_M = 100_000.0
LAUNCH_ANGLE_COUNT = 1000
FIELD_RANGE_COUNT = 201
FIELD_DEPTH_COUNT = 201
ANGLE_MIN_DEG = -20.3
ANGLE_MAX_DEG = 20.3
DEFAULT_THREAD_COUNT = max(1, (os.cpu_count() or 1) // 2)


class OOBUnavailableError(RuntimeError):
    """Raised when the compiled OOB Python package is not installed."""


def _api() -> dict[str, Any]:
    try:
        import numpy as np
        from openocean_field.ray_mode import (
            AxisInput,
            Bellhop2D,
            Bellhop2DEnvironment,
            Bellhop2DInput,
            Bellhop2DReceivers,
            BoundaryCondition,
            BoundaryInput,
            BoundarySideInput,
            HalfspaceInput,
            RunMode,
            SSP1DInput,
        )
    except (ImportError, ModuleNotFoundError) as exc:
        raise OOBUnavailableError(
            "OOB Python 接口不可用。请先在 OpenOcean-Field-RayMode 目录执行 "
            "`python3 -m pip install .`，再重新启动 server.py。"
        ) from exc
    return locals()


def ensure_available() -> None:
    """Fail with an actionable message before starting an acoustic run."""
    _api()


def _clamp(value: Any, lower: float, upper: float) -> float:
    return max(lower, min(upper, float(value)))


def _profile_samples(payload: dict[str, Any]) -> tuple[str, list[float], list[float]]:
    profile = str(payload.get("profile", "munk"))
    if profile == "custom":
        samples: dict[float, float] = {}
        raw_points = payload.get("ssp_points", [])
        if isinstance(raw_points, list):
            for raw in raw_points[:64]:
                if isinstance(raw, (list, tuple)) and len(raw) >= 2:
                    depth = _clamp(raw[0], 0.0, DEPTH_M)
                    samples[depth] = _clamp(raw[1], 1400.0, 1650.0)
        if len(samples) >= 2:
            ordered = sorted(samples.items())
            return profile, [item[0] for item in ordered], [item[1] for item in ordered]
        profile = "munk"

    axis = _clamp(payload.get("axis_depth", 1300.0), 300.0, 3000.0)
    strength = _clamp(payload.get("gradient", 1.0), 0.2, 2.0)
    depths = [float(depth) for depth in range(0, int(DEPTH_M) + 1, 50)]
    speeds: list[float] = []
    for depth in depths:
        if profile == "constant":
            speed = 1500.0
        elif profile == "surface":
            thermocline = 28.0 * math.tanh((axis - depth) / 420.0)
            deep = max(0.0, depth - axis) * 0.012
            speed = 1490.0 + strength * (thermocline + deep)
        else:
            profile = "munk"
            eta = max(-8.0, min(8.0, 2.0 * (depth - axis) / 1300.0))
            speed = 1500.0 * (
                1.0 + 0.00737 * strength * (eta + math.exp(-eta) - 1.0)
            )
        speeds.append(float(speed))
    return profile, depths, speeds


def _bottom(payload: dict[str, Any]) -> tuple[float, float, float]:
    return (
        _clamp(payload.get("bottom_speed", 1700.0), 1400.0, 3000.0),
        _clamp(payload.get("bottom_density", 1800.0), 1000.0, 3500.0),
        _clamp(payload.get("bottom_absorption", 0.5), 0.0, 5.0),
    )


def _input(
    payload: dict[str, Any],
    *,
    run_mode: Any,
    launch_count: int,
    receiver_depths: Any,
    receiver_ranges: Any,
) -> tuple[Any, str, list[float], list[float]]:
    api = _api()
    profile, depths, speeds = _profile_samples(payload)
    bottom_speed, bottom_density, bottom_absorption = _bottom(payload)
    frequency = _clamp(payload.get("frequency", 500.0), 20.0, 10_000.0)
    source_depth = _clamp(payload.get("source_depth", 1000.0), 20.0, DEPTH_M - 20.0)

    ssp = api["SSP1DInput"](
        depths_metres=tuple(depths),
        compressional_speed_metres_per_second=tuple(speeds),
        density_relative=tuple(1.0 for _ in depths),
        mean_depth_metres=DEPTH_M * 0.5,
    )
    bottom = api["BoundarySideInput"](
        condition=api["BoundaryCondition"].HALF_SPACE,
        halfspace=api["HalfspaceInput"](
            depth_metres=DEPTH_M,
            compressional_speed_metres_per_second=bottom_speed,
            compressional_attenuation=bottom_absorption,
            density_relative=bottom_density / 1000.0,
        ),
    )
    environment = api["Bellhop2DEnvironment"](
        title="OOB interactive Munk laboratory",
        frequency_hz=frequency,
        ssp=ssp,
        boundary=api["BoundaryInput"](bottom=bottom),
    )
    receivers = api["Bellhop2DReceivers"](
        depths=receiver_depths,
        ranges=receiver_ranges,
    )
    value = api["Bellhop2DInput"].easy_start(
        environment=environment,
        source_depths=api["AxisInput"].explicit([source_depth]),
        receivers=receivers,
        run_mode=run_mode,
    )
    value.source.launch_angles = api["AxisInput"].linspace(
        ANGLE_MIN_DEG, ANGLE_MAX_DEG, launch_count
    )
    value.options.beam.maximum_range_metres = MAX_RANGE_M + 1000.0
    value.options.beam.maximum_depth_metres = DEPTH_M + 100.0
    value.options.beam.step_metres = 0.0
    # Convert the receiver-depth tolerance into the angular convergence scale
    # used by OOB's precise tracker. The native solver still decides all roots.
    receiver_range = max(1.0, _axis_max(receiver_ranges))
    tolerance_m = _clamp(payload.get("tolerance", 1.0), 0.05, 25.0)
    value.options.beam.tolerance_radians = max(1.0e-10, tolerance_m / receiver_range)
    return value, profile, depths, speeds


def _axis_max(axis: Any) -> float:
    if axis.values:
        return max(float(value) for value in axis.values)
    return max(float(axis.start), float(axis.end))


def _run(value: Any) -> Any:
    api = _api()
    solver = api["Bellhop2D"](
        thread_count=DEFAULT_THREAD_COUNT,
        memory_limit_bytes=768 * 1024 * 1024,
    )
    solver.set_input(value)
    return solver.run()


def _clip_path(points: Any, stop_range_m: float | None = None, limit: int = 420) -> list[list[float]]:
    """Serialize one native ray, preserving boundary and final points."""
    np = _api()["np"]
    values = np.asarray(points, dtype=np.float64)
    if values.size == 0:
        return []
    if stop_range_m is not None and values[-1, 0] > stop_range_m:
        before = np.nonzero(values[:, 0] <= stop_range_m)[0]
        last = int(before[-1]) if before.size else 0
        clipped = values[: last + 1]
        if last + 1 < values.shape[0] and values[last, 0] < stop_range_m:
            left, right = values[last], values[last + 1]
            weight = (stop_range_m - left[0]) / max(1.0e-12, right[0] - left[0])
            end = left + weight * (right - left)
            clipped = np.vstack((clipped, end))
        values = clipped
    if values.shape[0] > limit:
        indices = np.linspace(0, values.shape[0] - 1, limit, dtype=np.int64)
        values = values[indices]
    return [[round(float(x) / 1000.0, 4), round(float(z), 3)] for x, z in values]


def _ray_views(ray_set: Any) -> list[dict[str, Any]]:
    rays: list[dict[str, Any]] = []
    for index, angle in enumerate(ray_set.launch_angles_degrees):
        start = int(ray_set.offsets[index])
        stop = int(ray_set.offsets[index + 1])
        rays.append({
            "angle": float(angle),
            "points": ray_set.points_m[start:stop],
        })
    return rays


def _arrivals(result: Any) -> list[dict[str, Any]]:
    np = _api()["np"]
    arrival_set = result.arrivals()
    if arrival_set.offsets.size < 2:
        return []
    start, stop = int(arrival_set.offsets[0]), int(arrival_set.offsets[1])
    values: list[dict[str, Any]] = []
    for index in range(start, stop):
        amplitude = complex(arrival_set.amplitudes[index])
        values.append({
            "launch_angle": float(arrival_set.source_angles_degrees[index]),
            "arrival_angle": float(arrival_set.receiver_angles_degrees[index]),
            "travel_time_s": float(np.real(arrival_set.delays_s[index])),
            "amplitude_complex": amplitude,
            "amplitude": abs(amplitude),
            "phase_deg": float(np.degrees(np.angle(amplitude)) % 360.0),
            "top_bounces": int(arrival_set.top_bounces[index]),
            "bottom_bounces": int(arrival_set.bottom_bounces[index]),
        })
    return values


def _depth_at_range(points: Any, target_m: float) -> float:
    np = _api()["np"]
    values = np.asarray(points, dtype=np.float64)
    if values.size == 0:
        return float("nan")
    crossings = np.nonzero(values[:, 0] >= target_m)[0]
    if not crossings.size:
        return float(values[-1, 1])
    right_index = int(crossings[0])
    if right_index == 0:
        return float(values[0, 1])
    left, right = values[right_index - 1], values[right_index]
    weight = (target_m - left[0]) / max(1.0e-12, right[0] - left[0])
    return float(left[1] + weight * (right[1] - left[1]))


def _path_length_km(points: Any, stop_range_m: float) -> float:
    np = _api()["np"]
    path = np.asarray(_clip_path(points, stop_range_m, limit=10_000), dtype=np.float64)
    if path.shape[0] < 2:
        return 0.0
    # _clip_path returns range in kilometres and depth in metres.
    delta_range_m = np.diff(path[:, 0]) * 1000.0
    delta_depth_m = np.diff(path[:, 1])
    return float(np.hypot(delta_range_m, delta_depth_m).sum() / 1000.0)


def _kind(top: int, bottom: int) -> str:
    if top and bottom:
        return "海面+海底"
    if top:
        return "海面反射"
    if bottom:
        return "海底反射"
    return "直达/折射"


def _combine_rays(
    ray_result: Any,
    arrival_result: Any,
    receiver_range_m: float,
    receiver_depth_m: float,
) -> list[dict[str, Any]]:
    rays = _ray_views(ray_result.rays())
    arrivals = _arrivals(arrival_result)
    available = set(range(len(arrivals)))
    coarse_step = (ANGLE_MAX_DEG - ANGLE_MIN_DEG) / (LAUNCH_ANGLE_COUNT - 1)
    match_tolerance_deg = max(1.0e-4, 1.5 * coarse_step)
    combined: list[dict[str, Any]] = []
    for ray in rays:
        candidates = [
            index for index in available
            if abs(arrivals[index]["launch_angle"] - ray["angle"])
            <= match_tolerance_deg
        ]
        if candidates:
            match = min(candidates, key=lambda index: abs(
                arrivals[index]["launch_angle"] - ray["angle"]
            ))
            available.remove(match)
            arrival = arrivals[match]
            arrival_valid = True
        else:
            arrival = {
                "launch_angle": ray["angle"], "arrival_angle": 0.0,
                "travel_time_s": None, "amplitude": None, "phase_deg": None,
                "top_bounces": 0, "bottom_bounces": 0,
                "amplitude_complex": 0j,
            }
            arrival_valid = False
        residual = _depth_at_range(ray["points"], receiver_range_m) - receiver_depth_m
        combined.append({
            "kind": (
                _kind(arrival["top_bounces"], arrival["bottom_bounces"])
                if arrival_valid else "无到达记录"
            ),
            "launch_angle": float(ray["angle"]),
            "arrival_angle": arrival["arrival_angle"],
            "arrival_valid": arrival_valid,
            "residual_m": residual,
            "top_bounces": arrival["top_bounces"],
            "bottom_bounces": arrival["bottom_bounces"],
            "travel_time_s": arrival["travel_time_s"],
            "amplitude": arrival["amplitude"],
            "phase_deg": arrival["phase_deg"],
            "path_length_km": _path_length_km(ray["points"], receiver_range_m),
            "path": _clip_path(ray["points"], min(MAX_RANGE_M, receiver_range_m + 1000.0)),
            "_pressure": arrival["amplitude_complex"],
        })
    combined.sort(key=lambda item: (
        not item["arrival_valid"],
        item["travel_time_s"] if item["arrival_valid"] else item["launch_angle"],
    ))
    return combined


def _serialize(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    serialized: list[dict[str, Any]] = []
    for index, item in enumerate(items, 1):
        serialized.append({
            "id": index,
            **{
                key: (round(value, 7) if isinstance(value, float) else value)
                for key, value in item.items()
                if not key.startswith("_")
            },
        })
    return serialized


def simulate(payload: dict[str, Any]) -> dict[str, Any]:
    api = _api()
    ranges = api["AxisInput"].linspace(100.0, MAX_RANGE_M, FIELD_RANGE_COUNT)
    depths = api["AxisInput"].linspace(0.0, DEPTH_M, FIELD_DEPTH_COUNT)

    ray_input, profile, ssp_depths, ssp_speeds = _input(
        payload,
        run_mode=api["RunMode"].RAY,
        launch_count=19,
        receiver_depths=depths,
        receiver_ranges=ranges,
    )
    field_input, _, _, _ = _input(
        payload,
        run_mode=api["RunMode"].INCOHERENT_TL,
        launch_count=LAUNCH_ANGLE_COUNT,
        receiver_depths=depths,
        receiver_ranges=ranges,
    )
    field_input.options.velocity_enabled = True
    ray_set = _run(ray_input).rays()
    field_result = _run(field_input)
    field = field_result.pressure_field()
    np = api["np"]
    tl = np.asarray(field.transmission_loss_db, dtype=np.float64)
    tl = np.nan_to_num(tl, nan=100.0, posinf=100.0, neginf=40.0)
    tl = np.clip(tl, 40.0, 100.0)
    # Native OOB particle-velocity components. The high-level PressureField
    # wrapper currently forwards pressure only, while the owning native
    # ResultHandle exposes both enabled velocity fields as read-only arrays.
    horizontal_velocity = np.asarray(
        field_result._handle.horizontal_velocity[0], dtype=np.complex64
    )
    vertical_velocity = np.asarray(
        field_result._handle.vertical_velocity[0], dtype=np.complex64
    )

    def velocity_level(component: Any) -> Any:
        level = -20.0 * np.log10(np.maximum(
            np.abs(component), np.finfo(np.float32).tiny
        ))
        level = np.nan_to_num(level, nan=120.0, posinf=120.0, neginf=30.0)
        return np.clip(level, 30.0, 120.0)

    horizontal_level = velocity_level(horizontal_velocity)
    vertical_level = velocity_level(vertical_velocity)
    bottom_speed, bottom_density, bottom_absorption = _bottom(payload)
    ray_views = _ray_views(ray_set)
    ray_paths = [_clip_path(ray["points"], MAX_RANGE_M) for ray in ray_views]

    return {
        "profile": profile,
        "ssp": [[depth, round(speed, 3)] for depth, speed in zip(ssp_depths, ssp_speeds)],
        "rays": ray_paths,
        "ray_angles_deg": [round(ray["angle"], 7) for ray in ray_views],
        "loss": {
            "cols": int(field.receiver_ranges_m.size),
            "rows": int(field.receiver_depths_m.size),
            "values": [round(float(value), 2) for value in tl.reshape(-1)],
        },
        "velocity": {
            "cols": int(field.receiver_ranges_m.size),
            "rows": int(field.receiver_depths_m.size),
            "horizontal_db": [
                round(float(value), 2) for value in horizontal_level.reshape(-1)
            ],
            "vertical_db": [
                round(float(value), 2) for value in vertical_level.reshape(-1)
            ],
            "minimum_db": 30.0,
            "maximum_db": 120.0,
            "model": "OOB_NATIVE_RESULT_HANDLE_VELOCITY",
        },
        "display_ray_count": len(ray_paths),
        "field_ray_count": LAUNCH_ANGLE_COUNT,
        "field_mode": "INCOHERENT_TL",
        "thread_count": DEFAULT_THREAD_COUNT,
        "bottom": {
            "speed_mps": bottom_speed,
            "density_kgm3": bottom_density,
            "absorption_db_per_wavelength": bottom_absorption,
        },
        "engine": "OOB_BELLHOP2D_NATIVE_MEMORY",
    }


def precise_eigenrays(payload: dict[str, Any]) -> dict[str, Any]:
    api = _api()
    receiver_range_km = _clamp(payload.get("receiver_range", 50.0), 5.0, 95.0)
    receiver_depth_m = _clamp(payload.get("receiver_depth", 1000.0), 20.0, DEPTH_M - 20.0)
    receiver_range_m = receiver_range_km * 1000.0
    receiver_ranges = api["AxisInput"].explicit([receiver_range_m])
    receiver_depths = api["AxisInput"].explicit([receiver_depth_m])

    def configured(mode: Any) -> Any:
        return _input(
            payload,
            run_mode=mode,
            launch_count=LAUNCH_ANGLE_COUNT,
            receiver_depths=receiver_depths,
            receiver_ranges=receiver_ranges,
        )[0]

    # Only the two eigenray methods are evaluated. A separate R-mode fan is
    # intentionally omitted because it does not contribute to either result.
    equal_ray_result = _run(configured(api["RunMode"].EIGENRAY))
    equal_arrival_result = _run(configured(api["RunMode"].ARRIVALS))
    precise_ray_result = _run(configured(api["RunMode"].PARTICLE_RAY))
    precise_arrival_result = _run(configured(api["RunMode"].PARTICLE_ARRIVALS))

    equal = _combine_rays(
        equal_ray_result, equal_arrival_result, receiver_range_m, receiver_depth_m
    )
    precise = _combine_rays(
        precise_ray_result, precise_arrival_result, receiver_range_m, receiver_depth_m
    )
    pressure = sum((item["_pressure"] for item in precise if item["arrival_valid"]), 0j)
    incoherent_power = sum(
        item["amplitude"] ** 2 for item in precise if item["arrival_valid"]
    )
    coherent_tl = -20.0 * math.log10(max(1.0e-30, abs(pressure)))
    incoherent_tl = -10.0 * math.log10(max(1.0e-30, incoherent_power))

    equal_rmse = math.sqrt(
        sum(item["residual_m"] ** 2 for item in equal) / max(1, len(equal))
    )
    precise_rmse = math.sqrt(
        sum(item["residual_m"] ** 2 for item in precise) / max(1, len(precise))
    )
    return {
        "receiver": {"range_km": receiver_range_km, "depth_m": receiver_depth_m},
        "launch_angle_count": LAUNCH_ANGLE_COUNT,
        "angle_range_degrees": [ANGLE_MIN_DEG, ANGLE_MAX_DEG],
        "equal_angle_eigenrays": _serialize(equal),
        "eigenrays": _serialize(precise),
        "equal_angle_residual_rmse_m": round(equal_rmse, 4),
        "precise_residual_rmse_m": round(precise_rmse, 4),
        "tolerance_m": _clamp(payload.get("tolerance", 1.0), 0.05, 25.0),
        "iterations": None,
        "coherent_tl_db": round(coherent_tl, 2),
        "incoherent_tl_db": round(incoherent_tl, 2),
        "thread_count": DEFAULT_THREAD_COUNT,
        "engine": "OOB_BELLHOP2D_MODE_E_PC_MEMORY",
    }
