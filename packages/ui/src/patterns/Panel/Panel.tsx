import type { ReactNode } from "react";
import styles from "../../ui.module.css";
export function Panel({ title, description, action, children }: { readonly title: string; readonly description?: string; readonly action?: ReactNode; readonly children: ReactNode }) { return <section className={styles.panel}><header className={styles.panelHeader}><div><h2>{title}</h2>{description === undefined ? null : <p>{description}</p>}</div>{action}</header><div className={styles.panelBody}>{children}</div></section>; }
