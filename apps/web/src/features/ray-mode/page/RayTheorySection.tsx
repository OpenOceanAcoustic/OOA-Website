export function RayTheorySection() {
  return (
    <section className="ray-intro" aria-labelledby="rayIntroTitle">
      <div className="ray-intro-heading">
        <p className="eyebrow">
          {"RAY EQUATIONS · RUNGE–KUTTA INTEGRATION"}
        </p>
        <h1 id="rayIntroTitle">
          {"声线，如何一步步"}
          <br />
          <em>
            {"穿过海洋。"}
          </em>
        </h1>
        <p className="intro-lead">
          {"Munk 声速剖面使多条声线围绕深海声道轴弯曲传播。右侧按发射角一条一条追踪声线，同步展示当前声线的高斯波束和复声压 "}
          <i>
            {"p"}
            <sup>
              {"(α)"}
            </sup>
          </i>
          {"，再按 "}
          <i>
            {"p = ∑"}
            <sub>
              {"α"}
            </sub>
            {" p"}
            <sup>
              {"(α)"}
            </sup>
          </i>
          {" 完成相干叠加，直观展示二维声场的形成过程。"}
        </p>
      </div>
      <div className="ray-intro-copy">
        <div className="equation-card" aria-label="声线轨迹方程、动态射线方程、几何波束与声压计算公式">
          <div className="equation-title">
            <span>
              {"RAY · DYNAMIC RAY · PRESSURE"}
            </span>
            <strong>
              {"声线、波束与声压"}
            </strong>
          </div>
          <section className="equation-section" aria-labelledby="trajectoryEquationTitle">
            <div className="equation-section-head">
              <span>
                {"01 · TRAJECTORY"}
              </span>
              <strong id="trajectoryEquationTitle">
                {"声线轨迹方程"}
              </strong>
            </div>
            <p className="equation-note">
              {"以下四个一阶方程只负责追踪中心声线的位置与方向："}
            </p>
            <div className="equation-system trajectory-system">
              <math display="block">
                <mrow>
                  <mfrac>
                    <mrow>
                      <mi>
                        {"d"}
                      </mi>
                      <mi>
                        {"r"}
                      </mi>
                    </mrow>
                    <mrow>
                      <mi>
                        {"d"}
                      </mi>
                      <mi>
                        {"s"}
                      </mi>
                    </mrow>
                  </mfrac>
                  <mo>
                    {"="}
                  </mo>
                  <mi>
                    {"c"}
                  </mi>
                  <mi>
                    {"ξ"}
                  </mi>
                  <mo stretchy="false">
                    {"("}
                  </mo>
                  <mi>
                    {"s"}
                  </mi>
                  <mo stretchy="false">
                    {")"}
                  </mo>
                  <mo>
                    {","}
                  </mo>
                </mrow>
                <mspace width="2em"></mspace>
                <mrow>
                  <mfrac>
                    <mrow>
                      <mi>
                        {"d"}
                      </mi>
                      <mi>
                        {"ξ"}
                      </mi>
                    </mrow>
                    <mrow>
                      <mi>
                        {"d"}
                      </mi>
                      <mi>
                        {"s"}
                      </mi>
                    </mrow>
                  </mfrac>
                  <mo>
                    {"="}
                  </mo>
                  <mo>
                    {"−"}
                  </mo>
                  <mfrac>
                    <mn>
                      {"1"}
                    </mn>
                    <msup>
                      <mi>
                        {"c"}
                      </mi>
                      <mn>
                        {"2"}
                      </mn>
                    </msup>
                  </mfrac>
                  <mfrac>
                    <mrow>
                      <mi>
                        {"∂"}
                      </mi>
                      <mi>
                        {"c"}
                      </mi>
                    </mrow>
                    <mrow>
                      <mi>
                        {"∂"}
                      </mi>
                      <mi>
                        {"r"}
                      </mi>
                    </mrow>
                  </mfrac>
                  <mo>
                    {","}
                  </mo>
                </mrow>
              </math>
              <math display="block">
                <mrow>
                  <mfrac>
                    <mrow>
                      <mi>
                        {"d"}
                      </mi>
                      <mi>
                        {"z"}
                      </mi>
                    </mrow>
                    <mrow>
                      <mi>
                        {"d"}
                      </mi>
                      <mi>
                        {"s"}
                      </mi>
                    </mrow>
                  </mfrac>
                  <mo>
                    {"="}
                  </mo>
                  <mi>
                    {"c"}
                  </mi>
                  <mi>
                    {"ζ"}
                  </mi>
                  <mo stretchy="false">
                    {"("}
                  </mo>
                  <mi>
                    {"s"}
                  </mi>
                  <mo stretchy="false">
                    {")"}
                  </mo>
                  <mo>
                    {","}
                  </mo>
                </mrow>
                <mspace width="2em"></mspace>
                <mrow>
                  <mfrac>
                    <mrow>
                      <mi>
                        {"d"}
                      </mi>
                      <mi>
                        {"ζ"}
                      </mi>
                    </mrow>
                    <mrow>
                      <mi>
                        {"d"}
                      </mi>
                      <mi>
                        {"s"}
                      </mi>
                    </mrow>
                  </mfrac>
                  <mo>
                    {"="}
                  </mo>
                  <mo>
                    {"−"}
                  </mo>
                  <mfrac>
                    <mn>
                      {"1"}
                    </mn>
                    <msup>
                      <mi>
                        {"c"}
                      </mi>
                      <mn>
                        {"2"}
                      </mn>
                    </msup>
                  </mfrac>
                  <mfrac>
                    <mrow>
                      <mi>
                        {"∂"}
                      </mi>
                      <mi>
                        {"c"}
                      </mi>
                    </mrow>
                    <mrow>
                      <mi>
                        {"∂"}
                      </mi>
                      <mi>
                        {"z"}
                      </mi>
                    </mrow>
                  </mfrac>
                  <mo>
                    {"."}
                  </mo>
                </mrow>
              </math>
            </div>
            <div className="equation-legend">
              <span>
                <i>
                  {"r, z"}
                </i>
                {" 距离与深度"}
              </span>
              <span>
                <i>
                  {"ξ, ζ"}
                </i>
                {" 慢度向量分量"}
              </span>
              <span>
                <i>
                  {"c(r,z)"}
                </i>
                {" 局地声速"}
              </span>
              <span>
                <i>
                  {"s"}
                </i>
                {" 声线弧长"}
              </span>
            </div>
          </section>
          <section className="equation-section dynamic-ray-section" aria-labelledby="dynamicEquationTitle">
            <div className="equation-section-head">
              <span>
                {"02 · DYNAMIC RAY"}
              </span>
              <strong id="dynamicEquationTitle">
                {"动态射线方程"}
              </strong>
            </div>
            <p className="equation-note">
              {"为进一步求解声线幅度与波束宽度，引入沿中心声线演化的动态变量 "}
              <i>
                {"q(s)"}
              </i>
              {" 和 "}
              <i>
                {"p(s)"}
              </i>
              {"："}
            </p>
            <div className="dynamic-beam-grid">
              <div className="dynamic-equation-copy">
                <div className="equation-system dynamic-equation-system">
                  <math display="block">
                    <mrow>
                      <mfrac>
                        <mrow>
                          <mi>
                            {"d"}
                          </mi>
                          <mi>
                            {"q"}
                          </mi>
                        </mrow>
                        <mrow>
                          <mi>
                            {"d"}
                          </mi>
                          <mi>
                            {"s"}
                          </mi>
                        </mrow>
                      </mfrac>
                      <mo>
                        {"="}
                      </mo>
                      <mi>
                        {"c"}
                      </mi>
                      <mi>
                        {"p"}
                      </mi>
                      <mo stretchy="false">
                        {"("}
                      </mo>
                      <mi>
                        {"s"}
                      </mi>
                      <mo stretchy="false">
                        {")"}
                      </mo>
                      <mo>
                        {","}
                      </mo>
                    </mrow>
                  </math>
                  <math display="block">
                    <mrow>
                      <mfrac>
                        <mrow>
                          <mi>
                            {"d"}
                          </mi>
                          <mi>
                            {"p"}
                          </mi>
                        </mrow>
                        <mrow>
                          <mi>
                            {"d"}
                          </mi>
                          <mi>
                            {"s"}
                          </mi>
                        </mrow>
                      </mfrac>
                      <mo>
                        {"="}
                      </mo>
                      <mo>
                        {"−"}
                      </mo>
                      <mfrac>
                        <msub>
                          <mi>
                            {"c"}
                          </mi>
                          <mrow>
                            <mi>
                              {"m"}
                            </mi>
                            <mi>
                              {"n"}
                            </mi>
                          </mrow>
                        </msub>
                        <mrow>
                          <msup>
                            <mi>
                              {"c"}
                            </mi>
                            <mn>
                              {"2"}
                            </mn>
                          </msup>
                          <mo stretchy="false">
                            {"("}
                          </mo>
                          <mi>
                            {"s"}
                          </mi>
                          <mo stretchy="false">
                            {")"}
                          </mo>
                        </mrow>
                      </mfrac>
                      <mi>
                        {"q"}
                      </mi>
                      <mo stretchy="false">
                        {"("}
                      </mo>
                      <mi>
                        {"s"}
                      </mi>
                      <mo stretchy="false">
                        {")"}
                      </mo>
                      <mo>
                        {"."}
                      </mo>
                    </mrow>
                  </math>
                </div>
                <div className="dynamic-legend">
                  <span>
                    <i>
                      {"q(s)"}
                    </i>
                    {" 横向几何扩展与波束宽度参数"}
                  </span>
                  <span>
                    <i>
                      {"p(s)"}
                    </i>
                    {" 与 "}
                    <i>
                      {"q(s)"}
                    </i>
                    {" 共轭的动态射线变量"}
                  </span>
                  <span>
                    <i>
                      {"c"}
                      <sub>
                        {"mn"}
                      </sub>
                    </i>
                    {" 声速在射线法向上的二阶变化项"}
                  </span>
                  <small>
                    {"这里的 "}
                    <i>
                      {"p(s)"}
                    </i>
                    {" 是动态变量，不是声压。"}
                  </small>
                </div>
              </div>
              <figure className="beam-schematic">
                <svg viewBox="0 0 520 220" role="img" aria-labelledby="beamDiagramTitle beamDiagramDesc">
                  <title id="beamDiagramTitle">
                    {"几何波束与波束窗示意图"}
                  </title>
                  <desc id="beamDiagramDesc">
                    {"左侧为从声源发出的中心声线及其上下边界，右侧为法向距离方向上的三角形波束窗。"}
                  </desc>
                  <defs>
                    <linearGradient id="beamAreaGradient" x1="0" y1="1" x2="1" y2="0">
                      <stop offset="0" stopColor="#35d4e9" stopOpacity=".05"></stop>
                      <stop offset="1" stopColor="#35d4e9" stopOpacity=".28"></stop>
                    </linearGradient>
                    <marker id="beamArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#8aa9b2"></path>
                    </marker>
                  </defs>
                  <path className="beam-fill" d="M32 174 C104 157 174 86 286 54 L268 112 C171 121 104 163 32 174 Z"></path>
                  <path className="beam-edge" d="M32 174 C104 157 174 86 286 54"></path>
                  <path className="beam-edge" d="M32 174 C104 170 171 126 268 112"></path>
                  <path className="beam-ray" d="M32 174 C105 163 173 106 277 83"></path>
                  <line className="beam-axis" x1="32" y1="174" x2="32" y2="26" markerEnd="url(#beamArrow)"></line>
                  <line className="beam-axis" x1="32" y1="174" x2="322" y2="174" markerEnd="url(#beamArrow)"></line>
                  <circle className="beam-source" cx="32" cy="174" r="7"></circle>
                  <circle className="beam-station" cx="198" cy="116" r="4"></circle>
                  <line className="beam-normal" x1="198" y1="116" x2="182" y2="87" markerStart="url(#beamArrow)" markerEnd="url(#beamArrow)"></line>
                  <line className="beam-tangent" x1="185" y1="122" x2="231" y2="100" markerEnd="url(#beamArrow)"></line>
                  <line className="beam-width" x1="244" y1="93" x2="232" y2="67" markerStart="url(#beamArrow)" markerEnd="url(#beamArrow)"></line>
                  <text x="11" y="20">
                    {"z"}
                  </text>
                  <text x="327" y="181">
                    {"r"}
                  </text>
                  <text x="8" y="204">
                    {"Source"}
                  </text>
                  <text x="121" y="151">
                    {"center ray"}
                  </text>
                  <text className="beam-accent-label" x="203" y="113">
                    {"s"}
                  </text>
                  <text x="167" y="91">
                    {"d"}
                  </text>
                  <text x="247" y="71">
                    {"ρ(s)"}
                  </text>
                  <text className="beam-caption" x="180" y="208">
                    {"GEOMETRIC BEAM"}
                  </text>
                  <rect className="beam-window-box" x="366" y="24" width="146" height="166" rx="4"></rect>
                  <text className="beam-window-title" x="379" y="45">
                    {"BEAM WINDOW"}
                  </text>
                  <line className="beam-window-axis" x1="397" y1="91" x2="433" y2="172" markerStart="url(#beamArrow)" markerEnd="url(#beamArrow)"></line>
                  <line className="beam-window-axis" x1="415" y1="132" x2="495" y2="96" markerEnd="url(#beamArrow)"></line>
                  <path className="beam-window-fill" d="M403 104 L427 159 L484 101 Z"></path>
                  <path className="beam-window-line" d="M403 104 L484 101 L427 159"></path>
                  <line className="beam-window-center" x1="415" y1="132" x2="484" y2="101"></line>
                  <line className="beam-window-slice" x1="421" y1="146" x2="484" y2="101"></line>
                  <circle className="beam-window-peak" cx="484" cy="101" r="3.5"></circle>
                  <circle className="beam-window-sample" cx="421" cy="146" r="2.7"></circle>
                  <text className="beam-window-label" x="486" y="91">
                    {"φ"}
                  </text>
                  <text className="beam-window-label" x="388" y="111">
                    {"−ρ"}
                  </text>
                  <text className="beam-window-label" x="430" y="164">
                    {"ρ"}
                  </text>
                  <text className="beam-window-label" x="428" y="143">
                    {"d"}
                  </text>
                  <text className="beam-window-label" x="448" y="123">
                    {"φ(s,d)"}
                  </text>
                </svg>
                <figcaption>
                  {"左：中心声线与相邻声线围成几何波束。右：沿波束传播方向绘制局部波束窗，法向距离为 "}
                  <i>
                    {"d"}
                  </i>
                  {"，边界为 "}
                  <i>
                    {"ρ(s)"}
                  </i>
                  {"。"}
                </figcaption>
              </figure>
            </div>
          </section>
          <section className="equation-section pressure-ray-section" aria-labelledby="pressureEquationTitle">
            <div className="equation-section-head">
              <span>
                {"03 · ACOUSTIC PRESSURE"}
              </span>
              <strong id="pressureEquationTitle">
                {"波束声压与相干叠加"}
              </strong>
            </div>
            <p className="equation-note">
              {"动态射线给出幅度和波束宽度后，第 "}
              <i>
                {"α"}
              </i>
              {" 条声线对接收点的复声压贡献为："}
            </p>
            <div className="equation-system pressure-equation-system">
              <math display="block">
                <mrow>
                  <msup>
                    <mi>
                      {"p"}
                    </mi>
                    <mrow>
                      <mo stretchy="false">
                        {"("}
                      </mo>
                      <mi>
                        {"α"}
                      </mi>
                      <mo stretchy="false">
                        {")"}
                      </mo>
                    </mrow>
                  </msup>
                  <mo stretchy="false">
                    {"("}
                  </mo>
                  <mi>
                    {"s"}
                  </mi>
                  <mo>
                    {","}
                  </mo>
                  <mi>
                    {"n"}
                  </mi>
                  <mo stretchy="false">
                    {")"}
                  </mo>
                  <mo>
                    {"="}
                  </mo>
                  <mi>
                    {"A"}
                  </mi>
                  <mo stretchy="false">
                    {"("}
                  </mo>
                  <mi>
                    {"s"}
                  </mi>
                  <mo stretchy="false">
                    {")"}
                  </mo>
                  <mi>
                    {"φ"}
                  </mi>
                  <mo stretchy="false">
                    {"("}
                  </mo>
                  <mi>
                    {"s"}
                  </mi>
                  <mo>
                    {","}
                  </mo>
                  <mi>
                    {"d"}
                  </mi>
                  <mo stretchy="false">
                    {")"}
                  </mo>
                  <msup>
                    <mi>
                      {"e"}
                    </mi>
                    <mrow>
                      <mi>
                        {"i"}
                      </mi>
                      <mo stretchy="false">
                        {"["}
                      </mo>
                      <mi>
                        {"ω"}
                      </mi>
                      <mi>
                        {"τ"}
                      </mi>
                      <mo stretchy="false">
                        {"("}
                      </mo>
                      <mi>
                        {"s"}
                      </mi>
                      <mo stretchy="false">
                        {")"}
                      </mo>
                      <mo>
                        {"+"}
                      </mo>
                      <mi>
                        {"ϕ"}
                      </mi>
                      <mo stretchy="false">
                        {"("}
                      </mo>
                      <mi>
                        {"s"}
                      </mi>
                      <mo stretchy="false">
                        {")"}
                      </mo>
                      <mo stretchy="false">
                        {"]"}
                      </mo>
                    </mrow>
                  </msup>
                  <mo>
                    {"."}
                  </mo>
                </mrow>
              </math>
              <math display="block" className="pressure-sum-equation">
                <mrow>
                  <mi>
                    {"p"}
                  </mi>
                  <mo>
                    {"="}
                  </mo>
                  <munder>
                    <mo>
                      {"∑"}
                    </mo>
                    <mi>
                      {"α"}
                    </mi>
                  </munder>
                  <msup>
                    <mi>
                      {"p"}
                    </mi>
                    <mrow>
                      <mo stretchy="false">
                        {"("}
                      </mo>
                      <mi>
                        {"α"}
                      </mi>
                      <mo stretchy="false">
                        {")"}
                      </mo>
                    </mrow>
                  </msup>
                  <mo>
                    {"."}
                  </mo>
                </mrow>
              </math>
            </div>
            <div className="pressure-legend">
              <span>
                <i>
                  {"A(s)"}
                </i>
                {" 动态射线确定的幅度"}
              </span>
              <span>
                <i>
                  {"φ(s,d)"}
                </i>
                {" 几何波束横向加权"}
              </span>
              <span>
                <i>
                  {"τ(s)"}
                </i>
                {" 传播走时"}
              </span>
              <span>
                <i>
                  {"ϕ(s)"}
                </i>
                {" 反射、焦散等相位修正"}
              </span>
              <span>
                <i>
                  {"ω"}
                </i>
                {" 声源角频率"}
              </span>
              <strong>
                {"所有声线贡献按复数相位相加，得到总声压 "}
                <i>
                  {"p"}
                </i>
                {"。"}
              </strong>
            </div>
          </section>
        </div>
      </div>
      <div className="intro-visual-column">
        <section className="intro-principle" id="principle" aria-labelledby="introPrincipleTitle">
          <div className="intro-principle-head">
            <div>
              <span>
                {"PROPAGATION LOSS · PRINCIPLE"}
              </span>
              <strong id="introPrincipleTitle">
                {"传播损失计算原理"}
              </strong>
            </div>
            <small>
              {"声速剖面 → 声线路径 → 声压与 TL"}
            </small>
          </div>
          <div className="intro-principle-flow">
            <article>
              <span className="step">
                {"01"}
              </span>
              <div className="flow-icon profile-icon">
                <i></i>
              </div>
              <h3>
                {"声速决定折射"}
              </h3>
              <p>
                {"温度、盐度和压力形成声速剖面，决定声道、会聚区与阴影区。"}
              </p>
              <code>
                {"c = c(z)"}
              </code>
            </article>
            <div className="flow-arrow">
              {"→"}
            </div>
            <article>
              <span className="step">
                {"02"}
              </span>
              <div className="flow-icon ray-icon">
                <i></i>
              </div>
              <h3>
                {"追踪能量路径"}
              </h3>
              <p>
                {"按发射角追踪声线，逐步求解折射并处理海面、海底反射。"}
              </p>
              <code>
                {"∇ · (c⁻¹ dr/ds) = ∇c⁻¹"}
              </code>
            </article>
            <div className="flow-arrow">
              {"→"}
            </div>
            <article>
              <span className="step">
                {"03"}
              </span>
              <div className="flow-icon field-icon">
                <i></i>
              </div>
              <h3>
                {"形成传播损失场"}
              </h3>
              <p>
                {"几何扩展、吸收、反射和相干叠加共同确定接收点声压。"}
              </p>
              <code>
                {"TL = −20 log₁₀ |p/p₀|"}
              </code>
            </article>
          </div>
          <div className="intro-principle-note">
            <span>
              {"关键观察"}
            </span>
            <p>
              {"剖面改变声线弯曲与能量聚集位置，随后反映为传播损失场中的低损失通道。"}
            </p>
          </div>
        </section>
        <div className="intro-visual panel">
          <div className="intro-visual-head">
            <div>
              <span className="micro">
                {"MUNK CHANNEL · COHERENT SUM"}
              </span>
              <h3>
                {"从声线、波束到声压叠加"}
              </h3>
            </div>
            <button id="introReplay" className="intro-replay" aria-label="重新播放声线动画">
              {"↻ REPLAY"}
            </button>
          </div>
          <div className="intro-canvas-wrap">
            <canvas id="introRayCanvas" aria-label="Munk 声速剖面、声线、几何波束和声压相干叠加动画"></canvas>
          </div>
          <div className="intro-progress">
            <div>
              <span>
                {"已发射声线"}
              </span>
              <strong id="introRayNumber">
                {"00 / 09"}
              </strong>
            </div>
            <div>
              <span>
                {"当前发射角"}
              </span>
              <strong id="introAngle">
                {"−12.0°"}
              </strong>
            </div>
            <div className="progress-track">
              <span>
                {"逐条叠加进度"}
              </span>
              <i>
                <b id="introProgressBar"></b>
              </i>
              <strong id="introProgressText">
                {"0%"}
              </strong>
            </div>
            <div>
              <span>
                {"相干叠加"}
              </span>
              <strong className="intro-sum">
                <i>
                  {"p"}
                </i>
                {" = ∑"}
                <sub>
                  {"α"}
                </sub>
                <i>
                  {"p"}
                </i>
                <sup>
                  {"(α)"}
                </sup>
              </strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
