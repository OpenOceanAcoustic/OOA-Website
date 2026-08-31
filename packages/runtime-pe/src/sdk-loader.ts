import { OutputMode, RAM, RAMInput } from "@openocean/field-pe-ram";
import { RuntimeError } from "@ooa/runtime-core";
import type { PeRequest, PeSdkAdapter } from "./public-types";

/** Model-module access used only by the original-page parity adapter. */
export function loadLegacyPeSdkModule() {
  return import("@openocean/field-pe-ram");
}

function profile(depthsM: ArrayLike<number>, values: ArrayLike<number>) {
  return { depthsM: Float64Array.from(depthsM), values: Float64Array.from(values) };
}

function buildInput(request: PeRequest) {
  const depthsM = Float64Array.from(request.environment.soundSpeedProfile, (point) => point.depthM);
  const speedsMps = Float64Array.from(request.environment.soundSpeedProfile, (point) => point.speedMps);
  const bottomDepths = Float64Array.of(0, request.maximumDepthM);
  const bathymetry = request.environment.bathymetry.length > 1
    ? request.environment.bathymetry
    : [{ rangeM: 0, depthM: request.environment.waterDepthM }, { rangeM: request.maximumRangeM, depthM: request.environment.waterDepthM }];
  const builder = RAMInput.easyStart({
    environment: {
      title: request.environment.title,
      frequencyHz: request.environment.frequencyHz,
      referenceSoundSpeedMps: 1500,
      bathymetry,
      mediumSections: [{
        activationRangeM: 0,
        waterSoundSpeedMps: profile(depthsM, speedsMps),
        bottomCompressionalSpeedMps: profile(bottomDepths, [request.environment.bottom.soundSpeedMps, request.environment.bottom.soundSpeedMps]),
        bottomDensityKgM3: profile(bottomDepths, [request.environment.bottom.densityKgM3, request.environment.bottom.densityKgM3]),
        bottomCompressionalAttenuationDbPerWavelength: profile(bottomDepths, [request.environment.bottom.attenuationDbPerWavelength, request.environment.bottom.attenuationDbPerWavelength]),
      }],
    },
    source: { depthM: request.sourceDepthM, rangeM: 0 },
    receivers: { depthsM: request.receiverDepthsM },
    outputRequest: {
      maximumRangeM: request.maximumRangeM,
      maximumDepthM: request.maximumDepthM,
      plotMaximumDepthM: request.maximumDepthM,
      outputMode: OutputMode.IN_MEMORY,
    },
  });
  builder.options().rangeGrid(request.rangeStepM, request.rangeDecimation);
  builder.options().depthGrid(request.depthStepM, request.depthDecimation);
  builder.options().padeTerms(request.nPade);
  return builder.build();
}

export async function loadPeSdk(): Promise<PeSdkAdapter> {
  try {
    const runtime = { ...RAM.recommendedRuntime(), threadCount: 1 };
    const backend = await RAM.create(runtime);
    return {
      info: { packageName: "@openocean/field-pe-ram", packageVersion: "2.0.0", model: "RAM", executionMode: "SINGLE_THREAD", threadCount: runtime.threadCount, memoryLimitBytes: runtime.memoryLimitBytes },
      async run(request, signal) {
        const input = buildInput(request);
        const validation = await backend.validate(input);
        if (!validation.valid) throw new RuntimeError("INPUT_INVALID", validation.issues.map((issue) => issue.message).join("; "));
        const onAbort = () => backend.cancel();
        signal.addEventListener("abort", onAbort, { once: true });
        try {
          const outcome = await backend.run(input);
          if (!outcome.succeeded || outcome.result === null) throw new RuntimeError("RUN_FAILED", `RAM ended with ${outcome.status}`);
          const field = outcome.result.pressureField();
          const line = outcome.result.transmissionLossLine();
          return {
            receiverRangesM: field.receiverRangesM as Float64Array,
            receiverDepthsM: field.receiverDepthsM as Float64Array,
            transmissionLossDb: field.transmissionLossDb as Float32Array,
            validityMask: field.validityMask as Uint8Array,
            lineRangesM: line.rangesM as Float64Array,
            lineTransmissionLossDb: line.transmissionLossDb as Float32Array,
            totalTimeMs: outcome.timing.totalNs / 1e6,
          };
        } finally { signal.removeEventListener("abort", onAbort); }
      },
      cancel: () => backend.cancel(),
      dispose: async () => backend.dispose(),
    };
  } catch (error) { throw new RuntimeError("SDK_LOAD_FAILED", "无法加载本地 RAM WASM SDK", { cause: error }); }
}
