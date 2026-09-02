export const RAY_PAGE_AUTOMATIC_BEAM_COUNT = 1000;
export const RAY_PAGE_MINIMUM_BEAM_COUNT = 2;
export const RAY_PAGE_MAXIMUM_BEAM_COUNT = 20_000;

/**
 * Resolve the Ray page's editable beam-count contract.
 *
 * Bellhop uses zero as the automatic-count sentinel. Keep that meaning at the
 * page boundary, but resolve it to the browser's documented interactive
 * default before constructing an AxisInput (which requires at least 2 points).
 */
export function resolveRayFieldLaunchAngleCount(
  value: unknown,
  automaticCount = RAY_PAGE_AUTOMATIC_BEAM_COUNT,
): number {
  const numeric = value === undefined || value === null ? automaticCount : Number(value);
  if (!Number.isFinite(numeric)) return automaticCount;
  if (numeric === 0) return automaticCount;
  return Math.round(Math.max(
    RAY_PAGE_MINIMUM_BEAM_COUNT,
    Math.min(RAY_PAGE_MAXIMUM_BEAM_COUNT, numeric),
  ));
}
