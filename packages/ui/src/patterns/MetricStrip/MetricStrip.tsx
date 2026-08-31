import styles from "../../ui.module.css";
export interface Metric { readonly label: string; readonly value: string | number; }
export function MetricStrip({ metrics }: { readonly metrics: readonly Metric[] }) { return <div className={styles.metrics}>{metrics.map((metric) => <div className={styles.metric} key={metric.label}><b>{metric.value}</b><span>{metric.label}</span></div>)}</div>; }
