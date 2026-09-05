import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";

interface VelocityGlossaryTerm {
  readonly id: string;
  readonly label: string;
  readonly symbol: string;
  readonly english: string;
  readonly definition: string;
  readonly relation: string;
  readonly position: {
    readonly x: string;
    readonly y: string;
    readonly duration: string;
    readonly delay: string;
    readonly drift: string;
  };
}

type VelocityTermStyle = CSSProperties & {
  readonly "--term-x": string;
  readonly "--term-y": string;
  readonly "--term-duration": string;
  readonly "--term-delay": string;
  readonly "--term-drift": string;
};

const TERMS: readonly VelocityGlossaryTerm[] = [
  {
    id: "particle-velocity",
    label: "质点振速",
    symbol: "v",
    english: "Particle velocity",
    definition: "声波通过介质时，介质质点围绕平衡位置振动所产生的瞬时速度，是具有方向的矢量。质点振速不同于描述波传播快慢的声速。",
    relation: "当前两张图分别展示质点振速在水平传播方向与垂直深度方向上的复数分量经幅值变换后的分布。",
    position: { x: "5%", y: "18%", duration: "21s", delay: "-3s", drift: "28px" },
  },
  {
    id: "horizontal-particle-velocity",
    label: "水平质点振速",
    symbol: "vᵣ",
    english: "Horizontal particle velocity (vᵣ)",
    definition: "质点振速沿水平传播距离方向的复数分量，既包含幅值，也保留相位信息。",
    relation: "水平质点振速图的数据源来自 ResultHandle.horizontal_velocity；页面把每个复数采样点转换为图示振速级。",
    position: { x: "29%", y: "11%", duration: "25s", delay: "-12s", drift: "38px" },
  },
  {
    id: "vertical-particle-velocity",
    label: "垂直质点振速",
    symbol: "v_z",
    english: "Vertical particle velocity (v_z)",
    definition: "质点振速沿垂直深度方向的复数分量，用来描述介质质点在水深方向上的振动。",
    relation: "垂直质点振速图的数据源来自 ResultHandle.vertical_velocity，并与水平分量使用同一接收网格绘制。",
    position: { x: "61%", y: "22%", duration: "18s", delay: "-7s", drift: "22px" },
  },
  {
    id: "complex-acoustic-field",
    label: "复数声场",
    symbol: "ℂ",
    english: "Complex acoustic field",
    definition: "在单频稳态计算中，用实部与虚部共同表示声压或质点振速，从而同时保存幅值和相位。",
    relation: "OOB 返回的水平、垂直振速都是复数声场数据；页面绘图前会将每对实部和虚部还原为一个复数采样点。",
    position: { x: "80%", y: "10%", duration: "23s", delay: "-16s", drift: "34px" },
  },
  {
    id: "complex-velocity-magnitude",
    label: "复振速幅值",
    symbol: "|v|",
    english: "Complex velocity magnitude |v|",
    definition: "某一复振速分量的模，按 |v| = √(Re(v)² + Im(v)²) 计算，是不含相位的非负标量。",
    relation: "当前颜色值先由水平或垂直分量的实部、虚部算出 |v|，再经过对数变换和显示范围裁剪。",
    position: { x: "14%", y: "51%", duration: "17s", delay: "-9s", drift: "20px" },
  },
  {
    id: "displayed-velocity-level",
    label: "图示振速级",
    symbol: "dB*",
    english: "Displayed velocity level",
    definition: "页面采用 −20 log₁₀|v| 得到用于着色的数值，并将显示范围裁剪到 30–120 dB。它没有引入参考振速，因此不是绝对振速级。",
    relation: "两张图的色标和悬停读数展示的就是这个可视化量，适合比较图内空间分布，不应解读为带物理参考量的绝对级。",
    position: { x: "42%", y: "43%", duration: "20s", delay: "-1s", drift: "42px" },
  },
  {
    id: "velocity-phase",
    label: "相位",
    symbol: "arg(v)",
    english: "Phase arg(v)",
    definition: "复振速分量的相角，通常由 atan2(Im(v), Re(v)) 求得，用于描述相对于谐波基准的振动时序。",
    relation: "当前色彩图只使用 |v|，没有直接显示相位；原始交错复数数组仍保留了计算相位所需的实部和虚部。",
    position: { x: "70%", y: "53%", duration: "24s", delay: "-14s", drift: "30px" },
  },
  {
    id: "receiver-grid",
    label: "接收网格",
    symbol: "r × z",
    english: "Receiver grid",
    definition: "由接收距离采样点与接收深度采样点组合成的二维计算网格，每个网格位置对应一个声场结果。",
    relation: "水平图和垂直图共享相同的列数、行数以及距离—深度坐标，因此同一像素位置可对照两个方向的结果。",
    position: { x: "4%", y: "77%", duration: "22s", delay: "-18s", drift: "36px" },
  },
  {
    id: "oob-result-handle",
    label: "OOB 原生 ResultHandle",
    symbol: "↗",
    english: "OOB native ResultHandle",
    definition: "OOB WebAssembly 求解完成后提供的原生结果访问对象，用于读取声线、声场以及水平和垂直质点振速等计算数据。",
    relation: "本区域两张图所需的复振速数组，分别通过 ResultHandle 的 horizontal_velocity 与 vertical_velocity 字段取得。",
    position: { x: "24%", y: "68%", duration: "19s", delay: "-5s", drift: "24px" },
  },
  {
    id: "horizontal-velocity-field",
    label: "horizontal_velocity",
    symbol: "H",
    english: "horizontal_velocity",
    definition: "ResultHandle 中保存水平质点振速复数采样值的字段，数据按接收网格顺序排列。",
    relation: "运行时读取该字段的交错实部、虚部，生成水平质点振速图使用的 horizontal_db 数组。",
    position: { x: "48%", y: "78%", duration: "26s", delay: "-21s", drift: "40px" },
  },
  {
    id: "vertical-velocity-field",
    label: "vertical_velocity",
    symbol: "V",
    english: "vertical_velocity",
    definition: "ResultHandle 中保存垂直质点振速复数采样值的字段，与水平字段具有相同的接收网格维度。",
    relation: "运行时读取该字段的交错实部、虚部，生成垂直质点振速图使用的 vertical_db 数组。",
    position: { x: "72%", y: "73%", duration: "16s", delay: "-8s", drift: "18px" },
  },
  {
    id: "interleaved-complex-array",
    label: "交错复数数组",
    symbol: "Re·Im",
    english: "Interleaved complex array",
    definition: "按 [Re₀, Im₀, Re₁, Im₁, …] 顺序连续保存复数的数组，每两个相邻数共同表示一个网格采样点。",
    relation: "页面按索引读取 2i 与 2i + 1 位置，分别作为第 i 个振速采样点的实部和虚部，再计算其幅值。",
    position: { x: "84%", y: "43%", duration: "20s", delay: "-11s", drift: "32px" },
  },
] as const;

function termStyle(term: VelocityGlossaryTerm): VelocityTermStyle {
  return {
    "--term-x": term.position.x,
    "--term-y": term.position.y,
    "--term-duration": term.position.duration,
    "--term-delay": term.position.delay,
    "--term-drift": term.position.drift,
  };
}

export function VelocityGlossary() {
  const [activeTerm, setActiveTerm] = useState<VelocityGlossaryTerm | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const closeDialog = useCallback(() => {
    setActiveTerm(null);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (activeTerm === null) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [activeTerm, closeDialog]);

  const openDialog = (term: VelocityGlossaryTerm, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setActiveTerm(term);
  };

  const handleBackdropClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) closeDialog();
  };

  return (
    <aside className="velocity-glossary" data-testid="velocity-glossary" aria-labelledby="velocityGlossaryTitle">
      <header className="velocity-glossary-head">
        <div className="velocity-glossary-copy">
          <span className="micro">
            {"OOB 原生结果句柄"}
          </span>
          <h4 id="velocityGlossaryTitle">
            {"流动术语图谱"}
          </h4>
          <p>
            {"点击漂浮词条，查看它与当前质点振速图的关系。"}
          </p>
        </div>
        <code className="velocity-glossary-handle">
          {"ResultHandle.horizontal_velocity · ResultHandle.vertical_velocity"}
        </code>
      </header>

      <div className="velocity-term-stream" data-testid="velocity-term-stream" aria-label="质点振速名词流">
        {TERMS.map((term) => (
          <button
            type="button"
            className="velocity-term"
            id={`velocityTerm-${term.id}`}
            data-testid={`velocity-term-${term.id}`}
            data-term-id={term.id}
            style={termStyle(term)}
            aria-haspopup="dialog"
            aria-controls="velocityGlossaryDialog"
            aria-expanded={activeTerm?.id === term.id}
            onClick={(event) => openDialog(term, event.currentTarget)}
            key={term.id}
          >
            <span className="velocity-term-label">
              {term.label}
            </span>
            <span className="velocity-term-symbol" aria-hidden="true">
              {term.symbol}
            </span>
          </button>
        ))}
      </div>

      {activeTerm !== null ? (
        <div
          className="velocity-glossary-backdrop"
          data-testid="velocity-glossary-backdrop"
          onClick={handleBackdropClick}
        >
          <div
            className="velocity-glossary-dialog"
            id="velocityGlossaryDialog"
            data-testid="velocity-glossary-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="velocityGlossaryDialogTitle"
            aria-describedby="velocityGlossaryDialogDefinition velocityGlossaryDialogRelation"
          >
            <button
              type="button"
              className="velocity-glossary-close"
              ref={closeRef}
              onClick={closeDialog}
              aria-label={`关闭“${activeTerm.label}”名词解释`}
            >
              {"关闭 ×"}
            </button>
            <p className="micro">
              {"VELOCITY GLOSSARY"}
            </p>
            <h4 id="velocityGlossaryDialogTitle">
              {activeTerm.label}
            </h4>
            <p className="velocity-glossary-english">
              {activeTerm.english}
            </p>
            <div className="velocity-glossary-definition" id="velocityGlossaryDialogDefinition">
              <strong>
                {"名词解释"}
              </strong>
              <p>
                {activeTerm.definition}
              </p>
            </div>
            <div className="velocity-glossary-relation" id="velocityGlossaryDialogRelation">
              <strong>
                {"与当前图 / 数据的关系"}
              </strong>
              <p>
                {activeTerm.relation}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
