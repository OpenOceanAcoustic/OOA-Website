export function PeControls() {
  return (
    <aside className="panel control-panel pe-controls">
      <div className="panel-head">
        <div>
          <p className="micro">
            {"PE CONFIGURATION"}
          </p>
          <h3>
            {"传播与离散参数"}
          </h3>
        </div>
        <span className="status-pill" id="solveStatus">
          {"READY"}
        </span>
      </div>
      <div className="environment-import-bar">
        <button type="button" className="environment-import-button" id="environmentImportButton">
          <span aria-hidden="true">
            {"↑"}
          </span>
          {" 导入 RAM IN / JSON"}
        </button>
        <input id="environmentFileInput" type="file" accept=".in,.json" hidden />
        <p id="environmentImportStatus" role="status" aria-live="polite">
          {"支持 RAM .in 与统一环境 JSON；文件仅在本机浏览器中解析。"}
        </p>
      </div>
      <div className="control-section environment-section">
        <div className="environment-section-title">
          <span>
            {"01"}
          </span>
          <strong>
            {"一维声速剖面"}
          </strong>
          <small>
            {"setEnvironment()"}
          </small>
        </div>
        <label className="control-label" htmlFor="profileKind">
          {"默认环境"}
        </label>
        <div className="select-wrap">
          <select id="profileKind" defaultValue="pekeris">
            <option value="pekeris">
              {"Pekeris 均匀浅海波导"}
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
            <option value="custom">
              {"自定义 500 m 节点"}
            </option>
          </select>
        </div>
        <p className="preset-summary" id="profileDescription">
          {"200 m 等声速水层 + 可穿透流体海底"}
        </p>
        <div className="mini-profile embedded-profile">
          <canvas id="sspCanvas" aria-label="PE 声速剖面与声源"></canvas>
          <span>
            {"SSP · SOURCE DEPTH"}
          </span>
        </div>
        <details className="profile-table-editor" id="sspTableEditor">
          <summary>
            <span>
              {"表格编辑声速剖面"}
            </span>
            <small>
              {"DEPTH · SPEED"}
            </small>
          </summary>
          <div className="profile-table-wrap">
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
          <button type="button" className="profile-add-row" id="addSSPRow">
            {"＋ 新增节点"}
          </button>
        </details>
      </div>
      <div className="control-section environment-section">
        <div className="environment-section-title">
          <span>
            {"02"}
          </span>
          <strong>
            {"声源与波导"}
          </strong>
          <small>
            {"setSource()"}
          </small>
        </div>
        <div className="control-grid">
          <label>
            {"中心频率 / Hz"}
            <input id="frequency" type="number" min="10" max="1000" step="5" defaultValue="100" />
          </label>
          <label>
            {"声源深度 / m"}
            <input id="sourceDepth" type="number" min="1" max="199" step="1" defaultValue="50" />
          </label>
          <label>
            {"水深 / m"}
            <input id="waterDepth" type="number" min="50" max="8000" step="50" defaultValue="200" />
          </label>
          <label>
            {"最大距离 / km"}
            <input id="maximumRange" type="number" min="2" max="250" step="2" defaultValue="20" />
          </label>
        </div>
      </div>
      <div className="control-section environment-section">
        <div className="environment-section-title">
          <span>
            {"03"}
          </span>
          <strong>
            {"海底半空间"}
          </strong>
          <small>
            {"setBottom()"}
          </small>
        </div>
        <div className="material-range-list">
          <div className="material-range-control">
            <div className="material-range-title">
              <label htmlFor="bottomSpeedRange">
                {"纵波声速"}
              </label>
              <span className="material-number-edit">
                <input id="bottomSpeed" type="number" min="1400" max="3000" step="10" defaultValue="1700" aria-label="海底纵波声速数值" />
                <b>
                  {"m/s"}
                </b>
              </span>
            </div>
            <input id="bottomSpeedRange" type="range" min="1400" max="3000" step="10" defaultValue="1700" />
            <div className="range-ends">
              <span>
                {"1,400"}
              </span>
              <span>
                {"3,000 m/s"}
              </span>
            </div>
          </div>
          <div className="material-range-control">
            <div className="material-range-title">
              <label htmlFor="bottomDensityRange">
                {"密度"}
              </label>
              <span className="material-number-edit">
                <input id="bottomDensity" type="number" min="1000" max="3500" step="50" defaultValue="1800" aria-label="海底密度数值" />
                <b>
                  {"kg/m³"}
                </b>
              </span>
            </div>
            <input id="bottomDensityRange" type="range" min="1000" max="3500" step="50" defaultValue="1800" />
            <div className="range-ends">
              <span>
                {"1,000"}
              </span>
              <span>
                {"3,500 kg/m³"}
              </span>
            </div>
          </div>
          <div className="material-range-control">
            <div className="material-range-title">
              <label htmlFor="bottomAbsorptionRange">
                {"吸收"}
              </label>
              <span className="material-number-edit">
                <input id="bottomAbsorption" type="number" min="0" max="5" step="0.05" defaultValue="0.5" aria-label="海底吸收数值" />
                <b>
                  {"dB/λ"}
                </b>
              </span>
            </div>
            <input id="bottomAbsorptionRange" type="range" min="0" max="5" step="0.05" defaultValue="0.5" />
            <div className="range-ends">
              <span>
                {"0"}
              </span>
              <span>
                {"5 dB/λ"}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="control-section environment-section">
        <div className="environment-section-title">
          <span>
            {"04"}
          </span>
          <strong>
            {"网格与 Padé 选项"}
          </strong>
          <small>
            {"setOptions()"}
          </small>
        </div>
        <label className="control-label" htmlFor="peModel">
          {"PE 内核"}
        </label>
        <div className="select-wrap">
          <select id="peModel">
            <option value="ram">
              {"RAM · 流体底 · 浏览器 WASM"}
            </option>
          </select>
        </div>
        <div className="control-grid discretization-grid">
          <label>
            {"计算域最大深度 / m"}
            <input id="maximumDepth" type="number" min="100" max="10000" step="50" defaultValue="300" />
          </label>
          <label>
            {"距离步长 dr / m"}
            <input id="rangeStep" type="number" min="1" max="100" step="1" defaultValue="25" />
          </label>
          <label>
            {"深度步长 dz / m"}
            <input id="depthStep" type="number" min="0.25" max="20" step="0.25" defaultValue="2" />
          </label>
        </div>
        <div className="range-control pade-control">
          <div className="range-title">
            <label htmlFor="nPade">
              {"Padé 项数 nPade"}
            </label>
            <output id="nPadeOut">
              {"4 terms"}
            </output>
          </div>
          <input id="nPade" type="range" min="1" max="10" step="1" defaultValue="4" />
          <div className="pade-ticks" aria-hidden="true">
            <span>
              {"1"}
            </span>
            <span>
              {"2"}
            </span>
            <span>
              {"3"}
            </span>
            <span>
              {"4"}
            </span>
            <span>
              {"5"}
            </span>
            <span>
              {"6"}
            </span>
            <span>
              {"7"}
            </span>
            <span>
              {"8"}
            </span>
            <span>
              {"9"}
            </span>
            <span>
              {"10"}
            </span>
          </div>
        </div>
        <div className="range-control">
          <div className="range-title">
            <label htmlFor="inspectRange">
              {"垂向剖面距离"}
            </label>
            <output id="inspectRangeOut">
              {"18.0 km"}
            </output>
          </div>
          <input id="inspectRange" type="range" min="0" max="30" step="0.5" defaultValue="18" />
          <div className="range-ends">
            <span>
              {"近场"}
            </span>
            <span>
              {"最大距离"}
            </span>
          </div>
        </div>
      </div>
      <div className="control-section environment-section">
        <div className="environment-section-title">
          <span>
            {"05"}
          </span>
          <strong>
            {"浏览器执行"}
          </strong>
          <small>
            {"setExecution()"}
          </small>
        </div>
        <button className="run-button" id="runPE">
          <span>
            {"▷"}
          </span>
          <span>
            {"重新推进声场"}
            <small>
              {"RUN PE MARCHER"}
            </small>
          </span>
        </button>
      </div>
    </aside>
  );
}
