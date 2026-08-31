import { importEnvironmentDocuments, type EnvironmentDocument } from "@ooa/environment";

export function importNormalModeEnvironment(documents: readonly EnvironmentDocument[]) {
  return importEnvironmentDocuments(documents);
}

function finiteHint(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Compatibility DTO for the original Normal Mode page. */
export async function importNormalModePageEnvironment(documents: readonly EnvironmentDocument[]) {
  const imported = await importNormalModeEnvironment(documents);
  const { environment, modelHints } = imported;
  return {
    title: environment.title,
    frequencyHz: environment.frequencyHz,
    waterDepthM: environment.waterDepthM,
    sourceDepthM: finiteHint(modelHints.sourceDepthM, Math.min(50, environment.waterDepthM - 1)),
    maximumRangeKm: finiteHint(modelHints.maximumRangeKm, 20),
    profilePoints: environment.soundSpeedProfile.map((point) => [point.depthM, point.speedMps]),
    bathymetry: environment.bathymetry.map((point) => [point.rangeM / 1000, point.depthM]),
    bottomSoundSpeedMps: environment.bottom.soundSpeedMps,
    bottomDensityKgM3: environment.bottom.densityKgM3,
    bottomAttenuationDbPerWavelength: environment.bottom.attenuationDbPerWavelength,
    interpolation: "LINEAR",
    documents: imported.documents,
    modelHints,
  };
}
