import { useCallback, useRef } from "react";
import { useCanvasSurface } from "../canvas/use-canvas-surface";
import { sampleColorMap } from "../color-map";
import styles from "../visualization.module.css";

export interface HeatmapCanvasProps {
  readonly values: Float32Array | Float64Array;
  readonly columns: number;
  readonly rows: number;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly ariaLabel?: string;
}

export function HeatmapCanvas({ values, columns, rows, minimum = 0, maximum = 120, ariaLabel = "声场热图" }: HeatmapCanvasProps) {
  const reference = useRef<HTMLCanvasElement>(null);
  const draw = useCallback((context: CanvasRenderingContext2D, size: { width: number; height: number }) => {
    context.clearRect(0, 0, size.width, size.height);
    if (columns <= 0 || rows <= 0 || values.length === 0) return;
    const raster = new ImageData(columns, rows);
    for (let index = 0; index < columns * rows; index += 1) {
      const [red, green, blue, alpha] = sampleColorMap(values[index] ?? maximum, minimum, maximum);
      const offset = index * 4;
      raster.data[offset] = red; raster.data[offset + 1] = green; raster.data[offset + 2] = blue; raster.data[offset + 3] = alpha;
    }
    const buffer = document.createElement("canvas");
    buffer.width = columns; buffer.height = rows;
    buffer.getContext("2d")?.putImageData(raster, 0, 0);
    context.imageSmoothingEnabled = true;
    context.drawImage(buffer, 0, 0, size.width, size.height);
  }, [columns, maximum, minimum, rows, values]);
  useCanvasSurface(reference, draw);
  return <canvas ref={reference} className={styles.canvas} role="img" aria-label={ariaLabel} />;
}
