import styles from "../../ui.module.css";
export type StatusTone = "idle" | "ready" | "running" | "error";
export function StatusIndicator({ state, label }: { readonly state: StatusTone; readonly label: string }) { return <span className={`${styles.status} ${styles[state] ?? ""}`}><span className={styles.dot} aria-hidden="true" />{label}</span>; }
