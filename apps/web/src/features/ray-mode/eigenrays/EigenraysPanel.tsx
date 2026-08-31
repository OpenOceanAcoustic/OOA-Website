import { EmptyState, MetricStrip, PlotPanel } from "@ooa/ui";
import { RayCanvas } from "@ooa/visualization";
import { useRayModeStore } from "../state/store";

export function EigenraysPanel() {
  const result = useRayModeStore((state) => state.eigenrayResult);
  const state = useRayModeStore();
  const offsets = result?.offsets ?? new Uint32Array([0]);
  const pointsM = result?.pointsM ?? new Float64Array();
  return <PlotPanel title="精确本征声线" description="拖动红色接收器后重新搜索"><>{result === null ? <EmptyState>设置或拖动接收器，然后运行本征声线任务。</EmptyState> : <MetricStrip metrics={[{ label: "声线数", value: Math.max(0, result.offsets.length - 1) }, { label: "轨迹点", value: result.pointsM.length / 2 }, { label: "耗时", value: `${result.totalTimeMs.toFixed(1)} ms` }]} />}</><RayCanvas offsets={offsets} pointsM={pointsM} maximumRangeM={state.parameters.maximumRangeKm * 1000} maximumDepthM={state.environment.waterDepthM} target={{ rangeM: state.parameters.eigenrayReceiverRangeKm * 1000, depthM: state.parameters.eigenrayReceiverDepthM }} onTargetChange={(target) => state.patchParameters({ eigenrayReceiverRangeKm: target.rangeM / 1000, eigenrayReceiverDepthM: target.depthM })} /></PlotPanel>;
}
