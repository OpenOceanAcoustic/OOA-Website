import { createRayRuntime } from "@ooa/runtime-ray";
import { useEffect, type RefObject } from "react";
import { mountRayCanvasExperience } from "../canvas/ray-page-engine";

/**
 * Owns the Ray document's Runtime lifetime. The exact legacy scientific drawing
 * algorithms remain isolated behind the canvas experience while React owns the
 * document structure.
 */
export function useRayPage(root: RefObject<HTMLDivElement | null>, demonstration: boolean): void {
  useEffect(() => {
    const element = root.current;
    if (element === null) throw new Error("Ray Mode page root is missing");
    const runtime = createRayRuntime({ demonstration });
    const mounted = mountRayCanvasExperience(element, runtime);
    void mounted.ready;
    return () => { void mounted.dispose(); };
  }, [demonstration, root]);
}
