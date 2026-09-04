import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { renderPeMarch } from "../canvas/pe-theory-renderer";

export function PeTheorySection() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const progress = useRef(0.16);
  const [playing, setPlaying] = useState(() => (
    typeof window === "undefined"
    || typeof window.matchMedia !== "function"
    || !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ));

  const draw = useCallback((currentProgress: number) => {
    if (canvas.current) renderPeMarch(canvas.current, currentProgress);
  }, []);

  useLayoutEffect(() => draw(progress.current), [draw]);

  useEffect(() => {
    if (!canvas.current) return undefined;
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => draw(progress.current));
      observer.observe(canvas.current);
      return () => observer.disconnect();
    }
    const redraw = () => draw(progress.current);
    window.addEventListener("resize", redraw);
    return () => window.removeEventListener("resize", redraw);
  }, [draw]);

  useEffect(() => {
    if (!playing || typeof window.requestAnimationFrame !== "function") return undefined;
    let animationFrame = 0;
    let previousTime = performance.now();
    const animate = (currentTime: number) => {
      const elapsedSeconds = Math.min((currentTime - previousTime) / 1000, 0.05);
      previousTime = currentTime;
      progress.current = (progress.current + elapsedSeconds * 0.075) % 1;
      draw(progress.current);
      animationFrame = window.requestAnimationFrame(animate);
    };
    animationFrame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [draw, playing]);

  const restart = () => {
    progress.current = 0;
    draw(0);
  };

  return (
    <section className="pe-theory" aria-labelledby="peTheoryTitle">
      <div className="workspace-heading pe-theory-heading">
        <div><p className="micro">01 · RANGE MARCHING</p><h2 id="peTheoryTitle">把声场从 r 递推到 r + Δr</h2></div>
        <p>PE 不一次求出整个二维声场，而是反复应用单步传播算子，沿距离方向向前推进。</p>
      </div>

      <div className="pe-theory-formula" aria-label="抛物方程单步递推公式">
        <PeMarchEquation />
        <span>当前垂向场</span><i>经过一次传播算子</i><span>得到下一距离步</span>
      </div>

      <div className="pe-theory-meaning">
        <article><code>δ = ik₀Δr</code><p>决定一次向前推进的距离和参考相位积累。</p></article>
        <article><code>Z</code><p>汇集深度方向衍射、声速变化引起的折射以及边界影响。</p></article>
        <article><code>e<sup>{"δ[-1+√(1+Z)]"}</sup></code><p>单步传播算子；对它重复作用，就从声源平面推到远距离。</p></article>
        <article><code>Padé(n)</code><p>用 n 项有理式逼近平方根算子；阶数越高，宽角传播通常越准确。</p></article>
      </div>

      <article className="pe-theory-stage">
        <header>
          <div><p>ONE DISPLAY · CURRENT → OPERATOR → NEXT</p><h3>距离步进中的声场</h3></div>
          <div className="pe-theory-actions">
            <button type="button" onClick={() => setPlaying((current) => !current)}>
              <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>{playing ? "暂停递推" : "播放递推"}
            </button>
            <button type="button" className="secondary" onClick={restart}>从声源重播</button>
          </div>
        </header>
        <div className="pe-theory-canvas"><canvas ref={canvas} aria-label="抛物方程沿距离方向逐步递推声场动画" /></div>
        <p className="pe-theory-note">
          青线是已知切片 u(r)，橙线是下一切片 u(r+Δr)；两线之间只执行一次算子。橙线随后成为新的青线，过程不断重复。
        </p>
      </article>

      <p className="pe-theory-footnote">示意动画突出递推关系；下方 RAM WASM 实验台使用 Padé 有理逼近完成实际宽角传播计算。</p>
    </section>
  );
}

function PeMarchEquation() {
  return (
    <div className="pe-theory-formula-main">
      <math display="block" aria-label="u 在 r 加 delta r 处等于指数传播算子作用于 u 在 r 处">
        <mrow>
          <mi>u</mi><mo stretchy="false">(</mo><mi>r</mi><mo>+</mo><mi>Δ</mi><mi>r</mi><mo stretchy="false">)</mo>
          <mo>=</mo>
          <msup>
            <mi mathvariant="normal">e</mi>
            <mrow>
              <mi>δ</mi><mo>[</mo><mo>−</mo><mn>1</mn><mo>+</mo><msqrt><mrow><mn>1</mn><mo>+</mo><mi>Z</mi></mrow></msqrt><mo>]</mo>
            </mrow>
          </msup>
          <mi>u</mi><mo stretchy="false">(</mo><mi>r</mi><mo stretchy="false">)</mo>
        </mrow>
      </math>
    </div>
  );
}
