import { importEnvironmentDocuments, type EnvironmentDocument } from "@ooa/environment";
export function importPeEnvironment(documents: readonly EnvironmentDocument[]) { return importEnvironmentDocuments(documents); }

function finiteHint(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Compatibility DTO for the original PE page. */
export async function importPePageEnvironment(documents: readonly EnvironmentDocument[]) {
  const imported = await importPeEnvironment(documents);
  const { environment, modelHints } = imported;
  return {
    title: environment.title,
    frequencyHz: environment.frequencyHz,
    waterDepthM: environment.waterDepthM,
    sourceDepthM: finiteHint(modelHints.sourceDepthM, Math.min(50, environment.waterDepthM - 1)),
    maximumRangeKm: finiteHint(modelHints.maximumRangeKm, 20),
    maximumDepthM: finiteHint(modelHints.maximumDepthM, environment.waterDepthM),
    rangeStepM: finiteHint(modelHints.rangeStepM, 10),
    depthStepM: finiteHint(modelHints.depthStepM, 2),
    nPade: Math.round(finiteHint(modelHints.nPade, 4)),
    profilePoints: environment.soundSpeedProfile.map((point) => [point.depthM, point.speedMps]),
    bathymetry: environment.bathymetry.map((point) => [point.rangeM / 1000, point.depthM]),
    bottomSoundSpeedMps: environment.bottom.soundSpeedMps,
    bottomDensityKgM3: environment.bottom.densityKgM3,
    bottomAttenuationDbPerWavelength: environment.bottom.attenuationDbPerWavelength,
    documents: imported.documents,
    modelHints,
  };
}
