export interface FieldDifference { readonly values: Float32Array; readonly rms: number; readonly maximum: number; }
export function compareFields(current: Float32Array, reference: Float32Array): FieldDifference {
  if (current.length !== reference.length) throw new RangeError("场网格尺寸不一致");
  const values = new Float32Array(current.length);
  let sumSquares = 0;
  let maximum = 0;
  for (let index = 0; index < current.length; index += 1) {
    const difference = (current[index] ?? 0) - (reference[index] ?? 0);
    values[index] = difference;
    sumSquares += difference * difference;
    maximum = Math.max(maximum, Math.abs(difference));
  }
  return { values, rms: Math.sqrt(sumSquares / Math.max(1, values.length)), maximum };
}
