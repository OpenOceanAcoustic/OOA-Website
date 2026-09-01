import { createPlot, drawHeatmap, drawPoints, drawPolyline, nearestIndex, pointerValue, valueRange, } from "../../shared-page/canvas";
import { environmentPreset, normalizeProfilePoints, profilePointsForPreset, resampleProfilePoints, } from "../../shared-page/environment-presets";
import type { PeRuntime } from "@ooa/runtime-pe";
import type { MountedModelPage } from "../../shared-page/controller-types";
export function mountPePage(root: HTMLElement, runtime: PeRuntime): MountedModelPage {
    const listenerScope: any = new AbortController();
    const listen: any = (target: any, type: any, listener: any): any => target.addEventListener(type, listener, { signal: listenerScope.signal });
    const byId: any = (id: any): any => root.querySelector(`#${CSS.escape(id)}`);
    const controls: any = {
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
    const canvases: any = {
        ssp: byId("sspCanvas"), field: byId("fieldCanvas"), delta: byId("deltaCanvas"),
        convergence: byId("convergenceCanvas"), profile: byId("profileCanvas"),
    };
    const state: any = {
        result: null,
        request: 0,
        convergencePlot: null,
        customSSP: profilePointsForPreset("custom", 5000),
        importedEnvironment: null,
    };
    function clamp(value: any, minimum: any, maximum: any): any { return Math.max(minimum, Math.min(maximum, Number(value))); }
    function number(value: any, fallback: any): any { const parsed: any = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
    function format(value: any, digits: any = 3): any { return Number(value).toLocaleString("zh-CN", { maximumFractionDigits: digits }); }
    const bottomEditors: any = [
        { range: controls.bottomSpeedRange, number: controls.bottomSpeed, digits: 0 },
        { range: controls.bottomDensityRange, number: controls.bottomDensity, digits: 0 },
        { range: controls.bottomAbsorptionRange, number: controls.bottomAbsorption, digits: 2 },
    ];
    function setBottomValue(editor: any, value: any): any {
        const minimum: any = number(editor.range.min, Number.NEGATIVE_INFINITY);
        const maximum: any = number(editor.range.max, Number.POSITIVE_INFINITY);
        const bounded: any = clamp(value, minimum, maximum);
        editor.range.value = String(bounded);
        editor.number.value = editor.digits ? bounded.toFixed(editor.digits) : String(Math.round(bounded));
    }
    function syncBottomEditors(): any {
        for (const editor of bottomEditors)
            setBottomValue(editor, number(editor.range.value, 0));
    }
    function currentProfileDescription(): any {
        if (controls.profile.value === "custom" && state.importedEnvironment) {
            const { title, format: sourceFormat, bathymetry, modelHints }: any = state.importedEnvironment;
            const terrainNote: any = bathymetryVaries(bathymetry)
                ? " · 原生 RAM 距离相关地形"
                : "";
            const sectionCount: any = modelHints?.mediumSectionCount || 0;
            const sectionNote: any = sectionCount > 1
                ? ` · ${sectionCount} 个介质段`
                : "";
            return `${title || "导入环境"} · ${sourceFormat || "ENVIRONMENT"} · ${state.customSSP.length} 个 SSP 节点${terrainNote}${sectionNote}`;
        }
        return environmentPreset(controls.profile.value).description;
    }
    function bathymetryPointCount(bathymetry: any): any {
        if (!bathymetry)
            return 0;
        if (ArrayBuffer.isView(bathymetry))
            return Math.floor((bathymetry as unknown as { length: number }).length / 2);
        if (!Array.isArray(bathymetry))
            return 0;
        return Array.isArray(bathymetry[0]) ? bathymetry.length : Math.floor(bathymetry.length / 2);
    }
    function bathymetryVaries(bathymetry: any): any {
        if (!Array.isArray(bathymetry) || bathymetry.length < 2)
            return false;
        const first: any = Array.isArray(bathymetry[0]) ? number(bathymetry[0][1], NaN) : NaN;
        return Number.isFinite(first) && bathymetry.some((point: any): any => (Array.isArray(point) && Math.abs(number(point[1], first) - first) > 1e-6));
    }
    function errorText(error: any): any {
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
            // Fall through to a stable, user-facing parser error below.
        }
        return "未能识别文件内容，请选择一个 RAM .in 文件或一个环境 JSON。";
    }
    function setImportStatus(kind: any, text: any): any {
        const status: any = byId("environmentImportStatus");
        status.className = kind || "";
        status.textContent = text;
    }
    function readParameters(): any {
        const waterDepthM: any = clamp(number(controls.waterDepth.value, 200), 50, 8000);
        const maximumDepthM: any = clamp(number(controls.maximumDepth.value, 300), waterDepthM, 10000);
        const profile: any = controls.profile.value;
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
            sourceId: profile === "custom" ? state.importedEnvironment?.sourceId || null : null,
            nPade: Math.round(clamp(number(controls.nPade.value, 4), 1, 10)),
            referenceNPade: 10,
            rangeCount: 181,
            depthCount: 131,
        };
    }
    function normalizeRamEnvironment(imported: any): any {
        return imported;
    }
    function profileDisplayPoints(): any {
        const parameters: any = readParameters();
        return controls.profile.value === "custom"
            ? parameters.sspPoints
            : resampleProfilePoints(parameters.sspPoints, parameters.waterDepthM, 500);
    }
    function updateProfileEditor(): any {
        const points: any = profileDisplayPoints();
        const waterDepthM: any = readParameters().waterDepthM;
        byId("sspTableRows").innerHTML = points.map(([depthM, soundSpeedMps]: any, index: any): any => `
    <tr>
      <td><input type="number" min="0" max="${waterDepthM}" step="1" value="${Number(depthM).toFixed(depthM % 1 ? 1 : 0)}" data-profile-index="${index}" data-profile-field="depth" aria-label="第 ${index + 1} 个节点深度"></td>
      <td><input type="number" min="1300" max="2200" step="0.1" value="${Number(soundSpeedMps).toFixed(1)}" data-profile-index="${index}" data-profile-field="speed" aria-label="第 ${index + 1} 个节点声速"></td>
      <td><button type="button" class="profile-delete-row" data-profile-delete="${index}" aria-label="删除第 ${index + 1} 个节点">×</button></td>
    </tr>`).join("");
        byId("sspTableEditor").dataset.mode = controls.profile.value === "custom" ? "custom" : "preset";
    }
    function convertDisplayedProfileToCustom(): any {
        if (controls.profile.value === "custom")
            return;
        state.customSSP = profileDisplayPoints().map((point: any): any => [...point]);
        controls.profile.value = "custom";
        byId("profileDescription").textContent = environmentPreset("custom").description;
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
    async function importEnvironmentFiles(files: any): Promise<any> {
        if (!files.length)
            return;
        controls.importButton.disabled = true;
        setImportStatus("busy", "正在本地解析环境文件…");
        try {
            const parsed: any = await runtime.importEnvironment(files);
            const imported: any = normalizeRamEnvironment(parsed);
            const suppliedPoints: any = Array.isArray(imported?.profilePoints) ? imported.profilePoints : [];
            if (suppliedPoints.length < 2)
                throw new Error("导入文件中没有至少两个有效的声速剖面节点");
            const deepestProfilePoint: any = suppliedPoints.reduce((maximum: any, point: any): any => Math.max(maximum, Array.isArray(point) ? number(point[0], 0) : 0), 0);
            const waterDepthM: any = clamp(number(imported.waterDepthM, deepestProfilePoint || 200), 50, 8000);
            state.customSSP = normalizeProfilePoints(suppliedPoints, waterDepthM);
            state.importedEnvironment = {
                title: String(imported.title || files[0]?.name || "导入环境"),
                format: String(imported.format || "ENVIRONMENT"),
                bathymetry: imported.bathymetry || null,
                sourceId: parsed.sourceId || null,
                modelHints: parsed.modelHints || null,
            };
            controls.profile.value = "custom";
            controls.waterDepth.value = String(waterDepthM);
            controls.sourceDepth.max = String(waterDepthM - 1);
            controls.sourceDepth.value = String(clamp(number(imported.sourceDepthM, controls.sourceDepth.value), 1, waterDepthM - 1));
            controls.frequency.value = String(clamp(number(imported.frequencyHz, controls.frequency.value), 10, 1000));
            controls.maximumRange.value = String(clamp(number(imported.maximumRangeKm, controls.maximumRange.value), 2, 250));
            controls.maximumDepth.min = String(waterDepthM);
            controls.maximumDepth.value = String(clamp(Math.max(waterDepthM, number(imported.maximumDepthM, controls.maximumDepth.value)), waterDepthM, 10000));
            controls.rangeStep.value = String(clamp(number(imported.rangeStepM, controls.rangeStep.value), 1, 100));
            controls.depthStep.value = String(clamp(number(imported.depthStepM, controls.depthStep.value), 0.25, 20));
            controls.nPade.value = String(Math.round(clamp(number(imported.nPade, controls.nPade.value), 1, 10)));
            setBottomValue(bottomEditors[0], number(imported.bottomSoundSpeedMps, controls.bottomSpeed.value));
            setBottomValue(bottomEditors[1], number(imported.bottomDensityKgM3, controls.bottomDensity.value));
            setBottomValue(bottomEditors[2], number(imported.bottomAttenuationDbPerWavelength, controls.bottomAbsorption.value));
            updateProfileEditor();
            syncControlLabels();
            const terrainPoints: any = bathymetryPointCount(state.importedEnvironment.bathymetry);
            setImportStatus("success", parsed.sourceId
                ? `已导入并原生解析 ${state.importedEnvironment.title}；${terrainPoints} 个地形节点、${parsed.modelHints?.mediumSectionCount ?? 0} 个介质段和 ${parsed.modelHints?.receiverDepthCount ?? 0} 个接收深度将完整送入 RAM WASM。`
                : `已导入 ${state.importedEnvironment.title}；SSP、水深、声源与底质将送入本地 PE WASM。`);
            await calculate();
        }
        catch (error: any) {
            setImportStatus("error", `导入失败：${errorText(error)}`);
        }
        finally {
            controls.importButton.disabled = false;
            controls.importInput.value = "";
        }
    }
    function syncControlLabels(): any {
        syncBottomEditors();
        byId("nPadeOut").textContent = `${controls.nPade.value} terms`;
        byId("inspectRangeOut").textContent = `${number(controls.inspectRange.value, 0).toFixed(1)} km`;
        byId("heroModel").textContent = controls.model.value.toUpperCase();
        byId("profileDescription").textContent = currentProfileDescription();
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
        byId("heroEngine").textContent = runtime?.engine || (isWasm ? "PE WASM" : "DEMO FALLBACK");
        byId("runtimeMessage").textContent = isWasm
            ? "PE 正在浏览器 Web Worker / WebAssembly 中推进，环境参数和场结果不会上传到服务器。"
            : `WASM SDK 尚未生效：${runtime?.warning || "backend unavailable"}。当前数据只演示 nPade 交互与图表，不能用于工程计算。`;
        byId("resultSource").textContent = isWasm ? "OOB WASM" : "DEMO";
    }
    function drawEnvironment(): any {
        const result: any = state.result;
        if (!result)
            return;
        const speeds: any = result.environment.soundSpeedMps;
        const depths: any = result.environment.depthsM;
        const [minimum, maximum]: any = valueRange(speeds, { paddingFraction: 0.1, minimumPadding: 3 });
        const plot: any = createPlot(canvases.ssp, {
            xMinimum: minimum, xMaximum: maximum,
            yMinimum: 0, yMaximum: result.parameters.maximumDepthM,
            xLabel: "c / m·s⁻¹", yLabel: "深度 / m", depthAxis: true,
        });
        drawPolyline(plot, Array.from(depths, (depth: any, index: any): any => [speeds[index], depth]), { color: "#62d8e7", width: 2, glow: 5 });
        const sourceIndex: any = nearestIndex(depths, result.parameters.sourceDepthM);
        drawPoints(plot, [[speeds[sourceIndex], result.parameters.sourceDepthM]], { color: "#f8b44c", radius: 4 });
    }
    function inspectRangeKm(): any {
        if (!state.result)
            return number(controls.inspectRange.value, 0);
        return clamp(number(controls.inspectRange.value, 0), 0, state.result.parameters.maximumRangeKm);
    }
    function drawFields(): any {
        const result: any = state.result;
        if (!result)
            return;
        const common: any = {
            xMinimum: 0, xMaximum: result.parameters.maximumRangeKm,
            yMinimum: 0, yMaximum: result.parameters.maximumDepthM,
            xLabel: "距离 / km", yLabel: "深度 / m",
            bathymetry: result.environment.bathymetry,
        };
        const fieldPlot: any = drawHeatmap(canvases.field, {
            values: result.field.tlDb, rows: result.field.rows, columns: result.field.columns,
        }, { ...common, minimum: 60, maximum: 120 });
        const selectedRange: any = inspectRangeKm();
        drawPolyline(fieldPlot, [[selectedRange, 0], [selectedRange, result.parameters.maximumDepthM]], {
            color: "rgba(248,180,76,.9)", width: 1.2, dash: [4, 4],
        });
        drawPoints(fieldPlot, [[result.field.rangesKm[0], result.parameters.sourceDepthM]], { color: "#f8b44c", radius: 4 });
        const magnitude: any = Math.max(0.5, Math.ceil(result.metrics.deltaMaxDb * 2) / 2);
        const deltaPlot: any = drawHeatmap(canvases.delta, {
            values: result.deltaField.values, rows: result.deltaField.rows, columns: result.deltaField.columns,
        }, { ...common, divergingMagnitude: magnitude });
        drawPolyline(deltaPlot, [[selectedRange, 0], [selectedRange, result.parameters.maximumDepthM]], {
            color: "rgba(248,180,76,.9)", width: 1.2, dash: [4, 4],
        });
    }
    function drawConvergence(): any {
        const result: any = state.result;
        if (!result)
            return;
        const maximum: any = Math.max(0.1, ...result.convergence.map((point: any): any => point.rmsDb));
        const plot: any = createPlot(canvases.convergence, {
            xMinimum: 1, xMaximum: 10, yMinimum: 0, yMaximum: maximum * 1.12,
            xLabel: "Padé 项数 nPade", yLabel: "相对 nPade=10 的 RMSE / dB",
            xTicks: 9, xFormatter: (value: any): any => Math.round(value).toString(),
        });
        const points: any = result.convergence.map((point: any): any => [point.nPade, point.rmsDb]);
        drawPolyline(plot, points, { color: "#62d8e7", width: 2, glow: 3 });
        drawPoints(plot, points, { color: "#62d8e7", radius: 3 });
        drawPoints(plot, [points[result.parameters.nPade - 1]], { color: "#f8b44c", radius: 5, stroke: "#ffe0a0" });
        state.convergencePlot = plot;
    }
    function drawVerticalProfile(): any {
        const result: any = state.result;
        if (!result)
            return;
        const selectedRange: any = inspectRangeKm();
        const profile: any = runtime.verticalProfile(result.experimentId, selectedRange);
        const current: any = [];
        const reference: any = [];
        const values: any = [];
        for (let depthIndex: any = 0; depthIndex < profile.depthsM.length; depthIndex += 1) {
            const depth: any = profile.depthsM[depthIndex];
            const currentValue: any = profile.currentTlDb[depthIndex];
            const referenceValue: any = profile.referenceTlDb[depthIndex];
            if (Number.isFinite(currentValue)) {
                current.push([currentValue, depth]);
                values.push(currentValue);
            }
            if (Number.isFinite(referenceValue)) {
                reference.push([referenceValue, depth]);
                values.push(referenceValue);
            }
        }
        const [minimum, maximum]: any = valueRange(values, { paddingFraction: 0.08, minimumPadding: 2, fallback: [60, 120] });
        const plot: any = createPlot(canvases.profile, {
            xMinimum: Math.max(50, minimum), xMaximum: Math.min(130, maximum),
            yMinimum: 0, yMaximum: result.parameters.maximumDepthM,
            xLabel: "传播损失 / dB", yLabel: "深度 / m", depthAxis: true,
        });
        drawPolyline(plot, reference, { color: "#c5f16b", width: 1.5, dash: [4, 3] });
        drawPolyline(plot, current, { color: "#62d8e7", width: 2, glow: 3 });
        byId("profileTitle").textContent = `${profile.rangeKm.toFixed(1)} km 垂向剖面`;
    }
    function updateMetrics(): any {
        const result: any = state.result;
        if (!result)
            return;
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
    function render(): any {
        drawEnvironment();
        drawFields();
        drawConvergence();
        drawVerticalProfile();
        updateMetrics();
    }
    async function calculate(): Promise<any> {
        const token: any = ++state.request;
        controls.run.disabled = true;
        setStatus("busy", "MARCHING");
        try {
            const result: any = await runtime.run(readParameters());
            if (token !== state.request)
                return;
            state.result = result;
            controls.inspectRange.max = String(result.parameters.maximumRangeKm);
            controls.inspectRange.value = String(clamp(number(controls.inspectRange.value, result.parameters.maximumRangeKm * 0.6), 0, result.parameters.maximumRangeKm));
            controls.nPade.value = String(result.parameters.nPade);
            syncControlLabels();
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
    listen(controls.run, "click", calculate);
    listen(controls.profile, "change", (): any => {
        state.importedEnvironment = null;
        applyEnvironmentPreset(controls.profile.value);
        setImportStatus("", "支持 RAM .in 与统一环境 JSON；文件仅在本机浏览器中解析。");
        syncControlLabels();
        calculate();
    });
    [controls.model, controls.frequency, controls.sourceDepth, controls.maximumRange,
        controls.maximumDepth, controls.rangeStep, controls.depthStep, controls.nPade]
        .forEach((control: any): any => listen(control, "change", calculate));
    for (const editor of bottomEditors) {
        listen(editor.range, "input", (): any => setBottomValue(editor, number(editor.range.value, 0)));
        listen(editor.range, "change", calculate);
        listen(editor.number, "input", (): any => {
            const value: any = Number(editor.number.value);
            if (Number.isFinite(value))
                editor.range.value = String(clamp(value, number(editor.range.min, value), number(editor.range.max, value)));
        });
        listen(editor.number, "change", (): any => {
            setBottomValue(editor, number(editor.number.value, editor.range.value));
            calculate();
        });
    }
    listen(controls.waterDepth, "change", (): any => {
        const waterDepthM: any = clamp(number(controls.waterDepth.value, 200), 50, 8000);
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
    listen(byId("sspTableRows"), "change", updateProfileCell);
    listen(byId("sspTableRows"), "click", deleteProfilePoint);
    listen(byId("addSSPRow"), "click", addProfilePoint);
    listen(controls.importButton, "click", (): any => controls.importInput.click());
    listen(controls.importInput, "change", (): any => importEnvironmentFiles(Array.from(controls.importInput.files || [])));
    listen(controls.nPade, "input", syncControlLabels);
    listen(controls.inspectRange, "input", (): any => {
        syncControlLabels();
        if (state.result) {
            drawFields();
            drawVerticalProfile();
        }
    });
    listen(canvases.convergence, "pointerdown", (event: any): any => {
        if (!state.result || !state.convergencePlot)
            return;
        const target: any = Math.round(pointerValue(canvases.convergence, event, state.convergencePlot).x);
        controls.nPade.value = String(Math.round(clamp(target, 1, 10)));
        syncControlLabels();
        calculate();
    });
    listen(window, "resize", (): any => {
        if (state.result)
            render();
    });
    applyEnvironmentPreset(controls.profile.value);
    syncControlLabels();
    const ready: any = runtime.prepare().then(calculate).catch((error: any): any => {
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
