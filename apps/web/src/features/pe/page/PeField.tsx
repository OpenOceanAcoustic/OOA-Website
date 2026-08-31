export function PeField() {
  return (
    <section className="panel pe-field-panel">
      <div className="panel-head">
        <div>
          <p className="micro">
            {"CURRENT APPROXIMATION"}
          </p>
          <h3 id="fieldTitle">
            {"nPade = 4 传播损失"}
          </h3>
        </div>
        <div className="field-scale">
          <span>
            {"60"}
          </span>
          <i></i>
          <span>
            {"120 dB"}
          </span>
        </div>
      </div>
      <div className="plot-wrap field-wrap">
        <canvas id="fieldCanvas" aria-label="当前 Padé 阶数的传播损失场"></canvas>
        <span className="plot-note">
          {"TL / dB · SELECTED RANGE ┆"}
        </span>
      </div>
      <div className="metric-strip">
        <div className="metric">
          <span>
            {"Padé 项数"}
          </span>
          <strong id="padeMetric">
            {"—"}
          </strong>
        </div>
        <div className="metric">
          <span>
            {"计算网格步长"}
          </span>
          <strong id="stepMetric">
            {"—"}
          </strong>
        </div>
        <div className="metric">
          <span>
            {"显示网格"}
          </span>
          <strong id="fieldShape">
            {"—"}
          </strong>
        </div>
        <div className="metric">
          <span>
            {"计算时间"}
          </span>
          <strong id="computeTime">
            {"—"}
          </strong>
        </div>
      </div>
    </section>
  );
}
