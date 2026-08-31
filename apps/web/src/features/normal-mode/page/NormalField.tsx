export function NormalField() {
  return (
    <section className="panel field-panel">
      <div className="panel-head">
        <div>
          <p className="micro" id="fieldMicro">
            {"TRUNCATED MODAL FIELD"}
          </p>
          <h3 id="fieldTitle">
            {"前 24 阶模态传播损失"}
          </h3>
        </div>
        <div className="field-head-tools">
          <div className="field-view-toggle" role="group" aria-label="声场显示方式">
            <button type="button" className="active" data-field-view="sum" aria-pressed="true">
              {"模态叠加"}
            </button>
            <button type="button" data-field-view="single" aria-pressed="false">
              {"单模态"}
            </button>
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
      </div>
      <div className="plot-wrap field-wrap">
        <canvas id="fieldCanvas" aria-label="模态声场传播损失"></canvas>
        <span className="plot-note" id="fieldNote">
          {"TL / dB"}
        </span>
      </div>
      <div className="metric-strip">
        <div className="metric">
          <span id="activeModesLabel">
            {"参与叠加"}
          </span>
          <strong id="activeModes">
            {"—"}
          </strong>
        </div>
        <div className="metric">
          <span>
            {"场网格"}
          </span>
          <strong id="fieldShape">
            {"—"}
          </strong>
        </div>
        <div className="metric">
          <span>
            {"声源深度"}
          </span>
          <strong id="sourceMetric">
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
