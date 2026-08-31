import type { CSSProperties } from "react";

export function NormalModeDetail() {
  return (
    <section className="panel mode-detail-panel">
      <div className="panel-head">
        <div>
          <p className="micro">
            {"MODE SHAPE"}
          </p>
          <h3 id="modeShapeTitle">
            {"Mode 01 本征函数"}
          </h3>
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
          <canvas id="eigenfunctionCanvas" aria-label="选中模态的本征函数"></canvas>
          <span className="plot-note">
            {"φₘ(z) · NORMALIZED"}
          </span>
        </div>
      </div>
    </section>
  );
}
