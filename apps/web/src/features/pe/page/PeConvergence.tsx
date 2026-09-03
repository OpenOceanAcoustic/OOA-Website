import type { CSSProperties } from "react";
import { formatPeValue, type UsePePageResult } from "../hooks/usePePage";

export function PeConvergence({ page }: { readonly page: UsePePageResult }) {
  const nPade = Math.max(1, Math.min(10, Number(page.parameters.nPade) || 1));
  const result = page.result;
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
        <canvas ref={page.canvases.convergence} id="convergenceCanvas" tabIndex={0} aria-label="可点击选择 nPade 的误差收敛曲线" onPointerDown={page.selectPadeFromConvergence}></canvas>
        <span className="plot-note">
          {"CLICK A TERM COUNT"}
        </span>
      </div>
      <div className="result-parameter-control">
        <div className="range-control pade-control">
          <div className="range-title">
            <label htmlFor="nPade">Padé 项数 nPade</label>
            <output id="nPadeOut">{nPade} / ref 10 terms</output>
          </div>
          <input
            id="nPade"
            type="range"
            min="1"
            max="10"
            step="1"
            value={nPade}
            disabled={result === null || page.solveBusy}
            aria-describedby="nPadeEffect"
            onChange={(event) => { void page.selectPade(event.currentTarget.valueAsNumber); }}
          />
          <div className="pade-ticks" aria-hidden="true"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span><span>10</span></div>
        </div>
        <p className="parameter-effect" id="nPadeEffect">
          <strong>参数影响</strong>
          nPade 控制平方根传播算子的有理近似阶数；项数较少时宽角传播的相位和幅度截断误差通常更大，增加项数通常会向 nPade=10 参考场收敛。
          {result !== null ? ` 当前场的 ΔTL RMSE 为 ${formatPeValue(result.metrics.deltaRmsDb, 3)} dB，最大 |ΔTL| 为 ${formatPeValue(result.metrics.deltaMaxDb, 3)} dB。` : ""}
          本实验会预计算 1–10 阶声场，因此拖动滑块是切换已算结果；单次 RAM 推进中，更多 Padé 项通常意味着更多计算工作。
        </p>
      </div>
    </section>
  );
}
