import { MetricStrip, Panel } from "@ooa/ui";
import { usePeStore } from "../state/store";
export function DiscretizationPanel() { const value = usePeStore((state) => state.parameters); return <Panel title="PE 离散网格" description="dr、dz 与输出抽样分别控制"><MetricStrip metrics={[{ label: "dr", value: `${value.rangeStepM} m` }, { label: "dz", value: `${value.depthStepM} m` }, { label: "距离步数", value: Math.ceil(value.maximumRangeKm * 1000 / value.rangeStepM) }, { label: "深度步数", value: Math.ceil(value.maximumDepthM / value.depthStepM) }]} /></Panel>; }
