import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";

export interface FloatingGlossaryTerm {
  readonly id: string;
  readonly label: string;
  readonly symbol: string;
  readonly english: string;
  readonly definition: string;
  readonly relation: string;
  readonly motion: {
    readonly duration: string;
    readonly delay: string;
    readonly drift: string;
  };
}

type FloatingTermStyle = CSSProperties & {
  readonly "--term-duration": string;
  readonly "--term-delay": string;
  readonly "--term-drift": string;
};

interface FloatingGlossaryProps {
  readonly scope: "velocity" | "ray-geometry" | "transmission-loss";
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly source: string;
  readonly streamLabel: string;
  readonly dialogEyebrow: string;
  readonly terms: readonly FloatingGlossaryTerm[];
}

const motion = (duration: string, delay: string, drift: string): FloatingGlossaryTerm["motion"] => ({
  duration,
  delay,
  drift,
});

const VELOCITY_TERMS: readonly FloatingGlossaryTerm[] = [
  {
    id: "particle-velocity",
    label: "质点振速",
    symbol: "v",
    english: "Particle velocity",
    definition: "声波通过介质时，介质质点围绕平衡位置振动所产生的瞬时速度，是具有方向的矢量。质点振速不同于描述波传播快慢的声速。",
    relation: "当前两张图分别展示质点振速在水平传播方向与垂直深度方向上的复数分量经幅值变换后的分布。",
    motion: motion("21s", "-3s", "18px"),
  },
  {
    id: "horizontal-particle-velocity",
    label: "水平质点振速",
    symbol: "vᵣ",
    english: "Horizontal particle velocity (vᵣ)",
    definition: "质点振速沿水平传播距离方向的复数分量，既包含幅值，也保留相位信息。",
    relation: "水平质点振速图的数据源来自 PressureField.horizontalVelocityInterleaved；页面把每个复数采样点转换为图示振速级。",
    motion: motion("25s", "-12s", "22px"),
  },
  {
    id: "vertical-particle-velocity",
    label: "垂直质点振速",
    symbol: "v_z",
    english: "Vertical particle velocity (v_z)",
    definition: "质点振速沿垂直深度方向的复数分量，用来描述介质质点在水深方向上的振动。",
    relation: "垂直质点振速图的数据源来自 PressureField.verticalVelocityInterleaved，并与水平分量使用同一接收网格绘制。",
    motion: motion("18s", "-7s", "15px"),
  },
  {
    id: "complex-acoustic-field",
    label: "复数声场",
    symbol: "ℂ",
    english: "Complex acoustic field",
    definition: "在单频稳态计算中，用实部与虚部共同表示声压或质点振速，从而同时保存幅值和相位。",
    relation: "OOB 返回的水平、垂直振速都是复数声场数据；页面绘图前会将每对实部和虚部还原为一个复数采样点。",
    motion: motion("23s", "-16s", "20px"),
  },
  {
    id: "complex-velocity-magnitude",
    label: "复振速幅值",
    symbol: "|v|",
    english: "Complex velocity magnitude |v|",
    definition: "某一复振速分量的模，按 |v| = √(Re(v)² + Im(v)²) 计算，是不含相位的非负标量。",
    relation: "当前颜色值先由水平或垂直分量的实部、虚部算出 |v|，再经过对数变换和显示范围裁剪。",
    motion: motion("17s", "-9s", "14px"),
  },
  {
    id: "displayed-velocity-level",
    label: "图示振速级",
    symbol: "dB*",
    english: "Displayed velocity level",
    definition: "页面采用 −20 log₁₀|v| 得到用于着色的数值，并将显示范围裁剪到 30–120 dB。它没有引入参考振速，因此不是绝对振速级。",
    relation: "两张图的色标和悬停读数展示的就是这个可视化量，适合比较图内空间分布，不应解读为带物理参考量的绝对级。",
    motion: motion("20s", "-1s", "24px"),
  },
  {
    id: "velocity-phase",
    label: "相位",
    symbol: "arg(v)",
    english: "Phase arg(v)",
    definition: "复振速分量的相角，通常由 atan2(Im(v), Re(v)) 求得，用于描述相对于谐波基准的振动时序。",
    relation: "当前色彩图只使用 |v|，没有直接显示相位；原始交错复数数组仍保留了计算相位所需的实部和虚部。",
    motion: motion("24s", "-14s", "18px"),
  },
  {
    id: "receiver-grid",
    label: "接收网格",
    symbol: "r × z",
    english: "Receiver grid",
    definition: "由接收距离采样点与接收深度采样点组合成的二维计算网格，每个网格位置对应一个声场结果。",
    relation: "水平图和垂直图共享相同的列数、行数以及距离—深度坐标，因此同一像素位置可对照两个方向的结果。",
    motion: motion("22s", "-18s", "21px"),
  },
  {
    id: "oob-result-handle",
    label: "OOB 原生结果对象",
    symbol: "↗",
    english: "OOB native result objects",
    definition: "OOB WebAssembly 求解完成后返回 Bellhop2DResult；其 rays() 提供声线路径，pressureField(0) 提供接收网格上的声压、传播损失和质点振速。",
    relation: "本区域两张图所需的复振速数组，分别来自 PressureField.horizontalVelocityInterleaved 与 PressureField.verticalVelocityInterleaved。",
    motion: motion("19s", "-5s", "16px"),
  },
  {
    id: "horizontal-velocity-field",
    label: "水平振速原始数据",
    symbol: "H",
    english: "PressureField.horizontalVelocityInterleaved",
    definition: "PressureField 中保存水平质点振速复数采样值的 horizontalVelocityInterleaved 字段，数据按接收网格顺序排列。",
    relation: "运行时读取该字段的交错实部、虚部，生成水平质点振速图使用的 horizontal_db 数组。",
    motion: motion("26s", "-21s", "23px"),
  },
  {
    id: "vertical-velocity-field",
    label: "垂直振速原始数据",
    symbol: "V",
    english: "PressureField.verticalVelocityInterleaved",
    definition: "PressureField 中保存垂直质点振速复数采样值的 verticalVelocityInterleaved 字段，与水平字段具有相同的接收网格维度。",
    relation: "运行时读取该字段的交错实部、虚部，生成垂直质点振速图使用的 vertical_db 数组。",
    motion: motion("16s", "-8s", "13px"),
  },
  {
    id: "interleaved-complex-array",
    label: "交错复数数组",
    symbol: "Re·Im",
    english: "Interleaved complex array",
    definition: "按 [Re₀, Im₀, Re₁, Im₁, …] 顺序连续保存复数的数组，每两个相邻数共同表示一个网格采样点。",
    relation: "页面按索引读取 2i 与 2i + 1 位置，分别作为第 i 个振速采样点的实部和虚部，再计算其幅值。",
    motion: motion("20s", "-11s", "19px"),
  },
] as const;

const RAY_GEOMETRY_TERMS: readonly FloatingGlossaryTerm[] = [
  {
    id: "acoustic-ray",
    label: "声线",
    symbol: "Γ",
    english: "Acoustic ray",
    definition: "几何声学中用来表示声能局部传播方向的曲线，曲线在每一点都与局部波阵面的法线一致。它是传播路径模型，不是水体质点的运动轨迹。",
    relation: "声线轨迹图从 Bellhop2DResult.rays() 读取每条路径的距离—深度采样点，再按顺序连线绘制。",
    motion: motion("20s", "-4s", "10px"),
  },
  {
    id: "launch-angle",
    label: "发射角",
    symbol: "θ₀",
    english: "Launch angle",
    definition: "声线在声源处的初始传播方向角，它决定声线离开声源后的初始走向。",
    relation: "页面在所选最小—最大发射角之间取样并交给 OOB 求解；图下方同时显示这段角度范围。",
    motion: motion("24s", "-13s", "12px"),
  },
  {
    id: "sound-speed-profile",
    label: "声速剖面",
    symbol: "c",
    english: "Sound-speed profile",
    definition: "描述声速随深度变化的函数；在二维环境中还可以随传播距离变化。声速的空间梯度会改变声线方向。",
    relation: "当前环境的一维或二维声速数据直接进入 Bellhop2D，轨迹中的弯曲来自原生求解而不是前端曲线拟合。",
    motion: motion("18s", "-8s", "9px"),
  },
  {
    id: "refraction",
    label: "折射",
    symbol: "∇c",
    english: "Refraction",
    definition: "声线在非均匀声速场中连续改变方向的现象；在常见分层介质里，路径会向较低声速一侧弯曲。",
    relation: "图中不接触边界却逐渐弯曲的路径段体现了声速梯度造成的折射。",
    motion: motion("22s", "-17s", "11px"),
  },
  {
    id: "turning-point",
    label: "转向点",
    symbol: "dz/ds = 0",
    english: "Turning point",
    definition: "声线因折射使垂直传播方向发生反转、但没有接触海面或海底的位置；该点处路径的深度变化率瞬时为零。",
    relation: "声道环境中的平滑拐回通常就是转向点，它与发生在边界处的反射不同。",
    motion: motion("17s", "-2s", "8px"),
  },
  {
    id: "boundary-reflection",
    label: "边界反射",
    symbol: "S / B",
    english: "Boundary reflection",
    definition: "声线到达海面或海底边界后改变传播方向的过程。内置环境使用真空海面和流体半空间海底，导入 ENV 时保留边界类型与地形；页面底质声速、吸收和密度会覆盖对应的海底半空间参数。",
    relation: "轨迹图呈现反射后的几何路径；边界材料对幅度和能量的影响则主要体现在传播损失结果中。",
    motion: motion("23s", "-15s", "12px"),
  },
  {
    id: "bathymetry",
    label: "海底地形",
    symbol: "z_b(r)",
    english: "Bathymetry",
    definition: "海底深度随水平距离变化形成的边界曲线，用来描述平底、斜坡或更复杂的距离相关地形。",
    relation: "页面把计算结果中的 bathymetry 叠加在声线图上；没有距离相关地形数据时显示为平底。",
    motion: motion("19s", "-10s", "9px"),
  },
  {
    id: "display-rays",
    label: "显示声线",
    symbol: "N = 50",
    english: "Display rays",
    definition: "为了清晰展示传播几何而选取的一组声线路径，并不等同于合成声场所使用的全部角度样本。",
    relation: "当前页面固定采样 50 条显示声线并分批运行 RunMode.RAY；传播损失使用另一组场计算声线。",
    motion: motion("25s", "-20s", "10px"),
  },
] as const;

const TRANSMISSION_LOSS_TERMS: readonly FloatingGlossaryTerm[] = [
  {
    id: "transmission-loss",
    label: "传播损失",
    symbol: "TL",
    english: "Transmission loss",
    definition: "传播过程中接收声压相对于求解器参考声压的衰减，常写作 TL = −20 log₁₀|p/p_ref|；数值越大表示相对接收场越弱。",
    relation: "页面直接读取 PressureField.transmissionLossDb，并把用于着色的显示范围裁剪到 40–100 dB。",
    motion: motion("21s", "-5s", "10px"),
  },
  {
    id: "complex-pressure",
    label: "复声压",
    symbol: "p",
    english: "Complex acoustic pressure",
    definition: "单频稳态声场的相量表示，实部和虚部共同保存声压幅值与相位。",
    relation: "OOB 在每个接收网格点计算复声压并给出其传播损失派生量；当前色彩图不单独显示相位。",
    motion: motion("18s", "-11s", "9px"),
  },
  {
    id: "coherent-sum",
    label: "相干叠加",
    symbol: "Σp",
    english: "Coherent summation",
    definition: "先保留相位对各到达分量的复声压求和，再由合成结果计算幅值，因此会出现相长与相消干涉。",
    relation: "选择 COHERENT_TL 时，传播损失图保留各路径之间的相位关系和干涉细节。",
    motion: motion("24s", "-18s", "12px"),
  },
  {
    id: "incoherent-sum",
    label: "非相干叠加",
    symbol: "Σ|p|²",
    english: "Incoherent summation",
    definition: "按各到达分量的功率或强度求和而不保留相对相位，因此不会形成同样细密的相消干涉条纹。",
    relation: "选择 INCOHERENT_TL 时使用这种场叠加方式，结果通常比相干传播损失更平滑。",
    motion: motion("20s", "-3s", "11px"),
  },
  {
    id: "receiver-grid",
    label: "接收网格",
    symbol: "r × z",
    english: "Receiver grid",
    definition: "接收距离轴与接收深度轴组合成的二维采样网格，每个交点都对应一个求解后的声场值。",
    relation: "传播损失数组的列对应距离、行对应深度，画面中的每个色块来自一个接收网格采样点。",
    motion: motion("17s", "-9s", "8px"),
  },
  {
    id: "beam-type",
    label: "波束类型",
    symbol: "BeamType",
    english: "Beam type",
    definition: "描述单条声线周围声束影响的数值模型，包括几何波束、Gaussian 波束以及笛卡尔或声线中心坐标形式。",
    relation: "当前 BeamType 选择会传给 OOB，并影响接收网格上声场与传播损失的构建方式。",
    motion: motion("23s", "-16s", "12px"),
  },
  {
    id: "field-rays",
    label: "场计算声线",
    symbol: "N_field",
    english: "Field-computation rays",
    definition: "为在整个接收网格上合成声场而计算的发射角样本，其数量可以多于只用于轨迹展示的声线。",
    relation: "页面默认请求 1,000 条，或使用导入环境的 Nbeams；若估算超过 256 MiB 场内存预算会自动下调，标题处显示实际数量。",
    motion: motion("19s", "-7s", "9px"),
  },
  {
    id: "low-loss-channel",
    label: "低损失声道",
    symbol: "TL ↓",
    english: "Low-loss channel",
    definition: "空间上连续的较小传播损失区域，表示相对于周围位置具有更强的接收声场。",
    relation: "它可由折射聚焦和边界作用形成，在相干模式下还会叠加干涉结构；不应简单等同于声速最小值所在的深度。",
    motion: motion("25s", "-21s", "10px"),
  },
] as const;

function termStyle(term: FloatingGlossaryTerm): FloatingTermStyle {
  return {
    "--term-duration": term.motion.duration,
    "--term-delay": term.motion.delay,
    "--term-drift": term.motion.drift,
  };
}

export function FloatingGlossary({
  scope,
  eyebrow,
  title,
  description,
  source,
  streamLabel,
  dialogEyebrow,
  terms,
}: FloatingGlossaryProps) {
  const [activeTerm, setActiveTerm] = useState<FloatingGlossaryTerm | null>(null);
  const [keyboardFocusedTermId, setKeyboardFocusedTermId] = useState<string | null>(null);
  const keyboardActivationRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const titleId = `${scope}GlossaryTitle`;
  const dialogId = `${scope}GlossaryDialog`;
  const dialogTitleId = `${scope}GlossaryDialogTitle`;
  const dialogDefinitionId = `${scope}GlossaryDialogDefinition`;
  const dialogRelationId = `${scope}GlossaryDialogRelation`;

  const closeDialog = useCallback(() => {
    setActiveTerm(null);
    triggerRef.current?.focus();
    // Restore accessible focus without freezing a pointer-activated term after Escape.
    setKeyboardFocusedTermId(keyboardActivationRef.current ? triggerRef.current?.dataset.termId ?? null : null);
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

  const openDialog = (term: FloatingGlossaryTerm, trigger: HTMLButtonElement, keyboardActivation: boolean) => {
    triggerRef.current = trigger;
    keyboardActivationRef.current = keyboardActivation;
    setActiveTerm(term);
  };

  const handleBackdropClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) closeDialog();
  };

  return (
    <aside
      className={`plot-glossary plot-glossary--${scope}`}
      data-testid={`${scope}-glossary`}
      aria-labelledby={titleId}
    >
      <header className="plot-glossary-head">
        <div className="plot-glossary-copy">
          <span className="micro">{eyebrow}</span>
          <h4 id={titleId}>{title}</h4>
          <p>{description}</p>
        </div>
        <code className="plot-glossary-source">{source}</code>
      </header>

      <div className="plot-term-stream" data-testid={`${scope}-term-stream`} aria-label={streamLabel}>
        {terms.map((term) => (
          <button
            type="button"
            className="plot-term"
            id={`${scope}Term-${term.id}`}
            data-testid={`${scope}-term-${term.id}`}
            data-term-id={term.id}
            data-keyboard-focused={keyboardFocusedTermId === term.id || undefined}
            style={termStyle(term)}
            aria-haspopup="dialog"
            aria-controls={dialogId}
            aria-expanded={activeTerm?.id === term.id}
            onFocus={(event) => setKeyboardFocusedTermId(event.currentTarget.matches(":focus-visible") ? term.id : null)}
            onBlur={() => setKeyboardFocusedTermId(null)}
            onClick={(event) => openDialog(term, event.currentTarget, event.detail === 0)}
            key={term.id}
          >
            <span className="plot-term-label">{term.label}</span>
            <span className="plot-term-symbol" aria-hidden="true">{term.symbol}</span>
          </button>
        ))}
      </div>

      {activeTerm !== null ? (
        <div
          className="plot-glossary-backdrop"
          data-testid={`${scope}-glossary-backdrop`}
          onClick={handleBackdropClick}
        >
          <div
            className="plot-glossary-dialog"
            id={dialogId}
            data-testid={`${scope}-glossary-dialog`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            aria-describedby={`${dialogDefinitionId} ${dialogRelationId}`}
          >
            <button
              type="button"
              className="plot-glossary-close"
              ref={closeRef}
              onClick={closeDialog}
              aria-label={`关闭“${activeTerm.label}”名词解释`}
            >
              {"关闭 ×"}
            </button>
            <p className="micro">{dialogEyebrow}</p>
            <h4 id={dialogTitleId}>{activeTerm.label}</h4>
            <p className="plot-glossary-english">{activeTerm.english}</p>
            <div className="plot-glossary-definition" id={dialogDefinitionId}>
              <strong>{"名词解释"}</strong>
              <p>{activeTerm.definition}</p>
            </div>
            <div className="plot-glossary-relation" id={dialogRelationId}>
              <strong>{"与当前图 / 数据的关系"}</strong>
              <p>{activeTerm.relation}</p>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

export function VelocityGlossary() {
  return (
    <FloatingGlossary
      scope="velocity"
      eyebrow="OOB 原生结果对象"
      title="流动术语图谱"
      description="点击漂浮词条，查看它与当前质点振速图的关系。"
      source="PressureField.horizontalVelocityInterleaved · PressureField.verticalVelocityInterleaved"
      streamLabel="质点振速名词流"
      dialogEyebrow="VELOCITY GLOSSARY"
      terms={VELOCITY_TERMS}
    />
  );
}

export function RayGeometryGlossary() {
  return (
    <FloatingGlossary
      scope="ray-geometry"
      eyebrow="OOB 原生声线路径"
      title="声线几何术语"
      description="点击漂浮词条，查看它与当前声线轨迹图的关系。"
      source="Bellhop2DResult.rays() · RaySet.pointsM · RaySet.launchAnglesDegrees"
      streamLabel="声线轨迹名词流"
      dialogEyebrow="RAY GEOMETRY GLOSSARY"
      terms={RAY_GEOMETRY_TERMS}
    />
  );
}

export function TransmissionLossGlossary() {
  return (
    <FloatingGlossary
      scope="transmission-loss"
      eyebrow="OOB 原生声场结果"
      title="传播损失术语"
      description="点击漂浮词条，查看它与当前传播损失图的关系。"
      source="Bellhop2DResult.pressureField(0) · PressureField.transmissionLossDb"
      streamLabel="传播损失名词流"
      dialogEyebrow="TRANSMISSION LOSS GLOSSARY"
      terms={TRANSMISSION_LOSS_TERMS}
    />
  );
}
