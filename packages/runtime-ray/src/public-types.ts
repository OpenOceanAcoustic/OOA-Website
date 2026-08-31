import type { RuntimeInfo, RuntimeLifecycle } from "@ooa/runtime-core";
import type { ImportedModelEnvironment } from "@ooa/environment";

export type NumericPair = readonly [number, number];

export interface RayPageRequest {
  readonly profile: string;
  readonly axis_depth: number;
  readonly gradient: number;
  readonly water_depth_m: number;
  readonly source_depth: number;
  readonly frequency: number;
  readonly bottom_speed: number;
  readonly bottom_density: number;
  readonly bottom_absorption: number;
  readonly beam_type: string;
  readonly field_mode: string;
  readonly ssp_points?: readonly NumericPair[];
  readonly maximum_range_km?: number;
  readonly bathymetry?: readonly NumericPair[] | null;
  readonly angle_range_degrees?: readonly number[];
  readonly beam_count?: number;
  readonly receiver_range?: number;
  readonly receiver_depth?: number;
  readonly tolerance?: number;
  readonly include_equal_angle_comparison?: boolean;
}

export interface RayImportedEnvironment extends ImportedModelEnvironment, Readonly<Record<string, unknown>> {
  readonly title: string;
  readonly sourceFiles: readonly string[];
  readonly sspPoints: readonly NumericPair[];
  readonly maximumRangeKm: number;
  readonly maximumDepthM: number;
  readonly angleRangeDegrees: readonly number[];
  readonly fieldRayCount: number;
  readonly fieldGridRows: number;
  readonly fieldGridColumns: number;
  readonly beamType: string;
  readonly runMode: string;
  readonly rangeDependent: boolean;
}

export interface RayPageResult {
  readonly profile: string;
  readonly ssp: readonly NumericPair[];
  readonly rays: readonly (readonly NumericPair[])[];
  readonly ray_angles_deg: readonly number[];
  readonly loss: {
    readonly cols: number;
    readonly rows: number;
    readonly values: Float32Array;
  };
  readonly velocity: {
    readonly cols: number;
    readonly rows: number;
    readonly horizontal_db: Float32Array;
    readonly vertical_db: Float32Array;
    readonly minimum_db: number;
    readonly maximum_db: number;
    readonly model: string;
    readonly available: boolean;
  };
  readonly display_ray_count: number;
  readonly field_ray_count: number;
  readonly requested_field_ray_count: number;
  readonly field_memory_bytes: number;
  readonly angle_range_degrees: readonly [number, number];
  readonly maximum_range_km: number;
  readonly maximum_depth_m: number;
  readonly bathymetry: readonly NumericPair[];
  readonly field_mode: string;
  readonly beam_type: string;
  readonly thread_count: number;
  readonly bottom: {
    readonly speed_mps: number;
    readonly density_kgm3: number;
    readonly absorption_db_per_wavelength: number;
  };
  readonly compute_ms: number;
  readonly engine: string;
}

export interface EigenrayPath {
  readonly id: number;
  readonly kind: string;
  readonly launch_angle: number;
  readonly arrival_angle: number;
  readonly arrival_valid: boolean;
  readonly residual_m: number;
  readonly top_bounces: number;
  readonly bottom_bounces: number;
  readonly travel_time_s: number | null;
  readonly amplitude: number | null;
  readonly phase_deg: number | null;
  readonly path_length_km: number;
  readonly path: readonly NumericPair[];
}

export interface EigenrayPageResult {
  readonly receiver: { readonly range_km: number; readonly depth_m: number };
  readonly maximum_range_km: number;
  readonly maximum_depth_m: number;
  readonly bathymetry: readonly NumericPair[];
  readonly launch_angle_count: number;
  readonly receiver_count: number;
  readonly receiver_grid_shape: readonly [number, number];
  readonly comparison_included: boolean;
  readonly comparison_skip_reason: string | null;
  readonly angle_range_degrees: readonly [number, number];
  readonly equal_angle_eigenrays: readonly EigenrayPath[];
  readonly eigenrays: readonly EigenrayPath[];
  readonly equal_angle_residual_rmse_m: number | null;
  readonly precise_residual_rmse_m: number;
  readonly tolerance_m: number;
  readonly iterations: number | null;
  readonly coherent_tl_db: number;
  readonly incoherent_tl_db: number;
  readonly thread_count: number;
  readonly compute_ms: number;
  readonly engine: string;
}

export interface RayRuntimeAdapter {
  prepare(): Promise<RuntimeInfo>;
  importEnvironment(files: readonly File[]): Promise<RayImportedEnvironment>;
  runField(request: RayPageRequest): Promise<RayPageResult>;
  findEigenrays(request: RayPageRequest): Promise<EigenrayPageResult>;
  cancel(reason?: string): void;
  dispose(): Promise<void>;
}

export interface RayRuntime extends RuntimeLifecycle {
  importEnvironment(files: readonly File[]): Promise<RayImportedEnvironment>;
  runField(request: RayPageRequest): Promise<RayPageResult>;
  findEigenrays(request: RayPageRequest): Promise<EigenrayPageResult>;
}
