import {
  createPlot,
  drawHeatmap,
  drawPoints,
  drawPolyline,
  pointerValue,
  valueRange,
} from "../../shared-page/canvas.js";
import {
  environmentPreset,
  normalizeProfilePoints,
  profilePointsForPreset,
  resampleProfilePoints,
} from "../../shared-page/environment-presets.js";
import { parseNormalModeEnvironmentFiles } from "../../shared-page/model-environment-import.js";
import { parseKrakenEnvironment, runNormalMode } from "@ooa/runtime-normal-mode/page-runtime";
import { synthesizeSingleModeField } from "./single-mode-field.js";

const byId = (id) => document.getElementById(id);
const controls = {
  model: byId("normalModel"), profile: byId("profileKind"), frequency: byId("frequency"),
  sourceDepth: byId("sourceDepth"), waterDepth: byId("waterDepth"), maximumRange: byId("maximumRange"),
  phaseSpeedLow: byId("phaseSpeedLow"), phaseSpeedHigh: byId("phaseSpeedHigh"),
  bottomSpeed: byId("bottomSpeed"), bottomDensity: byId("bottomDensity"),
  bottomAbsorption: byId("bottomAbsorption"),
  bottomSpeedRange: byId("bottomSpeedRange"), bottomDensityRange: byId("bottomDensityRange"),
  bottomAbsorptionRange: byId("bottomAbsorptionRange"),
  modeLimit: byId("modeLimit"), selectedMode: byId("selectedMode"), run: byId("runNormal"),
  showSelectedModeField: byId("showSelectedModeField"),
  environmentImportButton: byId("environmentImportButton"),
  environmentFileInput: byId("environmentFileInput"),
};
const fieldViewButtons = Array.from(document.querySelectorAll("[data-field-view]"));
const canvases = {
  ssp: byId("sspCanvas"), spectrum: byId("spectrumCanvas"), eigenfunction: byId("eigenfunctionCanvas"),
  field: byId("fieldCanvas"), delta: byId("deltaCanvas"),
};
const state = {
  result: null,
  request: 0,
  selectedMode: 0,
  spectrumPlot: null,
  customSSP: profilePointsForPreset("custom", 5000),
  customProfileDescription: environmentPreset("custom").description,
  importedEnvironment: null,
  interpolation: "linear",
  environmentTitle: null,
  fieldView: "sum",
  singleModeFieldCache: null,
};

function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, Number(value))); }
function number(value, fallback) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function format(value, digits = 3) { return Number(value).toLocaleString("zh-CN", { maximumFractionDigits: digits }); }
function modeLabel(modeIndex = state.selectedMode) { return `Mode ${String(modeIndex + 1).padStart(2, "0")}`; }

const bottomMaterialControls = [
  { numberInput: controls.bottomSpeed, rangeInput: controls.bottomSpeedRange, fallback: 1700 },
  { numberInput: controls.bottomDensity, rangeInput: controls.bottomDensityRange, fallback: 1800 },
  { numberInput: controls.bottomAbsorption, rangeInput: controls.bottomAbsorptionRange, fallback: 0.5 },
];

function syncBottomMaterialControl(pair, source = pair.numberInput) {
  const minimum = number(pair.numberInput.min, -Infinity);
  const maximum = number(pair.numberInput.max, Infinity);
  const value = clamp(number(source.value, pair.fallback), minimum, maximum);
  pair.numberInput.value = String(value);
  pair.rangeInput.value = String(value);
}

function syncBottomMaterialControls() {
  bottomMaterialControls.forEach((pair) => syncBottomMaterialControl(pair));
}

function currentProfileDescription() {
  return controls.profile.value === "custom"
    ? state.customProfileDescription
    : environmentPreset(controls.profile.value).description;
}

function describeError(error) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error.trim();
  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") return serialized;
  } catch {
    // Fall through to the user-facing parser error below.
  }
  return "未能识别文件内容，请同时选择同名的 Kraken ENV/FLP，或选择一个环境 JSON。";
}

function bathymetryVaries(points) {
  if (!Array.isArray(points) || points.length < 2) return false;
  const firstDepth = number(points[0]?.[1], NaN);
  return Number.isFinite(firstDepth) && points.some((point) => (
    Math.abs(number(point?.[1], firstDepth) - firstDepth) > 1e-6
  ));
}

function readParameters() {
  const waterDepthM = clamp(number(controls.waterDepth.value, 200), 50, 8000);
  const profile = controls.profile.value;
  const sspPoints = profilePointsForPreset(profile, waterDepthM, state.customSSP);
  return {
    contractVersion: 1,
    model: controls.model.value,
    profile,
    environmentTitle: state.environmentTitle,
    sspPoints,
    frequencyHz: clamp(number(controls.frequency.value, 100), 10, 1000),
    sourceDepthM: clamp(number(controls.sourceDepth.value, 50), 1, waterDepthM - 1),
    waterDepthM,
    maximumRangeKm: clamp(number(controls.maximumRange.value, 20), 2, 250),
    phaseSpeedLowMps: number(controls.phaseSpeedLow.value, 1400),
    phaseSpeedHighMps: number(controls.phaseSpeedHigh.value, 1700),
    bottomSoundSpeedMps: clamp(number(controls.bottomSpeed.value, 1700), 1400, 3000),
    bottomDensityRelative: clamp(number(controls.bottomDensity.value, 1800) / 1000, 1, 3.5),
    bottomAttenuationDbPerWavelength: clamp(number(controls.bottomAbsorption.value, 0.5), 0, 5),
    interpolation: state.interpolation,
    sourceId: profile === "custom" ? state.importedEnvironment?.sourceId || null : null,
    modeLimit: number(controls.modeLimit.value, 24),
    rangeCount: 161,
    depthCount: 121,
  };
}

function profileDisplayPoints() {
  const parameters = readParameters();
  return controls.profile.value === "custom"
    ? parameters.sspPoints
    : resampleProfilePoints(parameters.sspPoints, parameters.waterDepthM, 500);
}

function updateProfileEditor() {
  const editable = controls.profile.value === "custom";
  const points = profileDisplayPoints();
  byId("sspTableRows").innerHTML = points.map(([depthM, soundSpeedMps], index) => `
    <tr>
      <td><input type="number" min="0" max="${readParameters().waterDepthM}" step="1" value="${Number(depthM).toFixed(depthM % 1 ? 1 : 0)}" data-profile-index="${index}" data-profile-field="depth" aria-label="第 ${index + 1} 个节点深度"></td>
      <td><input type="number" min="1300" max="2200" step="0.1" value="${Number(soundSpeedMps).toFixed(1)}" data-profile-index="${index}" data-profile-field="speed" aria-label="第 ${index + 1} 个节点声速"></td>
      <td><button type="button" class="profile-delete-row" data-profile-delete="${index}" aria-label="删除第 ${index + 1} 个节点">×</button></td>
    </tr>`).join("");
  byId("addSSPRow").disabled = false;
  byId("sspTableEditor").dataset.mode = editable ? "custom" : "preset";
}

function convertDisplayedProfileToCustom() {
  if (controls.profile.value === "custom") return;
  state.customSSP = profileDisplayPoints().map((point) => [...point]);
  state.customProfileDescription = environmentPreset("custom").description;
  controls.profile.value = "custom";
  byId("profileDescription").textContent = state.customProfileDescription;
}

function updateProfileCell(event) {
  const input = event.target.closest("input[data-profile-field]");
  if (!input) return;
  const displayed = profileDisplayPoints();
  const index = Number(input.dataset.profileIndex);
  convertDisplayedProfileToCustom();
  state.customSSP = displayed.map((point) => [...point]);
  if (!state.customSSP[index]) return;
  state.customSSP[index][input.dataset.profileField === "depth" ? 0 : 1] = number(input.value, 0);
  state.customSSP = normalizeProfilePoints(state.customSSP, number(controls.waterDepth.value, 200));
  updateProfileEditor();
  calculate();
}

function deleteProfilePoint(event) {
  const button = event.target.closest("button[data-profile-delete]");
  if (!button) return;
  const displayed = profileDisplayPoints();
  if (displayed.length <= 2) return;
  convertDisplayedProfileToCustom();
  state.customSSP = displayed.map((point) => [...point]);
  state.customSSP.splice(Number(button.dataset.profileDelete), 1);
  state.customSSP = normalizeProfilePoints(state.customSSP, number(controls.waterDepth.value, 200));
  updateProfileEditor();
  calculate();
}

function addProfilePoint() {
  const points = profileDisplayPoints();
  convertDisplayedProfileToCustom();
  state.customSSP = points.map((point) => [...point]);
  let insertion = 1;
  let widestGap = -1;
  for (let index = 1; index < state.customSSP.length; index += 1) {
    const gap = state.customSSP[index][0] - state.customSSP[index - 1][0];
    if (gap > widestGap) { widestGap = gap; insertion = index; }
  }
  const left = state.customSSP[insertion - 1];
  const right = state.customSSP[insertion];
  state.customSSP.splice(insertion, 0, [
    (left[0] + right[0]) / 2,
    (left[1] + right[1]) / 2,
  ]);
  updateProfileEditor();
  calculate();
}

function applyEnvironmentPreset(key) {
  const preset = environmentPreset(key);
  state.importedEnvironment = null;
  state.interpolation = "linear";
  state.environmentTitle = null;
  controls.frequency.value = String(preset.frequencyHz);
  controls.sourceDepth.value = String(preset.sourceDepthM);
  controls.waterDepth.value = String(preset.waterDepthM);
  controls.maximumRange.value = String(preset.maximumRangeKm);
  controls.phaseSpeedLow.value = String(preset.phaseSpeedLowMps);
  controls.phaseSpeedHigh.value = String(preset.phaseSpeedHighMps);
  controls.bottomSpeed.value = String(preset.bottomSoundSpeedMps);
  controls.bottomDensity.value = String(preset.bottomDensityKgM3);
  controls.bottomAbsorption.value = String(preset.bottomAttenuationDbPerWavelength);
  controls.sourceDepth.max = String(preset.waterDepthM - 1);
  syncBottomMaterialControls();
  byId("profileDescription").textContent = currentProfileDescription();
  updateProfileEditor();
}

function normalizeKrakenEnvironment(imported) {
  if (Array.isArray(imported?.profilePoints)) return imported;
  const profile = imported?.profiles?.[0];
  const layer = profile?.layers?.[0];
  const depths = Array.isArray(layer?.depthsM) ? layer.depthsM : [];
  const speeds = Array.isArray(layer?.compressionalSpeedMps)
    ? layer.compressionalSpeedMps
    : [];
  if (depths.length < 2 || depths.length !== speeds.length) {
    throw new Error("Kraken ENV 中没有可用于当前二维页面的有效水层声速剖面");
  }
  const receiverRanges = Array.isArray(imported.receiverRangesM)
    ? imported.receiverRangesM
    : [];
  const maximumRangeM = number(
    imported.maximumRangeM,
    receiverRanges.length ? Math.max(...receiverRanges) : 0,
  );
  const bottom = profile?.bottom || {};
  return {
    ...imported,
    profilePoints: depths.map((depth, index) => [depth, speeds[index]]),
    waterDepthM: number(bottom.depthM, depths.at(-1)),
    sourceDepthM: Array.isArray(imported.sourceDepthsM)
      ? imported.sourceDepthsM[0]
      : imported.sourceDepthM,
    maximumRangeKm: maximumRangeM / 1000,
    bottomSoundSpeedMps: bottom.compressionalSpeedMps,
    bottomDensityKgM3: number(bottom.densityRelative, 1.8) * 1000,
    bottomAttenuationDbPerWavelength: bottom.compressionalAttenuation,
    interpolation: profile?.interpolation,
  };
}

function syncControlLabels() {
  byId("modeLimitOut").textContent = `${controls.modeLimit.value} modes`;
  const selectedLabel = modeLabel(Number(controls.selectedMode.value) - 1);
  byId("selectedModeOut").textContent = selectedLabel;
  controls.showSelectedModeField.textContent = `查看 ${selectedLabel} 单模态声场`;
  byId("heroModel").textContent = controls.model.value.toUpperCase();
  byId("profileDescription").textContent = currentProfileDescription();
}

function syncFieldViewControls() {
  fieldViewButtons.forEach((button) => {
    const active = button.dataset.fieldView === state.fieldView;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function setStatus(kind, text) {
  const status = byId("solveStatus");
  status.className = `status-pill ${kind === "busy" || kind === "error" ? kind : ""}`.trim();
  status.textContent = text;
}

function updateRuntime(runtime) {
  const isWasm = runtime?.mode === "wasm";
  const banner = byId("runtimeBanner");
  banner.dataset.mode = isWasm ? "wasm" : "demo";
  byId("runtimeBadge").textContent = isWasm ? "WASM ACTIVE" : "DEMO FALLBACK";
  byId("heroEngine").textContent = runtime?.engine || (isWasm ? "NORMAL MODE WASM" : "DEMO FALLBACK");
  byId("runtimeMessage").textContent = isWasm
    ? "Normal Mode 正在浏览器 Web Worker / WebAssembly 中计算，输入和结果不会上传到服务器。"
    : `WASM SDK 尚未生效：${runtime?.warning || "backend unavailable"}。当前显示确定性的演示数据，不能用于工程计算。`;
  byId("resultSource").textContent = isWasm ? "OOB WASM" : "DEMO";
}

function drawSoundSpeedProfile() {
  const result = state.result;
  if (!result) return;
  const speeds = result.environment.soundSpeedMps;
  const depths = result.environment.depthsM;
  const [minimum, maximum] = valueRange(speeds, { paddingFraction: 0.1, minimumPadding: 3 });
  const plot = createPlot(canvases.ssp, {
    xMinimum: minimum, xMaximum: maximum,
    yMinimum: 0, yMaximum: result.environment.waterDepthM,
    xLabel: "c / m·s⁻¹", yLabel: "深度 / m", depthAxis: true,
  });
  drawPolyline(plot, Array.from(depths, (depth, index) => [speeds[index], depth]), { color: "#62d8e7", width: 2, glow: 5 });
  drawPoints(plot, [[
    speeds[Math.round(result.environment.sourceDepthM / result.environment.waterDepthM * (speeds.length - 1))],
    result.environment.sourceDepthM,
  ]], { color: "#f8b44c", radius: 4 });
}

function modalWavenumbers() {
  const values = state.result.modes.horizontalWavenumbersInterleaved;
  return Array.from({ length: state.result.modes.count }, (_, index) => values[index * 2]);
}

function drawSpectrum() {
  const result = state.result;
  if (!result) return;
  const wavenumbers = modalWavenumbers();
  const [minimum, maximum] = valueRange(wavenumbers, { paddingFraction: 0.08, minimumPadding: 1e-4 });
  const plot = createPlot(canvases.spectrum, {
    xMinimum: 1, xMaximum: result.modes.count,
    yMinimum: minimum, yMaximum: maximum,
    xLabel: "模态序号 m", yLabel: "Re(kᵣ) / rad·m⁻¹",
    xFormatter: (value) => Math.round(value).toString(),
    yFormatter: (value) => value.toFixed(4),
  });
  const points = wavenumbers.map((value, index) => [index + 1, value]);
  drawPolyline(plot, points, { color: "rgba(98,216,231,.72)", width: 1.2 });
  drawPoints(plot, points, { color: "#62d8e7", radius: 2 });
  drawPoints(plot, [points[state.selectedMode]], { color: "#f8b44c", radius: 5, stroke: "#ffe0a0", strokeWidth: 1.2 });
  state.spectrumPlot = plot;
}

function drawModeDetails() {
  const result = state.result;
  if (!result) return;
  const mode = state.selectedMode;
  const depths = result.modes.depthsM;
  const stride = depths.length;
  const realShape = [];
  const imaginaryShape = [];
  let normalization = 1e-12;
  for (let depthIndex = 0; depthIndex < stride; depthIndex += 1) {
    const offset = (mode * stride + depthIndex) * 2;
    normalization = Math.max(normalization, Math.hypot(
      result.modes.modeShapesInterleaved[offset],
      result.modes.modeShapesInterleaved[offset + 1],
    ));
  }
  for (let depthIndex = 0; depthIndex < stride; depthIndex += 1) {
    const offset = (mode * stride + depthIndex) * 2;
    realShape.push([result.modes.modeShapesInterleaved[offset] / normalization, depths[depthIndex]]);
    imaginaryShape.push([result.modes.modeShapesInterleaved[offset + 1] / normalization, depths[depthIndex]]);
  }
  const shapePlot = createPlot(canvases.eigenfunction, {
    xMinimum: -1.08, xMaximum: 1.08, yMinimum: 0, yMaximum: result.environment.waterDepthM,
    xLabel: "归一化 φₘ", yLabel: "深度 / m", depthAxis: true,
  });
  drawPolyline(shapePlot, realShape, { color: "#62d8e7", width: 1.8, glow: 3 });
  drawPolyline(shapePlot, imaginaryShape, { color: "#f8b44c", width: 1.4 });

  const krReal = result.modes.horizontalWavenumbersInterleaved[mode * 2];
  const krImaginary = result.modes.horizontalWavenumbersInterleaved[mode * 2 + 1];

  const groupVelocity = result.modes.groupVelocityMps[mode];
  byId("modeShapeTitle").textContent = `${modeLabel(mode)} 本征函数`;
  const imaginaryText = krImaginary
    ? ` ${krImaginary < 0 ? "−" : "+"} ${Math.abs(krImaginary).toExponential(1)}i`
    : "";
  byId("horizontalWavenumber").textContent = `${krReal.toFixed(6)}${imaginaryText} rad/m`;
  byId("horizontalWavelength").textContent = `${format(2 * Math.PI / Math.max(1e-12, krReal), 2)} m`;
  byId("groupVelocity").textContent = `${format(groupVelocity, 1)} m/s`;
}

function fieldBathymetry(result) {
  const maximumRange = result.field.rangesKm.at(-1);
  return [[0, result.environment.waterDepthM], [maximumRange, result.environment.waterDepthM]];
}

function selectedModeField() {
  const cache = state.singleModeFieldCache;
  if (cache?.result === state.result && cache.modeIndex === state.selectedMode) return cache.field;
  const field = synthesizeSingleModeField(state.result, state.selectedMode);
  state.singleModeFieldCache = { result: state.result, modeIndex: state.selectedMode, field };
  return field;
}

function drawFields() {
  const result = state.result;
  if (!result) return;
  const displayedField = state.fieldView === "single" ? selectedModeField() : result.field;
  const maximumRange = result.field.rangesKm.at(-1);
  const common = {
    xMinimum: 0, xMaximum: maximumRange,
    yMinimum: 0, yMaximum: result.environment.waterDepthM,
    xLabel: "距离 / km", yLabel: "深度 / m",
    bathymetry: fieldBathymetry(result),
  };
  const fieldPlot = drawHeatmap(canvases.field, {
    values: displayedField.tlDb, rows: displayedField.rows, columns: displayedField.columns,
  }, { ...common, minimum: 60, maximum: 120 });
  drawPoints(fieldPlot, [[result.field.rangesKm[0], result.environment.sourceDepthM]], { color: "#f8b44c", radius: 4 });
  const magnitude = Math.max(0.5, Math.ceil(result.metrics.deltaMaxDb * 2) / 2);
  drawHeatmap(canvases.delta, {
    values: result.deltaField.values, rows: result.deltaField.rows, columns: result.deltaField.columns,
  }, { ...common, divergingMagnitude: magnitude });
}

function updateMetrics() {
  const result = state.result;
  if (!result) return;
  const active = result.field.activeModeCount;
  const singleMode = state.fieldView === "single";
  byId("modeCount").textContent = `${result.modes.count} modes`;
  byId("activeModesLabel").textContent = singleMode ? "当前单模态" : "参与叠加";
  byId("activeModes").textContent = singleMode
    ? `${modeLabel()} / ${result.modes.count}`
    : `${active} / ${result.modes.count}`;
  byId("fieldShape").textContent = `${result.field.columns} × ${result.field.rows}`;
  byId("sourceMetric").textContent = `${format(result.environment.sourceDepthM, 0)} m`;
  byId("computeTime").textContent = `${format(result.runtime.computeMs, 1)} ms`;
  byId("deltaRms").textContent = `${format(result.metrics.deltaRmsDb, 3)} dB`;
  byId("deltaMax").textContent = `${format(result.metrics.deltaMaxDb, 3)} dB`;
  byId("truncationRatio").textContent = `${format(active / result.modes.count * 100, 1)} %`;
  byId("fieldTitle").textContent = singleMode
    ? `${modeLabel()} 单模态传播损失`
    : `前 ${active} 阶模态传播损失`;
  byId("fieldMicro").textContent = singleMode ? "SELECTED SINGLE-MODE FIELD" : "TRUNCATED MODAL FIELD";
  byId("fieldNote").textContent = singleMode ? `${modeLabel().toUpperCase()} · TL / dB` : "TL / dB";
}

function render() {
  drawSoundSpeedProfile();
  drawSpectrum();
  drawModeDetails();
  drawFields();
  updateMetrics();
}

function renderModeSelection() {
  drawSpectrum();
  drawModeDetails();
  if (state.fieldView === "single") {
    drawFields();
    updateMetrics();
  }
}

function setFieldView(view) {
  if (view !== "sum" && view !== "single") return;
  state.fieldView = view;
  syncFieldViewControls();
  if (state.result) {
    drawFields();
    updateMetrics();
  }
}

async function calculate() {
  const token = ++state.request;
  controls.run.disabled = true;
  setStatus("busy", "SOLVING");
  try {
    const result = await runNormalMode(readParameters());
    if (token !== state.request) return;
    state.result = result;
    state.singleModeFieldCache = null;
    const maximum = Math.max(1, result.modes.count);
    controls.modeLimit.max = String(maximum);
    controls.selectedMode.max = String(maximum);
    controls.modeLimit.value = String(Math.min(maximum, number(controls.modeLimit.value, 24)));
    state.selectedMode = Math.round(clamp(number(controls.selectedMode.value, 1), 1, maximum)) - 1;
    controls.selectedMode.value = String(state.selectedMode + 1);
    syncControlLabels();
    syncFieldViewControls();
    updateRuntime(result.runtime);
    render();
    setStatus("", "COMPLETE");
  } catch (error) {
    if (token !== state.request) return;
    setStatus("error", "FAILED");
    byId("runtimeMessage").textContent = `计算失败：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    if (token === state.request) controls.run.disabled = false;
  }
}

async function importEnvironmentFiles(files) {
  const selectedFiles = Array.from(files || []);
  if (!selectedFiles.length) return;
  const status = byId("environmentImportStatus");
  controls.environmentImportButton.disabled = true;
  status.className = "busy";
  status.textContent = `正在解析 ${selectedFiles.length} 个环境文件…`;
  try {
    const parsed = await parseNormalModeEnvironmentFiles(
      selectedFiles,
      ({ envText, flpText, envName, flpName }) => parseKrakenEnvironment({
        envText,
        flpText,
        envName,
        flpName,
      }),
    );
    const imported = normalizeKrakenEnvironment(parsed);
    if (!imported || !Array.isArray(imported.profilePoints) || imported.profilePoints.length < 2) {
      throw new Error("环境文件中没有找到至少两个有效的声速剖面节点。Kraken ENV 必须与同名 FLP 一起选择。");
    }

    const deepestProfilePoint = Math.max(...imported.profilePoints.map((point) => number(point?.[0], 0)));
    const firstBathymetryDepth = Array.isArray(imported.bathymetry) && imported.bathymetry.length
      ? number(imported.bathymetry[0]?.[1], 0)
      : 0;
    const waterDepthM = clamp(
      number(imported.waterDepthM, firstBathymetryDepth || deepestProfilePoint || 200),
      50,
      8000,
    );

    const title = String(imported.title || selectedFiles[0].name || "用户环境");
    controls.profile.value = "custom";
    state.importedEnvironment = parsed;
    state.environmentTitle = title;
    state.interpolation = String(imported.interpolation || "LINEAR").toUpperCase()
      === "SQUARED_SLOWNESS_LINEAR"
      ? "squared-slowness-linear"
      : "linear";
    state.customSSP = normalizeProfilePoints(imported.profilePoints, waterDepthM);
    const formatName = String(imported.format || selectedFiles[0].name.split(".").pop() || "ENV").toUpperCase();
    state.customProfileDescription = `已导入 ${title} · ${formatName} · ${state.customSSP.length} 个 SSP 节点`;

    controls.waterDepth.value = String(waterDepthM);
    controls.sourceDepth.max = String(waterDepthM - 1);
    controls.frequency.value = String(clamp(number(imported.frequencyHz, 100), 10, 1000));
    controls.sourceDepth.value = String(clamp(number(imported.sourceDepthM, 50), 1, waterDepthM - 1));
    controls.maximumRange.value = String(clamp(number(imported.maximumRangeKm, 20), 2, 250));
    controls.phaseSpeedLow.value = String(clamp(number(imported.phaseSpeedLowMps, controls.phaseSpeedLow.value), 1300, 1900));
    controls.phaseSpeedHigh.value = String(clamp(number(imported.phaseSpeedHighMps, controls.phaseSpeedHigh.value), 1400, 2400));
    controls.bottomSpeed.value = String(clamp(number(imported.bottomSoundSpeedMps, 1700), 1400, 3000));
    controls.bottomDensity.value = String(clamp(number(imported.bottomDensityKgM3, 1800), 1000, 3500));
    controls.bottomAbsorption.value = String(clamp(number(imported.bottomAttenuationDbPerWavelength, 0.5), 0, 5));

    syncBottomMaterialControls();
    updateProfileEditor();
    syncControlLabels();
    const bathymetryNote = parsed.format === "kraken-env-flp"
      ? ` · 原生 Kraken 解析 · ${parsed.receiverRangesM?.length || 0}×${parsed.receiverDepthsM?.length || 0} FLP 网格`
      : bathymetryVaries(imported.bathymetry)
        ? " · NM 按入口水深建立距离无关波导"
        : "";
    status.className = "success";
    status.textContent = `已导入：${title} · ${formatName} · ${selectedFiles.length} 个文件${bathymetryNote}`;
    await calculate();
  } catch (error) {
    status.className = "error";
    status.textContent = `导入失败：${describeError(error)}`;
  } finally {
    controls.environmentImportButton.disabled = false;
    controls.environmentFileInput.value = "";
  }
}

controls.run.addEventListener("click", calculate);
controls.showSelectedModeField.addEventListener("click", () => setFieldView("single"));
fieldViewButtons.forEach((button) => {
  button.addEventListener("click", () => setFieldView(button.dataset.fieldView));
});
controls.environmentImportButton.addEventListener("click", () => controls.environmentFileInput.click());
controls.environmentFileInput.addEventListener("change", (event) => importEnvironmentFiles(event.target.files));
controls.profile.addEventListener("change", () => {
  applyEnvironmentPreset(controls.profile.value);
  syncControlLabels();
  calculate();
});
[controls.model, controls.frequency, controls.sourceDepth,
  controls.maximumRange, controls.phaseSpeedLow, controls.phaseSpeedHigh,
  controls.modeLimit]
  .forEach((control) => control.addEventListener("change", calculate));
bottomMaterialControls.forEach((pair) => {
  pair.rangeInput.addEventListener("input", () => {
    pair.numberInput.value = pair.rangeInput.value;
  });
  pair.rangeInput.addEventListener("change", calculate);
  pair.numberInput.addEventListener("input", () => {
    const value = Number(pair.numberInput.value);
    if (Number.isFinite(value)) pair.rangeInput.value = String(value);
  });
  pair.numberInput.addEventListener("change", () => {
    syncBottomMaterialControl(pair);
    calculate();
  });
});
controls.waterDepth.addEventListener("change", () => {
  const waterDepthM = clamp(number(controls.waterDepth.value, 200), 50, 8000);
  controls.sourceDepth.max = String(waterDepthM - 1);
  controls.sourceDepth.value = String(clamp(number(controls.sourceDepth.value, 50), 1, waterDepthM - 1));
  if (controls.profile.value === "custom") {
    state.customSSP = normalizeProfilePoints(state.customSSP, waterDepthM);
  }
  updateProfileEditor();
  calculate();
});
byId("sspTableRows").addEventListener("change", updateProfileCell);
byId("sspTableRows").addEventListener("click", deleteProfilePoint);
byId("addSSPRow").addEventListener("click", addProfilePoint);
controls.modeLimit.addEventListener("input", syncControlLabels);
controls.selectedMode.addEventListener("input", () => {
  state.selectedMode = Number(controls.selectedMode.value) - 1;
  syncControlLabels();
  if (state.result) renderModeSelection();
});
canvases.spectrum.addEventListener("pointerdown", (event) => {
  if (!state.result || !state.spectrumPlot) return;
  const target = Math.round(pointerValue(canvases.spectrum, event, state.spectrumPlot).x);
  state.selectedMode = Math.round(clamp(target, 1, state.result.modes.count)) - 1;
  controls.selectedMode.value = String(state.selectedMode + 1);
  syncControlLabels();
  renderModeSelection();
});
window.addEventListener("resize", () => { if (state.result) render(); });

applyEnvironmentPreset(controls.profile.value);
syncControlLabels();
syncFieldViewControls();
calculate();
