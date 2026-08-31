import { describe, expect, it } from "vitest";
import { sampleColorMap } from "./index";

describe("scientific color maps", () => {
  it("clamps values and returns an opaque RGBA tuple", () => {
    expect(sampleColorMap(-1, 0, 100)).toEqual(sampleColorMap(0, 0, 100));
    expect(sampleColorMap(101, 0, 100)[3]).toBe(255);
  });
});
