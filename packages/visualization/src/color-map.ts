export type Rgba = readonly [number, number, number, number];
const STOPS: readonly Rgba[] = [
  [7, 17, 31, 255], [23, 59, 105, 255], [28, 132, 166, 255],
  [88, 213, 201, 255], [244, 230, 109, 255], [255, 123, 93, 255],
];

export function sampleColorMap(value: number, minimum: number, maximum: number): Rgba {
  const normalized = Math.max(0, Math.min(1, (value - minimum) / Math.max(Number.EPSILON, maximum - minimum)));
  const position = normalized * (STOPS.length - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.min(STOPS.length - 1, lowerIndex + 1);
  const amount = position - lowerIndex;
  const lower = STOPS[lowerIndex] ?? STOPS[0]!;
  const upper = STOPS[upperIndex] ?? STOPS.at(-1)!;
  return [
    Math.round(lower[0] + (upper[0] - lower[0]) * amount),
    Math.round(lower[1] + (upper[1] - lower[1]) * amount),
    Math.round(lower[2] + (upper[2] - lower[2]) * amount),
    255,
  ];
}
