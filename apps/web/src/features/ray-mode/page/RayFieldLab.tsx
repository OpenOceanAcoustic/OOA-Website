export function RayFieldLab() {
  return (
    <section className="lab-section" id="lab">
      <div className="section-heading">
        <div>
          <span className="section-no">
            {"01"}
          </span>
          <h2>
            {"传播链路实验台"}
          </h2>
        </div>
        <p>
          {"环境参数 → 折射路径 → 能量分布"}
        </p>
      </div>
      <div className="lab-grid">
        <aside className="control-panel panel">
          <div className="panel-head">
            <div>
              <span className="micro">
                {"ENVIRONMENT"}
              </span>
              <h3>
                {"环境参数"}
              </h3>
            </div>
            <span className="live-dot">
              {"LIVE"}
            </span>
          </div>
          <div className="env-import">
            <input id="envFileInput" type="file" accept=".env,.json,.bty,.ati,.ssp,.trc,.brc,.sbp" multiple hidden />
            <button type="button" id="envImportButton">
              <span>
                {"↑"}
              </span>
              {" 导入环境文件 / JSON"}
            </button>
            <small id="envImportStatus">
              {"支持 Bellhop ENV + 同名伴随文件，或统一环境 JSON"}
            </small>
          </div>
          <section className="environment-group profile-group">
            <div className="environment-group-head">
              <div>
                <span className="micro">
                  {"ONE-DIMENSIONAL SSP"}
                </span>
                <h4>
                  {"一维声速剖面"}
                </h4>
              </div>
              <span className="mode-badge" id="environmentModeBadge">
                {"MUNK"}
              </span>
            </div>
            <label className="control-label" htmlFor="profile">
              {"环境模式"}
            </label>
            <div className="select-wrap">
              <select id="profile">
                <option value="env" id="profileEnvOption" disabled hidden>
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
            <p className="profile-description" id="profileDescription">
              {"预设曲线由页面预览与 WASM 求解器共享同一份采样数据。"}
            </p>
            <div className="mini-plot">
              <canvas id="sspCanvas" aria-label="声速剖面图"></canvas>
              <div className="plot-tag">
                <span></span>
                {" SOUND SPEED PROFILE"}
              </div>
              <div className="drag-hint">
                {"拖动节点即转为自定义剖面 ↔"}
              </div>
              <div className="ssp-readout" id="sspReadout">
                {"选择节点"}
              </div>
            </div>
            <button type="button" className="convert-custom-button" id="convertToCustomButton">
              {"复制当前曲线为 500 m 自定义节点"}
            </button>
            <details className="ssp-table-editor" id="sspTableEditor">
              <summary>
                <span>
                  {"表格查看 / 编辑声速剖面"}
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
                  <tbody id="sspTableRows"></tbody>
                </table>
              </div>
              <button type="button" className="ssp-add-row" id="addSSPRow">
                {"＋ 新增一行"}
              </button>
            </details>
            <div className="slider-block">
              <div className="slider-title">
                <label htmlFor="axisDepth">
                  {"声道轴深度"}
                </label>
                <output id="axisDepthOut">
                  {"1,300 m"}
                </output>
              </div>
              <input id="axisDepth" type="range" min="50" max="2600" step="50" defaultValue="1300" />
              <div className="range-label">
                <span>
                  {"50 m"}
                </span>
                <span>
                  {"2,600 m"}
                </span>
              </div>
            </div>
            <div className="slider-block">
              <div className="slider-title">
                <label htmlFor="gradient">
                  {"剖面强度"}
                </label>
                <output id="gradientOut">
                  {"1.00×"}
                </output>
              </div>
              <input id="gradient" type="range" min="30" max="180" step="5" defaultValue="100" />
              <div className="range-label">
                <span>
                  {"平缓"}
                </span>
                <span>
                  {"强折射"}
                </span>
              </div>
            </div>
          </section>
          <section className="environment-group source-frequency-group">
            <div className="environment-group-head">
              <div>
                <span className="micro">
                  {"SOURCE"}
                </span>
                <h4>
                  {"声源与频率"}
                </h4>
              </div>
            </div>
            <div className="two-controls">
              <label>
                {"声源深度"}
                <input id="sourceDepth" type="number" min="20" max="4800" step="10" defaultValue="1000" />
                <span>
                  {"m"}
                </span>
              </label>
              <label>
                {"中心频率"}
                <input id="frequency" type="number" min="20" max="5000" step="10" defaultValue="500" />
                <span>
                  {"Hz"}
                </span>
              </label>
            </div>
          </section>
          <section className="environment-group bottom-controls">
            <div className="environment-group-head bottom-heading">
              <div>
                <span className="micro">
                  {"SEABED HALF-SPACE"}
                </span>
                <h4>
                  {"海底半空间"}
                </h4>
              </div>
              <strong>
                {"流体底质"}
              </strong>
            </div>
            <div className="compact-slider">
              <div>
                <label htmlFor="bottomSpeedSlider">
                  {"纵波声速"}
                </label>
                <span className="compact-number-editor">
                  <input id="bottomSpeed" type="number" min="1400" max="3000" step="10" defaultValue="1700" aria-label="海底纵波声速" />
                  <i>
                    {"m/s"}
                  </i>
                </span>
              </div>
              <input id="bottomSpeedSlider" type="range" min="1400" max="3000" step="10" defaultValue="1700" />
            </div>
            <div className="compact-slider">
              <div>
                <label htmlFor="bottomDensitySlider">
                  {"密度"}
                </label>
                <span className="compact-number-editor">
                  <input id="bottomDensity" type="number" min="1000" max="3500" step="20" defaultValue="1800" aria-label="海底密度" />
                  <i>
                    {"kg/m³"}
                  </i>
                </span>
              </div>
              <input id="bottomDensitySlider" type="range" min="1000" max="3500" step="20" defaultValue="1800" />
            </div>
            <div className="compact-slider">
              <div>
                <label htmlFor="bottomAbsorptionSlider">
                  {"吸收"}
                </label>
                <span className="compact-number-editor">
                  <input id="bottomAbsorption" type="number" min="0" max="5" step="0.05" defaultValue="0.5" aria-label="海底吸收" />
                  <i>
                    {"dB/λ"}
                  </i>
                </span>
              </div>
              <input id="bottomAbsorptionSlider" type="range" min="0" max="5" step="0.05" defaultValue="0.5" />
            </div>
            <div className="bottom-result">
              <span>
                {"送入 OOB 的底质吸收"}
              </span>
              <strong id="bottomReflectionLoss">
                {"— dB/λ"}
              </strong>
            </div>
          </section>
          <section className="environment-group field-options-group">
            <div className="environment-group-head">
              <div>
                <span className="micro">
                  {"FIELD OPTIONS"}
                </span>
                <h4>
                  {"波束与声场叠加"}
                </h4>
              </div>
              <span className="mode-badge">
                {"OOB NATIVE"}
              </span>
            </div>
            <div className="field-option-grid">
              <label htmlFor="beamType">
                {"波束类型\n                  "}
                <span className="field-select-wrap">
                  <select id="beamType" defaultValue="GEOMETRIC_CARTESIAN">
                    <option value="GEOMETRIC_CARTESIAN">
                      {"几何波束 · 笛卡尔"}
                    </option>
                    <option value="GEOMETRIC_RAY_CENTERED">
                      {"几何波束 · 声线中心"}
                    </option>
                    <option value="GAUSSIAN_CARTESIAN">
                      {"Gaussian · 笛卡尔"}
                    </option>
                    <option value="GAUSSIAN_RAY_CENTERED">
                      {"Gaussian · 声线中心"}
                    </option>
                    <option value="GAUSSIAN_SIMPLE">
                      {"简化 Gaussian"}
                    </option>
                  </select>
                </span>
              </label>
              <label htmlFor="fieldMode">
                {"传播损失叠加\n                  "}
                <span className="field-select-wrap">
                  <select id="fieldMode" defaultValue="INCOHERENT_TL">
                    <option value="INCOHERENT_TL">
                      {"非相干 TL"}
                    </option>
                    <option value="COHERENT_TL">
                      {"相干 TL"}
                    </option>
                  </select>
                </span>
              </label>
            </div>
            <p id="fieldOptionStatus" className="field-option-status">
              {"OOB RunMode.INCOHERENT_TL · BeamType.GEOMETRIC_CARTESIAN · 几何波束 · 笛卡尔"}
            </p>
          </section>
          <section className="environment-group execution-group">
            <div className="environment-group-head">
              <div>
                <span className="micro">
                  {"EXECUTION"}
                </span>
                <h4>
                  {"执行"}
                </h4>
              </div>
              <span className="execution-state">
                {"WASM · LOCAL"}
              </span>
            </div>
            <button className="run-button" id="runButton">
              <span className="play-icon"></span>
              <span>
                <b>
                  {"重新发射声线"}
                </b>
                <small>
                  {"RUN OOB BELLHOP2D"}
                </small>
              </span>
            </button>
          </section>
        </aside>
        <section className="ray-panel panel">
          <div className="panel-head canvas-heading">
            <div>
              <span className="micro">
                {"RAY GEOMETRY"}
              </span>
              <h3>
                {"声线轨迹"}
              </h3>
            </div>
            <div className="legend">
              <span>
                <i className="source-key"></i>
                {"声源"}
              </span>
              <span>
                <i className="ray-key"></i>
                {"声线"}
              </span>
              <span>
                <i className="terrain-key"></i>
                {"海底地形"}
              </span>
            </div>
          </div>
          <div className="main-canvas-wrap">
            <canvas id="rayCanvas" aria-label="声线路径动态图"></canvas>
            <div className="canvas-axis x-axis">
              {"距离 / km"}
            </div>
            <div className="canvas-axis y-axis">
              {"深度 / m"}
            </div>
            <div className="sim-badge">
              <span id="simPulse"></span>
              <b id="simStatus">
                {"CALCULATING"}
              </b>
              <small id="simTime">
                {"00.0 ms"}
              </small>
            </div>
            <div className="source-drag-hint">
              {"拖动声源上下调整深度 ↕"}
            </div>
          </div>
          <div className="ray-footer">
            <div>
              <span>
                {"发射角"}
              </span>
              <strong id="launchAngleDisplay">
                {"−20.3° — +20.3°"}
              </strong>
            </div>
            <div>
              <span>
                {"显示声线数量"}
              </span>
              <strong id="displayRayCount">
                {"50 DISPLAY RAYS"}
              </strong>
            </div>
            <div>
              <span>
                {"最大距离"}
              </span>
              <strong id="maximumRangeDisplay">
                {"100 km"}
              </strong>
            </div>
          </div>
        </section>
        <section className="loss-panel panel">
          <div className="panel-head canvas-heading">
            <div>
              <span className="micro">
                {"TRANSMISSION LOSS"}
              </span>
              <h3>
                {"传播损失"}
              </h3>
            </div>
            <div className="loss-head-meta">
              <span id="fieldRayCount">
                {"1,000 RAYS"}
              </span>
              <button className="icon-button" id="replayButton" title="刷新绘图" aria-label="刷新绘图">
                {"↻"}
              </button>
            </div>
          </div>
          <div className="main-canvas-wrap loss-wrap">
            <canvas id="lossCanvas" aria-label="传播损失图"></canvas>
            <div className="canvas-axis x-axis">
              {"距离 / km"}
            </div>
            <div className="canvas-axis y-axis">
              {"深度 / m"}
            </div>
            <div className="colorbar">
              <div>
                <span>
                  {"TRANSMISSION LOSS / dB"}
                </span>
                <strong id="fieldModeLabel">
                  {"INCOHERENT · GEOM CART"}
                </strong>
              </div>
              <i></i>
              <p>
                <span>
                  {"40"}
                </span>
                <span>
                  {"55"}
                </span>
                <span>
                  {"70"}
                </span>
                <span>
                  {"85"}
                </span>
                <span>
                  {"100"}
                </span>
              </p>
            </div>
            <div className="receiver-readout">
              <span>
                {"●"}
              </span>
              <div>
                <small>
                  {"光标位置损失"}
                </small>
                <strong id="tlReadout">
                  {"— dB"}
                </strong>
              </div>
            </div>
          </div>
          <div className="loss-summary">
            <span>
              {"当前环境形成的低损失声道集中在"}
            </span>
            <strong id="channelSummary">
              {"1,300 m 附近"}
            </strong>
          </div>
        </section>
        <section className="velocity-panel panel">
          <div className="panel-head canvas-heading">
            <div>
              <span className="micro">
                {"OOB NATIVE PARTICLE VELOCITY"}
              </span>
              <h3>
                {"水平与垂直质点振速"}
              </h3>
            </div>
            <div className="velocity-formula">
              {"velocity_enabled = true"}
            </div>
          </div>
          <div className="velocity-grid">
            <div className="main-canvas-wrap velocity-wrap velocity-component">
              <canvas id="horizontalVelocityCanvas" aria-label="OOB原生水平质点振速级图"></canvas>
              <div className="velocity-component-title">
                {"HORIZONTAL · 水平振速 v"}
                <sub>
                  {"r"}
                </sub>
              </div>
              <div className="canvas-axis x-axis">
                {"距离 / km"}
              </div>
              <div className="canvas-axis y-axis">
                {"深度 / m"}
              </div>
              <div className="velocity-colorbar">
                <div>
                  <span>
                    {"−20 log₁₀ |v"}
                    <sub>
                      {"r"}
                    </sub>
                    {"| / dB"}
                  </span>
                  <strong>
                    {"OOB NATIVE"}
                  </strong>
                </div>
                <i></i>
                <p>
                  <span>
                    {"30"}
                  </span>
                  <span>
                    {"50"}
                  </span>
                  <span>
                    {"70"}
                  </span>
                  <span>
                    {"90"}
                  </span>
                  <span>
                    {"120"}
                  </span>
                </p>
              </div>
              <div className="velocity-readout">
                <span>
                  {"●"}
                </span>
                <div>
                  <small>
                    {"水平振速幅值"}
                  </small>
                  <strong id="horizontalVelocityReadout">
                    {"—"}
                  </strong>
                </div>
              </div>
            </div>
            <div className="main-canvas-wrap velocity-wrap velocity-component">
              <canvas id="verticalVelocityCanvas" aria-label="OOB原生垂直质点振速级图"></canvas>
              <div className="velocity-component-title">
                {"VERTICAL · 垂直振速 v"}
                <sub>
                  {"z"}
                </sub>
              </div>
              <div className="canvas-axis x-axis">
                {"距离 / km"}
              </div>
              <div className="canvas-axis y-axis">
                {"深度 / m"}
              </div>
              <div className="velocity-colorbar">
                <div>
                  <span>
                    {"−20 log₁₀ |v"}
                    <sub>
                      {"z"}
                    </sub>
                    {"| / dB"}
                  </span>
                  <strong>
                    {"OOB NATIVE"}
                  </strong>
                </div>
                <i></i>
                <p>
                  <span>
                    {"30"}
                  </span>
                  <span>
                    {"50"}
                  </span>
                  <span>
                    {"70"}
                  </span>
                  <span>
                    {"90"}
                  </span>
                  <span>
                    {"120"}
                  </span>
                </p>
              </div>
              <div className="velocity-readout">
                <span>
                  {"●"}
                </span>
                <div>
                  <small>
                    {"垂直振速幅值"}
                  </small>
                  <strong id="verticalVelocityReadout">
                    {"—"}
                  </strong>
                </div>
              </div>
            </div>
          </div>
          <div className="velocity-summary">
            <span>
              {"OOB 原生结果句柄"}
            </span>
            <strong>
              {"ResultHandle.horizontal_velocity · ResultHandle.vertical_velocity"}
            </strong>
          </div>
        </section>
      </div>
    </section>
  );
}
