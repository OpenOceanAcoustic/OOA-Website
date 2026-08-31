import { describe, expect, it } from "vitest";
import { useNormalModeStore } from "./normal-mode/state/store";
import { usePeStore } from "./pe/state/store";
import { useRayModeStore } from "./ray-mode/state/store";

describe("model feature state isolation", () => {
  it("does not leak parameters between model families", () => {
    const normalBefore = useNormalModeStore.getState().parameters.sourceDepthM;
    const peBefore = usePeStore.getState().parameters.sourceDepthM;
    useRayModeStore.getState().patchParameters({ sourceDepthM: 123 });
    expect(useRayModeStore.getState().parameters.sourceDepthM).toBe(123);
    expect(useNormalModeStore.getState().parameters.sourceDepthM).toBe(normalBefore);
    expect(usePeStore.getState().parameters.sourceDepthM).toBe(peBefore);
  });
});
