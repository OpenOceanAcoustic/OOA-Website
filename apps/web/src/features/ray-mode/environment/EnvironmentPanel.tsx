import { FileDropzone, MetricStrip, Panel } from "@ooa/ui";
import type { RayRuntime } from "@ooa/runtime-ray";
import { useRayModeStore } from "../state/store";
import { importRayFiles } from "../workflows/import-environment";
export function EnvironmentPanel({ runtime }: { readonly runtime: RayRuntime }) { const environment = useRayModeStore((state) => state.environment); return <Panel title="环境与 SSP" description="统一环境包负责导入、编辑与校验"><MetricStrip metrics={[{ label: "频率", value: `${environment.frequencyHz} Hz` }, { label: "水深", value: `${environment.waterDepthM} m` }, { label: "SSP 点", value: environment.soundSpeedProfile.length }]} /><p>{environment.title}</p><FileDropzone accept=".json,.env,.ssp,.bty,.ati,.trc,.brc,.sbp" onFiles={(files) => void importRayFiles(runtime, files)} /></Panel>; }
