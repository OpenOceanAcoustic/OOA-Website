import { inferEnvironmentDocumentKind } from "@ooa/environment";
import type { RayRuntime } from "@ooa/runtime-ray";
import { useRayModeStore } from "../state/store";
export async function importRayFiles(runtime: RayRuntime, files: readonly File[]): Promise<void> {
  try {
    const documents = await Promise.all(files.map(async (file) => ({ name: file.name, kind: inferEnvironmentDocumentKind(file.name, "ray"), content: await file.text() })));
    const imported = await runtime.importEnvironment(documents);
    const store = useRayModeStore.getState();
    store.setEnvironment(imported.environment);
    const sourceDepthM = imported.modelHints.sourceDepthM;
    const maximumRangeKm = imported.modelHints.maximumRangeKm;
    const beamCount = imported.modelHints.beamCount;
    const angleRange = imported.modelHints.angleRangeDegrees;
    store.patchParameters({
      ...(typeof sourceDepthM === "number" ? { sourceDepthM } : {}),
      ...(typeof maximumRangeKm === "number" ? { maximumRangeKm } : {}),
      ...(typeof beamCount === "number" ? { beamCount } : {}),
      ...(Array.isArray(angleRange) && typeof angleRange[0] === "number" && typeof angleRange[1] === "number"
        ? { launchMinimumDegrees: angleRange[0], launchMaximumDegrees: angleRange[1] }
        : {}),
    });
  } catch (error) { useRayModeStore.getState().fail(error instanceof Error ? error.message : String(error)); }
}
