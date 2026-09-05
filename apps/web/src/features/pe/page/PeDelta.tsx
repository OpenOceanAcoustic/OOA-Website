import { formatPeValue, type UsePePageResult } from "../hooks/usePePage";

export function PeDelta({ page }: { readonly page: UsePePageResult }) {
  const result = page.result;
  const magnitude = Math.max(0.5, Math.ceil((result?.metrics.deltaMaxDb ?? 0.5) * 2) / 2);
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
        <div className="field-scale delta-scale" aria-label={`差值色标，负 ${magnitude} 到正 ${magnitude} dB，以零为中心`}>
          <i aria-hidden="true"></i>
          <div className="scale-ticks"><span>−{magnitude}</span><span>−{magnitude / 2}</span><span>0</span><span>{magnitude / 2}</span><span>{magnitude} dB</span></div>
        </div>
      </div>
      <div className="plot-wrap field-wrap">
        <canvas ref={page.canvases.delta} id="deltaCanvas" aria-label="相对高阶参考场的传播损失差值"></canvas>
        <span className="plot-note">
          {"CURRENT − REFERENCE"}
        </span>
      </div>
      <div className="metric-strip">
        <div className="metric">
          <span>
            {"ΔTL RMSE"}
          </span>
          <strong id="deltaRms">{result === null ? "— dB" : `${formatPeValue(result.metrics.deltaRmsDb, 3)} dB`}</strong>
        </div>
        <div className="metric">
          <span>
            {"最大 |ΔTL|"}
          </span>
          <strong id="deltaMax">{result === null ? "— dB" : `${formatPeValue(result.metrics.deltaMaxDb, 3)} dB`}</strong>
        </div>
        <div className="metric">
          <span>
            {"复压力相对 L2"}
          </span>
          <strong id="pressureL2">{result !== null && Number.isFinite(result.metrics.relativePressureL2) ? result.metrics.relativePressureL2?.toExponential(2) : "—"}</strong>
        </div>
        <div className="metric">
          <span>
            {"结果来源"}
          </span>
          <strong id="resultSource">{page.runtimeView.resultSource}</strong>
        </div>
      </div>
    </section>
  );
}
