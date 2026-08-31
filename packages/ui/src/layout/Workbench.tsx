import type { ReactNode } from "react";
import styles from "../ui.module.css";
export function Workbench({ controls, results }: { readonly controls: ReactNode; readonly results: ReactNode }) { return <div className={styles.layout}><aside>{controls}</aside><main>{results}</main></div>; }
