import type { PeRuntime } from "@ooa/runtime-pe";
import { FileDropzone, MetricStrip, Panel } from "@ooa/ui";
import { usePeStore } from "../state/store";
import { importPeFiles } from "../workflows/import-environment";
export function EnvironmentPanel({ runtime }: { readonly runtime: PeRuntime }) { const environment = usePeStore((state) => state.environment); return <Panel title="RAM 环境" description="流体水体与海底介质段"><MetricStrip metrics={[{ label: "频率", value: `${environment.frequencyHz} Hz` }, { label: "水深", value: `${environment.waterDepthM} m` }, { label: "SSP 点", value: environment.soundSpeedProfile.length }]} /><p>{environment.title}</p><FileDropzone accept=".in,.json" onFiles={(files) => void importPeFiles(runtime, files)} /></Panel>; }
