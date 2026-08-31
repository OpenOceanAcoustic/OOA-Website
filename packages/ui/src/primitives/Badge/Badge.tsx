import type { ReactNode } from "react";
import styles from "../../ui.module.css";
export function Badge({ children }: { readonly children: ReactNode }) { return <span className={styles.badge}>{children}</span>; }
