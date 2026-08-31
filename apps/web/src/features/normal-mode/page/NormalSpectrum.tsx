import type { CSSProperties } from "react";

export function NormalSpectrum() {
  return (
    <section className="panel spectrum-panel">
      <div className="panel-head">
        <div>
          <p className="micro">
            {"HORIZONTAL WAVENUMBER"}
          </p>
          <h3>
            {"模态谱 · 水平波数"}
          </h3>
        </div>
        <div className="plot-legend">
          <span>
            <i style={{ "--legend": "#62d8e7" } as CSSProperties}></i>
            {"Re(kᵣ)"}
          </span>
          <span>
            <i style={{ "--legend": "#f8b44c" } as CSSProperties}></i>
            {"当前模态"}
          </span>
        </div>
      </div>
      <div className="plot-wrap spectrum-wrap">
        <canvas id="spectrumCanvas" tabIndex={0} aria-label="可点击选择的水平波数模态谱"></canvas>
        <span className="plot-note">
          {"CLICK TO SELECT MODE"}
        </span>
      </div>
      <div className="metric-strip">
        <div className="metric">
          <span>
            {"求得模态总数"}
          </span>
          <strong id="modeCount">
            {"—"}
          </strong>
        </div>
        <div className="metric">
          <span>
            {"水平波数 kᵣ"}
          </span>
          <strong id="horizontalWavenumber">
            {"— rad/m"}
          </strong>
        </div>
        <div className="metric">
          <span>
            {"水平波长"}
          </span>
          <strong id="horizontalWavelength">
            {"— m"}
          </strong>
        </div>
        <div className="metric">
          <span>
            {"群速度"}
          </span>
          <strong id="groupVelocity">
            {"— m/s"}
          </strong>
        </div>
      </div>
    </section>
  );
}
