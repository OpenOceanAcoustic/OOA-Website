import type { ButtonHTMLAttributes } from "react";
import styles from "../../ui.module.css";
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { readonly variant?: "default" | "primary" | "danger"; }
export function Button({ variant = "default", className, ...props }: ButtonProps) {
  return <button className={[styles.button, variant === "primary" ? styles.primary : "", variant === "danger" ? styles.danger : "", className].filter(Boolean).join(" ")} {...props} />;
}
