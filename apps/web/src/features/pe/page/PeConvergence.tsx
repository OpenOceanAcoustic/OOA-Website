import type { CSSProperties } from "react";

export function PeConvergence() {
  return (
    <section className="panel convergence-panel">
      <div className="panel-head">
        <div>
          <p className="micro">
            {"PADE CONVERGENCE"}
          </p>
          <h3>
            {"阶数—场差收敛曲线"}
          </h3>
        </div>
        <div className="plot-legend">
          <span>
            <i style={{ "--legend": "#62d8e7" } as CSSProperties}></i>
            {"RMSE"}
          </span>
          <span>
            <i style={{ "--legend": "#f8b44c" } as CSSProperties}></i>
            {"当前 nPade"}
          </span>
        </div>
      </div>
      <div className="plot-wrap auxiliary-wrap">
        <canvas id="convergenceCanvas" tabIndex={0} aria-label="可点击选择 nPade 的误差收敛曲线"></canvas>
        <span className="plot-note">
          {"CLICK A TERM COUNT"}
        </span>
      </div>
    </section>
  );
}
