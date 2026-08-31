import type { ReactNode } from "react";
import styles from "../../ui.module.css";
export function EmptyState({ children }: { readonly children: ReactNode }) { return <div className={styles.state}>{children}</div>; }
