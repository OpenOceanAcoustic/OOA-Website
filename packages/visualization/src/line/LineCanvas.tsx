import { useCallback, useRef } from "react";
import { useCanvasSurface } from "../canvas/use-canvas-surface";
import styles from "../visualization.module.css";
export function LineCanvas({ x, y, ariaLabel = "曲线图" }: { readonly x: ArrayLike<number>; readonly y: ArrayLike<number>; readonly ariaLabel?: string }) {
  const reference = useRef<HTMLCanvasElement>(null);
  const draw = useCallback((context: CanvasRenderingContext2D, size: { width: number; height: number }) => {
    context.clearRect(0, 0, size.width, size.height);
    if (x.length < 2 || y.length < 2) return;
    const xs = Array.from(x); const ys = Array.from(y);
    const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
    context.beginPath(); context.strokeStyle = "#32d5ff"; context.lineWidth = 1.5;
    for (let index = 0; index < Math.min(xs.length, ys.length); index += 1) {
      const px = 24 + ((xs[index]! - minX) / Math.max(Number.EPSILON, maxX - minX)) * (size.width - 48);
      const py = 18 + ((ys[index]! - minY) / Math.max(Number.EPSILON, maxY - minY)) * (size.height - 36);
      if (index === 0) context.moveTo(px, py); else context.lineTo(px, py);
    }
    context.stroke();
  }, [x, y]);
  useCanvasSurface(reference, draw);
  return <canvas ref={reference} className={styles.canvas} role="img" aria-label={ariaLabel} />;
}
