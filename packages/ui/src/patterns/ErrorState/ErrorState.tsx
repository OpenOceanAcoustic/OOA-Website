import styles from "../../ui.module.css";
export function ErrorState({ message }: { readonly message: string }) { return <div className={`${styles.state} ${styles.errorState}`} role="alert">{message}</div>; }
