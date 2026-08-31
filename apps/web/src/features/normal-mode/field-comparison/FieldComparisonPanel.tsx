import { useMemo } from "react";
import { EmptyState, PlotPanel } from "@ooa/ui";
import { HeatmapCanvas } from "@ooa/visualization";
import { useNormalModeStore } from "../state/store";

export function FieldComparisonPanel() {
  const full = useNormalModeStore((state) => state.fullResult);
  const truncated = useNormalModeStore((state) => state.truncatedResult);
  const difference = useMemo(() => {
    if (full === null || truncated === null) return null;
    return Float32Array.from(full.transmissionLossDb, (value, index) => value - (truncated.transmissionLossDb[index] ?? value));
  }, [full, truncated]);
  if (full === null || truncated === null || difference === null) return <PlotPanel title="完整场 / 截断场"><EmptyState>运行后并排保存完整与截断模态场。</EmptyState></PlotPanel>;
  return <div style={{ display: "grid", gap: "1rem" }}><PlotPanel title="完整模态场"><HeatmapCanvas values={full.transmissionLossDb} columns={full.receiverRangesM.length} rows={full.receiverDepthsM.length} minimum={20} maximum={120} /></PlotPanel><PlotPanel title="截断模态场"><HeatmapCanvas values={truncated.transmissionLossDb} columns={truncated.receiverRangesM.length} rows={truncated.receiverDepthsM.length} minimum={20} maximum={120} /></PlotPanel><PlotPanel title="完整场 − 截断场"><HeatmapCanvas values={difference} columns={full.receiverRangesM.length} rows={full.receiverDepthsM.length} minimum={-30} maximum={30} ariaLabel="模态截断差值场" /></PlotPanel></div>;
}
