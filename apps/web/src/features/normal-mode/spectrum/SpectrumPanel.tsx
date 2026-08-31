import { EmptyState, MetricStrip, Panel } from "@ooa/ui";
import { LineCanvas } from "@ooa/visualization";
import { useNormalModeStore } from "../state/store";

export function SpectrumPanel() {
  const result = useNormalModeStore((state) => state.fullResult);
  if (result === null) return <Panel title="模态谱"><EmptyState>运行 Kraken 后显示复水平波数谱。</EmptyState></Panel>;
  const count = result.modeCounts[0] ?? 0;
  const offset = (result.wavenumberOffsets[0] ?? 0) * 2;
  const real = Float64Array.from({ length: count }, (_, index) => result.wavenumbersInterleaved[offset + index * 2] ?? 0);
  const imaginary = Float64Array.from({ length: count }, (_, index) => result.wavenumbersInterleaved[offset + index * 2 + 1] ?? 0);
  return <Panel title="复水平波数谱"><MetricStrip metrics={[{ label: "首剖面模态", value: count }, { label: "剖面数", value: result.modeCounts.length }, { label: "群速度点", value: result.groupVelocityMps.length }]} /><LineCanvas x={real} y={imaginary} ariaLabel="复水平波数谱" /></Panel>;
}
