import type { CSSProperties } from "react";

export function NormalDelta() {
  return (
    <section className="panel delta-panel">
      <div className="panel-head">
        <div>
          <p className="micro">
            {"TRUNCATION IMPACT"}
          </p>
          <h3>
            {"相对完整模态场的差值"}
          </h3>
        </div>
        <div className="plot-legend">
          <span>
            <i style={{ "--legend": "#267dc1" } as CSSProperties}></i>
            {"偏低"}
          </span>
          <span>
            <i style={{ "--legend": "#e56b33" } as CSSProperties}></i>
            {"偏高"}
          </span>
        </div>
      </div>
      <div className="plot-wrap field-wrap">
        <canvas id="deltaCanvas" aria-label="模态截断传播损失差值"></canvas>
        <span className="plot-note">
          {"ΔTL = TLₙ − TLfull"}
        </span>
      </div>
      <div className="metric-strip">
        <div className="metric">
          <span>
            {"ΔTL RMSE"}
          </span>
          <strong id="deltaRms">
            {"— dB"}
          </strong>
        </div>
        <div className="metric">
          <span>
            {"最大 |ΔTL|"}
          </span>
          <strong id="deltaMax">
            {"— dB"}
          </strong>
        </div>
        <div className="metric">
          <span>
            {"截断比例"}
          </span>
          <strong id="truncationRatio">
            {"—"}
          </strong>
        </div>
        <div className="metric">
          <span>
            {"结果来源"}
          </span>
          <strong id="resultSource">
            {"—"}
          </strong>
        </div>
      </div>
    </section>
  );
}
