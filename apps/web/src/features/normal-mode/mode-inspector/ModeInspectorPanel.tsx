import { singleModeMagnitude, synthesizeSingleModeField } from "@ooa/runtime-normal-mode";
import { EmptyState, NumberField, Panel, PlotPanel } from "@ooa/ui";
import { HeatmapCanvas, LineCanvas } from "@ooa/visualization";
import { useNormalModeStore } from "../state/store";

export function ModeInspectorPanel() {
  const state = useNormalModeStore();
  if (state.fullResult === null) return <Panel title="单模态检查"><EmptyState>运行后选择模态。</EmptyState></Panel>;
  const count = state.fullResult.modeCounts[0] ?? 0;
  const modeIndex = Math.min(state.selectedMode, Math.max(0, count - 1));
  const depthCount = state.fullResult.depthCounts[0] ?? 0;
  const depthOffset = state.fullResult.depthOffsets[0] ?? 0;
  const shapeOffset = (state.fullResult.shapeOffsets[0] ?? 0) * 2;
  const depths = state.fullResult.depthsM.slice(depthOffset, depthOffset + depthCount);
  const shapes = state.fullResult.modeShapesInterleaved.slice(shapeOffset);
  const magnitude = singleModeMagnitude(shapes, depthCount, modeIndex);
  const field = synthesizeSingleModeField(state.fullResult, modeIndex);
  return <div style={{ display: "grid", gap: "1rem" }}><Panel title="单模态检查" description="切换模态不重新运行 WASM"><NumberField label="模态索引" value={modeIndex} min={0} max={Math.max(0, count - 1)} onValueChange={(value) => state.setSelectedMode(Math.max(0, Math.floor(value)))} /><LineCanvas x={magnitude} y={depths} ariaLabel="单模态深度函数" /></Panel><PlotPanel title={`Mode ${field.modeNumber} 单模态场`} description={`k = ${field.horizontalWavenumber.real.toPrecision(5)} + ${field.horizontalWavenumber.imaginary.toPrecision(3)}i`}><HeatmapCanvas values={field.transmissionLossDb} columns={field.receiverRangesM.length} rows={field.receiverDepthsM.length} minimum={20} maximum={140} ariaLabel="单模态传播损失场" /></PlotPanel></div>;
}
