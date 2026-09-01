import type { ChangeEvent, InputHTMLAttributes, ReactNode } from "react";

export interface FileImportButtonProps {
  readonly inputId: string;
  readonly accept: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly multiple?: boolean;
  readonly disabled?: boolean;
  onFilesSelected(files: FileList): void;
}

export function FileImportButton({
  inputId,
  accept,
  children,
  className,
  multiple = false,
  disabled = false,
  onFilesSelected,
}: FileImportButtonProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.currentTarget.files !== null) onFilesSelected(event.currentTarget.files);
  };
  return (
    <>
      <button className={className} type="button" disabled={disabled} onClick={() => document.getElementById(inputId)?.click()}>{children}</button>
      <input id={inputId} type="file" accept={accept} multiple={multiple} hidden disabled={disabled} onChange={handleChange} />
    </>
  );
}

export interface RunButtonProps {
  readonly id: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly type?: InputHTMLAttributes<HTMLInputElement>["type"];
  onRun(): void;
}

export function RunButton({ id, children, className, disabled = false, onRun }: RunButtonProps) {
  return <button id={id} className={className} type="button" disabled={disabled} onClick={onRun}>{children}</button>;
}

export interface StatusPillProps {
  readonly id?: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly mode?: "idle" | "busy" | "error";
}

export function StatusPill({ id, children, className = "status-pill", mode = "idle" }: StatusPillProps) {
  const modeClass = mode === "idle" ? "" : ` ${mode}`;
  return <span id={id} className={`${className}${modeClass}`}>{children}</span>;
}
