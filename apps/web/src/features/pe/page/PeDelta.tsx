import type { CSSProperties } from "react";

export function PeDelta() {
  return (
    <section className="panel pe-delta-panel">
      <div className="panel-head">
        <div>
          <p className="micro">
            {"ERROR AGAINST HIGH-ORDER REFERENCE"}
          </p>
          <h3>
            {"相对 nPade=10 的 ΔTL"}
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
        <canvas id="deltaCanvas" aria-label="相对高阶参考场的传播损失差值"></canvas>
        <span className="plot-note">
          {"CURRENT − REFERENCE"}
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
            {"复压力相对 L2"}
          </span>
          <strong id="pressureL2">
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
