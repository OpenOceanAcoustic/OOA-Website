import type { InputHTMLAttributes } from "react";
import styles from "../../ui.module.css";
export interface NumberFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> { readonly label: string; readonly onValueChange: (value: number) => void; }
export function NumberField({ label, onValueChange, ...props }: NumberFieldProps) { return <label className={styles.fieldGroup}>{label}<input className={styles.field} type="number" onChange={(event) => onValueChange(event.currentTarget.valueAsNumber)} {...props} /></label>; }
