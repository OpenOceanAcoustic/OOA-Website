import { importEnvironmentDocuments, type EnvironmentDocument } from "@ooa/environment";
import type { RayImportedEnvironment } from "./public-types";

export async function importRayEnvironment(
  documents: readonly EnvironmentDocument[],
): Promise<RayImportedEnvironment> {
  return importEnvironmentDocuments(documents);
}

function finiteHint(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Compatibility DTO for the original Ray page; raw documents stay attached. */
export async function importRayPageEnvironment(documents: readonly EnvironmentDocument[]) {
  const imported = await importRayEnvironment(documents);
  const { environment, modelHints } = imported;
  const maximumBathymetryRangeKm = environment.bathymetry.reduce(
    (maximum, point) => Math.max(maximum, point.rangeM / 1000),
    0,
  );
  const angleRange = Array.isArray(modelHints.angleRangeDegrees)
    ? modelHints.angleRangeDegrees.map(Number).filter(Number.isFinite).slice(0, 2)
    : [];
  return {
    title: environment.title,
    frequency: environment.frequencyHz,
    sourceDepth: finiteHint(modelHints.sourceDepthM, Math.min(1000, environment.waterDepthM / 2)),
    sspPoints: environment.soundSpeedProfile.map((point) => [point.depthM, point.speedMps]),
    bottomSpeed: environment.bottom.soundSpeedMps,
    bottomDensity: environment.bottom.densityKgM3,
    bottomAbsorption: environment.bottom.attenuationDbPerWavelength,
    bathymetry: environment.bathymetry.map((point) => [point.rangeM / 1000, point.depthM]),
    rangeDependent: documents.some((document) => document.kind === "bellhop-ssp"),
    maximumRangeKm: finiteHint(modelHints.maximumRangeKm, maximumBathymetryRangeKm || 100),
    maximumDepthM: environment.waterDepthM,
    angleRangeDegrees: angleRange.length === 2 ? angleRange : [-20, 20],
    fieldRayCount: Math.max(2, Math.round(finiteHint(modelHints.beamCount, 1000))),
    fieldGridRows: 201,
    fieldGridColumns: 201,
    beamType: "GEOMETRIC_CARTESIAN",
    runMode: "INCOHERENT_TL",
    fieldMode: "INCOHERENT_TL",
    documents: imported.documents,
    modelHints,
  };
}
