export function transmissionLossFromPressure(
  pressureInterleaved: ArrayLike<number>,
  rangeCount: number,
  depthCount: number,
): Float32Array {
  const transmissionLoss = new Float32Array(rangeCount * depthCount);
  for (let rangeIndex = 0; rangeIndex < rangeCount; rangeIndex += 1) {
    for (let depthIndex = 0; depthIndex < depthCount; depthIndex += 1) {
      const complexIndex = (rangeIndex * depthCount + depthIndex) * 2;
      const amplitude = Math.hypot(
        pressureInterleaved[complexIndex] ?? 0,
        pressureInterleaved[complexIndex + 1] ?? 0,
      );
      transmissionLoss[depthIndex * rangeCount + rangeIndex] =
        -20 * Math.log10(Math.max(1e-30, amplitude));
    }
  }
  return transmissionLoss;
}
