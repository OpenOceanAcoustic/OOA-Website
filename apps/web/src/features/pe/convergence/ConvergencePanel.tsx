import { EmptyState, Panel } from "@ooa/ui";
import { LineCanvas } from "@ooa/visualization";
import { usePeStore } from "../state/store";
export function ConvergencePanel() { const points = usePeStore((state) => state.convergence); return <Panel title="Padé 收敛"><>{points.length === 0 ? <EmptyState>完成扫描后显示 RMS 收敛。</EmptyState> : <LineCanvas x={Float64Array.from(points, (point) => point.nPade)} y={Float64Array.from(points, (point) => point.rms)} ariaLabel="Padé 收敛曲线" />}</></Panel>; }
