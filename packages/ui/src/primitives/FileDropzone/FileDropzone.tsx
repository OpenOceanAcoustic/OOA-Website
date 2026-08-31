import styles from "../../ui.module.css";
export function FileDropzone({ accept, onFiles }: { readonly accept?: string; readonly onFiles: (files: File[]) => void }) { return <label className={styles.dropzone}><input type="file" accept={accept} multiple onChange={(event) => onFiles(Array.from(event.currentTarget.files ?? []))} /><span>拖放或选择环境文件</span></label>; }
