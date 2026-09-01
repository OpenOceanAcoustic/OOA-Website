import { StatusPill } from "@ooa/ui";
import { useRef, type ChangeEvent, type FormEvent } from "react";
import {
  isCommitChange,
  type NormalNumericParameter,
  type UseNormalModePageResult,
} from "../hooks/useNormalModePage";

export interface NormalControlsProps {
  readonly page: UseNormalModePageResult;
}

function inputValue(event: FormEvent<HTMLInputElement>): string {
  return event.currentTarget.value;
}

function NumericInput({
  id,
  parameter,
  value,
  min,
  max,
  step,
  ariaLabel,
  page,
}: {
  readonly id: string;
  readonly parameter: NormalNumericParameter;
  readonly value: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly ariaLabel?: string;
  readonly page: UseNormalModePageResult;
}) {
  return (
    <input
      id={id}
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={ariaLabel}
      onInput={(event) => page.setNumericInput(parameter, inputValue(event))}
      onChange={(event) => {
        if (isCommitChange(event)) page.commitNumericInput(parameter, event.currentTarget.value);
      }}
    />
  );
}

function MaterialControl({
  title,
  parameter,
  numberId,
  rangeId,
  value,
  min,
  max,
  step,
  unit,
  startLabel,
  endLabel,
  ariaLabel,
  page,
}: {
  readonly title: string;
  readonly parameter: NormalNumericParameter;
  readonly numberId: string;
  readonly rangeId: string;
  readonly value: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit: string;
  readonly startLabel: string;
  readonly endLabel: string;
  readonly ariaLabel: string;
  readonly page: UseNormalModePageResult;
}) {
  const input = (event: FormEvent<HTMLInputElement>) => page.setBottomMaterial(parameter, inputValue(event));
  const commit = (event: ChangeEvent<HTMLInputElement>) => {
    if (isCommitChange(event)) page.commitBottomMaterial(parameter, event.currentTarget.value);
  };
  return (
    <div className="material-range-control">
      <div className="material-range-title">
        <label htmlFor={rangeId}>{title}</label>
        <span className="material-number-edit">
          <input id={numberId} type="number" min={min} max={max} step={step} value={value} aria-label={ariaLabel} onInput={input} onChange={commit} />
          <b>{unit}</b>
        </span>
      </div>
      <input id={rangeId} type="range" min={min} max={max} step={step} value={value} onInput={input} onChange={commit} />
      <div className="range-ends"><span>{startLabel}</span><span>{endLabel}</span></div>
    </div>
  );
}

export function NormalControls({ page }: NormalControlsProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const modeLabel = `Mode ${String(page.selectedMode + 1).padStart(2, "0")}`;
  const solveMode = page.solveStatus === "SOLVING" ? "busy" : page.solveStatus === "FAILED" ? "error" : "idle";
  const onFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.currentTarget.files !== null) await page.importEnvironmentFiles(event.currentTarget.files);
    event.currentTarget.value = "";
  };
  return (
    <aside className="panel control-panel normal-controls">
      <div className="panel-head">
        <div><p className="micro">ENVIRONMENT</p><h3>波导与求解参数</h3></div>
        <StatusPill id="solveStatus" mode={solveMode}>{page.solveStatus}</StatusPill>
      </div>
      <div className="environment-import-bar">
        <button type="button" className="environment-import-button" id="environmentImportButton" disabled={page.importView.busy} onClick={() => fileInput.current?.click()}>
          <span aria-hidden="true">↑</span>{" 导入 Kraken ENV / JSON"}
        </button>
        <input ref={fileInput} id="environmentFileInput" type="file" accept=".env,.flp,.json" multiple hidden onChange={(event) => { void onFilesSelected(event); }} />
        <p id="environmentImportStatus" className={page.importView.kind === "idle" ? undefined : page.importView.kind} role="status" aria-live="polite">
          {page.importView.message}
        </p>
      </div>
      <div className="control-section environment-section">
        <div className="environment-section-title"><span>01</span><strong>一维声速剖面</strong><small>setEnvironment()</small></div>
        <label className="control-label" htmlFor="profileKind">默认环境</label>
        <div className="select-wrap">
          <select id="profileKind" value={page.parameters.profile} onChange={(event) => page.setProfile(event.currentTarget.value)}>
            <option value="pekeris">Pekeris 均匀浅海波导</option>
            <option value="munk">Munk 深海声道</option>
            <option value="surface">表层跃变</option>
            <option value="constant">等声速水体</option>
            <option value="custom">自定义 500 m 节点</option>
          </select>
        </div>
        <p className="preset-summary" id="profileDescription">{page.profileDescription}</p>
        <div className="mini-profile embedded-profile">
          <canvas ref={page.canvases.ssp} id="sspCanvas" aria-label="声速剖面"></canvas>
          <span>SSP · SOURCE DEPTH</span>
        </div>
        <details className="profile-table-editor" id="sspTableEditor" data-mode={page.profileMode}>
          <summary><span>表格编辑声速剖面</span><small>DEPTH · SPEED</small></summary>
          <div className="profile-table-wrap">
            <table>
              <thead><tr><th>深度 / m</th><th>声速 / m/s</th><th></th></tr></thead>
              <tbody id="sspTableRows">
                {page.profilePoints.map(([depthM, soundSpeedMps], index) => (
                  <tr key={`${index}:${depthM}`}>
                    <td><input type="number" min="0" max={page.parameters.waterDepthM} step="1" defaultValue={Number(depthM).toFixed(depthM % 1 ? 1 : 0)} data-profile-index={index} data-profile-field="depth" aria-label={`第 ${index + 1} 个节点深度`} onChange={(event) => page.updateProfilePoint(index, "depth", event.currentTarget.value)} /></td>
                    <td><input type="number" min="1300" max="2200" step="0.1" defaultValue={Number(soundSpeedMps).toFixed(1)} data-profile-index={index} data-profile-field="speed" aria-label={`第 ${index + 1} 个节点声速`} onChange={(event) => page.updateProfilePoint(index, "speed", event.currentTarget.value)} /></td>
                    <td><button type="button" className="profile-delete-row" data-profile-delete={index} aria-label={`删除第 ${index + 1} 个节点`} onClick={() => page.deleteProfilePoint(index)}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="profile-add-row" id="addSSPRow" onClick={page.addProfilePoint}>＋ 新增节点</button>
        </details>
      </div>
      <div className="control-section environment-section">
        <div className="environment-section-title"><span>02</span><strong>声源与波导</strong><small>setSource()</small></div>
        <div className="control-grid">
          <label>中心频率 / Hz<NumericInput id="frequency" parameter="frequencyHz" value={page.parameters.frequencyHz} min={10} max={1000} step={5} page={page} /></label>
          <label>声源深度 / m<NumericInput id="sourceDepth" parameter="sourceDepthM" value={page.parameters.sourceDepthM} min={1} max={Math.max(1, Number(page.parameters.waterDepthM) - 1)} step={1} page={page} /></label>
          <label>海深 / m<input id="waterDepth" type="number" min="50" max="8000" step="50" value={page.parameters.waterDepthM} onInput={(event) => page.setNumericInput("waterDepthM", inputValue(event))} onChange={(event) => { if (isCommitChange(event)) page.commitWaterDepth(event.currentTarget.value); }} /></label>
          <label>最大距离 / km<NumericInput id="maximumRange" parameter="maximumRangeKm" value={page.parameters.maximumRangeKm} min={2} max={250} step={2} page={page} /></label>
        </div>
      </div>
      <div className="control-section environment-section">
        <div className="environment-section-title"><span>03</span><strong>海底半空间</strong><small>setBottom()</small></div>
        <div className="material-range-list">
          <MaterialControl title="纵波声速" parameter="bottomSoundSpeedMps" numberId="bottomSpeed" rangeId="bottomSpeedRange" value={page.parameters.bottomSoundSpeedMps} min={1400} max={3000} step={10} unit="m/s" startLabel="1,400" endLabel="3,000 m/s" ariaLabel="海底纵波声速数值" page={page} />
          <MaterialControl title="密度" parameter="bottomDensityKgM3" numberId="bottomDensity" rangeId="bottomDensityRange" value={page.parameters.bottomDensityKgM3} min={1000} max={3500} step={50} unit="kg/m³" startLabel="1,000" endLabel="3,500 kg/m³" ariaLabel="海底密度数值" page={page} />
          <MaterialControl title="吸收" parameter="bottomAttenuationDbPerWavelength" numberId="bottomAbsorption" rangeId="bottomAbsorptionRange" value={page.parameters.bottomAttenuationDbPerWavelength} min={0} max={5} step={0.05} unit="dB/λ" startLabel="0" endLabel="5 dB/λ" ariaLabel="海底吸收数值" page={page} />
        </div>
      </div>
      <div className="control-section environment-section">
        <div className="environment-section-title"><span>04</span><strong>求解与模态选择</strong><small>setOptions()</small></div>
        <label className="control-label" htmlFor="normalModel">Normal Mode 内核</label>
        <div className="select-wrap"><select id="normalModel" value={page.parameters.model} onChange={() => { void page.run(); }}><option value="kraken">Kraken · 浏览器 WASM</option></select></div>
        <div className="control-grid phase-speed-grid">
          <label>最小相速度 / m/s<NumericInput id="phaseSpeedLow" parameter="phaseSpeedLowMps" value={page.parameters.phaseSpeedLowMps} min={1300} max={1900} step={10} page={page} /></label>
          <label>最大相速度 / m/s<NumericInput id="phaseSpeedHigh" parameter="phaseSpeedHighMps" value={page.parameters.phaseSpeedHighMps} min={1400} max={2400} step={10} page={page} /></label>
        </div>
        <div className="range-control">
          <div className="range-title"><label htmlFor="modeLimit">参与叠加的前 N 阶模态</label><output id="modeLimitOut">{page.parameters.modeLimit} modes</output></div>
          <input id="modeLimit" type="range" min="1" max={page.modeMaximum} step="1" value={page.parameters.modeLimit} onInput={(event) => page.setNumericInput("modeLimit", inputValue(event))} onChange={(event) => { if (isCommitChange(event)) page.commitNumericInput("modeLimit", event.currentTarget.value); }} />
          <div className="range-ends"><span>单模态</span><span>完整模态场</span></div>
        </div>
        <div className="range-control">
          <div className="range-title"><label htmlFor="selectedMode">单模态编号</label><output id="selectedModeOut">{modeLabel}</output></div>
          <input id="selectedMode" type="range" min="1" max={page.modeMaximum} step="1" value={page.selectedMode + 1} onInput={(event) => page.setSelectedMode(event.currentTarget.valueAsNumber)} />
          <div className="range-ends"><span>低阶</span><span>高阶</span></div>
        </div>
        <button type="button" className="mode-field-action" id="showSelectedModeField" onClick={() => page.setFieldView("single")}>查看 {modeLabel} 单模态声场</button>
      </div>
      <div className="control-section environment-section">
        <div className="environment-section-title"><span>05</span><strong>浏览器执行</strong><small>setExecution()</small></div>
        <button className="run-button" id="runNormal" disabled={page.solveBusy} onClick={() => { void page.run(); }}>
          <span>▷</span><span>重新计算模态<small>RUN NORMAL MODE</small></span>
        </button>
      </div>
    </aside>
  );
}
