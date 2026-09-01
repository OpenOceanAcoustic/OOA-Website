import type { CSSProperties, ReactNode } from "react";

export interface PanelProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly ariaLabelledBy?: string;
}

export function Panel({ children, className = "panel", ariaLabelledBy }: PanelProps) {
  return <section className={className} aria-labelledby={ariaLabelledBy}>{children}</section>;
}

export interface PanelHeaderProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export function PanelHeader({ children, className = "panel-head" }: PanelHeaderProps) {
  return <header className={className}>{children}</header>;
}

export interface RuntimeBannerProps {
  readonly id?: string;
  readonly mode: "loading" | "wasm" | "demo" | "error";
  readonly children: ReactNode;
  readonly className?: string;
}

export function RuntimeBanner({ id, mode, children, className = "runtime-banner" }: RuntimeBannerProps) {
  return <div id={id} className={className} data-mode={mode}>{children}</div>;
}

export interface PlotFrameProps {
  readonly canvasId: string;
  readonly ariaLabel: string;
  readonly className?: string;
  readonly canvasClassName?: string;
  readonly note?: ReactNode;
  readonly onPointerMove?: React.PointerEventHandler<HTMLCanvasElement>;
  readonly onPointerDown?: React.PointerEventHandler<HTMLCanvasElement>;
  readonly onPointerUp?: React.PointerEventHandler<HTMLCanvasElement>;
}

export function PlotFrame({
  canvasId,
  ariaLabel,
  className = "plot-wrap",
  canvasClassName,
  note,
  onPointerMove,
  onPointerDown,
  onPointerUp,
}: PlotFrameProps) {
  return (
    <div className={className}>
      <canvas
        id={canvasId}
        className={canvasClassName}
        aria-label={ariaLabel}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      />
      {note === undefined ? null : <span className="plot-note">{note}</span>}
    </div>
  );
}

export interface PlotLegendItem {
  readonly label: ReactNode;
  readonly color: string;
}

export function PlotLegend({ items, className = "plot-legend" }: { readonly items: readonly PlotLegendItem[]; readonly className?: string }) {
  return (
    <div className={className}>
      {items.map((item, index) => (
        <span key={index}><i style={{ "--legend": item.color } as CSSProperties} />{item.label}</span>
      ))}
    </div>
  );
}

export function MetricStrip({ children, className = "metric-strip" }: { readonly children: ReactNode; readonly className?: string }) {
  return <div className={className}>{children}</div>;
}
