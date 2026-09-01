import { createPlot, drawHeatmap, drawPoints, drawPolyline, pointerValue, valueRange, } from "../../shared-page/canvas";
import { environmentPreset, normalizeProfilePoints, profilePointsForPreset, resampleProfilePoints, } from "../../shared-page/environment-presets";
import type { NormalModeRuntime } from "@ooa/runtime-normal-mode";
import type { MountedModelPage } from "../../shared-page/controller-types";
export function mountNormalModePage(root: HTMLElement, runtime: NormalModeRuntime): MountedModelPage {
    const listenerScope: any = new AbortController();
    const listen: any = (target: any, type: any, listener: any): any => target.addEventListener(type, listener, { signal: listenerScope.signal });
    const byId: any = (id: any): any => root.querySelector(`#${CSS.escape(id)}`);
    const controls: any = {
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
    const fieldViewButtons: any = Array.from(root.querySelectorAll("[data-field-view]"));
    const canvases: any = {
        ssp: byId("sspCanvas"), spectrum: byId("spectrumCanvas"), eigenfunction: byId("eigenfunctionCanvas"),
        field: byId("fieldCanvas"), delta: byId("deltaCanvas"),
    };
    const state: any = {
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
    };
    function clamp(value: any, minimum: any, maximum: any): any { return Math.max(minimum, Math.min(maximum, Number(value))); }
    function number(value: any, fallback: any): any { const parsed: any = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
    function format(value: any, digits: any = 3): any { return Number(value).toLocaleString("zh-CN", { maximumFractionDigits: digits }); }
    function modeLabel(modeIndex: any = state.selectedMode): any { return `Mode ${String(modeIndex + 1).padStart(2, "0")}`; }
    const bottomMaterialControls: any = [
        { numberInput: controls.bottomSpeed, rangeInput: controls.bottomSpeedRange, fallback: 1700 },
        { numberInput: controls.bottomDensity, rangeInput: controls.bottomDensityRange, fallback: 1800 },
        { numberInput: controls.bottomAbsorption, rangeInput: controls.bottomAbsorptionRange, fallback: 0.5 },
    ];
    function syncBottomMaterialControl(pair: any, source: any = pair.numberInput): any {
        const minimum: any = number(pair.numberInput.min, -Infinity);
        const maximum: any = number(pair.numberInput.max, Infinity);
        const value: any = clamp(number(source.value, pair.fallback), minimum, maximum);
        pair.numberInput.value = String(value);
        pair.rangeInput.value = String(value);
    }
    function syncBottomMaterialControls(): any {
        bottomMaterialControls.forEach((pair: any): any => syncBottomMaterialControl(pair));
    }
    function currentProfileDescription(): any {
        return controls.profile.value === "custom"
            ? state.customProfileDescription
            : environmentPreset(controls.profile.value).description;
    }
    function describeError(error: any): any {
        if (error instanceof Error && error.message)
            return error.message;
        if (typeof error === "string" && error.trim())
            return error.trim();
        try {
            const serialized: any = JSON.stringify(error);
            if (serialized && serialized !== "{}")
                return serialized;
        }
        catch {
            // Fall through to the user-facing parser error below.
        }
        return "未能识别文件内容，请同时选择同名的 Kraken ENV/FLP，或选择一个环境 JSON。";
    }
    function bathymetryVaries(points: any): any {
        if (!Array.isArray(points) || points.length < 2)
            return false;
        const firstDepth: any = number(points[0]?.[1], NaN);
        return Number.isFinite(firstDepth) && points.some((point: any): any => (Math.abs(number(point?.[1], firstDepth) - firstDepth) > 1e-6));
    }
    function readParameters(): any {
        const waterDepthM: any = clamp(number(controls.waterDepth.value, 200), 50, 8000);
        const profile: any = controls.profile.value;
        const sspPoints: any = profilePointsForPreset(profile, waterDepthM, state.customSSP);
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
    function profileDisplayPoints(): any {
        const parameters: any = readParameters();
        return controls.profile.value === "custom"
            ? parameters.sspPoints
            : resampleProfilePoints(parameters.sspPoints, parameters.waterDepthM, 500);
    }
    function updateProfileEditor(): any {
        const editable: any = controls.profile.value === "custom";
        const points: any = profileDisplayPoints();
        byId("sspTableRows").innerHTML = points.map(([depthM, soundSpeedMps]: any, index: any): any => `
    <tr>
      <td><input type="number" min="0" max="${readParameters().waterDepthM}" step="1" value="${Number(depthM).toFixed(depthM % 1 ? 1 : 0)}" data-profile-index="${index}" data-profile-field="depth" aria-label="第 ${index + 1} 个节点深度"></td>
      <td><input type="number" min="1300" max="2200" step="0.1" value="${Number(soundSpeedMps).toFixed(1)}" data-profile-index="${index}" data-profile-field="speed" aria-label="第 ${index + 1} 个节点声速"></td>
      <td><button type="button" class="profile-delete-row" data-profile-delete="${index}" aria-label="删除第 ${index + 1} 个节点">×</button></td>
    </tr>`).join("");
        byId("addSSPRow").disabled = false;
        byId("sspTableEditor").dataset.mode = editable ? "custom" : "preset";
    }
    function convertDisplayedProfileToCustom(): any {
        if (controls.profile.value === "custom")
            return;
        state.customSSP = profileDisplayPoints().map((point: any): any => [...point]);
        state.customProfileDescription = environmentPreset("custom").description;
        controls.profile.value = "custom";
        byId("profileDescription").textContent = state.customProfileDescription;
    }
    function updateProfileCell(event: any): any {
        const input: any = event.target.closest("input[data-profile-field]");
        if (!input)
            return;
        const displayed: any = profileDisplayPoints();
        const index: any = Number(input.dataset.profileIndex);
        convertDisplayedProfileToCustom();
        state.customSSP = displayed.map((point: any): any => [...point]);
        if (!state.customSSP[index])
            return;
        state.customSSP[index][input.dataset.profileField === "depth" ? 0 : 1] = number(input.value, 0);
        state.customSSP = normalizeProfilePoints(state.customSSP, number(controls.waterDepth.value, 200));
        updateProfileEditor();
        calculate();
    }
    function deleteProfilePoint(event: any): any {
        const button: any = event.target.closest("button[data-profile-delete]");
        if (!button)
            return;
        const displayed: any = profileDisplayPoints();
        if (displayed.length <= 2)
            return;
        convertDisplayedProfileToCustom();
        state.customSSP = displayed.map((point: any): any => [...point]);
        state.customSSP.splice(Number(button.dataset.profileDelete), 1);
        state.customSSP = normalizeProfilePoints(state.customSSP, number(controls.waterDepth.value, 200));
        updateProfileEditor();
        calculate();
    }
    function addProfilePoint(): any {
        const points: any = profileDisplayPoints();
        convertDisplayedProfileToCustom();
        state.customSSP = points.map((point: any): any => [...point]);
        let insertion: any = 1;
        let widestGap: any = -1;
        for (let index: any = 1; index < state.customSSP.length; index += 1) {
            const gap: any = state.customSSP[index][0] - state.customSSP[index - 1][0];
            if (gap > widestGap) {
                widestGap = gap;
                insertion = index;
            }
        }
        const left: any = state.customSSP[insertion - 1];
        const right: any = state.customSSP[insertion];
        state.customSSP.splice(insertion, 0, [
            (left[0] + right[0]) / 2,
            (left[1] + right[1]) / 2,
        ]);
        updateProfileEditor();
        calculate();
    }
    function applyEnvironmentPreset(key: any): any {
        const preset: any = environmentPreset(key);
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
    function normalizeKrakenEnvironment(imported: any): any {
        if (Array.isArray(imported?.profilePoints))
            return imported;
        const profile: any = imported?.profiles?.[0];
        const layer: any = profile?.layers?.[0];
        const depths: any = Array.isArray(layer?.depthsM) ? layer.depthsM : [];
        const speeds: any = Array.isArray(layer?.compressionalSpeedMps)
            ? layer.compressionalSpeedMps
            : [];
        if (depths.length < 2 || depths.length !== speeds.length) {
            throw new Error("Kraken ENV 中没有可用于当前二维页面的有效水层声速剖面");
        }
        const receiverRanges: any = Array.isArray(imported.receiverRangesM)
            ? imported.receiverRangesM
            : [];
        const maximumRangeM: any = number(imported.maximumRangeM, receiverRanges.length ? Math.max(...receiverRanges) : 0);
        const bottom: any = profile?.bottom || {};
        return {
            ...imported,
            profilePoints: depths.map((depth: any, index: any): any => [depth, speeds[index]]),
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
    function syncControlLabels(): any {
        byId("modeLimitOut").textContent = `${controls.modeLimit.value} modes`;
        const selectedLabel: any = modeLabel(Number(controls.selectedMode.value) - 1);
        byId("selectedModeOut").textContent = selectedLabel;
        controls.showSelectedModeField.textContent = `查看 ${selectedLabel} 单模态声场`;
        byId("heroModel").textContent = controls.model.value.toUpperCase();
        byId("profileDescription").textContent = currentProfileDescription();
    }
    function syncFieldViewControls(): any {
        fieldViewButtons.forEach((button: any): any => {
            const active: any = button.dataset.fieldView === state.fieldView;
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", active ? "true" : "false");
        });
    }
    function setStatus(kind: any, text: any): any {
        const status: any = byId("solveStatus");
        status.className = `status-pill ${kind === "busy" || kind === "error" ? kind : ""}`.trim();
        status.textContent = text;
    }
    function updateRuntime(runtime: any): any {
        const isWasm: any = runtime?.mode === "wasm";
        const banner: any = byId("runtimeBanner");
        banner.dataset.mode = isWasm ? "wasm" : "demo";
        byId("runtimeBadge").textContent = isWasm ? "WASM ACTIVE" : "DEMO FALLBACK";
        byId("heroEngine").textContent = runtime?.engine || (isWasm ? "NORMAL MODE WASM" : "DEMO FALLBACK");
        byId("runtimeMessage").textContent = isWasm
            ? "Normal Mode 正在浏览器 Web Worker / WebAssembly 中计算，输入和结果不会上传到服务器。"
            : `WASM SDK 尚未生效：${runtime?.warning || "backend unavailable"}。当前显示确定性的演示数据，不能用于工程计算。`;
        byId("resultSource").textContent = isWasm ? "OOB WASM" : "DEMO";
    }
    function drawSoundSpeedProfile(): any {
        const result: any = state.result;
        if (!result)
            return;
        const speeds: any = result.environment.soundSpeedMps;
        const depths: any = result.environment.depthsM;
        const [minimum, maximum]: any = valueRange(speeds, { paddingFraction: 0.1, minimumPadding: 3 });
        const plot: any = createPlot(canvases.ssp, {
            xMinimum: minimum, xMaximum: maximum,
            yMinimum: 0, yMaximum: result.environment.waterDepthM,
            xLabel: "c / m·s⁻¹", yLabel: "深度 / m", depthAxis: true,
        });
        drawPolyline(plot, Array.from(depths, (depth: any, index: any): any => [speeds[index], depth]), { color: "#62d8e7", width: 2, glow: 5 });
        drawPoints(plot, [[
                speeds[Math.round(result.environment.sourceDepthM / result.environment.waterDepthM * (speeds.length - 1))],
                result.environment.sourceDepthM,
            ]], { color: "#f8b44c", radius: 4 });
    }
    function modalWavenumbers(): any {
        const values: any = state.result.modes.horizontalWavenumbersInterleaved;
        return Array.from({ length: state.result.modes.count }, (_: any, index: any): any => values[index * 2]);
    }
    function drawSpectrum(): any {
        const result: any = state.result;
        if (!result)
            return;
        const wavenumbers: any = modalWavenumbers();
        const [minimum, maximum]: any = valueRange(wavenumbers, { paddingFraction: 0.08, minimumPadding: 1e-4 });
        const plot: any = createPlot(canvases.spectrum, {
            xMinimum: 1, xMaximum: result.modes.count,
            yMinimum: minimum, yMaximum: maximum,
            xLabel: "模态序号 m", yLabel: "Re(kᵣ) / rad·m⁻¹",
            xFormatter: (value: any): any => Math.round(value).toString(),
            yFormatter: (value: any): any => value.toFixed(4),
        });
        const points: any = wavenumbers.map((value: any, index: any): any => [index + 1, value]);
        drawPolyline(plot, points, { color: "rgba(98,216,231,.72)", width: 1.2 });
        drawPoints(plot, points, { color: "#62d8e7", radius: 2 });
        drawPoints(plot, [points[state.selectedMode]], { color: "#f8b44c", radius: 5, stroke: "#ffe0a0", strokeWidth: 1.2 });
        state.spectrumPlot = plot;
    }
    function drawModeDetails(): any {
        const result: any = state.result;
        if (!result)
            return;
        const mode: any = state.selectedMode;
        const depths: any = result.modes.depthsM;
        const stride: any = depths.length;
        const realShape: any = [];
        const imaginaryShape: any = [];
        let normalization: any = 1e-12;
        for (let depthIndex: any = 0; depthIndex < stride; depthIndex += 1) {
            const offset: any = (mode * stride + depthIndex) * 2;
            normalization = Math.max(normalization, Math.hypot(result.modes.modeShapesInterleaved[offset], result.modes.modeShapesInterleaved[offset + 1]));
        }
        for (let depthIndex: any = 0; depthIndex < stride; depthIndex += 1) {
            const offset: any = (mode * stride + depthIndex) * 2;
            realShape.push([result.modes.modeShapesInterleaved[offset] / normalization, depths[depthIndex]]);
            imaginaryShape.push([result.modes.modeShapesInterleaved[offset + 1] / normalization, depths[depthIndex]]);
        }
        const shapePlot: any = createPlot(canvases.eigenfunction, {
            xMinimum: -1.08, xMaximum: 1.08, yMinimum: 0, yMaximum: result.environment.waterDepthM,
            xLabel: "归一化 φₘ", yLabel: "深度 / m", depthAxis: true,
        });
        drawPolyline(shapePlot, realShape, { color: "#62d8e7", width: 1.8, glow: 3 });
        drawPolyline(shapePlot, imaginaryShape, { color: "#f8b44c", width: 1.4 });
        const krReal: any = result.modes.horizontalWavenumbersInterleaved[mode * 2];
        const krImaginary: any = result.modes.horizontalWavenumbersInterleaved[mode * 2 + 1];
        const groupVelocity: any = result.modes.groupVelocityMps[mode];
        byId("modeShapeTitle").textContent = `${modeLabel(mode)} 本征函数`;
        const imaginaryText: any = krImaginary
            ? ` ${krImaginary < 0 ? "−" : "+"} ${Math.abs(krImaginary).toExponential(1)}i`
            : "";
        byId("horizontalWavenumber").textContent = `${krReal.toFixed(6)}${imaginaryText} rad/m`;
        byId("horizontalWavelength").textContent = `${format(2 * Math.PI / Math.max(1e-12, krReal), 2)} m`;
        byId("groupVelocity").textContent = `${format(groupVelocity, 1)} m/s`;
    }
    function fieldBathymetry(result: any): any {
        const maximumRange: any = result.field.rangesKm.at(-1);
        return [[0, result.environment.waterDepthM], [maximumRange, result.environment.waterDepthM]];
    }
    function selectedModeField(): any {
        return runtime.singleModeField(state.result.experimentId, state.selectedMode);
    }
    function drawFields(): any {
        const result: any = state.result;
        if (!result)
            return;
        const displayedField: any = state.fieldView === "single" ? selectedModeField() : result.field;
        const maximumRange: any = result.field.rangesKm.at(-1);
        const common: any = {
            xMinimum: 0, xMaximum: maximumRange,
            yMinimum: 0, yMaximum: result.environment.waterDepthM,
            xLabel: "距离 / km", yLabel: "深度 / m",
            bathymetry: fieldBathymetry(result),
        };
        const fieldPlot: any = drawHeatmap(canvases.field, {
            values: displayedField.tlDb, rows: displayedField.rows, columns: displayedField.columns,
        }, { ...common, minimum: 60, maximum: 120 });
        drawPoints(fieldPlot, [[result.field.rangesKm[0], result.environment.sourceDepthM]], { color: "#f8b44c", radius: 4 });
        const magnitude: any = Math.max(0.5, Math.ceil(result.metrics.deltaMaxDb * 2) / 2);
        drawHeatmap(canvases.delta, {
            values: result.deltaField.values, rows: result.deltaField.rows, columns: result.deltaField.columns,
        }, { ...common, divergingMagnitude: magnitude });
    }
    function updateMetrics(): any {
        const result: any = state.result;
        if (!result)
            return;
        const active: any = result.field.activeModeCount;
        const singleMode: any = state.fieldView === "single";
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
    function render(): any {
        drawSoundSpeedProfile();
        drawSpectrum();
        drawModeDetails();
        drawFields();
        updateMetrics();
    }
    function renderModeSelection(): any {
        drawSpectrum();
        drawModeDetails();
        if (state.fieldView === "single") {
            drawFields();
            updateMetrics();
        }
    }
    function setFieldView(view: any): any {
        if (view !== "sum" && view !== "single")
            return;
        state.fieldView = view;
        syncFieldViewControls();
        if (state.result) {
            drawFields();
            updateMetrics();
        }
    }
    async function calculate(): Promise<any> {
        const token: any = ++state.request;
        controls.run.disabled = true;
        setStatus("busy", "SOLVING");
        try {
            const result: any = await runtime.run(readParameters());
            if (token !== state.request)
                return;
            state.result = result;
            const maximum: any = Math.max(1, result.modes.count);
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
        }
        catch (error: any) {
            if (token !== state.request)
                return;
            setStatus("error", "FAILED");
            byId("runtimeMessage").textContent = `计算失败：${error instanceof Error ? error.message : String(error)}`;
        }
        finally {
            if (token === state.request)
                controls.run.disabled = false;
        }
    }
    async function importEnvironmentFiles(files: any): Promise<any> {
        const selectedFiles: any = Array.from(files || []);
        if (!selectedFiles.length)
            return;
        const status: any = byId("environmentImportStatus");
        controls.environmentImportButton.disabled = true;
        status.className = "busy";
        status.textContent = `正在解析 ${selectedFiles.length} 个环境文件…`;
        try {
            const parsed: any = await runtime.importEnvironment(selectedFiles);
            const imported: any = normalizeKrakenEnvironment(parsed);
            if (!imported || !Array.isArray(imported.profilePoints) || imported.profilePoints.length < 2) {
                throw new Error("环境文件中没有找到至少两个有效的声速剖面节点。Kraken ENV 必须与同名 FLP 一起选择。");
            }
            const deepestProfilePoint: any = Math.max(...imported.profilePoints.map((point: any): any => number(point?.[0], 0)));
            const firstBathymetryDepth: any = Array.isArray(imported.bathymetry) && imported.bathymetry.length
                ? number(imported.bathymetry[0]?.[1], 0)
                : 0;
            const waterDepthM: any = clamp(number(imported.waterDepthM, firstBathymetryDepth || deepestProfilePoint || 200), 50, 8000);
            const title: any = String(imported.title || selectedFiles[0].name || "用户环境");
            controls.profile.value = "custom";
            state.importedEnvironment = parsed;
            state.environmentTitle = title;
            state.interpolation = String(imported.interpolation || "LINEAR").toUpperCase()
                === "SQUARED_SLOWNESS_LINEAR"
                ? "squared-slowness-linear"
                : "linear";
            state.customSSP = normalizeProfilePoints(imported.profilePoints, waterDepthM);
            const formatName: any = String(imported.format || selectedFiles[0].name.split(".").pop() || "ENV").toUpperCase();
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
            const bathymetryNote: any = parsed.format === "kraken-env-flp"
                ? ` · 原生 Kraken 解析 · ${parsed.receiverRangesM?.length || 0}×${parsed.receiverDepthsM?.length || 0} FLP 网格`
                : bathymetryVaries(imported.bathymetry)
                    ? " · NM 按入口水深建立距离无关波导"
                    : "";
            status.className = "success";
            status.textContent = `已导入：${title} · ${formatName} · ${selectedFiles.length} 个文件${bathymetryNote}`;
            await calculate();
        }
        catch (error: any) {
            status.className = "error";
            status.textContent = `导入失败：${describeError(error)}`;
        }
        finally {
            controls.environmentImportButton.disabled = false;
            controls.environmentFileInput.value = "";
        }
    }
    listen(controls.run, "click", calculate);
    listen(controls.showSelectedModeField, "click", (): any => setFieldView("single"));
    fieldViewButtons.forEach((button: any): any => {
        listen(button, "click", (): any => setFieldView(button.dataset.fieldView));
    });
    listen(controls.environmentImportButton, "click", (): any => controls.environmentFileInput.click());
    listen(controls.environmentFileInput, "change", (event: any): any => importEnvironmentFiles(event.target.files));
    listen(controls.profile, "change", (): any => {
        applyEnvironmentPreset(controls.profile.value);
        syncControlLabels();
        calculate();
    });
    [controls.model, controls.frequency, controls.sourceDepth,
        controls.maximumRange, controls.phaseSpeedLow, controls.phaseSpeedHigh,
        controls.modeLimit]
        .forEach((control: any): any => listen(control, "change", calculate));
    bottomMaterialControls.forEach((pair: any): any => {
        listen(pair.rangeInput, "input", (): any => {
            pair.numberInput.value = pair.rangeInput.value;
        });
        listen(pair.rangeInput, "change", calculate);
        listen(pair.numberInput, "input", (): any => {
            const value: any = Number(pair.numberInput.value);
            if (Number.isFinite(value))
                pair.rangeInput.value = String(value);
        });
        listen(pair.numberInput, "change", (): any => {
            syncBottomMaterialControl(pair);
            calculate();
        });
    });
    listen(controls.waterDepth, "change", (): any => {
        const waterDepthM: any = clamp(number(controls.waterDepth.value, 200), 50, 8000);
        controls.sourceDepth.max = String(waterDepthM - 1);
        controls.sourceDepth.value = String(clamp(number(controls.sourceDepth.value, 50), 1, waterDepthM - 1));
        if (controls.profile.value === "custom") {
            state.customSSP = normalizeProfilePoints(state.customSSP, waterDepthM);
        }
        updateProfileEditor();
        calculate();
    });
    listen(byId("sspTableRows"), "change", updateProfileCell);
    listen(byId("sspTableRows"), "click", deleteProfilePoint);
    listen(byId("addSSPRow"), "click", addProfilePoint);
    listen(controls.modeLimit, "input", syncControlLabels);
    listen(controls.selectedMode, "input", (): any => {
        state.selectedMode = Number(controls.selectedMode.value) - 1;
        syncControlLabels();
        if (state.result)
            renderModeSelection();
    });
    listen(canvases.spectrum, "pointerdown", (event: any): any => {
        if (!state.result || !state.spectrumPlot)
            return;
        const target: any = Math.round(pointerValue(canvases.spectrum, event, state.spectrumPlot).x);
        state.selectedMode = Math.round(clamp(target, 1, state.result.modes.count)) - 1;
        controls.selectedMode.value = String(state.selectedMode + 1);
        syncControlLabels();
        renderModeSelection();
    });
    listen(window, "resize", (): any => {
        if (state.result)
            render();
    });
    applyEnvironmentPreset(controls.profile.value);
    syncControlLabels();
    syncFieldViewControls();
    const ready: any = runtime.prepare().then(calculate).then((): any => undefined).catch((error: any): any => {
        setStatus("error", "FAILED");
        byId("runtimeMessage").textContent = `WASM 加载失败：${error instanceof Error ? error.message : String(error)}`;
    });
    return {
        ready,
        async dispose() {
            listenerScope.abort();
            state.request += 1;
            runtime.cancel("page disposed");
            await runtime.dispose();
        },
    };
}
