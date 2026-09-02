import { describe, expect, it } from "vitest";
import {
  RAY_PAGE_AUTOMATIC_BEAM_COUNT,
  resolveRayFieldLaunchAngleCount,
} from "./page-beam-count";

describe("Ray page beam-count projection", () => {
  it("preserves Bellhop zero as AUTO instead of collapsing it to two rays", () => {
    expect(resolveRayFieldLaunchAngleCount(0)).toBe(RAY_PAGE_AUTOMATIC_BEAM_COUNT);
  });

  it("keeps explicit counts inside the browser-safe range", () => {
    expect(resolveRayFieldLaunchAngleCount(1)).toBe(2);
    expect(resolveRayFieldLaunchAngleCount(321.4)).toBe(321);
    expect(resolveRayFieldLaunchAngleCount(50_000)).toBe(20_000);
  });
});
