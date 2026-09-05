import { formatPeValue, type UsePePageResult } from "../hooks/usePePage";

export function PeField({ page }: { readonly page: UsePePageResult }) {
  const result = page.result;
  return (
    <section className="panel pe-field-panel">
      <div className="panel-head">
        <div>
          <p className="micro">
            {"CURRENT APPROXIMATION"}
          </p>
          <h3 id="fieldTitle">nPade = {result?.parameters.nPade ?? 4} 传播损失</h3>
        </div>
        <div className="field-scale" aria-label="传播损失色标，60 到 120 dB">
          <i aria-hidden="true"></i>
          <div className="scale-ticks"><span>60</span><span>75</span><span>90</span><span>105</span><span>120 dB</span></div>
        </div>
      </div>
      <div className="plot-wrap field-wrap">
        <canvas ref={page.canvases.field} id="fieldCanvas" aria-label="当前 Padé 阶数的传播损失场"></canvas>
        <span className="plot-note">
          {"TL / dB · SELECTED RANGE ┆"}
        </span>
      </div>
      <div className="metric-strip">
        <div className="metric">
          <span>
            {"Padé 项数"}
          </span>
          <strong id="padeMetric">{result === null ? "—" : `${result.parameters.nPade} / ref 10`}</strong>
        </div>
        <div className="metric">
          <span>
            {"计算网格步长"}
          </span>
          <strong id="stepMetric">{result === null ? "—" : `${formatPeValue(result.parameters.rangeStepM, 2)} m × ${formatPeValue(result.parameters.depthStepM, 2)} m`}</strong>
        </div>
        <div className="metric">
          <span>
            {"显示网格"}
          </span>
          <strong id="fieldShape">{result === null ? "—" : `${result.field.columns} × ${result.field.rows}`}</strong>
        </div>
        <div className="metric">
          <span>
            {"计算时间"}
          </span>
          <strong id="computeTime">{result === null ? "—" : `${formatPeValue(result.runtime.computeMs, 1)} ms`}</strong>
        </div>
      </div>
    </section>
  );
}
