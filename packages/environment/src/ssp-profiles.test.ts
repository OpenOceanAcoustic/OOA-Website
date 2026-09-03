import { describe, expect, it } from "vitest";
import {
  MAX_SANITIZED_SSP_POINT_COUNT,
  sampleSspPointsByIndex,
  sanitizeSspPoints,
} from "./ssp-profiles";

describe("adaptive SSP point sampling", () => {
  it("uses deterministic, evenly spaced source indices and preserves both endpoints", () => {
    const points = Array.from({ length: 1_025 }, (_, index) => [index, 1_500]);

    const first = sampleSspPointsByIndex(points);
    const second = sampleSspPointsByIndex(points);

    expect(first).toHaveLength(MAX_SANITIZED_SSP_POINT_COUNT);
    expect(first).toEqual(second);
    expect(first[0]).toBe(points[0]);
    expect(first.at(-1)).toBe(points.at(-1));
    expect(first[1]).toBe(points[2]);
  });

  it("keeps the final water-depth node after sanitization", () => {
    const points = Array.from({ length: 513 }, (_, depth) => [depth, 1_500.04]);
    const sanitized = sanitizeSspPoints(points, 512);

    expect(sanitized).toHaveLength(512);
    expect(sanitized[0]).toEqual([0, 1_500]);
    expect(sanitized.at(-1)).toEqual([512, 1_500]);
  });
});
