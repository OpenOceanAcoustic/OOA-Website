import {
  parseEnvironmentFiles,
  validateCanonicalEnvironment,
} from "@ooa/environment/browser-import";
import type {
  NumericPair,
  RayImportedEnvironment,
  RayRuntime,
} from "./public-types";

export interface RayCanonicalEnvironment extends Readonly<Record<string, unknown>> {
  readonly title: string;
  readonly format: string;
  readonly profilePoints: readonly NumericPair[];
  readonly waterDepthM: number;
  readonly frequencyHz: number;
  readonly sourceDepthM: number;
  readonly maximumRangeKm: number;
  readonly bottomSoundSpeedMps: number;
  readonly bottomDensityKgM3: number;
  readonly bottomAttenuationDbPerWavelength: number;
  readonly bathymetry: readonly NumericPair[];
  readonly angleRangeDegrees: readonly [number, number];
  readonly beamCount: number;
}

export type AdaptiveRayEnvironmentImport =
  | {
    readonly mode: "native";
    readonly environment: RayImportedEnvironment;
  }
  | {
    readonly mode: "canonical";
    readonly environment: RayCanonicalEnvironment;
    readonly nativeFailure?: string;
  };

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "string" && error.trim()) return error.trim();
  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") return serialized;
  } catch {
    // Fall through to the stable unknown-error label.
  }
  return "未知错误";
}

export class AdaptiveRayEnvironmentImportError extends Error {
  readonly nativeError: unknown;
  readonly canonicalError: unknown;

  constructor(nativeError: unknown, canonicalError: unknown) {
    const nativeMessage = errorMessage(nativeError);
    const canonicalMessage = errorMessage(canonicalError);
    super("Bellhop2D 原生解析失败：" + nativeMessage
      + "；自适应 canonical 解析失败：" + canonicalMessage);
    this.name = "AdaptiveRayEnvironmentImportError";
    this.nativeError = nativeError;
    this.canonicalError = canonicalError;
  }
}

async function importCanonical(files: readonly File[]): Promise<RayCanonicalEnvironment> {
  const parsed: unknown = await parseEnvironmentFiles(files);
  // Keep the fallback fail-closed: the light parser must produce the complete,
  // strictly validated canonical contract before the page can use it.
  return validateCanonicalEnvironment(parsed) as RayCanonicalEnvironment;
}

/**
 * Prefer the native Bellhop2D importer for ENV files. If that parser rejects an
 * otherwise valid ENV, fall back to the strict canonical parser so the page can
 * run it through the custom-environment path. JSON is canonical by definition
 * and therefore bypasses the native importer. The canonical parser accepts only
 * ENV/JSON plus SSP/BTY; unsupported ATI/SBP/etc. companions fail explicitly.
 */
export async function importAdaptiveRayEnvironment(
  runtime: Pick<RayRuntime, "importEnvironment">,
  files: readonly File[],
): Promise<AdaptiveRayEnvironmentImport> {
  const unsupported = files
    .map((file) => file.name)
    .filter((name) => !/\.(?:env|json|ssp|bty)$/i.test(name));
  if (unsupported.length > 0) {
    throw new TypeError(
      "Ray 环境导入尚不支持这些伴随文件：" + unsupported.join(", ")
      + "；目前仅支持 .env、.ssp、.bty 和 .json",
    );
  }

  const hasEnv = files.some((file) => /\.env$/i.test(file.name));
  if (!hasEnv) {
    return { mode: "canonical", environment: await importCanonical(files) };
  }

  try {
    return { mode: "native", environment: await runtime.importEnvironment(files) };
  } catch (nativeError) {
    try {
      return {
        mode: "canonical",
        environment: await importCanonical(files),
        nativeFailure: errorMessage(nativeError),
      };
    } catch (canonicalError) {
      throw new AdaptiveRayEnvironmentImportError(nativeError, canonicalError);
    }
  }
}
