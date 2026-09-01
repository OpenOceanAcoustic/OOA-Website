import type { CSSProperties } from "react";
import type { UseNormalModePageResult } from "../hooks/useNormalModePage";

function format(value: number, digits = 3): string {
  return Number(value).toLocaleString("zh-CN", { maximumFractionDigits: digits });
}

export function NormalSpectrum({ page }: { readonly page: UseNormalModePageResult }) {
  const result = page.result;
  const mode = page.selectedMode;
  const krReal = result?.modes.horizontalWavenumbersInterleaved[mode * 2];
  const krImaginary = result?.modes.horizontalWavenumbersInterleaved[mode * 2 + 1];
  const groupVelocity = result?.modes.groupVelocityMps[mode];
  const imaginaryText = krImaginary
    ? ` ${krImaginary < 0 ? "−" : "+"} ${Math.abs(krImaginary).toExponential(1)}i`
    : "";
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
        <canvas ref={page.canvases.spectrum} id="spectrumCanvas" tabIndex={0} aria-label="可点击选择的水平波数模态谱" onPointerDown={page.selectModeFromSpectrum}></canvas>
        <span className="plot-note">
          {"CLICK TO SELECT MODE"}
        </span>
      </div>
      <div className="metric-strip">
        <div className="metric">
          <span>
            {"求得模态总数"}
          </span>
          <strong id="modeCount">{result === null ? "—" : `${result.modes.count} modes`}</strong>
        </div>
        <div className="metric">
          <span>
            {"水平波数 kᵣ"}
          </span>
          <strong id="horizontalWavenumber">{krReal === undefined ? "— rad/m" : `${krReal.toFixed(6)}${imaginaryText} rad/m`}</strong>
        </div>
        <div className="metric">
          <span>
            {"水平波长"}
          </span>
          <strong id="horizontalWavelength">{krReal === undefined ? "— m" : `${format(2 * Math.PI / Math.max(1e-12, krReal), 2)} m`}</strong>
        </div>
        <div className="metric">
          <span>
            {"群速度"}
          </span>
          <strong id="groupVelocity">{groupVelocity === undefined ? "— m/s" : `${format(groupVelocity, 1)} m/s`}</strong>
        </div>
      </div>
    </section>
  );
}
