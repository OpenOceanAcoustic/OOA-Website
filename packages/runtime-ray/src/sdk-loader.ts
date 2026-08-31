import {
  AttenuationUnit,
  AxisInput,
  BeamType,
  BeamWidthType,
  Bellhop2D,
  Bellhop2DInput,
  Bellhop2DOutputRequest,
  BoundaryCondition,
  BoundaryInterpolation,
  RunMode,
  RunStatus,
  SspInterpolation,
  VolumeAttenuation,
} from "@openocean/field-bellhop-2d";
import { RuntimeError } from "@ooa/runtime-core";
import type { RayFieldRequest, RaySdkAdapter, RaySdkRequest, RaySdkResult } from "./public-types";

// Transitional compatibility surface for the parity controller. Keeping this
// export here preserves the rule that the model package is only resolved by
// the runtime SDK loader while the old page behavior is migrated behind the
// typed RayRuntime interface.
export {
  AttenuationUnit,
  AxisInput,
  BeamType,
  BeamWidthType,
  Bellhop2D,
  Bellhop2DInput,
  BoundaryCondition,
  BoundaryInterpolation,
  RunMode,
  RunStatus,
  SspInterpolation,
  VolumeAttenuation,
};

const beamTypes = {
  "geometric-cartesian": BeamType.GEOMETRIC_CARTESIAN,
  "geometric-ray-centered": BeamType.GEOMETRIC_RAY_CENTERED,
  "gaussian-cartesian": BeamType.GAUSSIAN_CARTESIAN,
  "gaussian-ray-centered": BeamType.GAUSSIAN_RAY_CENTERED,
  "gaussian-simple": BeamType.GAUSSIAN_SIMPLE,
} as const;
const fieldModes = {
  coherent: RunMode.COHERENT_TL,
  incoherent: RunMode.INCOHERENT_TL,
  semicoherent: RunMode.SEMICOHERENT_TL,
} as const;

function empty(): Float64Array<ArrayBuffer> {
  return new Float64Array(0);
}

function buildInput({ kind, request }: RaySdkRequest) {
  const profile = request.environment.soundSpeedProfile;
  const depthsM = Float64Array.from(profile, (point) => point.depthM);
  const speedsMps = Float64Array.from(profile, (point) => point.speedMps);
  const zeros = new Float64Array(depthsM.length);
  const density = new Float64Array(depthsM.length).fill(1);
  const halfspace = (surface: boolean) => ({
    depthM: surface ? 0 : request.environment.waterDepthM,
    compressionalSpeedMps: surface ? 0 : request.environment.bottom.soundSpeedMps,
    compressionalAttenuation: surface ? 0 : request.environment.bottom.attenuationDbPerWavelength,
    shearSpeedMps: 0,
    shearAttenuation: 0,
    densityRelative: surface ? 0 : request.environment.bottom.densityKgM3 / 1000,
    grainSize: 0,
  });
  const boundaryPoints = request.environment.bathymetry.map((point) => ({ ...point }));
  const environment = {
    title: request.environment.title,
    frequencyHz: request.environment.frequencyHz,
    frequenciesHz: empty(),
    ssp: {
      depthsM,
      compressionalSpeedMps: speedsMps,
      densityRelative: density,
      compressionalAttenuation: zeros,
      shearSpeedMps: zeros,
      shearAttenuation: zeros,
      interpolation: SspInterpolation.C_LINEAR,
      attenuationUnit: AttenuationUnit.DB_PER_WAVELENGTH,
      volumeAttenuation: VolumeAttenuation.NONE,
      temperatureCelsius: 20,
      salinityPsu: 35,
      ph: 8,
      meanDepthM: request.environment.waterDepthM / 2,
    },
    boundary: {
      surface: {
        condition: BoundaryCondition.VACUUM,
        interpolation: BoundaryInterpolation.NONE,
        halfspace: halfspace(true),
        points: [],
        pointMaterials: [],
      },
      bottom: {
        condition: BoundaryCondition.HALF_SPACE,
        interpolation: boundaryPoints.length > 1
          ? BoundaryInterpolation.LINEAR_SHORT
          : BoundaryInterpolation.NONE,
        halfspace: halfspace(false),
        points: boundaryPoints,
        pointMaterials: [],
      },
    },
  };
  const outputRequest = kind === "field"
    ? Bellhop2DOutputRequest.coherentField()
    : Bellhop2DOutputRequest.rayTrace();
  const builder = Bellhop2DInput.easyStart({
    environment,
    source: { depths: AxisInput.explicit([request.sourceDepthM]) },
    receivers: {
      depths: AxisInput.explicit(request.receiverDepthsM),
      ranges: AxisInput.explicit(request.receiverRangesM),
      radialVelocityMps: 0,
    },
    outputRequest,
  });
  const angles = request.launchAnglesDegrees;
  const minimum = angles[0] ?? -30;
  const maximum = angles.at(-1) ?? 30;
  builder.source().launchAngles(AxisInput.linspace(minimum, maximum, request.beamCount), false);
  builder.options().maximumRangeM(request.receiverRangesM.at(-1) ?? 0);
  builder.options().maximumDepthM(request.environment.waterDepthM);
  builder.options().beamType(beamTypes[request.beamType]);
  builder.options().velocityEnabled(request.velocityEnabled);
  builder.options().runMode(kind === "eigenrays" ? RunMode.EIGENRAY : fieldModes[request.fieldMode]);
  return builder.build();
}

export async function loadRaySdk(): Promise<RaySdkAdapter> {
  try {
    const recommended = Bellhop2D.recommendedRuntime();
    const runtime = import.meta.env.DEV
      ? { ...recommended, executionMode: "SINGLE_THREAD" as const, threadCount: 1 }
      : recommended;
    const backend = await Bellhop2D.create(runtime);
    return {
      info: {
        packageName: "@openocean/field-bellhop-2d",
        packageVersion: "2.0.0",
        model: "Bellhop2D",
        executionMode: runtime.executionMode,
        threadCount: runtime.threadCount,
        memoryLimitBytes: runtime.memoryLimitBytes,
      },
      async run(request, signal): Promise<RaySdkResult> {
        const input = buildInput(request);
        const validation = await backend.validate(input);
        if (!validation.valid) {
          throw new RuntimeError("INPUT_INVALID", validation.issues.map((issue) => issue.message).join("; "));
        }
        const onAbort = () => backend.cancel();
        signal.addEventListener("abort", onAbort, { once: true });
        try {
          const outcome = await backend.run(input);
          if (outcome.result === null || outcome.status !== "SUCCEEDED") {
            throw new RuntimeError("RUN_FAILED", `Bellhop2D ended with ${outcome.status}`);
          }
          const totalTimeMs = outcome.report?.totalTimeMs ?? outcome.result.report().totalTimeMs;
          if (request.kind === "field") {
            const field = outcome.result.pressureField();
            return {
              kind: "field",
              receiverRangesM: field.receiverRangesM,
              receiverDepthsM: field.receiverDepthsM,
              transmissionLossDb: field.transmissionLossDb,
              validityMask: field.validityMask,
              totalTimeMs,
            };
          }
          const rays = outcome.result.rays();
          return { kind: "eigenrays", ...rays, totalTimeMs };
        } finally {
          signal.removeEventListener("abort", onAbort);
        }
      },
      cancel: () => backend.cancel(),
      dispose: async () => backend.dispose(),
    };
  } catch (error) {
    throw new RuntimeError("SDK_LOAD_FAILED", "无法加载本地 Bellhop2D WASM SDK", { cause: error });
  }
}
