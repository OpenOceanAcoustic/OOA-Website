import { EmptyState, MetricStrip, Panel } from "@ooa/ui";
import { usePeStore } from "../state/store";
export function PadeSweepPanel() { const convergence = usePeStore((state) => state.convergence); return <Panel title="Padé 扫描" description="固定 nPade=10 为参考">{convergence.length === 0 ? <EmptyState>点击 Padé 扫描生成 nPade=1–10 的计算结果。</EmptyState> : <MetricStrip metrics={convergence.map((point) => ({ label: `n=${point.nPade} RMS`, value: point.rms.toFixed(3) }))} />}</Panel>; }
