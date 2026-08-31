import { useCallback, useRef, type PointerEvent } from "react";
import { useCanvasSurface } from "../canvas/use-canvas-surface";
import styles from "../visualization.module.css";

export interface RayCanvasTarget {
  readonly rangeM: number;
  readonly depthM: number;
}

export function RayCanvas({ offsets, pointsM, maximumRangeM, maximumDepthM, target, onTargetChange }: {
  readonly offsets: Uint32Array;
  readonly pointsM: Float64Array;
  readonly maximumRangeM: number;
  readonly maximumDepthM: number;
  readonly target?: RayCanvasTarget;
  readonly onTargetChange?: (target: RayCanvasTarget) => void;
}) {
  const reference = useRef<HTMLCanvasElement>(null);
  const draw = useCallback((context: CanvasRenderingContext2D, size: { width: number; height: number }) => {
    context.clearRect(0, 0, size.width, size.height);
    const colors = ["#32d5ff", "#ffc861", "#ff718b", "#7c8cff"];
    for (let ray = 0; ray < offsets.length - 1; ray += 1) {
      context.beginPath(); context.strokeStyle = colors[ray % colors.length] ?? "#32d5ff"; context.globalAlpha = .72;
      const start = offsets[ray] ?? 0; const end = offsets[ray + 1] ?? start;
      for (let point = start; point < end; point += 1) {
        const px = ((pointsM[point * 2] ?? 0) / Math.max(1, maximumRangeM)) * size.width;
        const py = ((pointsM[point * 2 + 1] ?? 0) / Math.max(1, maximumDepthM)) * size.height;
        if (point === start) context.moveTo(px, py); else context.lineTo(px, py);
      }
      context.stroke();
    }
    context.globalAlpha = 1;
    if (target !== undefined) {
      const x = target.rangeM / Math.max(1, maximumRangeM) * size.width;
      const y = target.depthM / Math.max(1, maximumDepthM) * size.height;
      context.beginPath(); context.fillStyle = "#ff718b"; context.strokeStyle = "#ffffff";
      context.arc(x, y, 6, 0, Math.PI * 2); context.fill(); context.stroke();
    }
  }, [maximumDepthM, maximumRangeM, offsets, pointsM, target]);
  useCanvasSurface(reference, draw);
  const updateTarget = (event: PointerEvent<HTMLCanvasElement>) => {
    if (onTargetChange === undefined) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    onTargetChange({ rangeM: x / Math.max(1, rect.width) * maximumRangeM, depthM: y / Math.max(1, rect.height) * maximumDepthM });
  };
  return <canvas ref={reference} className={styles.canvas} role="img" aria-label="声线轨迹和可拖动接收器" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); updateTarget(event); }} onPointerMove={(event) => { if (event.buttons === 1) updateTarget(event); }} />;
}
