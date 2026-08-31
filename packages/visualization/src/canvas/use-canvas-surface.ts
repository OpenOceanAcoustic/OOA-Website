import { useEffect, type RefObject } from "react";

export interface CanvasSize { readonly width: number; readonly height: number; readonly dpr: number; }

export function useCanvasSurface(
  reference: RefObject<HTMLCanvasElement | null>,
  draw: (context: CanvasRenderingContext2D, size: CanvasSize) => void,
): void {
  useEffect(() => {
    const canvas = reference.current;
    if (canvas === null) return undefined;
    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      const context = canvas.getContext("2d");
      if (context === null) return;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(context, { width: rect.width, height: rect.height, dpr });
    };
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    render();
    return () => observer.disconnect();
  }, [draw, reference]);
}
