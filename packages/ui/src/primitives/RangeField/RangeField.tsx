import type { InputHTMLAttributes } from "react";
import styles from "../../ui.module.css";
export interface RangeFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> { readonly label: string; readonly onValueChange: (value: number) => void; }
export function RangeField({ label, onValueChange, ...props }: RangeFieldProps) { return <label className={styles.fieldGroup}>{label}<input className={styles.field} type="range" onChange={(event) => onValueChange(event.currentTarget.valueAsNumber)} {...props} /></label>; }
