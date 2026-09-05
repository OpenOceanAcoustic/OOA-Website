import type { PePageResult, PeVerticalProfile } from "@ooa/runtime-pe";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  createPlot,
  drawHeatmap,
  drawPoints,
  drawPolyline,
  nearestIndex,
  pointerValue,
  valueRange,
} from "../../shared-page/canvas";

export type PeConvergencePlot = ReturnType<typeof createPlot>;

export interface PeCanvasElements {
  readonly ssp: HTMLCanvasElement;
  readonly field: HTMLCanvasElement;
  readonly delta: HTMLCanvasElement;
  readonly convergence: HTMLCanvasElement;
  readonly profile: HTMLCanvasElement;
}

function drawEnvironment(canvas: HTMLCanvasElement, result: PePageResult): void {
  const speeds = result.environment.soundSpeedMps;
  const depths = result.environment.depthsM;
  const [minimum, maximum] = valueRange(speeds, { paddingFraction: 0.1, minimumPadding: 3 });
  const plot = createPlot(canvas, {
    xMinimum: minimum,
    xMaximum: maximum,
    yMinimum: 0,
    yMaximum: result.parameters.maximumDepthM,
    xLabel: "声速 / m·s⁻¹",
    xFormatter: (value: number) => Number(value.toFixed(2)).toString(),
    yLabel: "深度 / m",
    depthAxis: true,
  });
  drawPolyline(plot, Array.from(depths, (depth, index) => [speeds[index] ?? 0, depth]), { color: "#62d8e7", width: 2, glow: 5 });
  const sourceIndex = nearestIndex(depths, result.parameters.sourceDepthM);
  drawPoints(plot, [[speeds[sourceIndex] ?? speeds[0] ?? 0, result.parameters.sourceDepthM]], { color: "#f8b44c", radius: 4 });
}

function drawFields(
  canvases: Pick<PeCanvasElements, "field" | "delta">,
  result: PePageResult,
  inspectRangeKm: number,
): void {
  const common = {
    xMinimum: 0,
    xMaximum: result.parameters.maximumRangeKm,
    yMinimum: 0,
    yMaximum: result.parameters.maximumDepthM,
    xLabel: "距离 / km",
    yLabel: "深度 / m",
    bathymetry: result.environment.bathymetry,
  };
  const fieldPlot = drawHeatmap(canvases.field, {
    values: result.field.tlDb,
    rows: result.field.rows,
    columns: result.field.columns,
  }, { ...common, minimum: 60, maximum: 120 });
  drawPolyline(fieldPlot, [[inspectRangeKm, 0], [inspectRangeKm, result.parameters.maximumDepthM]], {
    color: "rgba(248,180,76,.9)", width: 1.2, dash: [4, 4],
  });
  drawPoints(fieldPlot, [[result.field.rangesKm[0] ?? 0, result.parameters.sourceDepthM]], { color: "#f8b44c", radius: 4 });
  const magnitude = Math.max(0.5, Math.ceil(result.metrics.deltaMaxDb * 2) / 2);
  const deltaPlot = drawHeatmap(canvases.delta, {
    values: result.deltaField.values,
    rows: result.deltaField.rows,
    columns: result.deltaField.columns,
  }, { ...common, divergingMagnitude: magnitude });
  drawPolyline(deltaPlot, [[inspectRangeKm, 0], [inspectRangeKm, result.parameters.maximumDepthM]], {
    color: "rgba(248,180,76,.9)", width: 1.2, dash: [4, 4],
  });
}

function drawConvergence(canvas: HTMLCanvasElement, result: PePageResult): PeConvergencePlot {
  const maximum = Math.max(0.1, ...result.convergence.map((point) => point.rmsDb));
  const plot = createPlot(canvas, {
    xMinimum: 1,
    xMaximum: 10,
    yMinimum: 0,
    yMaximum: maximum * 1.12,
    xLabel: "Padé 项数 nPade",
    yLabel: "相对 nPade=10 的 RMSE / dB",
    xTicks: 9,
    xFormatter: (value: number) => Math.round(value).toString(),
  });
  const points = result.convergence.map((point) => [point.nPade, point.rmsDb] as const);
  drawPolyline(plot, points, { color: "#62d8e7", width: 2, glow: 3 });
  drawPoints(plot, points, { color: "#62d8e7", radius: 3 });
  const selected = points[result.parameters.nPade - 1];
  if (selected !== undefined) drawPoints(plot, [selected], { color: "#f8b44c", radius: 5, stroke: "#ffe0a0" });
  return plot;
}

function drawVerticalProfile(canvas: HTMLCanvasElement, result: PePageResult, profile: PeVerticalProfile): void {
  const current: [number, number][] = [];
  const reference: [number, number][] = [];
  const values: number[] = [];
  for (let depthIndex = 0; depthIndex < profile.depthsM.length; depthIndex += 1) {
    const depth = profile.depthsM[depthIndex] ?? 0;
    const currentValue = profile.currentTlDb[depthIndex];
    const referenceValue = profile.referenceTlDb[depthIndex];
    if (currentValue !== undefined && Number.isFinite(currentValue)) {
      current.push([currentValue, depth]);
      values.push(currentValue);
    }
    if (referenceValue !== undefined && Number.isFinite(referenceValue)) {
      reference.push([referenceValue, depth]);
      values.push(referenceValue);
    }
  }
  const [minimum, maximum] = valueRange(values, { paddingFraction: 0.08, minimumPadding: 2, fallback: [60, 120] });
  const plot = createPlot(canvas, {
    xMinimum: Math.max(50, minimum),
    xMaximum: Math.min(130, maximum),
    yMinimum: 0,
    yMaximum: result.parameters.maximumDepthM,
    xLabel: "传播损失 / dB",
    yLabel: "深度 / m",
    depthAxis: true,
  });
  drawPolyline(plot, reference, { color: "#c5f16b", width: 1.5, dash: [4, 3] });
  drawPolyline(plot, current, { color: "#62d8e7", width: 2, glow: 3 });
}

export function renderPeCanvases(
  canvases: PeCanvasElements,
  result: PePageResult,
  inspectRangeKm: number,
  profile: PeVerticalProfile,
): PeConvergencePlot {
  drawEnvironment(canvases.ssp, result);
  drawFields(canvases, result, inspectRangeKm);
  const convergencePlot = drawConvergence(canvases.convergence, result);
  drawVerticalProfile(canvases.profile, result, profile);
  return convergencePlot;
}

export function padeFromPointer(
  canvas: HTMLCanvasElement,
  event: PointerEvent | ReactPointerEvent<HTMLCanvasElement>,
  plot: PeConvergencePlot,
): number {
  return Math.max(1, Math.min(10, Math.round(pointerValue(canvas, event, plot).x)));
}
