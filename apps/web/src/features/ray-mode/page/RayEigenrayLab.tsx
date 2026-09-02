export function RayEigenrayLab() {
  return (
    <section className="advanced-section" id="advanced">
      <div className="section-heading">
        <div>
          <span className="section-no">
            {"03"}
          </span>
          <h2>
            {"精确本征声线"}
          </h2>
        </div>
        <p>
          {"OOB EIGENRAY → MODE_E_PC 精确本征求解 → 原生到达结果"}
        </p>
      </div>
      <div className="eigen-lab panel">
        <div className="eigen-lab-shell">
          <aside className="eigen-env-panel">
            <div className="eigen-env-head">
              <div>
                <span className="micro">
                  {"ENVIRONMENT"}
                </span>
                <h3>
                  {"环境参数"}
                </h3>
              </div>
              <span className="live-dot">
                {"LINKED"}
              </span>
            </div>
            <label className="eigen-env-label" htmlFor="eigenProfile">
              {"声速剖面"}
            </label>
            <div className="eigen-env-select">
              <select id="eigenProfile">
                <option value="env" id="eigenProfileEnvOption" disabled hidden>
                  {"ENV 原始剖面"}
                </option>
                <option value="munk">
                  {"Munk 深海声道"}
                </option>
                <option value="surface">
                  {"表层跃变"}
                </option>
                <option value="constant">
                  {"等声速水体"}
                </option>
                <option value="pekeris">
                  {"Pekeris 浅海波导"}
                </option>
                <option value="custom">
                  {"自定义 500 m 节点"}
                </option>
              </select>
            </div>
            <div className="eigen-ssp-mini">
              <canvas id="eigenSSPCanvas" aria-label="本征声线环境声速剖面"></canvas>
              <span>
                {"声速剖面 · 声源深度"}
              </span>
            </div>
            <details className="ssp-table-editor eigen-ssp-table" id="eigenSSPTableEditor">
              <summary>
                <span>
                  {"表格编辑声速剖面"}
                </span>
                <small>
                  {"DEPTH · SPEED"}
                </small>
              </summary>
              <div className="ssp-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>
                        {"深度 / m"}
                      </th>
                      <th>
                        {"声速 / m/s"}
                      </th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody id="eigenSSPTableRows"></tbody>
                </table>
              </div>
              <button type="button" className="ssp-add-row" id="eigenAddSSPRow">
                {"＋ 新增一行"}
              </button>
            </details>
            <div className="eigen-env-control">
              <div>
                <label htmlFor="eigenAxisDepth">
                  {"声道轴深度"}
                </label>
                <output id="eigenAxisDepthOut">
                  {"1,300 m"}
                </output>
              </div>
              <input id="eigenAxisDepth" type="range" min="50" max="2600" step="50" defaultValue="1300" />
            </div>
            <div className="eigen-env-control">
              <div>
                <label htmlFor="eigenGradient">
                  {"剖面强度"}
                </label>
                <output id="eigenGradientOut">
                  {"1.00×"}
                </output>
              </div>
              <input id="eigenGradient" type="range" min="30" max="180" step="5" defaultValue="100" />
            </div>
            <div className="eigen-env-pair">
              <label>
                {"声源深度"}
                <div>
                  <input id="eigenSourceDepth" type="number" min="20" max="4800" step="10" defaultValue="1000" />
                  <span>
                    {"m"}
                  </span>
                </div>
              </label>
              <label>
                {"中心频率"}
                <div>
                  <input id="eigenFrequency" type="number" min="20" max="10000" step="10" defaultValue="500" />
                  <span>
                    {"Hz"}
                  </span>
                </div>
              </label>
            </div>
            <div className="eigen-bottom-box">
              <div className="eigen-bottom-head">
                <span className="micro">
                  {"SEABED HALF-SPACE"}
                </span>
                <strong>
                  {"海底介质"}
                </strong>
              </div>
              <div className="eigen-env-control compact">
                <div>
                  <label htmlFor="eigenBottomSpeed">
                    {"纵波声速"}
                  </label>
                  <output id="eigenBottomSpeedOut">
                    {"1,700 m/s"}
                  </output>
                </div>
                <input id="eigenBottomSpeed" type="range" min="1450" max="2200" step="10" defaultValue="1700" />
              </div>
              <div className="eigen-env-control compact">
                <div>
                  <label htmlFor="eigenBottomDensity">
                    {"密度"}
                  </label>
                  <output id="eigenBottomDensityOut">
                    {"1,800 kg/m³"}
                  </output>
                </div>
                <input id="eigenBottomDensity" type="range" min="1200" max="2600" step="20" defaultValue="1800" />
              </div>
              <div className="eigen-env-control compact">
                <div>
                  <label htmlFor="eigenBottomAbsorption">
                    {"吸收"}
                  </label>
                  <output id="eigenBottomAbsorptionOut">
                    {"0.50 dB/λ"}
                  </output>
                </div>
                <input id="eigenBottomAbsorption" type="range" min="0" max="2" step="0.05" defaultValue="0.5" />
              </div>
            </div>
          </aside>
          <div className="eigen-stage">
            <div className="eigen-toolbar">
              <div className="eigen-title">
                <span className="micro">
                  {"OOB · PRECISE EIGENRAY"}
                </span>
                <h3>
                  {"接收点反向约束实验"}
                </h3>
                <p>
                  {"不再依赖某条离散声线“恰好经过”接收器，而是求解使声线深度残差为零的精确发射角。"}
                </p>
              </div>
              <div className="eigen-inputs">
                <label>
                  {"接收距离"}
                  <div>
                    <input id="receiverRange" type="number" min="5" max="95" step="0.5" defaultValue="50" />
                    <span>
                      {"km"}
                    </span>
                  </div>
                </label>
                <label>
                  {"接收深度"}
                  <div>
                    <input id="receiverDepth" type="number" min="20" max="4980" step="10" defaultValue="1000" />
                    <span>
                      {"m"}
                    </span>
                  </div>
                </label>
                <label>
                  {"收敛容差"}
                  <div>
                    <select id="eigenTolerance" defaultValue="1">
                      <option value="5">
                        {"5.0 m"}
                      </option>
                      <option value="1">
                        {"1.0 m"}
                      </option>
                      <option value="0.1">
                        {"0.1 m"}
                      </option>
                    </select>
                  </div>
                </label>
                <button id="eigenRun">
                  <span>
                    {"⌖"}
                  </span>
                  <b>
                    {"搜索本征声线"}
                  </b>
                  <small>
                    {"SOLVE ROOTS"}
                  </small>
                </button>
              </div>
            </div>
            <div className="eigen-statusbar">
              <div id="eigenStatus" className="eigen-running">
                <i></i>
                <span>
                  {"正在计算两种本征声线"}
                </span>
              </div>
              <p>
                {"当前接入环境："}
                <strong id="eigenEnv">
                  {"Munk · 声源 1,000 m · 500 Hz"}
                </strong>
              </p>
              <code>
                {"F(α) = z"}
                <sub>
                  {"ray"}
                </sub>
                {"(r"}
                <sub>
                  {"R"}
                </sub>
                {", α) − z"}
                <sub>
                  {"R"}
                </sub>
                {" = 0"}
              </code>
            </div>
            <div className="eigen-grid">
              <section className="eigen-chart-card">
                <div className="chart-head">
                  <div>
                    <span className="micro">
                      {"EIGENRAY COMPARISON"}
                    </span>
                    <h4>
                      {"本征声线模式 vs. 精确本征声线模式"}
                    </h4>
                  </div>
                  <div className="eigen-legend">
                    <span>
                      <i className="equal-line"></i>
                      {"本征声线"}
                    </span>
                    <span>
                      <i className="exact-line"></i>
                      {"精确本征声线"}
                    </span>
                    <span>
                      <i className="receiver-dot"></i>
                      {"接收器"}
                    </span>
                  </div>
                </div>
                <div className="eigen-canvas-wrap">
                  <canvas id="eigenCanvas" aria-label="可拖动声源和接收器的本征声线对比图"></canvas>
                  <div className="receiver-drag-hint">
                    {"拖动左侧声源上下调整深度 · 拖动 "}
                    <i></i>
                    {" 接收器修改距离与深度"}
                  </div>
                  <div className="zoom-label">
                    {"RECEIVER ±1 km / ±180 m"}
                  </div>
                </div>
                <div className="metric-row">
                  <div>
                    <span>
                      {"本征声线残差 RMSE"}
                    </span>
                    <strong id="coarseMiss">
                      {"— m"}
                    </strong>
                  </div>
                  <div>
                    <span>
                      {"精确残差 RMSE"}
                    </span>
                    <strong id="exactResidual">
                      {"— m"}
                    </strong>
                  </div>
                  <div>
                    <span>
                      {"本征 / 精确数量"}
                    </span>
                    <strong id="eigenCount">
                      {"— / — paths"}
                    </strong>
                  </div>
                  <div>
                    <span>
                      {"精确求解引擎"}
                    </span>
                    <strong id="eigenIterations">
                      {"—"}
                    </strong>
                  </div>
                </div>
              </section>
              <section className="arrival-card">
                <div className="chart-head">
                  <div>
                    <span className="micro">
                      {"ARRIVAL STRUCTURE"}
                    </span>
                    <h4>
                      {"多途到达结构"}
                    </h4>
                  </div>
                  <div className="tl-pair">
                    <span>
                      {"相干 TL "}
                      <b id="coherentTl">
                        {"— dB"}
                      </b>
                    </span>
                    <span>
                      {"非相干 TL "}
                      <b id="incoherentTl">
                        {"— dB"}
                      </b>
                    </span>
                  </div>
                </div>
                <div className="arrival-canvas-wrap">
                  <canvas id="arrivalCanvas" aria-label="本征声线到达时延和幅度图"></canvas>
                </div>
                <div className="arrival-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>
                          {"方法"}
                        </th>
                        <th>
                          {"路径"}
                        </th>
                        <th>
                          {"类型"}
                        </th>
                        <th>
                          {"发射角"}
                        </th>
                        <th>
                          {"时延"}
                        </th>
                        <th>
                          {"相位"}
                        </th>
                        <th>
                          {"残差"}
                        </th>
                      </tr>
                    </thead>
                    <tbody id="arrivalRows">
                      <tr>
                        <td colSpan={7}>
                          {"正在计算…"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
            <div className="method-note">
              <span>
                {"算法说明"}
              </span>
              <p id="eigenMethodNote">
                {"−20.3° 至 +20.3° 使用 1000 个等间隔初始角。蓝色结果由 OOB 的 EIGENRAY / ARRIVALS 模式计算；彩色结果由 OOB 原生 MODE_E_PC 精确本征算法（PARTICLE_RAY / PARTICLE_ARRIVALS）计算。计算在浏览器 Web Worker 的 WebAssembly 模块中完成，不向后端上传环境参数。"}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="capability-heading">
        <span>
          {"MORE CAPABILITIES"}
        </span>
        <h3>
          {"从本征声线扩展到完整声场"}
        </h3>
      </div>
      <div className="feature-grid">
        <article className="feature-card featured">
          <span className="feature-index">
            {"01 / FIELD"}
          </span>
          <div className="feature-symbol">
            {"◫"}
          </div>
          <h3>
            {"二维传播损失场"}
          </h3>
          <p>
            {"按所选相干或非相干模式输出距离—深度网格上的传播损失，识别会聚区、干涉条纹和声影区。"}
          </p>
          <ul>
            <li>
              {"Coherent / Incoherent"}
            </li>
            <li>
              {"40–100 dB 标准色标"}
            </li>
          </ul>
        </article>
        <article className="feature-card">
          <span className="feature-index">
            {"02 / ARRIVALS"}
          </span>
          <div className="feature-symbol">
            {"⌁"}
          </div>
          <h3>
            {"多途到达结构"}
          </h3>
          <p>
            {"计算每条到达路径的时延、幅度、相位和出入射角，支撑信道脉冲响应分析。"}
          </p>
          <ul>
            <li>
              {"Eigenrays"}
            </li>
            <li>
              {"Travel time & phase"}
            </li>
          </ul>
        </article>
        <article className="feature-card">
          <span className="feature-index">
            {"03 / BOUNDARY"}
          </span>
          <div className="feature-symbol">
            {"◇"}
          </div>
          <h3>
            {"复杂海面与海底"}
          </h3>
          <p>
            {"引入真实地形、边界材料、粗糙度和反射损失，刻画浅海多次反射传播。"}
          </p>
          <ul>
            <li>
              {"Range-dependent bathymetry"}
            </li>
            <li>
              {"Material half-space"}
            </li>
          </ul>
        </article>
        <article className="feature-card">
          <span className="feature-index">
            {"04 / SDK"}
          </span>
          <div className="feature-symbol">
            {"{ }"}
          </div>
          <h3>
            {"浏览器原生计算"}
          </h3>
          <p>
            {"通过类型化 npm SDK 在 Web Worker 中运行 Bellhop2D WebAssembly 核心。"}
          </p>
          <ul>
            <li>
              {"No compute backend"}
            </li>
            <li>
              {"WASM typed arrays"}
            </li>
          </ul>
        </article>
      </div>
    </section>
  );
}
