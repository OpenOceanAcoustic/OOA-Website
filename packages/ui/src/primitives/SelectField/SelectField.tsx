import type { SelectHTMLAttributes } from "react";
import styles from "../../ui.module.css";
export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> { readonly label: string; }
export function SelectField({ label, children, ...props }: SelectFieldProps) { return <label className={styles.fieldGroup}>{label}<select className={styles.field} {...props}>{children}</select></label>; }
