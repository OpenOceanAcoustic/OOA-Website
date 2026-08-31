import { importEnvironmentDocuments } from "@ooa/environment";
import type { RuntimeInfo } from "@ooa/runtime-core";
import type { EigenrayRequest, EigenrayResult, RayFieldRequest, RayFieldResult, RayRuntime } from "@ooa/runtime-ray";
import type { NormalModeRequest, NormalModeResult, NormalModeRuntime } from "@ooa/runtime-normal-mode";
import type { PeRequest, PeResult, PeRuntime } from "@ooa/runtime-pe";

function info(packageName: string, model: string): RuntimeInfo { return { packageName, packageVersion: "fake", model, executionMode: "FAKE", threadCount: 0, memoryLimitBytes: 0 }; }
abstract class FakeLifecycle { cancelled = false; disposed = false; cancel(): void { this.cancelled = true; } async dispose(): Promise<void> { this.disposed = true; } }

export class FakeRayRuntime extends FakeLifecycle implements RayRuntime {
  async prepare() { return info("@ooa/testkit/ray", "Bellhop2D fake"); }
  async importEnvironment(files: Parameters<RayRuntime["importEnvironment"]>[0]) { return importEnvironmentDocuments(files); }
  async runField(request: RayFieldRequest): Promise<RayFieldResult> { return { kind: "field", receiverRangesM: request.receiverRangesM, receiverDepthsM: request.receiverDepthsM, transmissionLossDb: new Float64Array(request.receiverRangesM.length * request.receiverDepthsM.length).fill(60), validityMask: new Uint8Array(request.receiverRangesM.length * request.receiverDepthsM.length).fill(1), totalTimeMs: 0 }; }
  async findEigenrays(_request: EigenrayRequest): Promise<EigenrayResult> { return { kind: "eigenrays", offsets: new Uint32Array([0, 2]), launchAnglesDegrees: new Float64Array([0]), pointsM: new Float64Array([0, 0, 1, 1]), totalTimeMs: 0 }; }
}
export class FakeNormalModeRuntime extends FakeLifecycle implements NormalModeRuntime {
  async prepare() { return info("@ooa/testkit/normal", "Kraken fake"); }
  async importEnvironment(files: Parameters<NormalModeRuntime["importEnvironment"]>[0]) { return importEnvironmentDocuments(files); }
  async run(request: NormalModeRequest): Promise<NormalModeResult> { return { sourceDepthM: request.sourceDepthM, receiverRangesM: request.receiverRangesM, receiverDepthsM: request.receiverDepthsM, transmissionLossDb: new Float32Array(request.receiverRangesM.length * request.receiverDepthsM.length).fill(60), modeCounts: new Uint32Array([1]), depthCounts: new Uint32Array([request.receiverDepthsM.length]), depthOffsets: new Uint32Array([0, request.receiverDepthsM.length]), shapeOffsets: new Uint32Array([0, request.receiverDepthsM.length]), wavenumberOffsets: new Uint32Array([0, 1]), depthsM: request.receiverDepthsM, wavenumbersInterleaved: new Float64Array([1, 0]), groupVelocityMps: new Float64Array([1500]), modeShapesInterleaved: new Float64Array(request.receiverDepthsM.length * 2).fill(1), totalTimeMs: 0 }; }
}
export class FakePeRuntime extends FakeLifecycle implements PeRuntime {
  async prepare() { return info("@ooa/testkit/pe", "RAM fake"); }
  async importEnvironment(files: Parameters<PeRuntime["importEnvironment"]>[0]) { return importEnvironmentDocuments(files); }
  async run(request: PeRequest): Promise<PeResult> { const receiverRangesM = Float64Array.of(0, request.maximumRangeM); const length = receiverRangesM.length * request.receiverDepthsM.length; return { receiverRangesM, receiverDepthsM: request.receiverDepthsM, transmissionLossDb: new Float32Array(length).fill(60), validityMask: new Uint8Array(length).fill(1), lineRangesM: receiverRangesM, lineTransmissionLossDb: new Float32Array(receiverRangesM.length).fill(60), totalTimeMs: 0 }; }
}
