import type { NormalModeResult } from "./public-types";

const MINIMUM_PRESSURE = 1.1754943508222875e-38;

function multiply(ar: number, ai: number, br: number, bi: number): [number, number] {
  return [ar * br - ai * bi, ar * bi + ai * br];
}

function divide(ar: number, ai: number, br: number, bi: number): [number, number] {
  const denominator = br * br + bi * bi;
  if (!(denominator > 0)) throw new RangeError("horizontal wavenumber must be non-zero");
  return [(ar * br + ai * bi) / denominator, (ai * br - ar * bi) / denominator];
}

function squareRoot(real: number, imaginary: number): [number, number] {
  const magnitude = Math.hypot(real, imaginary);
  return [
    Math.sqrt(Math.max(0, (magnitude + real) / 2)),
    Math.sign(imaginary || 1) * Math.sqrt(Math.max(0, (magnitude - real) / 2)),
  ];
}

function sample(result: NormalModeResult, modeIndex: number, depthIndex: number): [number, number] {
  const depthCount = result.depthCounts[0] ?? 0;
  const offset = ((result.shapeOffsets[0] ?? 0) + modeIndex * depthCount + depthIndex) * 2;
  return [result.modeShapesInterleaved[offset] ?? 0, result.modeShapesInterleaved[offset + 1] ?? 0];
}

function interpolate(result: NormalModeResult, modeIndex: number, depthM: number): [number, number] {
  const depthOffset = result.depthOffsets[0] ?? 0;
  const depthCount = result.depthCounts[0] ?? 0;
  if (depthCount < 2) throw new RangeError("at least two mode-shape depths are required");
  const depth = (index: number) => result.depthsM[depthOffset + index] ?? 0;
  if (depthM <= depth(0)) return sample(result, modeIndex, 0);
  if (depthM >= depth(depthCount - 1)) return sample(result, modeIndex, depthCount - 1);
  let low = 0;
  let high = depthCount - 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (depth(middle) <= depthM) low = middle;
    else high = middle;
  }
  const fraction = (depthM - depth(low)) / Math.max(Number.EPSILON, depth(high) - depth(low));
  const left = sample(result, modeIndex, low);
  const right = sample(result, modeIndex, high);
  return [left[0] + fraction * (right[0] - left[0]), left[1] + fraction * (right[1] - left[1])];
}

export interface SingleModeField {
  readonly modeIndex: number;
  readonly modeNumber: number;
  readonly horizontalWavenumber: { readonly real: number; readonly imaginary: number };
  readonly receiverRangesM: Float64Array;
  readonly receiverDepthsM: Float64Array;
  readonly transmissionLossDb: Float32Array;
}

export function synthesizeSingleModeField(result: NormalModeResult, modeIndex: number): SingleModeField {
  const modeCount = result.modeCounts[0] ?? 0;
  if (!Number.isInteger(modeIndex) || modeIndex < 0 || modeIndex >= modeCount) {
    throw new RangeError(`modeIndex must be between 0 and ${Math.max(0, modeCount - 1)}`);
  }
  const wavenumberOffset = ((result.wavenumberOffsets[0] ?? 0) + modeIndex) * 2;
  const krReal = result.wavenumbersInterleaved[wavenumberOffset] ?? 0;
  const krImaginary = result.wavenumbersInterleaved[wavenumberOffset + 1] ?? 0;
  const sourceShape = interpolate(result, modeIndex, result.sourceDepthM);
  const rootWavenumber = squareRoot(krReal, krImaginary);
  const factor = Math.sqrt(Math.PI);
  const coupled = multiply(-factor, factor, sourceShape[0], sourceShape[1]);
  const constant = divide(coupled[0], coupled[1], rootWavenumber[0], rootWavenumber[1]);
  const receiverShapes = Array.from(result.receiverDepthsM, (depthM) => interpolate(result, modeIndex, depthM));
  const columns = result.receiverRangesM.length;
  const rows = result.receiverDepthsM.length;
  const transmissionLossDb = new Float32Array(rows * columns);
  for (let rangeIndex = 0; rangeIndex < columns; rangeIndex += 1) {
    const rangeM = result.receiverRangesM[rangeIndex] ?? 0;
    let propagated: [number, number] = [0, 0];
    if (rangeM > 0) {
      const amplitude = Math.exp(Math.max(-700, Math.min(700, krImaginary * rangeM))) / Math.sqrt(rangeM);
      const phase = -krReal * rangeM;
      propagated = multiply(constant[0], constant[1], amplitude * Math.cos(phase), amplitude * Math.sin(phase));
    }
    for (let depthIndex = 0; depthIndex < rows; depthIndex += 1) {
      const receiver = receiverShapes[depthIndex] ?? [0, 0];
      const pressure = multiply(receiver[0], receiver[1], propagated[0], propagated[1]);
      transmissionLossDb[depthIndex * columns + rangeIndex] = -20 * Math.log10(
        Math.max(MINIMUM_PRESSURE, Math.hypot(pressure[0], pressure[1])),
      );
    }
  }
  return {
    modeIndex,
    modeNumber: modeIndex + 1,
    horizontalWavenumber: { real: krReal, imaginary: krImaginary },
    receiverRangesM: result.receiverRangesM,
    receiverDepthsM: result.receiverDepthsM,
    transmissionLossDb,
  };
}

export function singleModeMagnitude(
  modeShapesInterleaved: Float64Array,
  depthCount: number,
  modeIndex: number,
): Float32Array {
  const result = new Float32Array(depthCount);
  for (let depthIndex = 0; depthIndex < depthCount; depthIndex += 1) {
    const index = (modeIndex * depthCount + depthIndex) * 2;
    result[depthIndex] = Math.hypot(modeShapesInterleaved[index] ?? 0, modeShapesInterleaved[index + 1] ?? 0);
  }
  return result;
}
