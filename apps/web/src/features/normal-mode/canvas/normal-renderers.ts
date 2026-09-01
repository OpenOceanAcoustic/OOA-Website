import type { NormalModePageResult, NormalModeSingleField } from "@ooa/runtime-normal-mode";
import type { PointerEvent as ReactPointerEvent } from "react";
import { createPlot, drawHeatmap, drawPoints, drawPolyline, pointerValue, valueRange } from "../../shared-page/canvas";

export type NormalSpectrumPlot = ReturnType<typeof createPlot>;

export interface NormalCanvasElements {
  readonly ssp: HTMLCanvasElement;
  readonly spectrum: HTMLCanvasElement;
  readonly eigenfunction: HTMLCanvasElement;
  readonly field: HTMLCanvasElement;
  readonly delta: HTMLCanvasElement;
}

export interface NormalCanvasState {
  readonly result: NormalModePageResult;
  readonly selectedMode: number;
  readonly fieldView: "sum" | "single";
  readonly singleModeField: NormalModeSingleField | null;
}

function modalWavenumbers(result: NormalModePageResult): number[] {
  const values = result.modes.horizontalWavenumbersInterleaved;
  return Array.from({ length: result.modes.count }, (_, index) => values[index * 2] ?? 0);
}

function fieldBathymetry(result: NormalModePageResult): readonly (readonly [number, number])[] {
  const maximumRange = result.field.rangesKm.at(-1) ?? 0;
  return [[0, result.environment.waterDepthM], [maximumRange, result.environment.waterDepthM]];
}

function drawSoundSpeedProfile(canvas: HTMLCanvasElement, result: NormalModePageResult): void {
  const speeds = result.environment.soundSpeedMps;
  const depths = result.environment.depthsM;
  const [minimum, maximum] = valueRange(speeds, { paddingFraction: 0.1, minimumPadding: 3 });
  const plot = createPlot(canvas, {
    xMinimum: minimum,
    xMaximum: maximum,
    yMinimum: 0,
    yMaximum: result.environment.waterDepthM,
    xLabel: "c / m·s⁻¹",
    yLabel: "深度 / m",
    depthAxis: true,
  });
  drawPolyline(plot, Array.from(depths, (depth, index) => [speeds[index] ?? 0, depth]), { color: "#62d8e7", width: 2, glow: 5 });
  const sourceIndex = Math.round(result.environment.sourceDepthM / result.environment.waterDepthM * (speeds.length - 1));
  drawPoints(plot, [[speeds[sourceIndex] ?? speeds[0] ?? 0, result.environment.sourceDepthM]], { color: "#f8b44c", radius: 4 });
}

function drawSpectrum(canvas: HTMLCanvasElement, result: NormalModePageResult, selectedMode: number): NormalSpectrumPlot {
  const wavenumbers = modalWavenumbers(result);
  const [minimum, maximum] = valueRange(wavenumbers, { paddingFraction: 0.08, minimumPadding: 1e-4 });
  const plot = createPlot(canvas, {
    xMinimum: 1,
    xMaximum: result.modes.count,
    yMinimum: minimum,
    yMaximum: maximum,
    xLabel: "模态序号 m",
    yLabel: "Re(kᵣ) / rad·m⁻¹",
    xFormatter: (value: number) => Math.round(value).toString(),
    yFormatter: (value: number) => value.toFixed(4),
  });
  const points = wavenumbers.map((value, index) => [index + 1, value] as const);
  drawPolyline(plot, points, { color: "rgba(98,216,231,.72)", width: 1.2 });
  drawPoints(plot, points, { color: "#62d8e7", radius: 2 });
  const selected = points[selectedMode];
  if (selected !== undefined) drawPoints(plot, [selected], { color: "#f8b44c", radius: 5, stroke: "#ffe0a0", strokeWidth: 1.2 });
  return plot;
}

function drawModeDetails(canvas: HTMLCanvasElement, result: NormalModePageResult, selectedMode: number): void {
  const depths = result.modes.depthsM;
  const stride = depths.length;
  const realShape: [number, number][] = [];
  const imaginaryShape: [number, number][] = [];
  let normalization = 1e-12;
  for (let depthIndex = 0; depthIndex < stride; depthIndex += 1) {
    const offset = (selectedMode * stride + depthIndex) * 2;
    normalization = Math.max(normalization, Math.hypot(
      result.modes.modeShapesInterleaved[offset] ?? 0,
      result.modes.modeShapesInterleaved[offset + 1] ?? 0,
    ));
  }
  for (let depthIndex = 0; depthIndex < stride; depthIndex += 1) {
    const offset = (selectedMode * stride + depthIndex) * 2;
    realShape.push([(result.modes.modeShapesInterleaved[offset] ?? 0) / normalization, depths[depthIndex] ?? 0]);
    imaginaryShape.push([(result.modes.modeShapesInterleaved[offset + 1] ?? 0) / normalization, depths[depthIndex] ?? 0]);
  }
  const plot = createPlot(canvas, {
    xMinimum: -1.08,
    xMaximum: 1.08,
    yMinimum: 0,
    yMaximum: result.environment.waterDepthM,
    xLabel: "归一化 φₘ",
    yLabel: "深度 / m",
    depthAxis: true,
  });
  drawPolyline(plot, realShape, { color: "#62d8e7", width: 1.8, glow: 3 });
  drawPolyline(plot, imaginaryShape, { color: "#f8b44c", width: 1.4 });
}

function drawFields(canvases: Pick<NormalCanvasElements, "field" | "delta">, state: NormalCanvasState): void {
  const { result } = state;
  const displayedField = state.fieldView === "single" && state.singleModeField !== null
    ? state.singleModeField
    : result.field;
  const maximumRange = result.field.rangesKm.at(-1) ?? 0;
  const common = {
    xMinimum: 0,
    xMaximum: maximumRange,
    yMinimum: 0,
    yMaximum: result.environment.waterDepthM,
    xLabel: "距离 / km",
    yLabel: "深度 / m",
    bathymetry: fieldBathymetry(result),
  };
  const fieldPlot = drawHeatmap(canvases.field, {
    values: displayedField.tlDb,
    rows: displayedField.rows,
    columns: displayedField.columns,
  }, { ...common, minimum: 60, maximum: 120 });
  drawPoints(fieldPlot, [[result.field.rangesKm[0] ?? 0, result.environment.sourceDepthM]], { color: "#f8b44c", radius: 4 });
  const magnitude = Math.max(0.5, Math.ceil(result.metrics.deltaMaxDb * 2) / 2);
  drawHeatmap(canvases.delta, {
    values: result.deltaField.values,
    rows: result.deltaField.rows,
    columns: result.deltaField.columns,
  }, { ...common, divergingMagnitude: magnitude });
}

export function renderNormalCanvases(canvases: NormalCanvasElements, state: NormalCanvasState): NormalSpectrumPlot {
  drawSoundSpeedProfile(canvases.ssp, state.result);
  const spectrumPlot = drawSpectrum(canvases.spectrum, state.result, state.selectedMode);
  drawModeDetails(canvases.eigenfunction, state.result, state.selectedMode);
  drawFields(canvases, state);
  return spectrumPlot;
}

export function selectedModeFromPointer(
  canvas: HTMLCanvasElement,
  event: PointerEvent | ReactPointerEvent<HTMLCanvasElement>,
  plot: NormalSpectrumPlot,
  modeCount: number,
): number {
  const target = Math.round(pointerValue(canvas, event, plot).x);
  return Math.max(0, Math.min(modeCount - 1, target - 1));
}
