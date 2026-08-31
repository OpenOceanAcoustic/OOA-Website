import {
  AcousticAttenuationUnit,
  BoundaryKind,
  Kraken,
  KrakenInput,
  KrakenOutputRequest,
  SourceModel,
  WaveguideInterpolation,
} from "@openocean/field-normal-mode-kraken";
import { RuntimeError } from "@ooa/runtime-core";
import { transmissionLossFromPressure } from "./result-mapper";
import type { NormalModeRequest, NormalModeSdkAdapter } from "./public-types";

/** Internal model-module access for the original-page runtime facade. */
export function loadNormalModeSdkModule() {
  return import("@openocean/field-normal-mode-kraken");
}

function buildInput(request: NormalModeRequest) {
  const depthsM = Float64Array.from(request.environment.soundSpeedProfile, (point) => point.depthM);
  const compressionalSpeedMps = Float64Array.from(request.environment.soundSpeedProfile, (point) => point.speedMps);
  const zeros = new Float64Array(depthsM.length);
  const density = new Float64Array(depthsM.length).fill(1);
  const attenuationUnit = AcousticAttenuationUnit.DB_PER_WAVELENGTH;
  const environment = {
    title: request.environment.title,
    frequencyHz: request.environment.frequencyHz,
    profiles: [{
      beginRangeM: 0,
      interpolation: WaveguideInterpolation.LINEAR,
      layers: [{
        id: "water",
        elastic: false,
        meshPoints: request.meshPoints,
        compressionalAttenuationUnit: attenuationUnit,
        shearAttenuationUnit: attenuationUnit,
        depthsM,
        compressionalSpeedMps,
        shearSpeedMps: zeros,
        densityRelative: density,
        compressionalAttenuation: zeros,
        shearAttenuation: zeros,
      }],
      top: {
        kind: BoundaryKind.VACUUM,
        compressionalSpeedMps: 0,
        compressionalAttenuation: 0,
        shearSpeedMps: 0,
        shearAttenuation: 0,
        densityRelative: 0,
        attenuationUnit,
      },
      bottom: {
        kind: BoundaryKind.MATERIAL_HALF_SPACE,
        compressionalSpeedMps: request.environment.bottom.soundSpeedMps,
        compressionalAttenuation: request.environment.bottom.attenuationDbPerWavelength,
        shearSpeedMps: 0,
        shearAttenuation: 0,
        densityRelative: request.environment.bottom.densityKgM3 / 1000,
        attenuationUnit,
      },
    }],
    phaseSpeedLowMps: Math.min(...compressionalSpeedMps) - 100,
    phaseSpeedHighMps: Math.max(request.environment.bottom.soundSpeedMps, ...compressionalSpeedMps) + 100,
  };
  const builder = KrakenInput.easyStart({
    environment,
    source: {
      depthsM: Float64Array.of(request.sourceDepthM),
      model: SourceModel.POINT,
      directivity: [{ angleDegrees: -90, amplitude: 1 }, { angleDegrees: 90, amplitude: 1 }],
    },
    receivers: { rangesM: request.receiverRangesM, depthsM: request.receiverDepthsM },
    outputRequest: KrakenOutputRequest.modesAndField(),
  });
  builder.options().modeLimit(request.modeLimit);
  builder.options().meshPointsPerLayer(request.meshPoints);
  return builder.build();
}

export async function loadNormalModeSdk(): Promise<NormalModeSdkAdapter> {
  try {
    const recommended = Kraken.recommendedRuntime();
    const runtime = import.meta.env.DEV
      ? { ...recommended, executionMode: "SINGLE_THREAD" as const, threadCount: 1 }
      : recommended;
    const backend = await Kraken.create(runtime);
    return {
      info: {
        packageName: "@openocean/field-normal-mode-kraken",
        packageVersion: "2.0.0",
        model: "Kraken",
        executionMode: runtime.executionMode,
        threadCount: runtime.threadCount,
        memoryLimitBytes: runtime.memoryLimitBytes,
      },
      async run(request, signal) {
        const input = buildInput(request);
        const validation = await backend.validate(input);
        if (!validation.valid) throw new RuntimeError("INPUT_INVALID", validation.issues.map((issue) => issue.message).join("; "));
        const onAbort = () => backend.cancel();
        signal.addEventListener("abort", onAbort, { once: true });
        try {
          const outcome = await backend.run(input);
          if (!outcome.succeeded || outcome.result === null) throw new RuntimeError("RUN_FAILED", `Kraken ended with ${outcome.status}`);
          const field = outcome.result.pressureField();
          const modes = outcome.result.modes();
          return {
            sourceDepthM: field.sourceDepthM,
            receiverRangesM: field.receiverRangesM as Float64Array,
            receiverDepthsM: field.receiverDepthsM as Float64Array,
            transmissionLossDb: transmissionLossFromPressure(field.pressureInterleaved, field.receiverRangesM.length, field.receiverDepthsM.length),
            modeCounts: modes.modeCounts as Uint32Array,
            depthCounts: modes.depthCounts as Uint32Array,
            depthOffsets: modes.depthOffsets as Uint32Array,
            shapeOffsets: modes.shapeOffsets as Uint32Array,
            wavenumberOffsets: modes.wavenumberOffsets as Uint32Array,
            depthsM: modes.depthsM as Float64Array,
            wavenumbersInterleaved: modes.wavenumbersInterleaved as Float64Array,
            groupVelocityMps: modes.groupVelocityMps as Float64Array,
            modeShapesInterleaved: modes.modeShapesInterleaved as Float64Array,
            totalTimeMs: outcome.timing.totalNs / 1e6,
          };
        } finally {
          signal.removeEventListener("abort", onAbort);
        }
      },
      cancel: () => backend.cancel(),
      dispose: async () => backend.dispose(),
    };
  } catch (error) {
    throw new RuntimeError("SDK_LOAD_FAILED", "无法加载本地 Kraken WASM SDK", { cause: error });
  }
}
