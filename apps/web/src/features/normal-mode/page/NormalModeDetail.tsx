import type { CSSProperties } from "react";
import type { UseNormalModePageResult } from "../hooks/useNormalModePage";

export function NormalModeDetail({ page }: { readonly page: UseNormalModePageResult }) {
  const modeLabel = `Mode ${String(page.selectedMode + 1).padStart(2, "0")}`;
  return (
    <section className="panel mode-detail-panel">
      <div className="panel-head">
        <div>
          <p className="micro">
            {"MODE SHAPE"}
          </p>
          <h3 id="modeShapeTitle">{modeLabel} 本征函数</h3>
        </div>
        <div className="plot-legend">
          <span>
            <i style={{ "--legend": "#62d8e7" } as CSSProperties}></i>
            {"实部"}
          </span>
          <span>
            <i style={{ "--legend": "#f8b44c" } as CSSProperties}></i>
            {"虚部"}
          </span>
        </div>
      </div>
      <div className="detail-plots">
        <div className="plot-wrap">
          <canvas ref={page.canvases.eigenfunction} id="eigenfunctionCanvas" aria-label="选中模态的本征函数"></canvas>
          <span className="plot-note">
            {"φₘ(z) · NORMALIZED"}
          </span>
        </div>
      </div>
    </section>
  );
}
