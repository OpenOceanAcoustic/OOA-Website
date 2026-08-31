import type { NormalModeRuntime } from "@ooa/runtime-normal-mode";
import { FileDropzone, MetricStrip, Panel } from "@ooa/ui";
import { useNormalModeStore } from "../state/store";
import { importNormalFiles } from "../workflows/import-environment";
export function EnvironmentPanel({ runtime }: { readonly runtime: NormalModeRuntime }) { const environment = useNormalModeStore((state) => state.environment); return <Panel title="Kraken 环境" description="支持 ENV + FLP 与统一 JSON"><MetricStrip metrics={[{ label: "频率", value: `${environment.frequencyHz} Hz` }, { label: "水深", value: `${environment.waterDepthM} m` }, { label: "SSP 点", value: environment.soundSpeedProfile.length }]} /><p>{environment.title}</p><FileDropzone accept=".env,.flp,.json" onFiles={(files) => void importNormalFiles(runtime, files)} /></Panel>; }
