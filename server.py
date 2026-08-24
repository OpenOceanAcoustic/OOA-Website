#!/usr/bin/env python3
"""Dependency-free web server for the OpenOcean Bellhop teaching demo.

The ray tracer is a fast, reduced-order preview for interaction. Production
OOB/Bellhop results should be generated with the native solver in the bundled
OpenOcean-Field-RayMode repository.
"""

from __future__ import annotations

import json
import math
import os
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).resolve().parent
DEPTH = 5000.0
MAX_RANGE_KM = 100.0


def sound_speed(profile: str, axis: float, strength: float) -> Callable[[float], float]:
    if profile == "constant":
        return lambda _z: 1500.0

    if profile == "surface":
        # Smooth thermocline plus pressure-driven recovery below the channel axis.
        def surface(z: float) -> float:
            thermocline = 28.0 * math.tanh((axis - z) / 420.0)
            deep = max(0.0, z - axis) * 0.012
            return 1490.0 + strength * (thermocline + deep)
        return surface

    # Canonical analytic Munk profile, with a user-adjustable channel axis.
    epsilon, scale = 0.00737 * strength, 1300.0

    def munk(z: float) -> float:
        eta = 2.0 * (z - axis) / scale
        eta = max(-8.0, min(8.0, eta))
        return 1500.0 * (1.0 + epsilon * (eta + math.exp(-eta) - 1.0))

    return munk


def sound_speed_from_payload(payload: dict) -> tuple[str, Callable[[float], float]]:
    profile = str(payload.get("profile", "munk"))
    if profile == "custom":
        raw_points = payload.get("ssp_points", [])
        points = []
        if isinstance(raw_points, list):
            for raw in raw_points[:64]:
                if isinstance(raw, (list, tuple)) and len(raw) >= 2:
                    z = max(0.0, min(DEPTH, float(raw[0])))
                    c = max(1400.0, min(1650.0, float(raw[1])))
                    points.append((z, c))
        points.sort()
        deduplicated = []
        for point in points:
            if deduplicated and point[0] == deduplicated[-1][0]:
                deduplicated[-1] = point
            else:
                deduplicated.append(point)
        if len(deduplicated) >= 2:
            def custom(z: float) -> float:
                if z <= deduplicated[0][0]:
                    return deduplicated[0][1]
                for left, right in zip(deduplicated, deduplicated[1:]):
                    if z <= right[0]:
                        weight = (z - left[0]) / max(1e-9, right[0] - left[0])
                        return left[1] + weight * (right[1] - left[1])
                return deduplicated[-1][1]
            return profile, custom
        profile = "munk"

    if profile not in {"munk", "surface", "constant"}:
        profile = "munk"
    axis = max(300.0, min(3000.0, float(payload.get("axis_depth", 1300))))
    strength = max(0.2, min(2.0, float(payload.get("gradient", 1.0))))
    return profile, sound_speed(profile, axis, strength)


def bottom_properties(payload: dict) -> tuple[float, float, float]:
    speed = max(1400.0, min(3000.0, float(payload.get("bottom_speed", 1700))))
    density = max(1000.0, min(3500.0, float(payload.get("bottom_density", 1800))))
    absorption = max(0.0, min(5.0, float(payload.get("bottom_absorption", 0.5))))
    return speed, density, absorption


def bottom_reflection_loss_db(fn: Callable[[float], float], payload: dict) -> float:
    speed, density, absorption = bottom_properties(payload)
    water_impedance = 1000.0 * fn(DEPTH)
    bottom_impedance = density * speed
    coefficient = abs((bottom_impedance - water_impedance) / max(1.0, bottom_impedance + water_impedance))
    interface_loss = -20.0 * math.log10(max(0.02, coefficient))
    return max(0.2, min(18.0, 0.35 * interface_loss + 1.5 * absorption))


def derivative(fn: Callable[[float], float], z: float) -> float:
    dz = 3.0
    return (fn(min(DEPTH, z + dz)) - fn(max(0.0, z - dz))) / (2.0 * dz)


def trace_rays(fn: Callable[[float], float], source_depth: float) -> tuple[list[list[list[float]]], list[list[int]]]:
    rays: list[list[list[float]]] = []
    bottom_histories: list[list[int]] = []
    dx_m = 100.0
    steps = int(MAX_RANGE_KM * 1000.0 / dx_m)
    for angle_deg in range(-18, 19, 2):
        z = source_depth
        theta = math.radians(angle_deg)
        ray: list[list[float]] = [[0.0, round(z, 2)]]
        bottom_bounces = 0
        bounce_history = [0]
        for step in range(1, steps + 1):
            c = fn(z)
            # Stratified-medium ray equation, integrated in horizontal range.
            theta += -(derivative(fn, z) / c) * dx_m
            theta = max(-1.42, min(1.42, theta))
            z += math.tan(theta) * dx_m
            if z < 0.0:
                z = -z
                theta = -theta
            elif z > DEPTH:
                z = 2.0 * DEPTH - z
                theta = -theta
                bottom_bounces += 1
            if step % 5 == 0:
                ray.append([round(step * dx_m / 1000.0, 2), round(z, 2)])
                bounce_history.append(bottom_bounces)
        rays.append(ray)
        bottom_histories.append(bounce_history)
    return rays, bottom_histories


def transmission_loss(
    rays: list[list[list[float]]],
    bottom_histories: list[list[int]],
    frequency: float,
    bottom_loss_db: float,
) -> dict:
    cols, rows = 150, 86
    values: list[float] = []
    # Fast ray-density estimate: geometrical spreading + absorption + local
    # concentration. It provides an immediate preview of how ray geometry
    # changes the field while the native OOB solver remains the authority.
    for iz in range(rows):
        z = DEPTH * iz / (rows - 1)
        for ix in range(cols):
            r_km = MAX_RANGE_KM * ix / (cols - 1)
            sample_index = min(len(rays[0]) - 1, round(r_km / MAX_RANGE_KM * (len(rays[0]) - 1)))
            density = 0.0
            for ray, bounce_history in zip(rays, bottom_histories):
                dz = abs(ray[sample_index][1] - z)
                reflection_weight = 10.0 ** (-bottom_loss_db * bounce_history[sample_index] / 20.0)
                density += reflection_weight * math.exp(-0.5 * (dz / 145.0) ** 2)
            spreading = 20.0 * math.log10(max(1.0, r_km * 1000.0))
            absorption = (0.018 + 0.000035 * frequency) * r_km
            focusing = 10.0 * math.log10(1.0 + 7.5 * density)
            texture = 2.0 * math.sin(r_km * 0.38 + z * 0.006) * math.exp(-r_km / 90.0)
            # 16 dB is a display-reference offset: with cylindrical/spherical
            # spreading it keeps the full 0–100 km preview inside 60–120 dB.
            tl = max(60.0, min(120.0, 16.0 + spreading + absorption - focusing + texture))
            values.append(round(tl, 2))
    return {"cols": cols, "rows": rows, "values": values}


def trace_to_range(
    fn: Callable[[float], float],
    source_depth: float,
    angle_deg: float,
    receiver_range_km: float,
    store_path: bool = False,
) -> dict:
    """Trace one ray to an exact horizontal range.

    This uses the same stratified-medium equation as the teaching field, but
    at a smaller range step. Boundary hit counts are retained because OOB's
    precise eigenray search only brackets roots with matching topology.
    """
    dx_m = 50.0
    target_m = receiver_range_km * 1000.0
    steps = max(1, math.ceil(target_m / dx_m))
    z = source_depth
    theta = math.radians(angle_deg)
    path_length = 0.0
    travel_time = 0.0
    top_bounces = 0
    bottom_bounces = 0
    path: list[list[float]] = [[0.0, round(z, 3)]] if store_path else []
    x_m = 0.0

    for step in range(1, steps + 1):
        step_x = min(dx_m, target_m - x_m)
        if step_x <= 0.0:
            break
        c = fn(z)
        theta += -(derivative(fn, z) / c) * step_x
        theta = max(-1.48, min(1.48, theta))
        dz = math.tan(theta) * step_x
        z += dz
        ds = math.hypot(step_x, dz)
        path_length += ds
        travel_time += ds / max(c, 1.0)
        x_m += step_x

        while z < 0.0 or z > DEPTH:
            if z < 0.0:
                z = -z
                theta = -theta
                top_bounces += 1
            elif z > DEPTH:
                z = 2.0 * DEPTH - z
                theta = -theta
                bottom_bounces += 1

        if store_path and (step % 5 == 0 or x_m >= target_m):
            path.append([round(x_m / 1000.0, 4), round(z, 3)])

    return {
        "depth": z,
        "arrival_angle": math.degrees(theta),
        "top_bounces": top_bounces,
        "bottom_bounces": bottom_bounces,
        "travel_time": travel_time,
        "path_length": path_length,
        "path": path,
    }


def precise_eigenrays(payload: dict) -> dict:
    """Find receiver-hitting rays with topology-aware bracketing and bisection."""
    profile, fn = sound_speed_from_payload(payload)
    source = max(20.0, min(DEPTH - 20.0, float(payload.get("source_depth", 1000))))
    frequency = max(20.0, min(10000.0, float(payload.get("frequency", 500))))
    receiver_range = max(5.0, min(95.0, float(payload.get("receiver_range", 50))))
    receiver_depth = max(20.0, min(DEPTH - 20.0, float(payload.get("receiver_depth", 1000))))
    tolerance = max(0.05, min(25.0, float(payload.get("tolerance", 1.0))))
    bottom_loss = bottom_reflection_loss_db(fn, payload)

    coarse_angles = [float(a) for a in range(-35, 36, 2)]
    coarse = []
    nearest_miss = float("inf")
    for angle in coarse_angles:
        hit = trace_to_range(fn, source, angle, receiver_range, store_path=True)
        nearest_miss = min(nearest_miss, abs(hit["depth"] - receiver_depth))
        coarse.append({"angle": angle, "miss_m": round(hit["depth"] - receiver_depth, 2), "path": hit["path"]})

    # A denser scan discovers root brackets; each bracket is valid only when
    # surface/bottom bounce counts match at both ends.
    scan = []
    scan_step = 0.5
    angle = -35.0
    while angle <= 35.0001:
        hit = trace_to_range(fn, source, angle, receiver_range)
        scan.append((angle, hit, hit["depth"] - receiver_depth))
        angle += scan_step

    brackets = []
    for left, right in zip(scan, scan[1:]):
        la, lh, lf = left
        ra, rh, rf = right
        same_topology = (
            lh["top_bounces"] == rh["top_bounces"]
            and lh["bottom_bounces"] == rh["bottom_bounces"]
        )
        if same_topology and (lf == 0.0 or rf == 0.0 or lf * rf < 0.0):
            brackets.append((la, ra, lh["top_bounces"], lh["bottom_bounces"]))

    roots = []
    total_iterations = 0
    for lower, upper, target_top, target_bottom in brackets:
        lower_hit = trace_to_range(fn, source, lower, receiver_range)
        lower_f = lower_hit["depth"] - receiver_depth
        best_angle = lower
        best_hit = lower_hit
        for iteration in range(36):
            total_iterations += 1
            middle = (lower + upper) * 0.5
            middle_hit = trace_to_range(fn, source, middle, receiver_range)
            middle_f = middle_hit["depth"] - receiver_depth
            if (
                middle_hit["top_bounces"] != target_top
                or middle_hit["bottom_bounces"] != target_bottom
            ):
                # Keep the half whose topology remains the bracket topology.
                upper = middle
                continue
            if abs(middle_f) < abs(best_hit["depth"] - receiver_depth):
                best_angle, best_hit = middle, middle_hit
            if abs(middle_f) <= tolerance or abs(upper - lower) < 1e-8:
                break
            if lower_f * middle_f <= 0.0:
                upper = middle
            else:
                lower, lower_f = middle, middle_f

        exact = trace_to_range(fn, source, best_angle, receiver_range, store_path=True)
        residual = exact["depth"] - receiver_depth
        if abs(residual) > tolerance:
            continue
        if any(abs(best_angle - item["launch_angle"]) < 0.01 for item in roots):
            continue
        path_km = exact["path_length"] / 1000.0
        absorption = (0.018 + 0.000035 * frequency) * path_km
        reflection_loss = 1.2 * exact["top_bounces"] + bottom_loss * exact["bottom_bounces"]
        ray_tl = 16.0 + 20.0 * math.log10(max(1.0, exact["path_length"])) + absorption + reflection_loss
        amplitude = 10.0 ** (-ray_tl / 20.0)
        phase = (360.0 * frequency * exact["travel_time"] + 180.0 * exact["top_bounces"]) % 360.0
        visual = trace_to_range(
            fn,
            source,
            best_angle,
            min(100.0, receiver_range + 1.0),
            store_path=True,
        )
        roots.append({
            "launch_angle": best_angle,
            "arrival_angle": exact["arrival_angle"],
            "residual_m": residual,
            "top_bounces": exact["top_bounces"],
            "bottom_bounces": exact["bottom_bounces"],
            "travel_time_s": exact["travel_time"],
            "amplitude": amplitude,
            "phase_deg": phase,
            "path_length_km": path_km,
            "path": visual["path"],
        })

    roots.sort(key=lambda item: item["travel_time_s"])
    pressure_real = sum(item["amplitude"] * math.cos(math.radians(item["phase_deg"])) for item in roots)
    pressure_imag = sum(item["amplitude"] * math.sin(math.radians(item["phase_deg"])) for item in roots)
    incoherent_power = sum(item["amplitude"] ** 2 for item in roots)
    coherent_tl = -20.0 * math.log10(max(1e-12, math.hypot(pressure_real, pressure_imag)))
    incoherent_tl = -10.0 * math.log10(max(1e-24, incoherent_power))

    serialized = []
    for index, item in enumerate(roots, 1):
        top, bottom = item["top_bounces"], item["bottom_bounces"]
        if top and bottom:
            kind = "海面+海底"
        elif top:
            kind = "海面反射"
        elif bottom:
            kind = "海底反射"
        else:
            kind = "直达/折射"
        serialized.append({
            "id": index,
            "kind": kind,
            **{key: (round(value, 7) if isinstance(value, float) else value) for key, value in item.items()},
        })

    return {
        "receiver": {"range_km": receiver_range, "depth_m": receiver_depth},
        "coarse_rays": coarse,
        "eigenrays": serialized,
        "nearest_coarse_miss_m": round(nearest_miss, 2),
        "tolerance_m": tolerance,
        "iterations": total_iterations,
        "coherent_tl_db": round(coherent_tl, 2),
        "incoherent_tl_db": round(incoherent_tl, 2),
        "bottom_reflection_loss_db": round(bottom_loss, 3),
        "engine": "OOB_PRECISE_EIGENRAY_PREVIEW",
    }


def simulate(payload: dict) -> dict:
    profile, fn = sound_speed_from_payload(payload)
    source = max(20.0, min(DEPTH - 20.0, float(payload.get("source_depth", 1000))))
    frequency = max(20.0, min(10000.0, float(payload.get("frequency", 500))))
    ssp = [[z, round(fn(z), 3)] for z in range(0, int(DEPTH) + 1, 50)]
    rays, bottom_histories = trace_rays(fn, source)
    bottom_loss = bottom_reflection_loss_db(fn, payload)
    speed, density, absorption = bottom_properties(payload)
    return {
        "profile": profile,
        "ssp": ssp,
        "rays": rays,
        "loss": transmission_loss(rays, bottom_histories, frequency, bottom_loss),
        "bottom": {
            "speed_mps": speed,
            "density_kgm3": density,
            "absorption_db_per_wavelength": absorption,
            "reflection_loss_db": round(bottom_loss, 3),
        },
    }


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        clean = path.split("?", 1)[0].split("#", 1)[0].lstrip("/") or "index.html"
        target = (ROOT / clean).resolve()
        if target != ROOT and ROOT not in target.parents:
            return str(ROOT / "__not_found__")
        return str(target)

    def do_POST(self) -> None:  # noqa: N802
        if self.path not in {"/api/simulate", "/api/eigenrays"}:
            self.send_error(404)
            return
        try:
            length = min(int(self.headers.get("Content-Length", "0")), 65536)
            payload = json.loads(self.rfile.read(length) or b"{}")
            started = time.perf_counter()
            result = precise_eigenrays(payload) if self.path == "/api/eigenrays" else simulate(payload)
            result["compute_ms"] = round((time.perf_counter() - started) * 1000.0, 2)
            body = json.dumps(result, separators=(",", ":")).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            self.send_error(400, str(exc))

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"[OOB Web] {self.address_string()} - {fmt % args}")


def main() -> None:
    host = os.environ.get("OOB_WEB_HOST", "127.0.0.1")
    port = int(os.environ.get("OOB_WEB_PORT", "8000"))
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"OpenOcean Bellhop lab: http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
