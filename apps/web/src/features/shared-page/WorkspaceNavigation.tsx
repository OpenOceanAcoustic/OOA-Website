import type { ReactNode } from "react";

export function CollapsibleControls({ children }: { readonly children: ReactNode }) {
  return (
    <details className="workspace-controls" open onToggle={() => window.dispatchEvent(new Event("resize"))}>
      <summary>环境与参数 <span>展开 / 收起</span></summary>
      {children}
    </details>
  );
}

export function SectionLinks({ theoryId, labId, resultsId }: {
  readonly theoryId: string; readonly labId: string; readonly resultsId: string;
}) {
  return (
    <nav className="section-links" aria-label="本页快捷入口">
      <a href={`#${labId}`} className="primary">进入实验台 ↓</a>
      <a href={`#${theoryId}`}>原理演示</a>
      <a href={`#${resultsId}`}>结果对比</a>
    </nav>
  );
}
