export function NormalControls() {
  return (
    <aside className="panel control-panel normal-controls">
      <div className="panel-head">
        <div>
          <p className="micro">
            {"ENVIRONMENT"}
          </p>
          <h3>
            {"波导与求解参数"}
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
          {" 导入 Kraken ENV / JSON"}
        </button>
        <input id="environmentFileInput" type="file" accept=".env,.flp,.json" multiple hidden />
        <p id="environmentImportStatus" role="status" aria-live="polite">
          {"支持 Kraken .env、同名 .flp 与统一环境 JSON；文件仅在本机浏览器中解析。"}
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
          <canvas id="sspCanvas" aria-label="声速剖面"></canvas>
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
            {"海深 / m"}
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
            {"求解与模态选择"}
          </strong>
          <small>
            {"setOptions()"}
          </small>
        </div>
        <label className="control-label" htmlFor="normalModel">
          {"Normal Mode 内核"}
        </label>
        <div className="select-wrap">
          <select id="normalModel">
            <option value="kraken">
              {"Kraken · 浏览器 WASM"}
            </option>
          </select>
        </div>
        <div className="control-grid phase-speed-grid">
          <label>
            {"最小相速度 / m/s"}
            <input id="phaseSpeedLow" type="number" min="1300" max="1900" step="10" defaultValue="1400" />
          </label>
          <label>
            {"最大相速度 / m/s"}
            <input id="phaseSpeedHigh" type="number" min="1400" max="2400" step="10" defaultValue="1700" />
          </label>
        </div>
        <div className="range-control">
          <div className="range-title">
            <label htmlFor="modeLimit">
              {"参与叠加的前 N 阶模态"}
            </label>
            <output id="modeLimitOut">
              {"24 modes"}
            </output>
          </div>
          <input id="modeLimit" type="range" min="1" max="100" step="1" defaultValue="24" />
          <div className="range-ends">
            <span>
              {"单模态"}
            </span>
            <span>
              {"完整模态场"}
            </span>
          </div>
        </div>
        <div className="range-control">
          <div className="range-title">
            <label htmlFor="selectedMode">
              {"单模态编号"}
            </label>
            <output id="selectedModeOut">
              {"Mode 01"}
            </output>
          </div>
          <input id="selectedMode" type="range" min="1" max="100" step="1" defaultValue="1" />
          <div className="range-ends">
            <span>
              {"低阶"}
            </span>
            <span>
              {"高阶"}
            </span>
          </div>
        </div>
        <button type="button" className="mode-field-action" id="showSelectedModeField">
          {"查看 Mode 01 单模态声场"}
        </button>
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
        <button className="run-button" id="runNormal">
          <span>
            {"▷"}
          </span>
          <span>
            {"重新计算模态"}
            <small>
              {"RUN NORMAL MODE"}
            </small>
          </span>
        </button>
      </div>
    </aside>
  );
}
