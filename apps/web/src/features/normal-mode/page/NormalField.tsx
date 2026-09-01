import type { UseNormalModePageResult } from "../hooks/useNormalModePage";

function format(value: number, digits = 3): string {
  return Number(value).toLocaleString("zh-CN", { maximumFractionDigits: digits });
}

export function NormalField({ page }: { readonly page: UseNormalModePageResult }) {
  const result = page.result;
  const singleMode = page.fieldView === "single";
  const modeLabel = `Mode ${String(page.selectedMode + 1).padStart(2, "0")}`;
  const active = result?.field.activeModeCount;
  return (
    <section className="panel field-panel">
      <div className="panel-head">
        <div>
          <p className="micro" id="fieldMicro">{singleMode ? "SELECTED SINGLE-MODE FIELD" : "TRUNCATED MODAL FIELD"}</p>
          <h3 id="fieldTitle">{singleMode ? `${modeLabel} 单模态传播损失` : `前 ${active ?? 24} 阶模态传播损失`}</h3>
        </div>
        <div className="field-head-tools">
          <div className="field-view-toggle" role="group" aria-label="声场显示方式">
            <button type="button" className={singleMode ? undefined : "active"} data-field-view="sum" aria-pressed={singleMode ? "false" : "true"} onClick={() => page.setFieldView("sum")}>
              {"模态叠加"}
            </button>
            <button type="button" className={singleMode ? "active" : undefined} data-field-view="single" aria-pressed={singleMode ? "true" : "false"} onClick={() => page.setFieldView("single")}>
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
        <canvas ref={page.canvases.field} id="fieldCanvas" aria-label="模态声场传播损失"></canvas>
        <span className="plot-note" id="fieldNote">{singleMode ? `${modeLabel.toUpperCase()} · TL / dB` : "TL / dB"}</span>
      </div>
      <div className="metric-strip">
        <div className="metric">
          <span id="activeModesLabel">{singleMode ? "当前单模态" : "参与叠加"}</span>
          <strong id="activeModes">{result === null ? "—" : singleMode ? `${modeLabel} / ${result.modes.count}` : `${active} / ${result.modes.count}`}</strong>
        </div>
        <div className="metric">
          <span>
            {"场网格"}
          </span>
          <strong id="fieldShape">{result === null ? "—" : `${result.field.columns} × ${result.field.rows}`}</strong>
        </div>
        <div className="metric">
          <span>
            {"声源深度"}
          </span>
          <strong id="sourceMetric">{result === null ? "—" : `${format(result.environment.sourceDepthM, 0)} m`}</strong>
        </div>
        <div className="metric">
          <span>
            {"计算时间"}
          </span>
          <strong id="computeTime">{result === null ? "—" : `${format(result.runtime.computeMs, 1)} ms`}</strong>
        </div>
      </div>
    </section>
  );
}
