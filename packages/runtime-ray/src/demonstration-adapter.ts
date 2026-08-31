import { RuntimeError } from "@ooa/runtime-core";
import type {
  EigenrayPageResult,
  NumericPair,
  RayPageRequest,
  RayPageResult,
  RayRuntimeAdapter,
} from "./public-types";

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

function demonstrationField(request: RayPageRequest): RayPageResult {
  const rows = 101;
  const cols = 151;
  const maximumRangeKm = clamp(request.maximum_range_km ?? 100, 2, 100);
  const maximumDepthM = Math.max(50, request.water_depth_m);
  const loss = new Float32Array(rows * cols);
  const horizontal = new Float32Array(loss.length);
  const vertical = new Float32Array(loss.length);
  for (let depth = 0; depth < rows; depth += 1) {
    for (let range = 0; range < cols; range += 1) {
      const offset = depth * cols + range;
      const value = 48 + 42 * range / (cols - 1) + 8 * Math.sin(depth * 0.17 + range * 0.09) ** 2;
      loss[offset] = value;
      horizontal[offset] = clamp(value + 5 * Math.sin(range * 0.05), 30, 120);
      vertical[offset] = clamp(value + 7 * Math.cos(depth * 0.08), 30, 120);
    }
  }
  const rays = Array.from({ length: 50 }, (_, index): readonly NumericPair[] => (
    Array.from({ length: 121 }, (__, point): NumericPair => {
      const rangeKm = maximumRangeKm * point / 120;
      const angle = -20.3 + 40.6 * index / 49;
      const depthM = clamp(request.source_depth + Math.tan(angle * Math.PI / 180) * rangeKm * 260, 0, maximumDepthM);
      return [rangeKm, depthM];
    })
  ));
  const ssp: readonly NumericPair[] = request.ssp_points?.length
    ? request.ssp_points
    : [[0, 1500], [maximumDepthM, 1500]];
  return {
    profile: request.profile,
    ssp,
    rays,
    ray_angles_deg: Array.from({ length: 50 }, (_, index) => -20.3 + 40.6 * index / 49),
    loss: { cols, rows, values: loss },
    velocity: {
      cols, rows, horizontal_db: horizontal, vertical_db: vertical,
      minimum_db: 30, maximum_db: 120, model: "DEMONSTRATION", available: true,
    },
    display_ray_count: 50,
    field_ray_count: 1000,
    requested_field_ray_count: 1000,
    field_memory_bytes: loss.byteLength * 3,
    angle_range_degrees: [-20.3, 20.3],
    maximum_range_km: maximumRangeKm,
    maximum_depth_m: maximumDepthM,
    bathymetry: request.bathymetry ?? [[0, maximumDepthM], [maximumRangeKm, maximumDepthM]],
    field_mode: request.field_mode,
    beam_type: request.beam_type,
    thread_count: 1,
    bottom: {
      speed_mps: request.bottom_speed,
      density_kgm3: request.bottom_density,
      absorption_db_per_wavelength: request.bottom_absorption,
    },
    compute_ms: 0,
    engine: "EXPLICIT_DEMONSTRATION_ADAPTER",
  };
}

function demonstrationEigenrays(request: RayPageRequest): EigenrayPageResult {
  const rangeKm = clamp(request.receiver_range ?? 50, 2, request.maximum_range_km ?? 100);
  const depthM = clamp(request.receiver_depth ?? 1000, 20, request.water_depth_m - 20);
  const path: readonly NumericPair[] = [[0, request.source_depth], [rangeKm, depthM]];
  const ray = {
    id: 1, kind: "直达/折射", launch_angle: 0, arrival_angle: 0,
    arrival_valid: true, residual_m: 0, top_bounces: 0, bottom_bounces: 0,
    travel_time_s: rangeKm * 1000 / 1500, amplitude: 0.01, phase_deg: 0,
    path_length_km: rangeKm, path,
  };
  return {
    receiver: { range_km: rangeKm, depth_m: depthM },
    maximum_range_km: request.maximum_range_km ?? 100,
    maximum_depth_m: request.water_depth_m,
    bathymetry: request.bathymetry ?? [[0, request.water_depth_m], [rangeKm, request.water_depth_m]],
    launch_angle_count: 1000,
    receiver_count: 1,
    receiver_grid_shape: [1, 1],
    comparison_included: true,
    comparison_skip_reason: null,
    angle_range_degrees: [-20.3, 20.3],
    equal_angle_eigenrays: [ray],
    eigenrays: [ray],
    equal_angle_residual_rmse_m: 0,
    precise_residual_rmse_m: 0,
    tolerance_m: request.tolerance ?? 1,
    iterations: null,
    coherent_tl_db: 40,
    incoherent_tl_db: 40,
    thread_count: 1,
    compute_ms: 0,
    engine: "EXPLICIT_DEMONSTRATION_ADAPTER",
  };
}

export function createRayDemonstrationAdapter(): RayRuntimeAdapter {
  return {
    prepare: async () => ({
      packageName: "@ooa/runtime-ray", packageVersion: "0.1.0", model: "Ray demonstration",
      executionMode: "SINGLE_THREAD", threadCount: 1, memoryLimitBytes: 0,
    }),
    importEnvironment: async () => { throw new RuntimeError("INPUT_INVALID", "演示模式不导入 Bellhop 原生文件"); },
    runField: async (request) => demonstrationField(request),
    findEigenrays: async (request) => demonstrationEigenrays(request),
    cancel: () => undefined,
    dispose: async () => undefined,
  };
}
