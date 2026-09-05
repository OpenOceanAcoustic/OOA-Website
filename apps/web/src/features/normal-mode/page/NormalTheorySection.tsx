import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  renderDispersion,
  renderStandingModes,
  renderTravelingModes,
  type NormalTheoryParameters,
  type NormalTheoryProfile,
} from "../canvas/normal-theory-renderer";

const PROFILE_LABELS: Record<NormalTheoryProfile, string> = {
  pekeris: "Pekeris · 均匀水层",
  "surface-duct": "表面声道 · c 随深度增大",
  "deep-channel": "深海声道 · 中深层低速",
};

export function NormalTheorySection() {
  const [parameters, setParameters] = useState<NormalTheoryParameters>({
    frequencyHz: 100,
    modeCount: 4,
    profile: "pekeris",
  });
  const [playing, setPlaying] = useState(() => (
    typeof window === "undefined"
    || typeof window.matchMedia !== "function"
    || !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ));
  const standingCanvas = useRef<HTMLCanvasElement>(null);
  const dispersionCanvas = useRef<HTMLCanvasElement>(null);
  const travelingCanvas = useRef<HTMLCanvasElement>(null);
  const phase = useRef(0.45);

  const drawAll = useCallback((currentPhase: number) => {
    if (standingCanvas.current) renderStandingModes(standingCanvas.current, parameters, currentPhase);
    if (dispersionCanvas.current) renderDispersion(dispersionCanvas.current, parameters, currentPhase);
    if (travelingCanvas.current) renderTravelingModes(travelingCanvas.current, parameters, currentPhase);
  }, [parameters]);

  useLayoutEffect(() => {
    drawAll(phase.current);
  }, [drawAll]);

  useEffect(() => {
    const canvases = [standingCanvas.current, dispersionCanvas.current, travelingCanvas.current]
      .filter((canvas): canvas is HTMLCanvasElement => canvas !== null);
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => drawAll(phase.current));
      canvases.forEach((canvas) => observer.observe(canvas));
      return () => observer.disconnect();
    }
    const redraw = () => drawAll(phase.current);
    window.addEventListener("resize", redraw);
    return () => window.removeEventListener("resize", redraw);
  }, [drawAll]);

  useEffect(() => {
    if (!playing || typeof window.requestAnimationFrame !== "function") return undefined;
    let animationFrame = 0;
    let previousTime = performance.now();
    const animate = (currentTime: number) => {
      const elapsedSeconds = Math.min((currentTime - previousTime) / 1000, 0.05);
      previousTime = currentTime;
      phase.current = (phase.current + elapsedSeconds * 0.72) % (Math.PI * 2);
      drawAll(phase.current);
      animationFrame = window.requestAnimationFrame(animate);
    };
    animationFrame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [drawAll, playing]);

  const updateParameter = <Key extends keyof NormalTheoryParameters>(
    key: Key,
    value: NormalTheoryParameters[Key],
  ) => {
    setParameters((current) => ({ ...current, [key]: value }));
  };

  const resetAnimation = () => {
    phase.current = 0;
    drawAll(0);
  };

  return (
    <section className="normal-theory" aria-labelledby="normalTheoryTitle">
      <div className="workspace-heading normal-theory-heading">
        <div>
          <p className="micro">01 · HOW NORMAL MODES PROPAGATE</p>
          <h2 id="normalTheoryTitle">一个模态：竖直驻波 × 水平行波</h2>
        </div>
        <p>源在深度方向激发离散模态，每个模态再通过 Hankel 柱面波沿水平距离传播。</p>
      </div>

      <div className="normal-theory-controls" aria-label="简正波原理图控制栏">
        <label className="normal-theory-control normal-theory-control-range">
          <span><b>频率</b><output>{parameters.frequencyHz} Hz</output></span>
          <input
            type="range"
            min="50"
            max="500"
            step="25"
            value={parameters.frequencyHz}
            onChange={(event) => updateParameter("frequencyHz", Number(event.currentTarget.value))}
          />
          <small>频率改变 kᵣₘ 与群速度；t–y 图会显示不同频率的传播速度</small>
        </label>

        <label className="normal-theory-control normal-theory-control-range">
          <span><b>展示模态数</b><output>前 {parameters.modeCount} 阶</output></span>
          <input
            type="range"
            min="1"
            max="6"
            step="1"
            value={parameters.modeCount}
            onChange={(event) => updateParameter("modeCount", Number(event.currentTarget.value))}
          />
          <small>模态数决定参与求和的竖直本征函数数量</small>
        </label>

        <label className="normal-theory-control normal-theory-profile-control">
          <span><b>声速剖面</b><output>c(z)</output></span>
          <select
            value={parameters.profile}
            onChange={(event) => updateParameter("profile", event.currentTarget.value as NormalTheoryProfile)}
          >
            {Object.entries(PROFILE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <small>c(z) 决定竖直本征函数 ψₘ 与水平波数 kᵣₘ</small>
        </label>

        <div className="normal-theory-animation-control">
          <span><b>慢动作相位</b><output>{playing ? "RUNNING" : "PAUSED"}</output></span>
          <div>
            <button type="button" onClick={() => setPlaying((current) => !current)}>
              <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>
              {playing ? "暂停动画" : "播放动画"}
            </button>
            <button type="button" className="secondary" onClick={resetAnimation}>相位归零</button>
          </div>
          <small>同步播放竖直驻波、水平行波和底部频散波包</small>
        </div>
      </div>

      <div className="normal-theory-formula" aria-label="简正波声压展开式">
        <NormalModeEquation />
        <div className="normal-theory-formula-terms">
          <article><code>ψₘ(zₛ)</code><p>源耦合：位于 zₛ 的声源能激发第 m 阶模态多少</p></article>
          <article><code>ψₘ(zᵣ)</code><p>接收采样：接收深度 zᵣ 处能观测到该模态多少</p></article>
          <article><code>H₀⁽¹⁾(kᵣₘr)</code><p>水平传播：携带相位向外行进，并随柱面扩散衰减</p></article>
          <article><code>Σₘ</code><p>相干叠加：所有模态按复振幅与相位相加得到声压</p></article>
        </div>
      </div>

      <div className="normal-theory-grid">
        <TheoryCard
          index="01"
          eyebrow="DEPTH · STANDING WAVE"
          title="ψₘ(z)：竖直方向类似驻波"
          equation="ψₘ(z) ≈ sin(mπz / D)"
          note="边界条件只允许离散的深度形状。亮线振动时波腹改变正负，但节点固定；ψₘ(zₛ) 和 ψₘ(zᵣ) 分别在源、接收深度读取这个形状。"
        >
          <canvas ref={standingCanvas} aria-label={`前 ${parameters.modeCount} 阶深度驻波动画`} />
        </TheoryCard>

        <TheoryCard
          index="02"
          eyebrow="RANGE · CYLINDRICAL WAVE"
          title="Hankel(kᵣₘr)：水平方向是行波"
          equation="H₀⁽¹⁾(kᵣₘr) ~ eⁱ⁽ᵏʳᵐʳ⁻π/⁴⁾ / √r"
          note="波峰随时间沿 r 方向移动，表示相位推进；振幅外包络近似按 1/√r 衰减。它与只在原位振动的 ψₘ(z) 是两种不同的空间行为。"
        >
          <canvas ref={travelingCanvas} aria-label="各阶模态柱面行波随距离传播示意图" />
        </TheoryCard>

        <TheoryCard
          index="03"
          eyebrow="DISPERSION · WAVE PACKET"
          title="同一个波包边传播、边展宽"
          equation="p(y,t) = ∫ A(ω)eⁱ⁽ᵏ⁽ω⁾ʸ⁻ωᵗ⁾ dω"
          note="动画由 101 个频率分量相干叠加。低频长波传播稍快而移动到前缘，高频短波稍慢而落在后缘，所以波包向右运动时包络不断展宽、峰值下降。"
          wide
        >
          <canvas ref={dispersionCanvas} aria-label="由多个频率分量叠加的单个色散波包传播动画" />
        </TheoryCard>
      </div>

      <p className="normal-theory-footnote">
        示意图采用 200 m 理想波导，并放慢时间、压缩水平相位；下方实验台由 Kraken WASM 计算真实 ψₘ、kᵣₘ 与模态叠加声场。
      </p>
    </section>
  );
}

function NormalModeEquation() {
  return (
    <div className="normal-theory-formula-main">
      <math display="block" aria-label="p 等于 i 除以源深度密度，乘以所有模态的接收本征函数、源本征函数和 Hankel 行波之和">
        <mrow>
          <mi>p</mi><mo stretchy="false">(</mo><mi>r</mi><mo>,</mo><msub><mi>z</mi><mi>r</mi></msub><mo>;</mo><msub><mi>z</mi><mi>s</mi></msub><mo stretchy="false">)</mo>
          <mo>=</mo>
          <mfrac>
            <mi mathvariant="normal">i</mi>
            <mrow><mi>ρ</mi><mo stretchy="false">(</mo><msub><mi>z</mi><mi>s</mi></msub><mo stretchy="false">)</mo></mrow>
          </mfrac>
          <munderover>
            <mo>∑</mo>
            <mrow><mi>m</mi><mo>=</mo><mn>1</mn></mrow>
            <mi>M</mi>
          </munderover>
          <msub><mi>ψ</mi><mi>m</mi></msub><mo stretchy="false">(</mo><msub><mi>z</mi><mi>r</mi></msub><mo stretchy="false">)</mo>
          <msub><mi>ψ</mi><mi>m</mi></msub><mo stretchy="false">(</mo><msub><mi>z</mi><mi>s</mi></msub><mo stretchy="false">)</mo>
          <msubsup><mi mathvariant="normal">H</mi><mn>0</mn><mrow><mo stretchy="false">(</mo><mn>1</mn><mo stretchy="false">)</mo></mrow></msubsup>
          <mo stretchy="false">(</mo><msub><mi>k</mi><mrow><mi>r</mi><mi>m</mi></mrow></msub><mi>r</mi><mo stretchy="false">)</mo>
        </mrow>
      </math>
    </div>
  );
}

function TheoryCard({
  index,
  eyebrow,
  title,
  equation,
  note,
  wide = false,
  children,
}: {
  readonly index: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly equation: string;
  readonly note: string;
  readonly wide?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <article className={`normal-theory-card${wide ? " normal-theory-card-wide" : ""}`}>
      <header>
        <span className="normal-theory-index">{index}</span>
        <div><p>{eyebrow}</p><h3>{title}</h3></div>
      </header>
      <div className="normal-theory-equation">{equation}</div>
      <div className="normal-theory-canvas">{children}</div>
      <p className="normal-theory-note">{note}</p>
    </article>
  );
}
