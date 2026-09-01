import { importEnvironmentDocuments, type EnvironmentDocument } from "@ooa/environment";

function finiteHint(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Maps common document metadata to the original Normal Mode page contract. */
export async function importNormalModePageEnvironment(documents: readonly EnvironmentDocument[]) {
  const imported = await importEnvironmentDocuments(documents);
  const { environment, modelHints } = imported;
  return {
    environment,
    title: environment.title,
    frequencyHz: environment.frequencyHz,
    waterDepthM: environment.waterDepthM,
    sourceDepthM: finiteHint(modelHints.sourceDepthM, Math.min(50, environment.waterDepthM - 1)),
    maximumRangeKm: finiteHint(modelHints.maximumRangeKm, 20),
    profilePoints: environment.soundSpeedProfile.map((point) => [point.depthM, point.speedMps] as const),
    bathymetry: environment.bathymetry.map((point) => [point.rangeM / 1000, point.depthM] as const),
    bottomSoundSpeedMps: environment.bottom.soundSpeedMps,
    bottomDensityKgM3: environment.bottom.densityKgM3,
    bottomAttenuationDbPerWavelength: environment.bottom.attenuationDbPerWavelength,
    interpolation: "LINEAR",
    documents: imported.documents,
    modelHints,
  };
}
