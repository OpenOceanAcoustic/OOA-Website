import {
  createPlot,
  drawHeatmap,
  drawPoints,
  drawPolyline,
  nearestIndex,
  pointerValue,
  valueRange,
} from "../../shared-legacy/canvas.js";
import {
  environmentPreset,
  normalizeProfilePoints,
  profilePointsForPreset,
  resampleProfilePoints,
} from "../../shared-legacy/environment-presets.js";
import { parsePEEnvironmentFiles } from "../../shared-legacy/model-environment-import.js";
import { parseRamEnvironment, runPE } from "./wasm-adapter.js";

const byId = (id) => document.getElementById(id);
const controls = {
  model: byId("peModel"), profile: byId("profileKind"), frequency: byId("frequency"),
  sourceDepth: byId("sourceDepth"), waterDepth: byId("waterDepth"),
  maximumRange: byId("maximumRange"), maximumDepth: byId("maximumDepth"),
  bottomSpeed: byId("bottomSpeed"), bottomDensity: byId("bottomDensity"),
  bottomAbsorption: byId("bottomAbsorption"),
  bottomSpeedRange: byId("bottomSpeedRange"), bottomDensityRange: byId("bottomDensityRange"),
  bottomAbsorptionRange: byId("bottomAbsorptionRange"),
  rangeStep: byId("rangeStep"), depthStep: byId("depthStep"), nPade: byId("nPade"),
  inspectRange: byId("inspectRange"), run: byId("runPE"),
  importButton: byId("environmentImportButton"), importInput: byId("environmentFileInput"),
};
const canvases = {
  ssp: byId("sspCanvas"), field: byId("fieldCanvas"), delta: byId("deltaCanvas"),
  convergence: byId("convergenceCanvas"), profile: byId("profileCanvas"),
};
const state = {
  result: null,
  request: 0,
  convergencePlot: null,
  customSSP: profilePointsForPreset("custom", 5000),
  importedEnvironment: null,
};

function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, Number(value))); }
function number(value, fallback) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function format(value, digits = 3) { return Number(value).toLocaleString("zh-CN", { maximumFractionDigits: digits }); }

const bottomEditors = [
  { range: controls.bottomSpeedRange, number: controls.bottomSpeed, digits: 0 },
  { range: controls.bottomDensityRange, number: controls.bottomDensity, digits: 0 },
  { range: controls.bottomAbsorptionRange, number: controls.bottomAbsorption, digits: 2 },
];

function setBottomValue(editor, value) {
  const minimum = number(editor.range.min, Number.NEGATIVE_INFINITY);
  const maximum = number(editor.range.max, Number.POSITIVE_INFINITY);
  const bounded = clamp(value, minimum, maximum);
  editor.range.value = String(bounded);
  editor.number.value = editor.digits ? bounded.toFixed(editor.digits) : String(Math.round(bounded));
}

function syncBottomEditors() {
  for (const editor of bottomEditors) setBottomValue(editor, number(editor.range.value, 0));
}

function currentProfileDescription() {
  if (controls.profile.value === "custom" && state.importedEnvironment) {
    const { title, format: sourceFormat, bathymetry, nativeInput } = state.importedEnvironment;
    const terrainNote = bathymetryVaries(bathymetry)
      ? " · 原生 RAM 距离相关地形"
      : "";
    const sectionCount = nativeInput?.environment?.mediumSections?.length || 0;
    const sectionNote = sectionCount > 1
      ? ` · ${sectionCount} 个介质段`
      : "";
    return `${title || "导入环境"} · ${sourceFormat || "ENVIRONMENT"} · ${state.customSSP.length} 个 SSP 节点${terrainNote}${sectionNote}`;
  }
  return environmentPreset(controls.profile.value).description;
}

function bathymetryPointCount(bathymetry) {
  if (!bathymetry) return 0;
  if (ArrayBuffer.isView(bathymetry)) return Math.floor(bathymetry.length / 2);
  if (!Array.isArray(bathymetry)) return 0;
  return Array.isArray(bathymetry[0]) ? bathymetry.length : Math.floor(bathymetry.length / 2);
}

function bathymetryVaries(bathymetry) {
  if (!Array.isArray(bathymetry) || bathymetry.length < 2) return false;
  const first = Array.isArray(bathymetry[0]) ? number(bathymetry[0][1], NaN) : NaN;
  return Number.isFinite(first) && bathymetry.some((point) => (
    Array.isArray(point) && Math.abs(number(point[1], first) - first) > 1e-6
  ));
}

function errorText(error) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error.trim();
  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") return serialized;
  } catch {
    // Fall through to a stable, user-facing parser error below.
  }
  return "未能识别文件内容，请选择一个 RAM .in 文件或一个环境 JSON。";
}

function setImportStatus(kind, text) {
  const status = byId("environmentImportStatus");
  status.className = kind || "";
  status.textContent = text;
}

function readParameters() {
  const waterDepthM = clamp(number(controls.waterDepth.value, 200), 50, 8000);
  const maximumDepthM = clamp(number(controls.maximumDepth.value, 300), waterDepthM, 10000);
  const profile = controls.profile.value;
  return {
    contractVersion: 1,
    model: controls.model.value,
    profile,
    environmentTitle: state.importedEnvironment?.title || null,
    sspPoints: profilePointsForPreset(profile, waterDepthM, state.customSSP),
    frequencyHz: clamp(number(controls.frequency.value, 100), 10, 1000),
    sourceDepthM: clamp(number(controls.sourceDepth.value, 50), 1, waterDepthM - 1),
    waterDepthM,
    maximumRangeKm: clamp(number(controls.maximumRange.value, 20), 2, 250),
    maximumDepthM,
    rangeStepM: clamp(number(controls.rangeStep.value, 25), 1, 100),
    depthStepM: clamp(number(controls.depthStep.value, 2), 0.25, 20),
    bottomSoundSpeedMps: clamp(number(controls.bottomSpeed.value, 1700), 1400, 3000),
    bottomDensityKgM3: clamp(number(controls.bottomDensity.value, 1800), 1000, 3500),
    bottomAttenuationDbPerWavelength: clamp(number(controls.bottomAbsorption.value, 0.5), 0, 5),
    bathymetry: profile === "custom" ? state.importedEnvironment?.bathymetry || null : null,
    ramInput: profile === "custom" ? state.importedEnvironment?.nativeInput || null : null,
    ramBaseline: profile === "custom" ? state.importedEnvironment?.baseline || null : null,
    nPade: Math.round(clamp(number(controls.nPade.value, 4), 1, 10)),
    referenceNPade: 10,
    rangeCount: 181,
    depthCount: 131,
  };
}

function firstProfileValue(profile, fallback) {
  const values = profile?.values;
  return values && typeof values.length === "number" && values.length
    ? number(values[0], fallback)
    : fallback;
}

function isNativeRamInput(value) {
  return Boolean(value?.environment?.mediumSections && value?.source &&
    value?.receivers && value?.options && value?.outputRequest);
}

function profileValues(values) {
  return values && typeof values.length === "number"
    ? Array.from(values, (value) => number(value, 0))
    : [];
}

function normalizeRamEnvironment(imported) {
  if (!isNativeRamInput(imported)) return imported;
  const environment = imported.environment;
  const profile = environment.mediumSections[0];
  const waterProfile = profile?.waterSoundSpeedMps;
  const depths = profileValues(waterProfile?.depthsM);
  const speeds = profileValues(waterProfile?.values);
  if (depths.length < 2 || depths.length !== speeds.length) {
    throw new Error("RAM IN 中没有有效的水体声速剖面");
  }
  const bathymetry = Array.isArray(environment.bathymetry)
    ? environment.bathymetry.map((point) => [number(point?.rangeM, 0) / 1000, number(point?.depthM, 0)])
    : [];
  return {
    ...imported,
    title: environment.title,
    frequencyHz: environment.frequencyHz,
    profilePoints: depths.map((depth, index) => [depth, speeds[index]]),
    waterDepthM: bathymetry[0]?.[1] ?? imported.outputRequest.plotMaximumDepthM,
    sourceDepthM: imported.source.depthM,
    maximumRangeKm: number(imported.outputRequest.maximumRangeM, 0) / 1000,
    maximumDepthM: imported.outputRequest.maximumDepthM,
    rangeStepM: imported.options.rangeStepM,
    depthStepM: imported.options.depthStepM,
    nPade: imported.options.padeTerms,
    bathymetry,
    bottomSoundSpeedMps: firstProfileValue(profile?.bottomCompressionalSpeedMps, 1700),
    bottomDensityKgM3: firstProfileValue(profile?.bottomDensityKgM3, 1800),
    bottomAttenuationDbPerWavelength: firstProfileValue(
      profile?.bottomCompressionalAttenuationDbPerWavelength,
      0.5,
    ),
  };
}

function profileDisplayPoints() {
  const parameters = readParameters();
  return controls.profile.value === "custom"
    ? parameters.sspPoints
    : resampleProfilePoints(parameters.sspPoints, parameters.waterDepthM, 500);
}

function updateProfileEditor() {
  const points = profileDisplayPoints();
  const waterDepthM = readParameters().waterDepthM;
  byId("sspTableRows").innerHTML = points.map(([depthM, soundSpeedMps], index) => `
    <tr>
      <td><input type="number" min="0" max="${waterDepthM}" step="1" value="${Number(depthM).toFixed(depthM % 1 ? 1 : 0)}" data-profile-index="${index}" data-profile-field="depth" aria-label="第 ${index + 1} 个节点深度"></td>
      <td><input type="number" min="1300" max="2200" step="0.1" value="${Number(soundSpeedMps).toFixed(1)}" data-profile-index="${index}" data-profile-field="speed" aria-label="第 ${index + 1} 个节点声速"></td>
      <td><button type="button" class="profile-delete-row" data-profile-delete="${index}" aria-label="删除第 ${index + 1} 个节点">×</button></td>
    </tr>`).join("");
  byId("sspTableEditor").dataset.mode = controls.profile.value === "custom" ? "custom" : "preset";
}

function convertDisplayedProfileToCustom() {
  if (controls.profile.value === "custom") return;
  state.customSSP = profileDisplayPoints().map((point) => [...point]);
  controls.profile.value = "custom";
  byId("profileDescription").textContent = environmentPreset("custom").description;
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
  controls.frequency.value = String(preset.frequencyHz);
  controls.sourceDepth.value = String(preset.sourceDepthM);
  controls.waterDepth.value = String(preset.waterDepthM);
  controls.maximumRange.value = String(preset.maximumRangeKm);
  controls.maximumDepth.value = String(preset.maximumDepthM);
  controls.rangeStep.value = String(preset.rangeStepM);
  controls.depthStep.value = String(preset.depthStepM);
  controls.bottomSpeed.value = String(preset.bottomSoundSpeedMps);
  controls.bottomDensity.value = String(preset.bottomDensityKgM3);
  controls.bottomAbsorption.value = String(preset.bottomAttenuationDbPerWavelength);
  syncBottomEditors();
  controls.sourceDepth.max = String(preset.waterDepthM - 1);
  controls.maximumDepth.min = String(preset.waterDepthM);
  byId("profileDescription").textContent = currentProfileDescription();
  updateProfileEditor();
}

async function importEnvironmentFiles(files) {
  if (!files.length) return;
  controls.importButton.disabled = true;
  setImportStatus("busy", "正在本地解析环境文件…");
  try {
    const parsed = await parsePEEnvironmentFiles(
      files,
      ({ text }) => parseRamEnvironment({ text }),
    );
    const imported = normalizeRamEnvironment(parsed);
    const suppliedPoints = Array.isArray(imported?.profilePoints) ? imported.profilePoints : [];
    if (suppliedPoints.length < 2) throw new Error("导入文件中没有至少两个有效的声速剖面节点");
    const deepestProfilePoint = suppliedPoints.reduce(
      (maximum, point) => Math.max(maximum, Array.isArray(point) ? number(point[0], 0) : 0),
      0,
    );
    const waterDepthM = clamp(number(imported.waterDepthM, deepestProfilePoint || 200), 50, 8000);
    state.customSSP = normalizeProfilePoints(suppliedPoints, waterDepthM);
    const baseline = {
      waterDepthM,
      maximumRangeKm: number(imported.maximumRangeKm, controls.maximumRange.value),
      maximumDepthM: number(imported.maximumDepthM, controls.maximumDepth.value),
      profilePoints: state.customSSP.map((point) => [...point]),
      bottomSoundSpeedMps: number(imported.bottomSoundSpeedMps, controls.bottomSpeed.value),
      bottomDensityKgM3: number(imported.bottomDensityKgM3, controls.bottomDensity.value),
      bottomAttenuationDbPerWavelength: number(
        imported.bottomAttenuationDbPerWavelength,
        controls.bottomAbsorption.value,
      ),
    };
    const nativeInput = isNativeRamInput(parsed)
      ? Object.fromEntries(Object.entries(parsed).filter(([key]) => (
        key !== "format" && key !== "sourceFiles"
      )))
      : null;
    state.importedEnvironment = {
      title: String(imported.title || files[0]?.name || "导入环境"),
      format: String(imported.format || "ENVIRONMENT"),
      bathymetry: imported.bathymetry || null,
      nativeInput,
      baseline,
    };

    controls.profile.value = "custom";
    controls.waterDepth.value = String(waterDepthM);
    controls.sourceDepth.max = String(waterDepthM - 1);
    controls.sourceDepth.value = String(clamp(number(imported.sourceDepthM, controls.sourceDepth.value), 1, waterDepthM - 1));
    controls.frequency.value = String(clamp(number(imported.frequencyHz, controls.frequency.value), 10, 1000));
    controls.maximumRange.value = String(clamp(number(imported.maximumRangeKm, controls.maximumRange.value), 2, 250));
    controls.maximumDepth.min = String(waterDepthM);
    controls.maximumDepth.value = String(clamp(
      Math.max(waterDepthM, number(imported.maximumDepthM, controls.maximumDepth.value)),
      waterDepthM,
      10000,
    ));
    controls.rangeStep.value = String(clamp(number(imported.rangeStepM, controls.rangeStep.value), 1, 100));
    controls.depthStep.value = String(clamp(number(imported.depthStepM, controls.depthStep.value), 0.25, 20));
    controls.nPade.value = String(Math.round(clamp(number(imported.nPade, controls.nPade.value), 1, 10)));
    setBottomValue(bottomEditors[0], number(imported.bottomSoundSpeedMps, controls.bottomSpeed.value));
    setBottomValue(bottomEditors[1], number(imported.bottomDensityKgM3, controls.bottomDensity.value));
    setBottomValue(bottomEditors[2], number(
      imported.bottomAttenuationDbPerWavelength,
      controls.bottomAbsorption.value,
    ));

    updateProfileEditor();
    syncControlLabels();
    const terrainPoints = bathymetryPointCount(state.importedEnvironment.bathymetry);
    setImportStatus(
      "success",
      isNativeRamInput(parsed)
        ? `已原生解析 ${state.importedEnvironment.title}；${terrainPoints} 个地形节点、${parsed.environment.mediumSections.length} 个介质段和 ${parsed.receivers.depthsM.length} 个接收深度将完整送入 RAM WASM。`
        : `已导入 ${state.importedEnvironment.title}；SSP、水深、声源与底质将送入本地 PE WASM。`,
    );
    await calculate();
  } catch (error) {
    setImportStatus("error", `导入失败：${errorText(error)}`);
  } finally {
    controls.importButton.disabled = false;
    controls.importInput.value = "";
  }
}

function syncControlLabels() {
  syncBottomEditors();
  byId("nPadeOut").textContent = `${controls.nPade.value} terms`;
  byId("inspectRangeOut").textContent = `${number(controls.inspectRange.value, 0).toFixed(1)} km`;
  byId("heroModel").textContent = controls.model.value.toUpperCase();
  byId("profileDescription").textContent = currentProfileDescription();
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
  byId("heroEngine").textContent = runtime?.engine || (isWasm ? "PE WASM" : "DEMO FALLBACK");
  byId("runtimeMessage").textContent = isWasm
    ? "PE 正在浏览器 Web Worker / WebAssembly 中推进，环境参数和场结果不会上传到服务器。"
    : `WASM SDK 尚未生效：${runtime?.warning || "backend unavailable"}。当前数据只演示 nPade 交互与图表，不能用于工程计算。`;
  byId("resultSource").textContent = isWasm ? "OOB WASM" : "DEMO";
}

function drawEnvironment() {
  const result = state.result;
  if (!result) return;
  const speeds = result.environment.soundSpeedMps;
  const depths = result.environment.depthsM;
  const [minimum, maximum] = valueRange(speeds, { paddingFraction: 0.1, minimumPadding: 3 });
  const plot = createPlot(canvases.ssp, {
    xMinimum: minimum, xMaximum: maximum,
    yMinimum: 0, yMaximum: result.parameters.maximumDepthM,
    xLabel: "c / m·s⁻¹", yLabel: "深度 / m", depthAxis: true,
  });
  drawPolyline(plot, Array.from(depths, (depth, index) => [speeds[index], depth]), { color: "#62d8e7", width: 2, glow: 5 });
  const sourceIndex = nearestIndex(depths, result.parameters.sourceDepthM);
  drawPoints(plot, [[speeds[sourceIndex], result.parameters.sourceDepthM]], { color: "#f8b44c", radius: 4 });
}

function inspectRangeKm() {
  if (!state.result) return number(controls.inspectRange.value, 0);
  return clamp(number(controls.inspectRange.value, 0), 0, state.result.parameters.maximumRangeKm);
}

function drawFields() {
  const result = state.result;
  if (!result) return;
  const common = {
    xMinimum: 0, xMaximum: result.parameters.maximumRangeKm,
    yMinimum: 0, yMaximum: result.parameters.maximumDepthM,
    xLabel: "距离 / km", yLabel: "深度 / m",
    bathymetry: result.environment.bathymetry,
  };
  const fieldPlot = drawHeatmap(canvases.field, {
    values: result.field.tlDb, rows: result.field.rows, columns: result.field.columns,
  }, { ...common, minimum: 60, maximum: 120 });
  const selectedRange = inspectRangeKm();
  drawPolyline(fieldPlot, [[selectedRange, 0], [selectedRange, result.parameters.maximumDepthM]], {
    color: "rgba(248,180,76,.9)", width: 1.2, dash: [4, 4],
  });
  drawPoints(fieldPlot, [[result.field.rangesKm[0], result.parameters.sourceDepthM]], { color: "#f8b44c", radius: 4 });
  const magnitude = Math.max(0.5, Math.ceil(result.metrics.deltaMaxDb * 2) / 2);
  const deltaPlot = drawHeatmap(canvases.delta, {
    values: result.deltaField.values, rows: result.deltaField.rows, columns: result.deltaField.columns,
  }, { ...common, divergingMagnitude: magnitude });
  drawPolyline(deltaPlot, [[selectedRange, 0], [selectedRange, result.parameters.maximumDepthM]], {
    color: "rgba(248,180,76,.9)", width: 1.2, dash: [4, 4],
  });
}

function drawConvergence() {
  const result = state.result;
  if (!result) return;
  const maximum = Math.max(0.1, ...result.convergence.map((point) => point.rmsDb));
  const plot = createPlot(canvases.convergence, {
    xMinimum: 1, xMaximum: 10, yMinimum: 0, yMaximum: maximum * 1.12,
    xLabel: "Padé 项数 nPade", yLabel: "相对 nPade=10 的 RMSE / dB",
    xTicks: 9, xFormatter: (value) => Math.round(value).toString(),
  });
  const points = result.convergence.map((point) => [point.nPade, point.rmsDb]);
  drawPolyline(plot, points, { color: "#62d8e7", width: 2, glow: 3 });
  drawPoints(plot, points, { color: "#62d8e7", radius: 3 });
  drawPoints(plot, [points[result.parameters.nPade - 1]], { color: "#f8b44c", radius: 5, stroke: "#ffe0a0" });
  state.convergencePlot = plot;
}

function drawVerticalProfile() {
  const result = state.result;
  if (!result) return;
  const selectedRange = inspectRangeKm();
  const rangeIndex = nearestIndex(result.field.rangesKm, selectedRange);
  const current = [];
  const reference = [];
  const values = [];
  for (let depthIndex = 0; depthIndex < result.field.rows; depthIndex += 1) {
    const offset = depthIndex * result.field.columns + rangeIndex;
    const depth = result.field.depthsM[depthIndex];
    const currentValue = result.field.tlDb[offset];
    const referenceValue = result.referenceField.tlDb[offset];
    if (Number.isFinite(currentValue)) { current.push([currentValue, depth]); values.push(currentValue); }
    if (Number.isFinite(referenceValue)) { reference.push([referenceValue, depth]); values.push(referenceValue); }
  }
  const [minimum, maximum] = valueRange(values, { paddingFraction: 0.08, minimumPadding: 2, fallback: [60, 120] });
  const plot = createPlot(canvases.profile, {
    xMinimum: Math.max(50, minimum), xMaximum: Math.min(130, maximum),
    yMinimum: 0, yMaximum: result.parameters.maximumDepthM,
    xLabel: "传播损失 / dB", yLabel: "深度 / m", depthAxis: true,
  });
  drawPolyline(plot, reference, { color: "#c5f16b", width: 1.5, dash: [4, 3] });
  drawPolyline(plot, current, { color: "#62d8e7", width: 2, glow: 3 });
  byId("profileTitle").textContent = `${result.field.rangesKm[rangeIndex].toFixed(1)} km 垂向剖面`;
}

function updateMetrics() {
  const result = state.result;
  if (!result) return;
  byId("fieldTitle").textContent = `nPade = ${result.parameters.nPade} 传播损失`;
  byId("padeMetric").textContent = `${result.parameters.nPade} / ref 10`;
  byId("stepMetric").textContent = `${format(result.parameters.rangeStepM, 2)} m × ${format(result.parameters.depthStepM, 2)} m`;
  byId("fieldShape").textContent = `${result.field.columns} × ${result.field.rows}`;
  byId("computeTime").textContent = `${format(result.runtime.computeMs, 1)} ms`;
  byId("deltaRms").textContent = `${format(result.metrics.deltaRmsDb, 3)} dB`;
  byId("deltaMax").textContent = `${format(result.metrics.deltaMaxDb, 3)} dB`;
  byId("pressureL2").textContent = Number.isFinite(result.metrics.relativePressureL2)
    ? result.metrics.relativePressureL2.toExponential(2) : "—";
}

function render() {
  drawEnvironment();
  drawFields();
  drawConvergence();
  drawVerticalProfile();
  updateMetrics();
}

async function calculate() {
  const token = ++state.request;
  controls.run.disabled = true;
  setStatus("busy", "MARCHING");
  try {
    const result = await runPE(readParameters());
    if (token !== state.request) return;
    state.result = result;
    controls.inspectRange.max = String(result.parameters.maximumRangeKm);
    controls.inspectRange.value = String(clamp(number(controls.inspectRange.value, result.parameters.maximumRangeKm * 0.6), 0, result.parameters.maximumRangeKm));
    controls.nPade.value = String(result.parameters.nPade);
    syncControlLabels();
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

controls.run.addEventListener("click", calculate);
controls.profile.addEventListener("change", () => {
  state.importedEnvironment = null;
  applyEnvironmentPreset(controls.profile.value);
  setImportStatus("", "支持 RAM .in 与统一环境 JSON；文件仅在本机浏览器中解析。");
  syncControlLabels();
  calculate();
});
[controls.model, controls.frequency, controls.sourceDepth, controls.maximumRange,
  controls.maximumDepth, controls.rangeStep, controls.depthStep, controls.nPade]
  .forEach((control) => control.addEventListener("change", calculate));
for (const editor of bottomEditors) {
  editor.range.addEventListener("input", () => setBottomValue(editor, number(editor.range.value, 0)));
  editor.range.addEventListener("change", calculate);
  editor.number.addEventListener("input", () => {
    const value = Number(editor.number.value);
    if (Number.isFinite(value)) editor.range.value = String(clamp(value, number(editor.range.min, value), number(editor.range.max, value)));
  });
  editor.number.addEventListener("change", () => {
    setBottomValue(editor, number(editor.number.value, editor.range.value));
    calculate();
  });
}
controls.waterDepth.addEventListener("change", () => {
  const waterDepthM = clamp(number(controls.waterDepth.value, 200), 50, 8000);
  controls.sourceDepth.max = String(waterDepthM - 1);
  controls.sourceDepth.value = String(clamp(number(controls.sourceDepth.value, 50), 1, waterDepthM - 1));
  controls.maximumDepth.min = String(waterDepthM);
  controls.maximumDepth.value = String(Math.max(waterDepthM, number(controls.maximumDepth.value, 300)));
  if (controls.profile.value === "custom") {
    state.customSSP = normalizeProfilePoints(state.customSSP, waterDepthM);
  }
  updateProfileEditor();
  calculate();
});
byId("sspTableRows").addEventListener("change", updateProfileCell);
byId("sspTableRows").addEventListener("click", deleteProfilePoint);
byId("addSSPRow").addEventListener("click", addProfilePoint);
controls.importButton.addEventListener("click", () => controls.importInput.click());
controls.importInput.addEventListener("change", () => importEnvironmentFiles(Array.from(controls.importInput.files || [])));
controls.nPade.addEventListener("input", syncControlLabels);
controls.inspectRange.addEventListener("input", () => {
  syncControlLabels();
  if (state.result) { drawFields(); drawVerticalProfile(); }
});
canvases.convergence.addEventListener("pointerdown", (event) => {
  if (!state.result || !state.convergencePlot) return;
  const target = Math.round(pointerValue(canvases.convergence, event, state.convergencePlot).x);
  controls.nPade.value = String(Math.round(clamp(target, 1, 10)));
  syncControlLabels();
  calculate();
});
window.addEventListener("resize", () => { if (state.result) render(); });

applyEnvironmentPreset(controls.profile.value);
syncControlLabels();
calculate();

