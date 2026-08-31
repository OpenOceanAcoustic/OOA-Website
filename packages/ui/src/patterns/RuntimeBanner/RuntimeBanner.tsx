import { StatusIndicator, type StatusTone } from "../../primitives/StatusIndicator/StatusIndicator";
import styles from "../../ui.module.css";
export function RuntimeBanner({ state, detail }: { readonly state: StatusTone; readonly detail: string }) { return <div className={styles.runtime} role="status"><StatusIndicator state={state} label={state === "ready" ? "Ready" : state} /><span className={styles.runtimeDetail}>{detail}</span></div>; }
