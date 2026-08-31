import type { RayRuntime } from '@ooa/runtime-ray';
import type { MountedModelPage } from '../../shared-page/controller-types';
import { parseEnvironmentFiles } from '@ooa/environment/browser-import';
import { DEFAULT_WATER_DEPTH_M, generateSspProfile, profileDefaults, resampleSspPoints, sanitizeSspPoints, } from '@ooa/environment/ssp-profiles';
export function mountRayPage(root: HTMLElement, runtime: RayRuntime): MountedModelPage {
    const listenerScope: any = new AbortController();
    const listen: any = (target: any, type: any, listener: any): any => target.addEventListener(type, listener, { signal: listenerScope.signal });
    const $: any = (id: any): any => root.querySelector(`#${CSS.escape(id)}`);
    const initialProfile: any = generateSspProfile({ profile: 'munk' });
    const initialSSP: any = resampleSspPoints(initialProfile.depths.map((depth: any, index: any): any => [depth, initialProfile.speeds[index]]), initialProfile.waterDepthM);
    const state: any = { data: null, animation: 0, raf: null, request: 0, environmentRequest: 0, lossImage: null, velocityImages: { horizontal: null, vertical: null }, eigen: null, eigenRequest: 0, environmentMode: 'munk', importedEnvironment: null, customEnvironment: null, customSSP: initialSSP, customWaterDepthM: DEFAULT_WATER_DEPTH_M, maximumDepthM: DEFAULT_WATER_DEPTH_M, sspDrag: -1, sourceDragging: false, solvedSourceDepth: null, eigenSourceDragging: false, solvedEigenSourceDepth: null, receiverDragging: false, receiverPreview: null, introRaf: null, introStart: 0, introProgress: 0 };
    const controls: any = {
        profile: $('profile'), axisDepth: $('axisDepth'), gradient: $('gradient'),
        sourceDepth: $('sourceDepth'), frequency: $('frequency'), bottomSpeed: $('bottomSpeed'),
        bottomDensity: $('bottomDensity'), bottomAbsorption: $('bottomAbsorption')
    };
    const bottomSliders: any = {
        bottomSpeed: $('bottomSpeedSlider'),
        bottomDensity: $('bottomDensitySlider'),
        bottomAbsorption: $('bottomAbsorptionSlider'),
    };
    const fieldControls: any = {
        beamType: $('beamType'),
        fieldMode: $('fieldMode'),
    };
    const eigenEnvControls: any = {
        profile: $('eigenProfile'), axisDepth: $('eigenAxisDepth'), gradient: $('eigenGradient'),
        sourceDepth: $('eigenSourceDepth'), frequency: $('eigenFrequency'), bottomSpeed: $('eigenBottomSpeed'),
        bottomDensity: $('eigenBottomDensity'), bottomAbsorption: $('eigenBottomAbsorption')
    };
    const canvases: any = { intro: $('introRayCanvas'), ssp: $('sspCanvas'), ray: $('rayCanvas'), loss: $('lossCanvas'), horizontalVelocity: $('horizontalVelocityCanvas'), verticalVelocity: $('verticalVelocityCanvas'), eigenSSP: $('eigenSSPCanvas'), eigen: $('eigenCanvas'), arrival: $('arrivalCanvas') };
    const profileNames: any = { env: 'ENV 原始剖面', munk: 'Munk 深海声道', surface: '表层跃变', constant: '等声速水体', pekeris: 'Pekeris 浅海波导', custom: '自定义 500 m 节点' };
    const beamTypeNames: any = {
        GEOMETRIC_CARTESIAN: '几何波束 · 笛卡尔',
        GEOMETRIC_RAY_CENTERED: '几何波束 · 声线中心',
        GAUSSIAN_CARTESIAN: 'Gaussian · 笛卡尔',
        GAUSSIAN_RAY_CENTERED: 'Gaussian · 声线中心',
        GAUSSIAN_SIMPLE: '简化 Gaussian',
        CERVENY_CARTESIAN: 'Červený · 笛卡尔',
        CERVENY_RAY_CENTERED: 'Červený · 声线中心',
        PRECISE_EIGENRAY: '精确本征声线',
    };
    const beamTypeShortNames: any = {
        GEOMETRIC_CARTESIAN: 'GEOM CART',
        GEOMETRIC_RAY_CENTERED: 'GEOM RAY-CENTERED',
        GAUSSIAN_CARTESIAN: 'GAUSS CART',
        GAUSSIAN_RAY_CENTERED: 'GAUSS RAY-CENTERED',
        GAUSSIAN_SIMPLE: 'SIMPLE GAUSS',
        CERVENY_CARTESIAN: 'CERVENY CART',
        CERVENY_RAY_CENTERED: 'CERVENY RAY-CENTERED',
    };
    const fieldModeNames: any = { COHERENT_TL: 'COHERENT', INCOHERENT_TL: 'INCOHERENT' };
    const selectableFieldBeamTypes: any = new Set(['GEOMETRIC_CARTESIAN', 'GEOMETRIC_RAY_CENTERED', 'GAUSSIAN_CARTESIAN', 'GAUSSIAN_RAY_CENTERED', 'GAUSSIAN_SIMPLE']);
    function displayDepthM(): any { return Math.max(50, Number(state.maximumDepthM) || state.data?.maximum_depth_m || DEFAULT_WATER_DEPTH_M); }
    function environmentWaterDepthM(): any { const depth: any = state.environmentMode === 'custom' ? state.customWaterDepthM : state.environmentMode === 'env' ? state.importedEnvironment?.maximumDepthM : state.maximumDepthM; return Math.max(50, Number(depth) || DEFAULT_WATER_DEPTH_M); }
    function formatAngle(value: any): any { const normalized: any = Math.abs(value) < .00005 ? 0 : value; return `${normalized < 0 ? '−' : normalized > 0 ? '+' : ''}${Math.abs(normalized).toFixed(1)}°`; }
    function formatAngleRange(range: any): any { return `${formatAngle(range?.[0] ?? -20.3)} — ${formatAngle(range?.[1] ?? 20.3)}`; }
    function fitCanvas(canvas: any): any {
        const ratio: any = Math.min(window.devicePixelRatio || 1, 2);
        const rect: any = canvas.getBoundingClientRect();
        const w: any = Math.max(1, Math.round(rect.width * ratio));
        const h: any = Math.max(1, Math.round(rect.height * ratio));
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
        const ctx: any = canvas.getContext('2d');
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        return { ctx, w: rect.width, h: rect.height, ratio };
    }
    function params(): any {
        const waterDepthM: any = environmentWaterDepthM();
        const result: any = {
            profile: state.environmentMode,
            axis_depth: Number(controls.axisDepth.value),
            gradient: Number(controls.gradient.value) / 100,
            water_depth_m: waterDepthM,
            source_depth: Math.max(20, Math.min(waterDepthM - 20, Number(controls.sourceDepth.value) || 1000)),
            frequency: Math.max(20, Math.min(5000, Number(controls.frequency.value) || 500)),
            bottom_speed: Number(controls.bottomSpeed.value),
            bottom_density: Number(controls.bottomDensity.value),
            bottom_absorption: Number(controls.bottomAbsorption.value),
            beam_type: fieldControls.beamType.value,
            field_mode: fieldControls.fieldMode.value,
        };
        if (result.profile === 'custom' || result.profile === 'env') {
            const environment: any = result.profile === 'env' ? state.importedEnvironment : state.customEnvironment;
            result.ssp_points = (result.profile === 'env' ? state.importedEnvironment?.sspPoints : state.customSSP)?.map((point: any): any => [point[0], point[1]]) ?? [];
            if (environment) {
                result.maximum_range_km = environment.maximumRangeKm;
                result.bathymetry = environment.bathymetry;
                result.angle_range_degrees = environment.angleRangeDegrees;
                result.beam_count = environment.beamCount ?? environment.fieldRayCount;
            }
        }
        return result;
    }
    function fieldOptionDescription(beamType: any = fieldControls.beamType.value, fieldMode: any = fieldControls.fieldMode.value): any {
        const mode: any = fieldModeNames[fieldMode] ?? String(fieldMode), beam: any = beamTypeNames[beamType] ?? String(beamType);
        return { mode, beam, shortBeam: beamTypeShortNames[beamType] ?? String(beamType) };
    }
    function updateFieldOptionStatus(data: any = null): any {
        const beamType: any = data?.beam_type ?? fieldControls.beamType.value, fieldMode: any = data?.field_mode ?? fieldControls.fieldMode.value, { mode, beam, shortBeam }: any = fieldOptionDescription(beamType, fieldMode);
        $('fieldModeLabel').textContent = `${mode} · ${shortBeam}`;
        $('fieldOptionStatus').textContent = `OOB RunMode.${fieldMode} · BeamType.${beamType} · ${beam}`;
        $('fieldOptionStatus').title = $('fieldOptionStatus').textContent;
    }
    function clearImportedBeamOption(): any {
        [...fieldControls.beamType.options].filter((option: any): any => option.dataset.envOriginal === 'true').forEach((option: any): any => option.remove());
        if (!selectableFieldBeamTypes.has(fieldControls.beamType.value))
            fieldControls.beamType.value = 'GEOMETRIC_CARTESIAN';
    }
    function applyImportedFieldOptions(imported: any): any {
        clearImportedBeamOption();
        const beamType: any = String(imported?.beamType ?? '');
        if (beamType && beamType !== 'PRECISE_EIGENRAY') {
            let option: any = [...fieldControls.beamType.options].find((item: any): any => item.value === beamType);
            if (!option && ['CERVENY_CARTESIAN', 'CERVENY_RAY_CENTERED'].includes(beamType)) {
                option = document.createElement('option');
                option.value = beamType;
                option.dataset.envOriginal = 'true';
                option.textContent = `ENV 原始 · ${beamTypeNames[beamType] ?? beamType}`;
                fieldControls.beamType.append(option);
            }
            if (option)
                fieldControls.beamType.value = beamType;
        }
        if (['COHERENT_TL', 'INCOHERENT_TL'].includes(imported?.fieldMode))
            fieldControls.fieldMode.value = imported.fieldMode;
    }
    function syncLabels(): any {
        const p: any = params();
        $('axisDepthOut').textContent = p.axis_depth.toLocaleString('zh-CN') + ' m';
        $('gradientOut').textContent = p.gradient.toFixed(2) + '×';
        bottomSliders.bottomSpeed.value = String(p.bottom_speed);
        bottomSliders.bottomDensity.value = String(p.bottom_density);
        bottomSliders.bottomAbsorption.value = String(p.bottom_absorption);
        const parametric: any = ['munk', 'surface'].includes(p.profile);
        $('axisDepth').disabled = !parametric;
        $('gradient').disabled = !parametric;
        $('channelSummary').textContent = p.profile === 'env' ? (state.importedEnvironment?.rangeDependent ? 'ENV 原始二维声速场' : 'ENV 原始一维声速剖面') : p.profile === 'pekeris' ? `水深 ${displayDepthM().toLocaleString('zh-CN')} m · 等声速浅海波导` : p.profile === 'constant' ? '无明显声道轴' : p.profile === 'custom' ? `由 ${state.customSSP.length} 个自定义节点决定` : `${p.axis_depth.toLocaleString('zh-CN')} m 附近`;
        const names: any = { env: 'ENV / ORIGINAL PROFILE', munk: 'MUNK / DEEP CHANNEL', surface: 'THERMOCLINE / SURFACE', constant: 'ISOVELOCITY / CONTROL', pekeris: 'PEKERIS / SHALLOW WATER', custom: 'CUSTOM / 500 M NODES' };
        $('hero-profile').textContent = names[p.profile];
        controls.profile.value = p.profile;
        $('environmentModeBadge').textContent = p.profile === 'env' ? 'ENV LINKED' : p.profile.toUpperCase();
        $('profileDescription').textContent = p.profile === 'env' ? '保留 ENV 的原始 SSP、边界、接收网格与 Nbeams；可切换预设后再返回。' : p.profile === 'pekeris' ? '200 m 等声速水层叠加流体海底半空间，适合浅海基准实验。' : p.profile === 'custom' ? '拖动节点或用表格编辑；ENV 原始输入仍保留，可随时切回。' : '预设曲线由页面预览与 WASM 求解器共享同一份采样数据。';
        $('convertToCustomButton').hidden = p.profile === 'custom';
    }
    function syncEigenEnvironmentFromMain(): any {
        Object.keys(eigenEnvControls).forEach((key: any): any => { eigenEnvControls[key].value = controls[key].value; });
        const p: any = params();
        eigenEnvControls.profile.value = p.profile;
        $('eigenAxisDepthOut').textContent = p.axis_depth.toLocaleString('zh-CN') + ' m';
        $('eigenGradientOut').textContent = p.gradient.toFixed(2) + '×';
        $('eigenBottomSpeedOut').textContent = p.bottom_speed.toLocaleString('zh-CN') + ' m/s';
        $('eigenBottomDensityOut').textContent = p.bottom_density.toLocaleString('zh-CN') + ' kg/m³';
        $('eigenBottomAbsorptionOut').textContent = p.bottom_absorption.toFixed(2) + ' dB/λ';
        const parametric: any = ['munk', 'surface'].includes(p.profile);
        eigenEnvControls.axisDepth.disabled = !parametric;
        eigenEnvControls.gradient.disabled = !parametric;
        drawEigenEnvironment();
        renderSSPTables();
    }
    function environmentProfile(): any {
        const p: any = params();
        if (p.profile === 'env' && state.importedEnvironment)
            return state.importedEnvironment.sspPoints.map((point: any): any => [point[0], point[1]]);
        const generated: any = generateSspProfile({ profile: p.profile, axisDepthM: p.axis_depth, gradient: p.gradient, waterDepthM: p.water_depth_m, sspPoints: p.ssp_points });
        return generated.depths.map((depth: any, index: any): any => [depth, generated.speeds[index]]);
    }
    function drawEigenEnvironment(): any {
        if (!canvases.eigenSSP)
            return;
        const { ctx, w, h }: any = fitCanvas(canvases.eigenSSP);
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#061720';
        ctx.fillRect(0, 0, w, h);
        const a: any = { l: 38, r: 10, t: 29, b: 25 };
        a.pw = w - a.l - a.r;
        a.ph = h - a.t - a.b;
        const profile: any = environmentProfile(), domain: any = sspPlotDomain(profile), maximumDepthM: any = displayDepthM(), x: any = (c: any): any => a.l + (c - domain.minimum) / (domain.maximum - domain.minimum) * a.pw, y: any = (z: any): any => a.t + z / maximumDepthM * a.ph, p: any = params();
        ctx.strokeStyle = 'rgba(92,151,169,.13)';
        ctx.lineWidth = 1;
        for (let i: any = 0; i <= 4; i++) {
            const py: any = a.t + a.ph * i / 4;
            ctx.beginPath();
            ctx.moveTo(a.l, py);
            ctx.lineTo(a.l + a.pw, py);
            ctx.stroke();
            const px: any = a.l + a.pw * i / 4;
            ctx.beginPath();
            ctx.moveTo(px, a.t);
            ctx.lineTo(px, a.t + a.ph);
            ctx.stroke();
        }
        ctx.beginPath();
        profile.forEach(([depth, speed]: any, index: any): any => index ? ctx.lineTo(x(speed), y(depth)) : ctx.moveTo(x(speed), y(depth)));
        ctx.strokeStyle = '#62d8e7';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(98,216,231,.5)';
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.shadowBlur = 0;
        if (['munk', 'surface'].includes(p.profile)) {
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = 'rgba(197,241,107,.62)';
            ctx.beginPath();
            ctx.moveTo(a.l, y(p.axis_depth));
            ctx.lineTo(a.l + a.pw, y(p.axis_depth));
            ctx.stroke();
            ctx.setLineDash([]);
        }
        const nearest: any = profile.reduce((best: any, point: any): any => Math.abs(point[0] - p.source_depth) < Math.abs(best[0] - p.source_depth) ? point : best, profile[0]), sy: any = y(p.source_depth), sx: any = x(nearest[1]);
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(248,180,76,.45)';
        ctx.beginPath();
        ctx.moveTo(a.l, sy);
        ctx.lineTo(a.l + a.pw, sy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#f8b44c';
        ctx.shadowColor = '#f8b44c';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#64848e';
        ctx.font = '9px ui-monospace,monospace';
        for (let i: any = 0; i <= 4; i++) {
            const depth: any = maximumDepthM * i / 4;
            ctx.textAlign = 'right';
            ctx.fillText(depth >= 1000 ? `${(depth / 1000).toFixed(depth % 1000 ? 1 : 0)}k` : depth.toFixed(0), a.l - 4, a.t + a.ph * i / 4 + 3);
        }
        ctx.textAlign = 'left';
        ctx.fillText(String(domain.minimum), a.l, h - 9);
        ctx.textAlign = 'right';
        ctx.fillText(`${domain.maximum} m/s`, a.l + a.pw, h - 9);
        ctx.fillStyle = '#dfb76f';
        ctx.fillText(`${p.source_depth.toLocaleString('zh-CN')} m`, a.l + a.pw, Math.max(a.t + 10, Math.min(a.t + a.ph - 3, sy - 5)));
    }
    function sspTablePoints(): any {
        if (state.environmentMode === 'custom')
            return state.customSSP;
        return resampleSspPoints(environmentProfile(), displayDepthM());
    }
    function normalizeCustomSSP(): any {
        state.customSSP = sanitizeSspPoints(state.customSSP, state.customWaterDepthM);
    }
    function updateDepthBounds(): any {
        const maximumDepth: any = environmentWaterDepthM(), maximumSource: any = Math.max(20, maximumDepth - 20);
        controls.sourceDepth.max = String(maximumSource);
        eigenEnvControls.sourceDepth.max = String(maximumSource);
        $('receiverDepth').max = String(maximumSource);
        controls.sourceDepth.value = String(Math.max(20, Math.min(maximumSource, Number(controls.sourceDepth.value) || 20)));
        $('receiverDepth').value = String(Math.max(20, Math.min(maximumSource, Number($('receiverDepth').value) || Math.min(1000, maximumSource))));
        controls.axisDepth.max = String(Math.max(50, Math.min(2600, maximumSource)));
        eigenEnvControls.axisDepth.max = controls.axisDepth.max;
    }
    function ensureCustomSSP(points: any = environmentProfile()): any {
        if (state.environmentMode === 'custom')
            return;
        const maximumDepth: any = displayDepthM(), sampled: any = resampleSspPoints(points, maximumDepth);
        if (sampled.length >= 2)
            state.customSSP = sampled;
        state.customWaterDepthM = maximumDepth;
        state.customEnvironment = null;
        state.environmentMode = 'custom';
        state.maximumDepthM = maximumDepth;
        controls.profile.value = 'custom';
        eigenEnvControls.profile.value = 'custom';
        clearImportedBeamOption();
        normalizeCustomSSP();
        updateDepthBounds();
        $('envImportStatus').textContent = state.importedEnvironment ? '已转为一维自定义剖面 · ENV 原始模式仍可切回' : '已转为一维自定义剖面';
    }
    function setImportedOptionAvailability(): any {
        const available: any = state.importedEnvironment !== null;
        ['profileEnvOption', 'eigenProfileEnvOption'].forEach((id: any): any => {
            const option: any = $(id);
            if (!option)
                return;
            option.disabled = !available;
            option.hidden = !available;
        });
    }
    function applyProfileDefaults(profile: any): any {
        if (profile === 'env') {
            const imported: any = state.importedEnvironment;
            if (!imported)
                return false;
            state.maximumDepthM = imported.maximumDepthM;
            controls.axisDepth.value = '1300';
            controls.gradient.value = '100';
            controls.sourceDepth.value = String(imported.sourceDepth);
            controls.frequency.value = String(imported.frequency);
            if (imported.bottomSpeed > 0)
                controls.bottomSpeed.value = String(imported.bottomSpeed);
            if (imported.bottomDensity > 0)
                controls.bottomDensity.value = String(imported.bottomDensity);
            if (imported.bottomAbsorption >= 0)
                controls.bottomAbsorption.value = String(imported.bottomAbsorption);
        }
        else if (profile === 'custom') {
            state.maximumDepthM = state.customWaterDepthM;
            const defaults: any = profileDefaults('custom');
            controls.axisDepth.value = String(defaults.axisDepthM);
            controls.gradient.value = String(defaults.gradientPercent);
            controls.sourceDepth.value = String(defaults.sourceDepthM);
            controls.frequency.value = String(defaults.frequencyHz);
            controls.bottomSpeed.value = String(defaults.bottomSpeedMps);
            controls.bottomDensity.value = String(defaults.bottomDensityKgm3);
            controls.bottomAbsorption.value = String(defaults.bottomAbsorptionDbPerWavelength);
        }
        else {
            const defaults: any = profileDefaults(profile);
            state.maximumDepthM = defaults.waterDepthM;
            controls.axisDepth.value = String(defaults.axisDepthM);
            controls.gradient.value = String(defaults.gradientPercent);
            controls.sourceDepth.value = String(defaults.sourceDepthM);
            controls.frequency.value = String(defaults.frequencyHz);
            controls.bottomSpeed.value = String(defaults.bottomSpeedMps);
            controls.bottomDensity.value = String(defaults.bottomDensityKgm3);
            controls.bottomAbsorption.value = String(defaults.bottomAbsorptionDbPerWavelength);
        }
        updateDepthBounds();
        return true;
    }
    function activateProfile(profile: any, { defaults = true }: any = {}): any {
        if (profile === 'env' && !state.importedEnvironment)
            return false;
        if (!profileNames[profile])
            profile = 'munk';
        state.environmentMode = profile;
        if (profile === 'env')
            applyImportedFieldOptions(state.importedEnvironment);
        else
            clearImportedBeamOption();
        if (defaults && !applyProfileDefaults(profile))
            return false;
        controls.profile.value = profile;
        eigenEnvControls.profile.value = profile;
        setImportedOptionAvailability();
        syncLabels();
        syncEigenEnvironmentFromMain();
        drawSSP();
        return true;
    }
    function renderSSPTables(): any {
        const points: any = sspTablePoints(), maximumDepth: any = displayDepthM(), markup: any = points.map(([depth, speed]: any, index: any): any => `<tr><td><input type="number" min="0" max="${maximumDepth}" step="10" value="${Number(depth).toFixed(depth % 1 ? 1 : 0)}" data-ssp-index="${index}" data-ssp-field="depth" aria-label="第 ${index + 1} 行深度"></td><td><input type="number" min="1300" max="2000" step="0.1" value="${Number(speed).toFixed(1)}" data-ssp-index="${index}" data-ssp-field="speed" aria-label="第 ${index + 1} 行声速"></td><td><button type="button" class="ssp-delete-row" data-ssp-delete="${index}" aria-label="删除第 ${index + 1} 行">×</button></td></tr>`).join('');
        ['sspTableRows', 'eigenSSPTableRows'].forEach((id: any): any => {
            const body: any = $(id);
            if (body)
                body.innerHTML = markup;
        });
    }
    function updateSSPTableCell(event: any): any {
        const input: any = event.target.closest('input[data-ssp-field]');
        if (!input)
            return;
        const index: any = Number(input.dataset.sspIndex), field: any = input.dataset.sspField;
        ensureCustomSSP();
        if (!state.customSSP[index])
            return;
        state.customSSP[index][field === 'depth' ? 0 : 1] = Number(input.value);
        normalizeCustomSSP();
        syncLabels();
        syncEigenEnvironmentFromMain();
        drawSSP();
        markEigenStale();
        clearTimeout(debounce);
        debounce = setTimeout(recalculateEnvironment, 80);
    }
    function addSSPTableRow(): any {
        ensureCustomSSP();
        if (state.customSSP.length >= 512)
            return;
        const points: any = state.customSSP;
        let left: any = points[0], right: any = points[points.length - 1], largest: any = -1;
        for (let index: any = 0; index < points.length - 1; index++) {
            const gap: any = points[index + 1][0] - points[index][0];
            if (gap > largest) {
                largest = gap;
                left = points[index];
                right = points[index + 1];
            }
        }
        let depth: any;
        if (largest > 1)
            depth = Math.round((left[0] + right[0]) / 2);
        else
            depth = Math.min(displayDepthM(), Math.max(0, (points.at(-1)?.[0] || 0) + 100));
        const mix: any = (depth - left[0]) / Math.max(1, right[0] - left[0]), speed: any = left[1] + (right[1] - left[1]) * Math.max(0, Math.min(1, mix));
        state.customSSP.push([depth, speed]);
        normalizeCustomSSP();
        syncLabels();
        syncEigenEnvironmentFromMain();
        drawSSP();
        markEigenStale();
        clearTimeout(debounce);
        debounce = setTimeout(recalculateEnvironment, 80);
    }
    function deleteSSPTableRow(event: any): any {
        const button: any = event.target.closest('[data-ssp-delete]');
        if (!button)
            return;
        ensureCustomSSP();
        if (state.customSSP.length <= 2)
            return;
        state.customSSP.splice(Number(button.dataset.sspDelete), 1);
        normalizeCustomSSP();
        syncLabels();
        syncEigenEnvironmentFromMain();
        drawSSP();
        markEigenStale();
        clearTimeout(debounce);
        debounce = setTimeout(recalculateEnvironment, 80);
    }
    function axes(ctx: any, w: any, h: any, opts: any = {}): any {
        const pad: any = opts.pad || { l: 39, r: 12, t: 19, b: 28 };
        const maximumRangeKm: any = opts.maximumRangeKm || 100;
        const maximumDepthM: any = opts.maximumDepthM || 5000;
        const pw: any = w - pad.l - pad.r, ph: any = h - pad.t - pad.b;
        ctx.strokeStyle = 'rgba(92,151,169,.14)';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#5f7f89';
        ctx.font = '10px ui-monospace, monospace';
        for (let i: any = 0; i <= 5; i++) {
            const x: any = pad.l + pw * i / 5;
            ctx.beginPath();
            ctx.moveTo(x, pad.t);
            ctx.lineTo(x, pad.t + ph);
            ctx.stroke();
            if (!opts.noLabels) {
                const label: any = maximumRangeKm * i / 5;
                ctx.textAlign = 'center';
                ctx.fillText(label >= 10 ? label.toFixed(0) : label.toFixed(1), x, h - 12);
            }
        }
        for (let i: any = 0; i <= 5; i++) {
            const y: any = pad.t + ph * i / 5;
            ctx.beginPath();
            ctx.moveTo(pad.l, y);
            ctx.lineTo(pad.l + pw, y);
            ctx.stroke();
            if (!opts.noLabels) {
                const label: any = maximumDepthM * i / 5;
                ctx.textAlign = 'right';
                ctx.fillText(label >= 1000 ? `${(label / 1000).toFixed(label % 1000 ? 1 : 0)}k` : label.toFixed(0), pad.l - 6, y + 3);
            }
        }
        return { ...pad, pw, ph };
    }
    function sspPlotDomain(profile: any): any {
        const speeds: any = profile.map((point: any): any => Number(point[1])).filter(Number.isFinite), rawMin: any = Math.min(...speeds), rawMax: any = Math.max(...speeds), padding: any = Math.max(2, (rawMax - rawMin) * .08);
        let minimum: any = Math.floor((rawMin - padding) / 10) * 10, maximum: any = Math.ceil((rawMax + padding) / 10) * 10;
        if (maximum - minimum < 20) {
            const middle: any = (minimum + maximum) / 2;
            minimum = middle - 10;
            maximum = middle + 10;
        }
        return { minimum, maximum };
    }
    function drawSSP(): any {
        const { ctx, w, h }: any = fitCanvas(canvases.ssp);
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#061720';
        ctx.fillRect(0, 0, w, h);
        const displaySSP: any = environmentProfile();
        if (!displaySSP.length)
            return;
        const maximumDepthM: any = displayDepthM(), { minimum: min, maximum: max }: any = sspPlotDomain(displaySSP), p: any = axes(ctx, w, h, { pad: { l: 38, r: 12, t: 28, b: 34 }, noLabels: true, maximumDepthM });
        ctx.beginPath();
        displaySSP.forEach(([z, c]: any, i: any): any => { const x: any = p.l + (c - min) / (max - min) * p.pw; const y: any = p.t + z / maximumDepthM * p.ph; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.strokeStyle = '#62d8e7';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#42c8db';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
        const axis: any = params().axis_depth;
        const ay: any = p.t + axis / maximumDepthM * p.ph;
        if (['munk', 'surface'].includes(params().profile)) {
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = 'rgba(197,241,107,.65)';
            ctx.beginPath();
            ctx.moveTo(p.l, ay);
            ctx.lineTo(p.l + p.pw, ay);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        const nodes: any = sspNodes(), nodeStep: any = Math.max(1, Math.ceil(nodes.length / 20));
        nodes.forEach(([z, c]: any, i: any): any => {
            if (i % nodeStep && i !== nodes.length - 1 && i !== state.sspDrag)
                return;
            const nx: any = p.l + (c - min) / (max - min) * p.pw, ny: any = p.t + z / maximumDepthM * p.ph;
            ctx.fillStyle = i === state.sspDrag ? '#f8b44c' : '#071923';
            ctx.strokeStyle = i === state.sspDrag ? '#f8b44c' : '#62d8e7';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(nx, ny, i === state.sspDrag ? 4.5 : 2.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });
        ctx.fillStyle = '#688a94';
        ctx.font = '9px ui-monospace, monospace';
        for (let i: any = 0; i <= 5; i++) {
            const depth: any = maximumDepthM * i / 5, y: any = p.t + p.ph * i / 5;
            ctx.textAlign = 'right';
            ctx.fillText(depth >= 1000 ? `${(depth / 1000).toFixed(depth % 1000 ? 1 : 0)}k` : depth.toFixed(0), p.l - 5, y + 3);
        }
        ctx.textAlign = 'left';
        ctx.fillText(`${min} m/s`, p.l, h - 20);
        ctx.textAlign = 'right';
        ctx.fillText(`${max} m/s`, w - p.r, h - 20);
        ctx.save();
        ctx.translate(9, h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText('深度 / m', 0, 0);
        ctx.restore();
    }
    function sspNodes(): any {
        return state.environmentMode === 'custom' ? state.customSSP : resampleSspPoints(environmentProfile(), displayDepthM());
    }
    function sspPointer(event: any, commit: any = false): any {
        const canvas: any = canvases.ssp, rect: any = canvas.getBoundingClientRect(), nodes: any = sspNodes(), domain: any = sspPlotDomain(nodes), layout: any = { l: 38, r: 12, t: 28, b: 34, pw: rect.width - 50, ph: rect.height - 62, min: domain.minimum, max: domain.maximum, maximumDepthM: displayDepthM() };
        const px: any = event.clientX - rect.left, py: any = event.clientY - rect.top;
        if (state.sspDrag < 0) {
            let nearest: any = -1, distance: any = Infinity;
            nodes.forEach(([z, c]: any, i: any): any => {
                const x: any = layout.l + (c - layout.min) / (layout.max - layout.min) * layout.pw, y: any = layout.t + z / layout.maximumDepthM * layout.ph, d: any = Math.hypot(px - x, py - y);
                if (d < distance) {
                    nearest = i;
                    distance = d;
                }
            });
            if (distance > 18)
                return;
            const selectedDepth: any = nodes[nearest][0];
            ensureCustomSSP(nodes);
            state.sspDrag = state.customSSP.reduce((best: any, point: any, index: any): any => Math.abs(point[0] - selectedDepth) < Math.abs(state.customSSP[best][0] - selectedDepth) ? index : best, 0);
            canvas.setPointerCapture?.(event.pointerId);
        }
        const speed: any = Math.round(Math.max(layout.min, Math.min(layout.max, layout.min + (px - layout.l) / layout.pw * (layout.max - layout.min))) * 2) / 2;
        state.customSSP[state.sspDrag][1] = speed;
        $('sspReadout').textContent = `${state.customSSP[state.sspDrag][0].toLocaleString('zh-CN')} m · ${speed.toFixed(1)} m/s`;
        syncLabels();
        syncEigenEnvironmentFromMain();
        drawSSP();
        markEigenStale();
        clearTimeout(debounce);
        debounce = setTimeout(recalculateEnvironment, commit ? 10 : 180);
    }
    function sourceFromPointer(event: any): any {
        const rect: any = canvases.ray.getBoundingClientRect(), a: any = { l: 39, r: 12, t: 19, b: 28 }, ph: any = rect.height - a.t - a.b, px: any = event.clientX - rect.left, py: any = event.clientY - rect.top, maximumDepthM: any = displayDepthM();
        return { depth: Math.round(Math.max(20, Math.min(maximumDepthM - 20, (py - a.t) / ph * maximumDepthM)) / 10) * 10, px, py, sourceX: a.l, sourceY: a.t + params().source_depth / maximumDepthM * ph };
    }
    function drawBathymetry(ctx: any, a: any, data: any, progress: any = 1): any {
        const points: any = data?.bathymetry;
        if (!points?.length)
            return;
        const maximumRangeKm: any = data.maximum_range_km || 100, maximumDepthM: any = data.maximum_depth_m || 5000, limit: any = maximumRangeKm * progress, x: any = (range: any): any => a.l + range / maximumRangeKm * a.pw, y: any = (depth: any): any => a.t + depth / maximumDepthM * a.ph, visible: any = points.filter((point: any): any => point[0] <= limit);
        if (!visible.length)
            return;
        ctx.save();
        ctx.beginPath();
        visible.forEach((point: any, index: any): any => index ? ctx.lineTo(x(point[0]), y(point[1])) : ctx.moveTo(x(point[0]), y(point[1])));
        ctx.lineTo(x(visible.at(-1)[0]), a.t + a.ph);
        ctx.lineTo(x(visible[0][0]), a.t + a.ph);
        ctx.closePath();
        ctx.fillStyle = '#281f19';
        ctx.fill();
        ctx.beginPath();
        visible.forEach((point: any, index: any): any => index ? ctx.lineTo(x(point[0]), y(point[1])) : ctx.moveTo(x(point[0]), y(point[1])));
        ctx.strokeStyle = '#d5a968';
        ctx.lineWidth = 1.6;
        ctx.shadowColor = 'rgba(213,169,104,.35)';
        ctx.shadowBlur = 4;
        ctx.stroke();
        ctx.restore();
    }
    function startSourceDrag(event: any): any {
        if (!state.data)
            return;
        const point: any = sourceFromPointer(event);
        if (Math.hypot(point.px - point.sourceX, point.py - point.sourceY) > 22)
            return;
        clearTimeout(debounce);
        state.sourceDragging = true;
        canvases.ray.classList.add('dragging');
        canvases.ray.setPointerCapture?.(event.pointerId);
        moveSource(event);
    }
    function moveSource(event: any): any {
        if (!state.sourceDragging)
            return;
        const point: any = sourceFromPointer(event);
        controls.sourceDepth.value = String(point.depth);
        syncLabels();
        markEigenStale();
        $('simStatus').textContent = 'DRAGGING SOURCE';
        $('simTime').textContent = 'RELEASE TO RUN';
        drawRay(1);
    }
    function finishSourceDrag(event: any): any {
        if (!state.sourceDragging)
            return;
        moveSource(event);
        state.sourceDragging = false;
        canvases.ray.classList.remove('dragging');
        syncEigenEnvironmentFromMain();
        recalculateEnvironment();
    }
    function drawRay(progress: any = 1): any {
        const { ctx, w, h }: any = fitCanvas(canvases.ray);
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#06161f';
        ctx.fillRect(0, 0, w, h);
        const maximumRangeKm: any = state.data?.maximum_range_km || 100, maximumDepthM: any = state.data?.maximum_depth_m || displayDepthM(), a: any = axes(ctx, w, h, { maximumRangeKm, maximumDepthM });
        if (!state.data)
            return;
        const y: any = (z: any): any => a.t + z / maximumDepthM * a.ph, x: any = (r: any): any => a.l + r / maximumRangeKm * a.pw, sourceDepth: any = params().source_depth, solvedDepth: any = state.solvedSourceDepth ?? sourceDepth, previewShift: any = sourceDepth - solvedDepth;
        const grad: any = ctx.createLinearGradient(0, a.t, 0, a.t + a.ph);
        grad.addColorStop(0, 'rgba(20,72,89,.16)');
        grad.addColorStop(.5, 'rgba(18,91,108,.08)');
        grad.addColorStop(1, 'rgba(4,10,16,.25)');
        ctx.fillStyle = grad;
        ctx.fillRect(a.l, a.t, a.pw, a.ph);
        drawBathymetry(ctx, a, state.data, progress);
        if (['munk', 'surface'].includes(params().profile)) {
            ctx.strokeStyle = 'rgba(197,241,107,.28)';
            ctx.setLineDash([4, 5]);
            ctx.beginPath();
            ctx.moveTo(a.l, y(params().axis_depth));
            ctx.lineTo(a.l + a.pw, y(params().axis_depth));
            ctx.stroke();
            ctx.setLineDash([]);
        }
        const maxRange: any = progress * maximumRangeKm;
        state.data.rays.forEach((ray: any, idx: any): any => {
            ctx.beginPath();
            let started: any = false;
            ray.forEach((pt: any): any => {
                if (pt[0] > maxRange)
                    return;
                const px: any = x(pt[0]), previewDepth: any = Math.max(0, Math.min(maximumDepthM, pt[1] + previewShift * Math.exp(-pt[0] / 10))), py: any = y(previewDepth);
                if (!started) {
                    ctx.moveTo(px, py);
                    started = true;
                }
                else
                    ctx.lineTo(px, py);
            });
            const alpha: any = .32 + .58 * (1 - Math.abs(idx - (state.data.rays.length - 1) / 2) / (state.data.rays.length / 2));
            ctx.strokeStyle = `rgba(98,216,231,${alpha})`;
            ctx.lineWidth = idx % 3 === 0 ? 1.15 : .75;
            ctx.stroke();
        });
        const sx: any = x(0), sy: any = y(sourceDepth);
        ctx.shadowColor = '#f8b44c';
        ctx.shadowBlur = state.sourceDragging ? 16 : 12;
        ctx.fillStyle = '#f8b44c';
        ctx.beginPath();
        ctx.arc(sx, sy, state.sourceDragging ? 5 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(248,180,76,.35)';
        ctx.beginPath();
        ctx.arc(sx, sy, 8, 0, Math.PI * 2);
        ctx.stroke();
        if (state.sourceDragging) {
            ctx.setLineDash([3, 4]);
            ctx.strokeStyle = 'rgba(248,180,76,.32)';
            ctx.beginPath();
            ctx.moveTo(a.l, sy);
            ctx.lineTo(a.l + a.pw, sy);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#f1c878';
            ctx.font = '11px ui-monospace, monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`${sourceDepth.toLocaleString('zh-CN')} m`, sx + 12, sy - 10);
        }
        if (progress < 1) {
            const fx: any = x(maxRange);
            ctx.strokeStyle = 'rgba(98,216,231,.2)';
            ctx.beginPath();
            ctx.moveTo(fx, a.t);
            ctx.lineTo(fx, a.t + a.ph);
            ctx.stroke();
        }
    }
    const stops: any = [[148, 0, 0], [255, 20, 0], [255, 154, 0], [255, 242, 0], [48, 224, 122], [0, 205, 230], [0, 105, 244], [0, 23, 184], [2, 3, 105]];
    function tlColor(tl: any): any {
        const u: any = Math.max(0, Math.min(1, (tl - 40) / 60)) * (stops.length - 1), i: any = Math.min(stops.length - 2, Math.floor(u)), f: any = u - i;
        return stops[i].map((v: any, k: any): any => Math.round(v + (stops[i + 1][k] - v) * f));
    }
    function buildLossImage(): any {
        if (!state.data)
            return;
        const cols: any = state.data.loss.cols, rows: any = state.data.loss.rows, values: any = state.data.loss.values;
        const off: any = document.createElement('canvas');
        off.width = cols;
        off.height = rows;
        const o: any = off.getContext('2d');
        const img: any = o.createImageData(cols, rows);
        for (let i: any = 0; i < values.length; i++) {
            const c: any = tlColor(values[i]);
            img.data[i * 4] = c[0];
            img.data[i * 4 + 1] = c[1];
            img.data[i * 4 + 2] = c[2];
            img.data[i * 4 + 3] = 225;
        }
        o.putImageData(img, 0, 0);
        state.lossImage = off;
    }
    function drawLoss(progress: any = 1): any {
        const { ctx, w, h }: any = fitCanvas(canvases.loss);
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#06161f';
        ctx.fillRect(0, 0, w, h);
        const axisOptions: any = { maximumRangeKm: state.data?.maximum_range_km || 100, maximumDepthM: state.data?.maximum_depth_m || displayDepthM() }, a: any = axes(ctx, w, h, axisOptions);
        if (!state.lossImage)
            return;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.globalAlpha = .96;
        ctx.drawImage(state.lossImage, 0, 0, state.lossImage.width * progress, state.lossImage.height, a.l, a.t, a.pw * progress, a.ph);
        ctx.globalAlpha = 1;
        drawBathymetry(ctx, a, state.data, progress);
        axes(ctx, w, h, axisOptions);
        if (progress < 1) {
            const fx: any = a.l + a.pw * progress;
            const g: any = ctx.createLinearGradient(fx - 18, 0, fx + 8, 0);
            g.addColorStop(0, 'rgba(98,216,231,0)');
            g.addColorStop(1, 'rgba(98,216,231,.42)');
            ctx.fillStyle = g;
            ctx.fillRect(fx - 18, a.t, 26, a.ph);
        }
    }
    function velocityColor(level: any): any { return tlColor(40 + (Math.max(30, Math.min(120, level)) - 30) / 90 * 60); }
    function buildVelocityImages(): any {
        if (!state.data?.velocity)
            return;
        const { cols, rows }: any = state.data.velocity;
        [['horizontal', 'horizontal_db'], ['vertical', 'vertical_db']].forEach(([component, key]: any): any => {
            const values: any = state.data.velocity[key], off: any = document.createElement('canvas');
            off.width = cols;
            off.height = rows;
            const context: any = off.getContext('2d'), image: any = context.createImageData(cols, rows);
            for (let index: any = 0; index < values.length; index++) {
                const color: any = velocityColor(values[index]);
                image.data[index * 4] = color[0];
                image.data[index * 4 + 1] = color[1];
                image.data[index * 4 + 2] = color[2];
                image.data[index * 4 + 3] = 255;
            }
            context.putImageData(image, 0, 0);
            state.velocityImages[component] = off;
        });
    }
    function drawVelocityComponent(canvas: any, image: any, progress: any): any {
        const { ctx, w, h }: any = fitCanvas(canvas), axisOptions: any = { maximumRangeKm: state.data?.maximum_range_km || 100, maximumDepthM: state.data?.maximum_depth_m || displayDepthM() };
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#06161f';
        ctx.fillRect(0, 0, w, h);
        const a: any = axes(ctx, w, h, axisOptions);
        if (!image)
            return;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.globalAlpha = .96;
        ctx.drawImage(image, 0, 0, image.width * progress, image.height, a.l, a.t, a.pw * progress, a.ph);
        ctx.globalAlpha = 1;
        drawBathymetry(ctx, a, state.data, progress);
        axes(ctx, w, h, axisOptions);
        if (progress < 1) {
            const fx: any = a.l + a.pw * progress, g: any = ctx.createLinearGradient(fx - 18, 0, fx + 8, 0);
            g.addColorStop(0, 'rgba(98,216,231,0)');
            g.addColorStop(1, 'rgba(98,216,231,.42)');
            ctx.fillStyle = g;
            ctx.fillRect(fx - 18, a.t, 26, a.ph);
        }
    }
    function drawVelocity(progress: any = 1): any {
        drawVelocityComponent(canvases.horizontalVelocity, state.velocityImages.horizontal, progress);
        drawVelocityComponent(canvases.verticalVelocity, state.velocityImages.vertical, progress);
    }
    const introAngles: any = [-12, -9, -6, -3, 0, 3, 6, 9, 12];
    function introMunkSpeed(z: any): any { const eta: any = 2 * (z - 1300) / 1300; return 1500 * (1 + .00737 * (eta + Math.exp(-eta) - 1)); }
    function introMunkGradient(z: any): any { const eta: any = 2 * (z - 1300) / 1300; return 1500 * .00737 * (2 / 1300) * (1 - Math.exp(-eta)); }
    function introMunkCurvature(z: any): any { const eta: any = 2 * (z - 1300) / 1300; return 1500 * .00737 * Math.pow(2 / 1300, 2) * Math.exp(-eta); }
    const introMunkProfile: any = Array.from({ length: 101 }, (_: any, i: any): any => {
        const z: any = i * 50;
        return [z, introMunkSpeed(z)];
    });
    function introTrace(angle: any, spacingDegrees: any = .5, widthScale: any = 1.35): any {
        const step: any = 100, sourceDepth: any = 1000, c0: any = introMunkSpeed(sourceDepth), theta: any = angle * Math.PI / 180, spacing: any = spacingDegrees * Math.PI / 180, points: any = [[0, sourceDepth, 0, 0, 0]];
        let range: any = 0, z: any = sourceDepth, xi: any = Math.cos(theta) / c0, zeta: any = Math.sin(theta) / c0, p: any = 1, q: any = 0, tau: any = 0, width: any = 0;
        for (let i: any = 0; i < 3000 && range < 100000; i++) {
            const c: any = introMunkSpeed(z), cz: any = introMunkGradient(z), cnn: any = introMunkCurvature(z) * xi * xi, k1r: any = c * xi, k1z: any = c * zeta, midZ: any = z + k1z * step * .5, midZeta: any = zeta - step * .5 * cz / (c * c), midP: any = p - step * .5 * cnn * q, midQ: any = q + step * .5 * c * p, midC: any = introMunkSpeed(midZ), midCz: any = introMunkGradient(midZ), midCnn: any = introMunkCurvature(midZ) * xi * xi;
            range += midC * xi * step;
            z += midC * midZeta * step;
            zeta -= midCz / (midC * midC) * step;
            p -= midCnn * midQ * step;
            q += midC * midP * step;
            tau += step / midC;
            if (z < 0) {
                z = -z;
                zeta = Math.abs(zeta);
            }
            else if (z > 5000) {
                z = 10000 - z;
                zeta = -Math.abs(zeta);
            }
            const rawSigma: any = Math.abs(q) * spacing / c0 / Math.max(.2, Math.abs(midC * xi)), minimumSigma: any = Math.min(.2 * 50 * tau, Math.PI * midC / 50);
            width = Math.min(1100, Math.max(width, rawSigma * widthScale, minimumSigma * widthScale));
            if (i % 5 === 4 || range >= 100000)
                points.push([Math.min(100, range / 1000), z, width, q, tau]);
        }
        return points;
    }
    const introDemoRays: any = introAngles.map((angle: any): any => introTrace(angle));
    function introPartialRay(ray: any, fraction: any): any {
        if (!ray?.length)
            return [];
        const position: any = Math.max(0, Math.min(ray.length - 1, (ray.length - 1) * fraction)), whole: any = Math.floor(position), mix: any = position - whole, points: any = ray.slice(0, whole + 1);
        if (whole < ray.length - 1) {
            const a: any = ray[whole], b: any = ray[whole + 1];
            points.push(a.map((value: any, i: any): any => value + (b[i] - value) * mix));
        }
        return points;
    }
    function introPointAtRange(ray: any, rangeKm: any): any {
        let low: any = 0, high: any = ray.length - 1;
        while (low + 1 < high) {
            const middle: any = (low + high) >> 1;
            if (ray[middle][0] < rangeKm)
                low = middle;
            else
                high = middle;
        }
        const a: any = ray[low], b: any = ray[Math.min(ray.length - 1, high)], mix: any = Math.max(0, Math.min(1, (rangeKm - a[0]) / Math.max(1e-8, b[0] - a[0])));
        return a.map((value: any, index: any): any => value + (b[index] - value) * mix);
    }
    const introPressureGroups: any = introAngles.map((angle: any): any => Array.from({ length: 7 }, (_: any, index: any): any => introTrace(angle - 1.35 + index * .45, .45, .9)));
    const introFieldStops: any = [[146, 0, 0], [255, 25, 0], [255, 183, 0], [225, 255, 16], [37, 238, 196], [0, 184, 246], [0, 74, 222], [4, 6, 130]];
    function introFieldColor(tl: any): any { const value: any = Math.max(0, Math.min(1, (tl - 40) / 50)) * (introFieldStops.length - 1), index: any = Math.min(introFieldStops.length - 2, Math.floor(value)), mix: any = value - index; return introFieldStops[index].map((channel: any, channelIndex: any): any => Math.round(channel + (introFieldStops[index + 1][channelIndex] - channel) * mix)); }
    function introBuildPressureModel(): any {
        const cols: any = 180, rows: any = 100, size: any = cols * rows, omega: any = 2 * Math.PI * 50, components: any = introPressureGroups.map((): any => ({ real: new Float64Array(size), imaginary: new Float64Array(size), energy: new Float64Array(size) }));
        let maximum: any = 0;
        introPressureGroups.forEach((rayGroup: any, groupIndex: any): any => rayGroup.forEach((ray: any): any => {
            for (let column: any = 0; column < cols; column++) {
                const range: any = .1 + 99.9 * column / (cols - 1), point: any = introPointAtRange(ray, range), sigma: any = Math.max(24, point[2]), phase: any = omega * point[4] - (point[3] < 0 ? Math.PI / 2 : 0), phaseReal: any = Math.cos(phase), phaseImaginary: any = -Math.sin(phase);
                for (let row: any = 0; row < rows; row++) {
                    const normal: any = 5000 * row / (rows - 1) - point[1], window: any = Math.abs(normal) / sigma;
                    if (window > 3.7)
                        continue;
                    const weight: any = Math.exp(-.5 * window * window), rangeScale: any = 1 / Math.pow(Math.max(1, range), .25), amplitude: any = weight * rangeScale / Math.pow(Math.max(1, Math.abs(point[3])), .18), index: any = row * cols + column;
                    components[groupIndex].real[index] += amplitude * phaseReal;
                    components[groupIndex].imaginary[index] += amplitude * phaseImaginary;
                    components[groupIndex].energy[index] += amplitude * amplitude;
                }
            }
        }));
        const referenceLevels: any = [];
        for (let index: any = 0; index < size; index++) {
            let real: any = 0, imaginary: any = 0, energy: any = 0;
            components.forEach((component: any): any => { real += component.real[index]; imaginary += component.imaginary[index]; energy += component.energy[index]; });
            const magnitude: any = Math.hypot(real, imaginary) + .18 * Math.sqrt(energy);
            if (index % cols > 5 && magnitude > 1e-12)
                referenceLevels.push(magnitude);
        }
        referenceLevels.sort((a: any, b: any): any => a - b);
        maximum = referenceLevels[Math.floor(referenceLevels.length * .995)] || 1;
        const canvas: any = document.createElement('canvas');
        canvas.width = cols;
        canvas.height = rows;
        const context: any = canvas.getContext('2d'), image: any = context.createImageData(cols, rows);
        return { cols, rows, size, components, maximum, canvas, context, image };
    }
    const introPressureModel: any = introBuildPressureModel();
    function introSequence(progress: any): any {
        if (progress >= 1)
            return { current: introDemoRays.length - 1, local: 1, visible: introDemoRays.length };
        const scaled: any = Math.max(0, progress) * introDemoRays.length, current: any = Math.min(introDemoRays.length - 1, Math.floor(scaled)), local: any = scaled - current;
        return { current, local, visible: current + (local > 0 ? 1 : 0) };
    }
    function introRenderPressure(sequence: any): any {
        const model: any = introPressureModel, front: any = sequence.local * (model.cols - 1);
        for (let index: any = 0; index < model.size; index++) {
            const column: any = index % model.cols;
            let real: any = 0, imaginary: any = 0, energy: any = 0;
            for (let rayIndex: any = 0; rayIndex < sequence.current; rayIndex++) {
                real += model.components[rayIndex].real[index];
                imaginary += model.components[rayIndex].imaginary[index];
                energy += model.components[rayIndex].energy[index];
            }
            const currentWeight: any = sequence.local <= 0 ? 0 : Math.max(0, Math.min(1, (front - column + 2) / 2));
            real += model.components[sequence.current].real[index] * currentWeight;
            imaginary += model.components[sequence.current].imaginary[index] * currentWeight;
            energy += model.components[sequence.current].energy[index] * currentWeight * currentWeight;
            const magnitude: any = Math.hypot(real, imaginary) + .18 * Math.sqrt(energy), relativeDb: any = 20 * Math.log10(Math.max(1e-12, magnitude) / Math.max(1e-12, model.maximum)), row: any = Math.floor(index / model.cols), depth: any = 5000 * row / (model.rows - 1), sourceDistance: any = Math.hypot(column / 1.6, (depth - 1000) / 160);
            let tl: any = 68 + Math.max(0, Math.min(22, -relativeDb * .55));
            if (sourceDistance < 1)
                tl = Math.min(tl, 46 + 22 * sourceDistance);
            const color: any = introFieldColor(tl);
            model.image.data[index * 4] = color[0];
            model.image.data[index * 4 + 1] = color[1];
            model.image.data[index * 4 + 2] = color[2];
            model.image.data[index * 4 + 3] = 255;
        }
        model.context.putImageData(model.image, 0, 0);
        return model.canvas;
    }
    function introDrawSumFormula(ctx: any, x: any, y: any, align: any = 'right', size: any = 12, color: any = '#91aab2'): any {
        ctx.save();
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.font = `italic ${size}px Georgia, serif`;
        const prefix: any = 'p = ', sum: any = '∑', pressure: any = 'p', prefixWidth: any = ctx.measureText(prefix).width, sumWidth: any = ctx.measureText(sum).width, pressureWidth: any = ctx.measureText(pressure).width, scriptSize: any = size * .65;
        ctx.font = `italic ${scriptSize}px Georgia, serif`;
        const alphaWidth: any = ctx.measureText('α').width, scriptWidth: any = ctx.measureText('(α)').width, total: any = prefixWidth + sumWidth + alphaWidth * .72 + 5 + pressureWidth + scriptWidth;
        let cursor: any = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
        ctx.font = `italic ${size}px Georgia, serif`;
        ctx.fillText(prefix, cursor, y);
        cursor += prefixWidth;
        ctx.fillText(sum, cursor, y);
        ctx.font = `italic ${scriptSize}px Georgia, serif`;
        ctx.fillText('α', cursor + sumWidth * .58, y + size * .38);
        cursor += sumWidth + alphaWidth * .72 + 5;
        ctx.font = `italic ${size}px Georgia, serif`;
        ctx.fillText(pressure, cursor, y);
        cursor += pressureWidth;
        ctx.font = `italic ${scriptSize}px Georgia, serif`;
        ctx.fillText('(α)', cursor, y - size * .45);
        ctx.restore();
    }
    function introPanel(ctx: any, rect: any, index: any, title: any, formula: any): any {
        ctx.fillStyle = 'rgba(7,25,35,.72)';
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.strokeStyle = 'rgba(71,133,150,.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(rect.x + .5, rect.y + .5, rect.w - 1, rect.h - 1);
        ctx.font = '13px ui-monospace, monospace';
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#62d8e7';
        ctx.fillText(`${String(index).padStart(2, '0')}  ${title}`, rect.x + 11, rect.y + 20);
        if (formula === 'coherent-sum')
            introDrawSumFormula(ctx, rect.x + rect.w - 10, rect.y + 20, 'right', 14, '#a4bbc1');
        else {
            ctx.textAlign = 'right';
            ctx.fillStyle = '#a4bbc1';
            ctx.fillText(formula, rect.x + rect.w - 10, rect.y + 20);
        }
        return { x: rect.x + 11, y: rect.y + 31, w: rect.w - 22, h: rect.h - 42 };
    }
    function introRayPlot(ctx: any, plot: any, ray: any, progress: any, beam: any = false): any {
        const x: any = (r: any): any => plot.x + r / 100 * plot.w, y: any = (z: any): any => plot.y + z / 5000 * plot.h;
        ctx.save();
        ctx.beginPath();
        ctx.rect(plot.x, plot.y, plot.w, plot.h);
        ctx.clip();
        ctx.strokeStyle = 'rgba(91,145,160,.12)';
        ctx.lineWidth = 1;
        for (let i: any = 0; i <= 4; i++) {
            const px: any = plot.x + plot.w * i / 4;
            ctx.beginPath();
            ctx.moveTo(px, plot.y);
            ctx.lineTo(px, plot.y + plot.h);
            ctx.stroke();
        }
        [0, 1300, 3000, 5000].forEach((z: any): any => { const py: any = y(z); ctx.beginPath(); ctx.moveTo(plot.x, py); ctx.lineTo(plot.x + plot.w, py); ctx.stroke(); });
        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = 'rgba(197,241,107,.24)';
        ctx.beginPath();
        ctx.moveTo(plot.x, y(1300));
        ctx.lineTo(plot.x + plot.w, y(1300));
        ctx.stroke();
        ctx.setLineDash([]);
        const partial: any = introPartialRay(ray, progress), screen: any = partial.map((point: any): any => [x(point[0]), y(point[1]), (point[2] || 0) / 5000 * plot.h]);
        if (beam && screen.length > 2) {
            const upper: any = [], lower: any = [];
            screen.forEach((point: any, i: any): any => { const before: any = screen[Math.max(0, i - 1)], after: any = screen[Math.min(screen.length - 1, i + 1)], dx: any = after[0] - before[0], dy: any = after[1] - before[1], length: any = Math.max(1, Math.hypot(dx, dy)), width: any = Math.max(1.5, point[2]); upper.push([point[0] - dy / length * width, point[1] + dx / length * width]); lower.push([point[0] + dy / length * width, point[1] - dx / length * width]); });
            const gradient: any = ctx.createLinearGradient(plot.x, 0, plot.x + plot.w, 0);
            gradient.addColorStop(0, 'rgba(98,216,231,.06)');
            gradient.addColorStop(.55, 'rgba(98,216,231,.22)');
            gradient.addColorStop(1, 'rgba(98,216,231,.31)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            upper.forEach((p: any, i: any): any => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
            [...lower].reverse().forEach((p: any): any => ctx.lineTo(p[0], p[1]));
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(115,222,234,.65)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 3]);
            [upper, lower].forEach((edge: any): any => { ctx.beginPath(); edge.forEach((p: any, i: any): any => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); });
            ctx.setLineDash([]);
            const front: any = screen[screen.length - 1], previous: any = screen[Math.max(0, screen.length - 2)], dx: any = front[0] - previous[0], dy: any = front[1] - previous[1], length: any = Math.max(1, Math.hypot(dx, dy)), normalX: any = -dy / length, normalY: any = dx / length, width: any = Math.max(4, front[2]);
            ctx.strokeStyle = '#f8b44c';
            ctx.beginPath();
            ctx.moveTo(front[0] - normalX * width, front[1] - normalY * width);
            ctx.lineTo(front[0] + normalX * width, front[1] + normalY * width);
            ctx.stroke();
            ctx.font = '12px Georgia, serif';
            ctx.textAlign = 'left';
            ctx.fillStyle = '#f8b44c';
            ctx.fillText('σ(s)', front[0] + 7, front[1] - 8);
        }
        if (screen.length) {
            ctx.beginPath();
            screen.forEach((point: any, i: any): any => i ? ctx.lineTo(point[0], point[1]) : ctx.moveTo(point[0], point[1]));
            ctx.strokeStyle = beam ? '#f8b44c' : '#70e3ef';
            ctx.lineWidth = 2;
            ctx.shadowColor = beam ? 'rgba(248,180,76,.5)' : 'rgba(98,216,231,.55)';
            ctx.shadowBlur = 6;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
        const source: any = [x(ray[0][0]), y(ray[0][1])];
        ctx.fillStyle = '#f8b44c';
        ctx.beginPath();
        ctx.arc(source[0], source[1], 4, 0, Math.PI * 2);
        ctx.fill();
        if (screen.length > 1) {
            const front: any = screen[screen.length - 1], previous: any = screen[screen.length - 2], angle: any = Math.atan2(front[1] - previous[1], front[0] - previous[0]);
            ctx.save();
            ctx.translate(front[0], front[1]);
            ctx.rotate(angle);
            ctx.fillStyle = '#f8b44c';
            ctx.beginPath();
            ctx.moveTo(5, 0);
            ctx.lineTo(-4, -3);
            ctx.lineTo(-4, 3);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
        ctx.fillStyle = '#708f99';
        ctx.font = '12px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('0', plot.x, plot.y + plot.h + 13);
        ctx.textAlign = 'right';
        ctx.fillText('100 km', plot.x + plot.w, plot.y + plot.h + 13);
    }
    function introRayFanPlot(ctx: any, plot: any, sequence: any): any {
        const x: any = (r: any): any => plot.x + r / 100 * plot.w, y: any = (z: any): any => plot.y + z / 5000 * plot.h;
        let visible: any = 0;
        ctx.save();
        ctx.beginPath();
        ctx.rect(plot.x, plot.y, plot.w, plot.h);
        ctx.clip();
        ctx.strokeStyle = 'rgba(91,145,160,.12)';
        ctx.lineWidth = 1;
        for (let i: any = 0; i <= 4; i++) {
            const px: any = plot.x + plot.w * i / 4;
            ctx.beginPath();
            ctx.moveTo(px, plot.y);
            ctx.lineTo(px, plot.y + plot.h);
            ctx.stroke();
        }
        for (let i: any = 0; i <= 4; i++) {
            const py: any = plot.y + plot.h * i / 4;
            ctx.beginPath();
            ctx.moveTo(plot.x, py);
            ctx.lineTo(plot.x + plot.w, py);
            ctx.stroke();
        }
        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = 'rgba(197,241,107,.24)';
        ctx.beginPath();
        ctx.moveTo(plot.x, y(1300));
        ctx.lineTo(plot.x + plot.w, y(1300));
        ctx.stroke();
        ctx.setLineDash([]);
        introDemoRays.forEach((ray: any, index: any): any => {
            const local: any = index < sequence.current ? 1 : index === sequence.current ? sequence.local : 0;
            if (local <= 0)
                return;
            visible++;
            const partial: any = introPartialRay(ray, local);
            ctx.beginPath();
            partial.forEach((point: any, i: any): any => i ? ctx.lineTo(x(point[0]), y(point[1])) : ctx.moveTo(x(point[0]), y(point[1])));
            ctx.strokeStyle = index === sequence.current ? 'rgba(248,180,76,.95)' : 'rgba(98,216,231,.58)';
            ctx.lineWidth = index === sequence.current ? 1.65 : 1;
            ctx.stroke();
        });
        ctx.fillStyle = '#f8b44c';
        ctx.shadowColor = 'rgba(248,180,76,.65)';
        ctx.shadowBlur = 7;
        ctx.beginPath();
        ctx.arc(x(0), y(1000), 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
        ctx.fillStyle = '#708f99';
        ctx.font = '12px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('0', plot.x, plot.y + plot.h + 13);
        ctx.textAlign = 'right';
        ctx.fillText('100 km', plot.x + plot.w, plot.y + plot.h + 13);
        return visible;
    }
    function introBeamFanPlot(ctx: any, plot: any, sequence: any): any {
        const x: any = (range: any): any => plot.x + range / 100 * plot.w, y: any = (depth: any): any => plot.y + depth / 5000 * plot.h;
        ctx.save();
        ctx.beginPath();
        ctx.rect(plot.x, plot.y, plot.w, plot.h);
        ctx.clip();
        ctx.strokeStyle = 'rgba(91,145,160,.12)';
        ctx.lineWidth = 1;
        for (let i: any = 0; i <= 4; i++) {
            const px: any = plot.x + plot.w * i / 4;
            ctx.beginPath();
            ctx.moveTo(px, plot.y);
            ctx.lineTo(px, plot.y + plot.h);
            ctx.stroke();
        }
        for (let i: any = 0; i <= 4; i++) {
            const py: any = plot.y + plot.h * i / 4;
            ctx.beginPath();
            ctx.moveTo(plot.x, py);
            ctx.lineTo(plot.x + plot.w, py);
            ctx.stroke();
        }
        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = 'rgba(197,241,107,.24)';
        ctx.beginPath();
        ctx.moveTo(plot.x, y(1300));
        ctx.lineTo(plot.x + plot.w, y(1300));
        ctx.stroke();
        ctx.setLineDash([]);
        introDemoRays.forEach((ray: any, rayIndex: any): any => {
            const local: any = rayIndex < sequence.current ? 1 : rayIndex === sequence.current ? sequence.local : 0;
            if (local <= 0)
                return;
            const active: any = rayIndex === sequence.current, partial: any = introPartialRay(ray, local), screen: any = partial.map((point: any): any => [x(point[0]), y(point[1]), (point[2] || 0) / 5000 * plot.h]), deepEdge: any = [], shallowEdge: any = [];
            screen.forEach((point: any, index: any): any => { const before: any = screen[Math.max(0, index - 1)], after: any = screen[Math.min(screen.length - 1, index + 1)], dx: any = after[0] - before[0], dy: any = after[1] - before[1], length: any = Math.max(1, Math.hypot(dx, dy)), normalX: any = -dy / length, normalY: any = dx / length, beamWidth: any = Math.max(1.7, point[2]); shallowEdge.push([point[0] - normalX * beamWidth, point[1] - normalY * beamWidth]); deepEdge.push([point[0] + normalX * beamWidth, point[1] + normalY * beamWidth]); });
            if (screen.length > 2) {
                ctx.fillStyle = active ? 'rgba(248,180,76,.13)' : 'rgba(98,216,231,.045)';
                ctx.beginPath();
                shallowEdge.forEach((point: any, index: any): any => index ? ctx.lineTo(point[0], point[1]) : ctx.moveTo(point[0], point[1]));
                [...deepEdge].reverse().forEach((point: any): any => ctx.lineTo(point[0], point[1]));
                ctx.closePath();
                ctx.fill();
                ctx.setLineDash([4, 3]);
                ctx.strokeStyle = active ? 'rgba(248,180,76,.76)' : 'rgba(98,216,231,.24)';
                ctx.lineWidth = active ? 1 : .7;
                [shallowEdge, deepEdge].forEach((edge: any): any => { ctx.beginPath(); edge.forEach((point: any, index: any): any => index ? ctx.lineTo(point[0], point[1]) : ctx.moveTo(point[0], point[1])); ctx.stroke(); });
                ctx.setLineDash([]);
            }
            ctx.beginPath();
            screen.forEach((point: any, index: any): any => index ? ctx.lineTo(point[0], point[1]) : ctx.moveTo(point[0], point[1]));
            ctx.strokeStyle = active ? '#f8b44c' : 'rgba(98,216,231,.58)';
            ctx.lineWidth = active ? 1.8 : .9;
            ctx.stroke();
            if (active && screen.length > 1) {
                const front: any = screen[screen.length - 1], shallow: any = shallowEdge[shallowEdge.length - 1], deep: any = deepEdge[deepEdge.length - 1];
                ctx.strokeStyle = '#f8b44c';
                ctx.beginPath();
                ctx.moveTo(shallow[0], shallow[1]);
                ctx.lineTo(deep[0], deep[1]);
                ctx.stroke();
                ctx.fillStyle = '#f8b44c';
                ctx.font = '12px Georgia, serif';
                ctx.textAlign = 'left';
                ctx.fillText('ρ(s)', front[0] + 7, front[1] - 8);
            }
        });
        ctx.fillStyle = '#f8b44c';
        ctx.shadowColor = 'rgba(248,180,76,.6)';
        ctx.shadowBlur = 7;
        ctx.beginPath();
        ctx.arc(x(0), y(1000), 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
        ctx.fillStyle = '#708f99';
        ctx.font = '12px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('0', plot.x, plot.y + plot.h + 13);
        ctx.textAlign = 'right';
        ctx.fillText('100 km', plot.x + plot.w, plot.y + plot.h + 13);
    }
    function introPressurePlot(ctx: any, plot: any, sequence: any): any {
        const field: any = introRenderPressure(sequence), front: any = plot.x + plot.w * sequence.local;
        ctx.save();
        ctx.beginPath();
        ctx.rect(plot.x, plot.y, plot.w, plot.h);
        ctx.clip();
        ctx.fillStyle = '#061019';
        ctx.fillRect(plot.x, plot.y, plot.w, plot.h);
        ctx.imageSmoothingEnabled = true;
        ctx.globalAlpha = .96;
        ctx.drawImage(field, plot.x, plot.y, plot.w, plot.h);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(190,223,229,.13)';
        ctx.lineWidth = 1;
        for (let i: any = 0; i <= 4; i++) {
            const x: any = plot.x + plot.w * i / 4;
            ctx.beginPath();
            ctx.moveTo(x, plot.y);
            ctx.lineTo(x, plot.y + plot.h);
            ctx.stroke();
        }
        for (let i: any = 0; i <= 4; i++) {
            const y: any = plot.y + plot.h * i / 4;
            ctx.beginPath();
            ctx.moveTo(plot.x, y);
            ctx.lineTo(plot.x + plot.w, y);
            ctx.stroke();
        }
        ctx.fillStyle = 'rgba(4,14,21,.86)';
        ctx.fillRect(plot.x + 7, plot.y + 7, 218, 24);
        introDrawSumFormula(ctx, plot.x + 14, plot.y + 24, 'left', 14, '#e0eaec');
        ctx.fillStyle = '#91abb3';
        ctx.font = '12px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`α ${sequence.visible || 0} / ${introDemoRays.length}`, plot.x + 141, plot.y + 24);
        const barW: any = Math.min(125, plot.w * .24), barX: any = plot.x + plot.w - barW - 9, barY: any = plot.y + 9, bar: any = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        bar.addColorStop(0, 'rgb(4,6,130)');
        bar.addColorStop(.45, 'rgb(0,184,246)');
        bar.addColorStop(.72, 'rgb(225,255,16)');
        bar.addColorStop(1, 'rgb(255,25,0)');
        ctx.fillStyle = bar;
        ctx.fillRect(barX, barY, barW, 6);
        ctx.fillStyle = '#c2d3d7';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('90 dB', barX, barY + 17);
        ctx.textAlign = 'right';
        ctx.fillText('40 dB', barX + barW, barY + 17);
        const partial: any = introPartialRay(introDemoRays[sequence.current], sequence.local), x: any = (range: any): any => plot.x + range / 100 * plot.w, y: any = (depth: any): any => plot.y + depth / 5000 * plot.h;
        ctx.beginPath();
        partial.forEach((point: any, index: any): any => index ? ctx.lineTo(x(point[0]), y(point[1])) : ctx.moveTo(x(point[0]), y(point[1])));
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = 'rgba(248,180,76,.75)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
        if (sequence.local < 1) {
            const glow: any = ctx.createLinearGradient(front - 20, 0, front + 5, 0);
            glow.addColorStop(0, 'rgba(248,180,76,0)');
            glow.addColorStop(1, 'rgba(248,180,76,.62)');
            ctx.fillStyle = glow;
            ctx.fillRect(front - 20, plot.y, 25, plot.h);
        }
        ctx.fillStyle = '#bdced2';
        ctx.font = '11px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('0 m', plot.x + 4, plot.y + 13);
        ctx.fillText('5 km', plot.x + 4, plot.y + plot.h - 5);
        ctx.restore();
        ctx.fillStyle = '#708f99';
        ctx.font = '12px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('0', plot.x, plot.y + plot.h + 13);
        ctx.textAlign = 'center';
        ctx.fillText('50', plot.x + plot.w / 2, plot.y + plot.h + 13);
        ctx.textAlign = 'right';
        ctx.fillText('100 km', plot.x + plot.w, plot.y + plot.h + 13);
    }
    function drawIntroRay(progress: any = 0): any {
        state.introProgress = Math.max(0, Math.min(1, progress));
        const { ctx, w, h }: any = fitCanvas(canvases.intro);
        ctx.clearRect(0, 0, w, h);
        const bg: any = ctx.createLinearGradient(0, 0, w, h);
        bg.addColorStop(0, '#08212c');
        bg.addColorStop(1, '#05141c');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
        const outer: any = 12, profileWidth: any = Math.max(108, Math.min(188, w * .24)), profile: any = { x: outer, y: outer, w: profileWidth, h: h - outer * 2 }, rightX: any = profile.x + profile.w + 10, rightW: any = w - rightX - outer, gap: any = 8, available: any = profile.h - gap * 2, heights: any = [available * .25, available * .28, available * .47], rows: any = [];
        let rowStart: any = outer;
        heights.forEach((height: any): any => { rows.push({ x: rightX, y: rowStart, w: rightW, h: height }); rowStart += height + gap; });
        ctx.fillStyle = 'rgba(7,25,35,.72)';
        ctx.fillRect(profile.x, profile.y, profile.w, profile.h);
        ctx.strokeStyle = 'rgba(71,133,150,.28)';
        ctx.strokeRect(profile.x + .5, profile.y + .5, profile.w - 1, profile.h - 1);
        ctx.font = '12px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#62d8e7';
        ctx.fillText('MUNK  c(z)', profile.x + 11, profile.y + 20);
        ctx.fillStyle = '#91aab2';
        ctx.fillText('声速剖面', profile.x + 11, profile.y + 39);
        const chart: any = { x: profile.x + 34, y: profile.y + 48, w: profile.w - 45, h: profile.h - 82 }, cx: any = (c: any): any => chart.x + (c - 1495) / 65 * chart.w, cy: any = (z: any): any => chart.y + z / 5000 * chart.h;
        ctx.strokeStyle = 'rgba(91,145,160,.14)';
        ctx.lineWidth = 1;
        [0, 1300, 3000, 5000].forEach((z: any): any => { const y: any = cy(z); ctx.beginPath(); ctx.moveTo(chart.x, y); ctx.lineTo(chart.x + chart.w, y); ctx.stroke(); });
        [1500, 1530, 1560].forEach((c: any): any => { const x: any = cx(c); ctx.beginPath(); ctx.moveTo(x, chart.y); ctx.lineTo(x, chart.y + chart.h); ctx.stroke(); });
        ctx.beginPath();
        introMunkProfile.forEach(([z, c]: any, i: any): any => i ? ctx.lineTo(cx(c), cy(z)) : ctx.moveTo(cx(c), cy(z)));
        ctx.strokeStyle = '#62d8e7';
        ctx.lineWidth = 2.2;
        ctx.shadowColor = 'rgba(98,216,231,.5)';
        ctx.shadowBlur = 7;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(197,241,107,.65)';
        ctx.beginPath();
        ctx.moveTo(chart.x, cy(1300));
        ctx.lineTo(chart.x + chart.w, cy(1300));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#7898a1';
        ctx.font = '11px ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.fillText('0', chart.x - 6, chart.y + 4);
        ctx.fillText('1.3k', chart.x - 6, cy(1300) + 4);
        ctx.fillText('3k', chart.x - 6, cy(3000) + 4);
        ctx.fillText('5k', chart.x - 6, chart.y + chart.h + 4);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#c5f16b';
        ctx.fillText('AXIS', chart.x + 4, cy(1300) - 6);
        ctx.fillStyle = '#7898a1';
        ctx.fillText('1500', chart.x, chart.y + chart.h + 19);
        ctx.textAlign = 'right';
        ctx.fillText('1560 m/s', chart.x + chart.w, chart.y + chart.h + 19);
        const sequence: any = introSequence(state.introProgress), rayPlot: any = introPanel(ctx, rows[0], 1, '逐条声线传播', 'r⁽α⁾(s), z⁽α⁾(s)'), beamPlot: any = introPanel(ctx, rows[1], 2, '多声线 + 波束累积', 'Σ B⁽α⁾(s,n)'), pressurePlot: any = introPanel(ctx, rows[2], 3, '逐条声压相干叠加', 'coherent-sum');
        const visible: any = introRayFanPlot(ctx, rayPlot, sequence);
        introBeamFanPlot(ctx, beamPlot, sequence);
        introPressurePlot(ctx, pressurePlot, sequence);
        $('introRayNumber').textContent = `${String(visible).padStart(2, '0')} / ${String(introDemoRays.length).padStart(2, '0')}`;
        $('introAngle').textContent = `${introAngles[sequence.current].toFixed(1).replace('-', '−')}°`;
        $('introProgressBar').style.width = (state.introProgress * 100).toFixed(1) + '%';
        $('introProgressText').textContent = Math.round(state.introProgress * 100) + '%';
    }
    function startIntroAnimation(initialProgress: any = 0): any {
        const duration: any = 10800, offset: any = typeof initialProgress === 'number' ? Math.max(0, Math.min(.95, initialProgress)) : 0;
        cancelAnimationFrame(state.introRaf);
        state.introStart = performance.now() - duration * offset;
        function frame(now: any): any {
            const progress: any = Math.min(1, (now - state.introStart) / duration);
            drawIntroRay(progress);
            if (progress < 1)
                state.introRaf = requestAnimationFrame(frame);
            else
                state.introRaf = null;
        }
        state.introRaf = requestAnimationFrame(frame);
    }
    function animate(): any {
        cancelAnimationFrame(state.raf);
        const start: any = performance.now(), duration: any = 1800;
        function frame(now: any): any {
            const t: any = Math.min(1, (now - start) / duration), eased: any = 1 - Math.pow(1 - t, 3);
            state.animation = eased;
            drawRay(eased);
            drawLoss(eased);
            drawVelocity(eased);
            if (t < 1)
                state.raf = requestAnimationFrame(frame);
        }
        state.raf = requestAnimationFrame(frame);
    }
    function eigenColor(ray: any): any {
        if (ray.top_bounces && ray.bottom_bounces)
            return '#ad85f7';
        if (ray.top_bounces)
            return '#66db91';
        if (ray.bottom_bounces)
            return '#59a9ff';
        return '#f8b44c';
    }
    function eigenAxes(ctx: any, w: any, h: any, maxRange: any, maxDepth: any): any {
        const a: any = { l: 46, r: 16, t: 18, b: 34 };
        a.pw = w - a.l - a.r;
        a.ph = h - a.t - a.b;
        ctx.strokeStyle = 'rgba(92,151,169,.14)';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#5f7f89';
        ctx.font = '10px ui-monospace, monospace';
        for (let i: any = 0; i <= 5; i++) {
            const x: any = a.l + a.pw * i / 5;
            ctx.beginPath();
            ctx.moveTo(x, a.t);
            ctx.lineTo(x, a.t + a.ph);
            ctx.stroke();
            ctx.textAlign = 'center';
            ctx.fillText((maxRange * i / 5).toFixed(0), x, h - 12);
        }
        for (let i: any = 0; i <= 5; i++) {
            const y: any = a.t + a.ph * i / 5, depth: any = maxDepth * i / 5;
            ctx.beginPath();
            ctx.moveTo(a.l, y);
            ctx.lineTo(a.l + a.pw, y);
            ctx.stroke();
            ctx.textAlign = 'right';
            ctx.fillText(depth >= 1000 ? `${(depth / 1000).toFixed(depth % 1000 ? 1 : 0)}k` : depth.toFixed(0), a.l - 6, y + 3);
        }
        ctx.fillStyle = '#486b76';
        ctx.textAlign = 'center';
        ctx.fillText('距离 / km', a.l + a.pw / 2, h - 3);
        ctx.save();
        ctx.translate(10, a.t + a.ph / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('深度 / m', 0, 0);
        ctx.restore();
        return a;
    }
    function drawEigen(): any {
        const { ctx, w, h }: any = fitCanvas(canvases.eigen);
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#06161f';
        ctx.fillRect(0, 0, w, h);
        const data: any = state.eigen, maxRange: any = data?.maximum_range_km || 100, maxDepth: any = data?.maximum_depth_m || displayDepthM(), a: any = eigenAxes(ctx, w, h, maxRange, maxDepth);
        if (!data)
            return;
        const receiver: any = state.receiverPreview || data.receiver, x: any = (r: any): any => a.l + r / maxRange * a.pw, y: any = (z: any): any => a.t + z / maxDepth * a.ph, sourceDepth: any = params().source_depth, solvedSource: any = state.solvedEigenSourceDepth ?? sourceDepth, sourceShift: any = sourceDepth - solvedSource, pathY: any = (pt: any): any => y(Math.max(0, Math.min(maxDepth, pt[1] + sourceShift * Math.exp(-pt[0] / 10))));
        drawBathymetry(ctx, a, data, 1);
        ctx.setLineDash([5, 4]);
        data.equal_angle_eigenrays.forEach((ray: any): any => { ctx.beginPath(); ray.path.forEach((pt: any, i: any): any => i ? ctx.lineTo(x(pt[0]), pathY(pt)) : ctx.moveTo(x(pt[0]), pathY(pt))); ctx.strokeStyle = 'rgba(91,157,255,.75)'; ctx.lineWidth = 1.15; ctx.stroke(); });
        ctx.setLineDash([]);
        data.eigenrays.forEach((ray: any): any => { ctx.beginPath(); ray.path.forEach((pt: any, i: any): any => i ? ctx.lineTo(x(pt[0]), pathY(pt)) : ctx.moveTo(x(pt[0]), pathY(pt))); ctx.strokeStyle = eigenColor(ray); ctx.lineWidth = 1.65; ctx.shadowColor = eigenColor(ray); ctx.shadowBlur = 5; ctx.stroke(); ctx.shadowBlur = 0; });
        const sourceX: any = x(0), sourceY: any = y(sourceDepth);
        if (state.eigenSourceDragging) {
            ctx.setLineDash([3, 4]);
            ctx.strokeStyle = 'rgba(248,180,76,.34)';
            ctx.beginPath();
            ctx.moveTo(a.l, sourceY);
            ctx.lineTo(a.l + a.pw, sourceY);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        ctx.fillStyle = '#f8b44c';
        ctx.shadowColor = '#f8b44c';
        ctx.shadowBlur = state.eigenSourceDragging ? 15 : 10;
        ctx.beginPath();
        ctx.arc(sourceX, sourceY, state.eigenSourceDragging ? 6 : 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(248,180,76,.48)';
        ctx.beginPath();
        ctx.arc(sourceX, sourceY, 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#e2be78';
        ctx.font = '10px ui-monospace,monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`声源 ${sourceDepth.toLocaleString('zh-CN')} m`, sourceX + 12, sourceY - 10);
        const rx: any = x(receiver.range_km), ry: any = y(receiver.depth_m), boxLeft: any = Math.max(0, receiver.range_km - 1), boxRight: any = Math.min(maxRange, receiver.range_km + 1), boxTop: any = Math.max(0, receiver.depth_m - 180), boxBottom: any = Math.min(maxDepth, receiver.depth_m + 180);
        if (state.receiverDragging) {
            ctx.setLineDash([3, 4]);
            ctx.strokeStyle = 'rgba(248,180,76,.36)';
            ctx.beginPath();
            ctx.moveTo(a.l, ry);
            ctx.lineTo(a.l + a.pw, ry);
            ctx.moveTo(rx, a.t);
            ctx.lineTo(rx, a.t + a.ph);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        ctx.fillStyle = '#f8b44c';
        ctx.shadowColor = '#f8b44c';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(rx, ry, state.receiverDragging ? 7 : 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#f8b44c';
        ctx.strokeRect(x(boxLeft), y(boxTop), x(boxRight) - x(boxLeft), y(boxBottom) - y(boxTop));
        ctx.fillStyle = '#e2be78';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = rx > w - 165 ? 'right' : 'left';
        ctx.fillText(`${receiver.range_km.toFixed(1)} km · ${receiver.depth_m.toFixed(0)} m`, rx + (rx > w - 165 ? -10 : 10), ry - 10);
        const zw: any = Math.min(230, w * .34), zh: any = Math.min(150, h * .36), zx: any = w - zw - 24, zy: any = 32;
        ctx.fillStyle = 'rgba(5,19,27,.96)';
        ctx.fillRect(zx, zy, zw, zh);
        ctx.strokeStyle = '#285365';
        ctx.strokeRect(zx, zy, zw, zh);
        ctx.save();
        ctx.beginPath();
        ctx.rect(zx + 8, zy + 18, zw - 16, zh - 27);
        ctx.clip();
        const zxmin: any = boxLeft, zxmax: any = boxRight, zymin: any = boxTop, zymax: any = boxBottom;
        const xx: any = (r: any): any => zx + 8 + (r - zxmin) / Math.max(.1, zxmax - zxmin) * (zw - 16), yy: any = (z: any): any => zy + 18 + (z - zymin) / Math.max(1, zymax - zymin) * (zh - 27);
        ctx.setLineDash([4, 3]);
        data.equal_angle_eigenrays.forEach((ray: any): any => {
            ctx.beginPath();
            let active: any = false;
            ray.path.forEach((pt: any): any => {
                if (pt[0] < zxmin || pt[0] > zxmax)
                    return;
                active ? ctx.lineTo(xx(pt[0]), yy(pt[1])) : (ctx.moveTo(xx(pt[0]), yy(pt[1])), active = true);
            });
            ctx.strokeStyle = 'rgba(91,157,255,.8)';
            ctx.lineWidth = 1;
            ctx.stroke();
        });
        ctx.setLineDash([]);
        data.eigenrays.forEach((ray: any): any => {
            ctx.beginPath();
            let active: any = false;
            ray.path.forEach((pt: any): any => {
                if (pt[0] < zxmin || pt[0] > zxmax)
                    return;
                active ? ctx.lineTo(xx(pt[0]), yy(pt[1])) : (ctx.moveTo(xx(pt[0]), yy(pt[1])), active = true);
            });
            ctx.strokeStyle = eigenColor(ray);
            ctx.lineWidth = 1.25;
            ctx.stroke();
        });
        ctx.fillStyle = '#f8b44c';
        ctx.beginPath();
        ctx.arc(xx(receiver.range_km), yy(receiver.depth_m), 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#688a94';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('LOCAL CONVERGENCE', zx + 8, zy + 12);
    }
    function receiverFromPointer(event: any): any {
        const rect: any = canvases.eigen.getBoundingClientRect(), a: any = { l: 46, r: 16, t: 18, b: 34 }, pw: any = rect.width - 62, ph: any = rect.height - 52, px: any = event.clientX - rect.left, py: any = event.clientY - rect.top, maxRange: any = state.eigen?.maximum_range_km || 100, maxDepth: any = state.eigen?.maximum_depth_m || displayDepthM(), upper: any = Math.min(95, maxRange), lower: any = Math.min(5, upper);
        return { range_km: Math.round(Math.max(lower, Math.min(upper, (px - a.l) / pw * maxRange)) * 2) / 2, depth_m: Math.round(Math.max(20, Math.min(maxDepth - 20, (py - a.t) / ph * maxDepth)) / 10) * 10, px, py, a, pw, ph, maxRange, maxDepth };
    }
    function startEigenInteraction(event: any): any {
        if (!state.eigen || $('eigenRun').disabled)
            return;
        const point: any = receiverFromPointer(event), sourceX: any = point.a.l, sourceY: any = point.a.t + params().source_depth / point.maxDepth * point.ph;
        if (Math.hypot(point.px - sourceX, point.py - sourceY) <= 22) {
            clearTimeout(debounce);
            state.eigenSourceDragging = true;
            canvases.eigen.classList.add('dragging');
            canvases.eigen.setPointerCapture?.(event.pointerId);
            moveEigenInteraction(event);
            return;
        }
        startReceiverDrag(event);
    }
    function moveEigenInteraction(event: any): any {
        if (!state.eigenSourceDragging) {
            moveReceiver(event);
            return;
        }
        const point: any = receiverFromPointer(event), depth: any = Math.round(Math.max(20, Math.min(point.maxDepth - 20, point.depth_m)) / 10) * 10;
        controls.sourceDepth.value = String(depth);
        eigenEnvControls.sourceDepth.value = String(depth);
        syncLabels();
        drawEigenEnvironment();
        drawRay(1);
        $('eigenStatus').classList.add('eigen-running');
        $('eigenStatus').querySelector('span').textContent = '拖动声源 · 松开后重新求解';
        drawEigen();
    }
    function finishEigenInteraction(event: any): any {
        if (!state.eigenSourceDragging) {
            finishReceiverDrag(event);
            return;
        }
        moveEigenInteraction(event);
        state.eigenSourceDragging = false;
        canvases.eigen.classList.remove('dragging');
        recalculateAfterEigenDrag();
    }
    function startReceiverDrag(event: any): any {
        if (!state.eigen || $('eigenRun').disabled)
            return;
        const point: any = receiverFromPointer(event), receiver: any = state.receiverPreview || state.eigen.receiver, rx: any = point.a.l + receiver.range_km / point.maxRange * point.pw, ry: any = point.a.t + receiver.depth_m / point.maxDepth * point.ph;
        if (Math.hypot(point.px - rx, point.py - ry) > 18)
            return;
        state.receiverDragging = true;
        state.receiverPreview = { range_km: receiver.range_km, depth_m: receiver.depth_m };
        canvases.eigen.classList.add('dragging');
        canvases.eigen.setPointerCapture?.(event.pointerId);
        moveReceiver(event);
    }
    function moveReceiver(event: any): any {
        if (!state.receiverDragging)
            return;
        const point: any = receiverFromPointer(event);
        state.receiverPreview = { range_km: point.range_km, depth_m: point.depth_m };
        $('receiverRange').value = point.range_km.toFixed(1);
        $('receiverDepth').value = String(point.depth_m);
        $('eigenStatus').classList.add('eigen-running');
        $('eigenStatus').querySelector('span').textContent = '拖动接收器 · 松开后重新求解';
        drawEigen();
    }
    function finishReceiverDrag(event: any): any {
        if (!state.receiverDragging)
            return;
        moveReceiver(event);
        state.receiverDragging = false;
        canvases.eigen.classList.remove('dragging');
        runEigen({ comparison: false });
    }
    function drawArrivals(): any {
        const { ctx, w, h }: any = fitCanvas(canvases.arrival);
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#06161f';
        ctx.fillRect(0, 0, w, h);
        const rays: any = (state.eigen?.eigenrays || []).filter((r: any): any => r.arrival_valid && Number.isFinite(r.travel_time_s) && Number.isFinite(r.amplitude)), equal: any = (state.eigen?.equal_angle_eigenrays || []).filter((r: any): any => r.arrival_valid && Number.isFinite(r.travel_time_s) && Number.isFinite(r.amplitude)), all: any = [...rays, ...equal], a: any = { l: 43, r: 14, t: 18, b: 30 };
        a.pw = w - a.l - a.r;
        a.ph = h - a.t - a.b;
        ctx.strokeStyle = 'rgba(92,151,169,.14)';
        ctx.fillStyle = '#5f7f89';
        ctx.font = '10px ui-monospace, monospace';
        for (let i: any = 0; i <= 4; i++) {
            const y: any = a.t + a.ph * i / 4;
            ctx.beginPath();
            ctx.moveTo(a.l, y);
            ctx.lineTo(a.l + a.pw, y);
            ctx.stroke();
            ctx.textAlign = 'right';
            ctx.fillText((1 - i / 4).toFixed(2), a.l - 6, y + 3);
        }
        if (!all.length) {
            ctx.textAlign = 'center';
            ctx.fillText('NO EIGENRAYS FOUND', a.l + a.pw / 2, a.t + a.ph / 2);
            return;
        }
        const times: any = all.map((r: any): any => r.travel_time_s), min: any = Math.min(...times), max: any = Math.max(...times), span: any = Math.max(.08, max - min), lo: any = min - span * .08, hi: any = max + span * .08, maxAmp: any = Math.max(1e-30, ...all.map((r: any): any => r.amplitude));
        equal.forEach((ray: any): any => { const x: any = a.l + (ray.travel_time_s - lo) / (hi - lo) * a.pw, amp: any = ray.amplitude / maxAmp, y: any = a.t + (1 - amp) * a.ph; ctx.strokeStyle = 'rgba(91,157,255,.72)'; ctx.lineWidth = 1; ctx.setLineDash([3, 2]); ctx.beginPath(); ctx.moveTo(x, a.t + a.ph); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]); ctx.strokeStyle = '#5b9dff'; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.stroke(); });
        rays.forEach((ray: any): any => { const x: any = a.l + (ray.travel_time_s - lo) / (hi - lo) * a.pw, amp: any = ray.amplitude / maxAmp, y: any = a.t + (1 - amp) * a.ph; ctx.strokeStyle = eigenColor(ray); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(x, a.t + a.ph); ctx.lineTo(x, y); ctx.stroke(); ctx.fillStyle = eigenColor(ray); ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); });
        for (let i: any = 0; i <= 4; i++) {
            const x: any = a.l + a.pw * i / 4;
            ctx.fillStyle = '#486b76';
            ctx.textAlign = 'center';
            ctx.fillText((lo + (hi - lo) * i / 4).toFixed(2), x, h - 12);
        }
        ctx.fillText('到达时间 / s', a.l + a.pw / 2, h - 3);
        ctx.save();
        ctx.translate(10, a.t + a.ph / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('归一化幅度', 0, 0);
        ctx.restore();
        ctx.textAlign = 'right';
        ctx.fillStyle = '#5b9dff';
        ctx.fillText('○ 本征声线', w - 72, 11);
        ctx.fillStyle = '#c5f16b';
        ctx.fillText('● 精确本征', w - 12, 11);
    }
    function renderEigenSummary(): any {
        const data: any = state.eigen;
        if (!data)
            return;
        const rays: any = data.eigenrays, equal: any = data.equal_angle_eigenrays;
        $('coarseMiss').textContent = data.comparison_included ? data.equal_angle_residual_rmse_m.toFixed(2) + ' m' : '—';
        $('exactResidual').textContent = data.precise_residual_rmse_m.toFixed(3) + ' m';
        $('eigenCount').textContent = `${data.comparison_included ? equal.length : '—'} / ${rays.length} paths`;
        $('eigenIterations').textContent = data.iterations == null ? 'MODE_E_PC' : data.iterations + ' iter';
        $('coherentTl').textContent = data.coherent_tl_db.toFixed(2) + ' dB';
        $('incoherentTl').textContent = data.incoherent_tl_db.toFixed(2) + ' dB';
        const scopeNote: any = `接收器轴为 ${data.receiver_grid_shape.join('×')}，仅计算图中标记的一个接收点。`;
        const comparisonNote: any = data.comparison_included ? '蓝色结果由 OOB 的 EIGENRAY / ARRIVALS 模式计算；彩色结果由 OOB 原生 MODE_E_PC 精确本征算法（PARTICLE_RAY / PARTICLE_ARRIVALS）计算。' : data.comparison_skip_reason === 'range_dependent_environment' ? '当前为距离相关 2D ENV，已跳过不适用且耗时的传统 EIGENRAY / ARRIVALS 对照，仅执行 OOB 原生 MODE_E_PC 精确算法。' : '当前为拖动快速精确更新，仅执行 OOB 原生 MODE_E_PC；点击“搜索本征声线”可补算蓝色传统对照。';
        $('eigenMethodNote').textContent = `${scopeNote}${formatAngle(data.angle_range_degrees[0])} 至 ${formatAngle(data.angle_range_degrees[1])} 使用 ${data.launch_angle_count.toLocaleString('zh-CN')} 个等间隔初始角。${comparisonNote}计算在浏览器 Web Worker 的 WebAssembly 模块中完成，不向后端上传环境参数。`;
        const timeText: any = (ray: any): any => ray.arrival_valid && Number.isFinite(ray.travel_time_s) ? ray.travel_time_s.toFixed(4) + ' s' : '—', phaseText: any = (ray: any): any => ray.arrival_valid && Number.isFinite(ray.phase_deg) ? ray.phase_deg.toFixed(1) + '°' : '—';
        const exactRows: any = rays.map((ray: any): any => `<tr><td class="method-precise">精确</td><td>E${String(ray.id).padStart(2, '0')}</td><td style="color:${eigenColor(ray)}">${ray.kind}</td><td>${ray.launch_angle.toFixed(4)}°</td><td>${timeText(ray)}</td><td>${phaseText(ray)}</td><td>${Math.abs(ray.residual_m).toFixed(3)} m</td></tr>`), equalRows: any = equal.map((ray: any): any => `<tr><td class="method-equal">本征</td><td>A${String(ray.id).padStart(2, '0')}</td><td>${ray.kind}</td><td>${ray.launch_angle.toFixed(4)}°</td><td>${timeText(ray)}</td><td>${phaseText(ray)}</td><td>${Math.abs(ray.residual_m).toFixed(2)} m</td></tr>`);
        $('arrivalRows').innerHTML = exactRows.length || equalRows.length ? [...exactRows, ...equalRows].join('') : '<tr><td colspan="7">当前角度范围内未发现本征声线，请调整接收点。</td></tr>';
    }
    async function runEigen(options: any = {}): Promise<any> {
        const token: any = ++state.eigenRequest, p: any = params();
        p.receiver_range = Math.max(5, Math.min(95, Number($('receiverRange').value) || 50));
        p.receiver_depth = Math.max(20, Math.min(displayDepthM() - 20, Number($('receiverDepth').value) || 1000));
        p.tolerance = Number($('eigenTolerance').value);
        p.include_equal_angle_comparison = options.comparison !== false;
        const names: any = profileNames;
        $('eigenEnv').textContent = `${names[p.profile]} · 声源 ${p.source_depth.toLocaleString('zh-CN')} m · ${p.frequency} Hz`;
        $('eigenStatus').classList.add('eigen-running');
        $('eigenStatus').querySelector('span').textContent = p.include_equal_angle_comparison ? '正在计算本征声线与精确本征声线' : '正在精确求解单接收点';
        $('eigenRun').disabled = true;
        try {
            const data: any = await runtime.findEigenrays(p);
            if (token !== state.eigenRequest)
                return;
            state.eigen = data;
            state.solvedEigenSourceDepth = p.source_depth;
            state.receiverPreview = null;
            state.receiverDragging = false;
            state.eigenSourceDragging = false;
            canvases.eigen.classList.remove('dragging');
            syncEigenEnvironmentFromMain();
            drawEigen();
            drawArrivals();
            renderEigenSummary();
            $('eigenEnv').textContent = `${names[p.profile]} · 声源 ${p.source_depth.toLocaleString('zh-CN')} m · ${p.frequency} Hz · ${data.thread_count} WASM threads`;
            $('eigenStatus').querySelector('span').textContent = data.comparison_included ? `本征 ${data.equal_angle_eigenrays.length} 条 · 精确 ${data.eigenrays.length} 条 · ${data.compute_ms.toFixed(1)} ms` : `单接收点 · 精确 ${data.eigenrays.length} 条 · ${data.compute_ms.toFixed(1)} ms`;
            $('eigenStatus').classList.remove('eigen-running');
        }
        catch (e: any) {
            if (token !== state.eigenRequest)
                return;
            $('eigenStatus').querySelector('span').textContent = 'WASM 求解失败 · 请使用支持跨源隔离的浏览器服务';
            $('eigenStatus').classList.remove('eigen-running');
            console.error(e);
        }
        finally {
            if (token === state.eigenRequest)
                $('eigenRun').disabled = false;
        }
    }
    async function run(): Promise<any> {
        const token: any = ++state.request;
        syncLabels();
        $('simStatus').textContent = 'CALCULATING';
        $('simTime').textContent = 'PLEASE WAIT';
        $('simPulse').parentElement.classList.add('loading');
        const started: any = performance.now();
        try {
            const data: any = await runtime.runField(params());
            if (token !== state.request)
                return;
            state.data = data;
            state.solvedSourceDepth = params().source_depth;
            state.animation = 1;
            const { mode, shortBeam }: any = fieldOptionDescription(data.beam_type, data.field_mode), rayCount: any = data.field_ray_count.toLocaleString('zh-CN');
            $('bottomReflectionLoss').textContent = data.bottom.absorption_db_per_wavelength.toFixed(2) + ' dB/λ';
            $('fieldRayCount').textContent = data.field_ray_count === data.requested_field_ray_count ? `${rayCount} RAYS · ${mode} · ${shortBeam} · WASM` : `${rayCount} / ENV ${data.requested_field_ray_count.toLocaleString('zh-CN')} · ${mode} · ${shortBeam} · MEMORY FIT`;
            $('fieldRayCount').title = `RunMode.${data.field_mode} · BeamType.${data.beam_type}`;
            updateFieldOptionStatus(data);
            $('launchAngleDisplay').textContent = formatAngleRange(data.angle_range_degrees);
            $('displayRayCount').textContent = `${data.display_ray_count.toLocaleString('zh-CN')} DISPLAY RAYS`;
            $('maximumRangeDisplay').textContent = `${data.maximum_range_km.toLocaleString('zh-CN')} km`;
            buildLossImage();
            buildVelocityImages();
            drawSSP();
            drawRay(1);
            drawLoss(1);
            drawVelocity(1);
            drawIntroRay(state.introProgress || 1);
            $('simStatus').textContent = 'SIMULATION COMPLETE';
            $('simTime').textContent = `${(performance.now() - started).toFixed(1)} ms`;
        }
        catch (e: any) {
            if (token !== state.request)
                return;
            $('simStatus').textContent = 'WASM ERROR';
            $('simTime').textContent = 'CHECK COOP / COEP';
            console.error(e);
        }
        finally {
            if (token === state.request)
                $('simPulse').parentElement.classList.remove('loading');
        }
    }
    let debounce: any;
    async function recalculateEnvironment(): Promise<any> {
        const token: any = ++state.environmentRequest;
        await run();
        if (token !== state.environmentRequest)
            return;
        await runEigen();
    }
    async function recalculateAfterEigenDrag(): Promise<any> {
        const token: any = ++state.environmentRequest;
        await runEigen({ comparison: false });
        if (token !== state.environmentRequest)
            return;
        await run();
    }
    function markEigenStale(): any {
        if (!$('eigenStatus'))
            return;
        $('eigenStatus').classList.add('eigen-running');
        $('eigenStatus').querySelector('span').textContent = '环境参数已变化 · 正在重新计算';
    }
    function describeImportError(error: any): any {
        if (error instanceof Error && error.message)
            return error.message;
        if (typeof error === 'string' && error.trim())
            return error;
        try {
            const serialized: any = JSON.stringify(error);
            if (serialized && serialized !== '{}')
                return serialized;
        }
        catch { }
        return '未能识别文件内容，请检查 ENV/JSON 格式及同名 SSP、BTY 伴随文件。';
    }
    function canonicalBathymetryVaries(points: any): any {
        if (!Array.isArray(points) || points.length < 2)
            return false;
        const first: any = Number(points[0]?.[1]);
        return Number.isFinite(first) && points.some((point: any): any => Math.abs(Number(point?.[1]) - first) > 1e-6);
    }
    function applyCanonicalEnvironment(imported: any): any {
        if (!Array.isArray(imported?.profilePoints) || imported.profilePoints.length < 2)
            throw new Error('环境文件中未找到至少两个有效的声速剖面节点');
        const finiteOr: any = (value: any, fallback: any): any => Number.isFinite(Number(value)) ? Number(value) : fallback;
        const waterDepthM: any = Math.max(50, Math.min(12000, finiteOr(imported.waterDepthM, finiteOr(imported.profilePoints.at(-1)?.[0], DEFAULT_WATER_DEPTH_M))));
        const bathymetry: any = Array.isArray(imported.bathymetry) ? imported.bathymetry.map((point: any): any => [Number(point[0]), Number(point[1])]) : null;
        const deepestBottomM: any = bathymetry?.reduce((maximum: any, point: any): any => Math.max(maximum, Number(point[1]) || 0), waterDepthM) ?? waterDepthM;
        state.customWaterDepthM = waterDepthM;
        state.maximumDepthM = Math.max(waterDepthM, deepestBottomM);
        state.customSSP = sanitizeSspPoints(imported.profilePoints.map((point: any): any => [Number(point[0]), Number(point[1])]), waterDepthM);
        state.customEnvironment = {
            ...imported,
            maximumRangeKm: finiteOr(imported.maximumRangeKm, 100),
            bathymetry,
            angleRangeDegrees: Array.isArray(imported.angleRangeDegrees) ? imported.angleRangeDegrees.map(Number) : undefined,
            beamCount: finiteOr(imported.beamCount, 1000),
        };
        controls.frequency.value = String(Math.max(20, Math.min(5000, finiteOr(imported.frequencyHz, 500))));
        controls.bottomSpeed.value = String(Math.max(1400, Math.min(3000, finiteOr(imported.bottomSoundSpeedMps, 1700))));
        controls.bottomDensity.value = String(Math.max(1000, Math.min(3500, finiteOr(imported.bottomDensityKgM3, 1800))));
        controls.bottomAbsorption.value = String(Math.max(0, Math.min(5, finiteOr(imported.bottomAttenuationDbPerWavelength, 0.5))));
        applyImportedFieldOptions(imported);
        activateProfile('custom', { defaults: false });
        controls.sourceDepth.value = String(Math.max(20, Math.min(waterDepthM - 20, finiteOr(imported.sourceDepthM, Math.min(1000, waterDepthM / 2)))));
        updateDepthBounds();
        const receiverRange: any = Math.max(5, Math.min(95, finiteOr(imported.maximumRangeKm, 50), finiteOr($('receiverRange').value, 50)));
        $('receiverRange').value = String(receiverRange);
        syncLabels();
        syncEigenEnvironmentFromMain();
        renderSSPTables();
        drawSSP();
    }
    async function handleEnvImport(event: any): Promise<any> {
        const files: any = [...event.target.files];
        if (!files.length)
            return;
        ++state.environmentRequest;
        ++state.request;
        ++state.eigenRequest;
        const button: any = $('envImportButton'), status: any = $('envImportStatus');
        button.disabled = true;
        status.className = '';
        status.textContent = '正在浏览器中解析环境文件…';
        try {
            const hasEnv: any = files.some((file: any): any => /\.env$/i.test(file.name));
            if (hasEnv) {
                const imported: any = await runtime.importEnvironment(files);
                if (imported.sspPoints.length < 2)
                    throw new Error('ENV 中未找到有效的声速剖面');
                state.customEnvironment = null;
                state.importedEnvironment = { ...imported, sspPoints: imported.sspPoints.map((point: any): any => [point[0], point[1]]) };
                applyImportedFieldOptions(imported);
                setImportedOptionAvailability();
                activateProfile('env');
                $('receiverRange').value = String(Math.max(5, Math.min(Number($('receiverRange').value) || 50, imported.maximumRangeKm)));
                $('launchAngleDisplay').textContent = formatAngleRange(imported.angleRangeDegrees);
                $('displayRayCount').textContent = '50 DISPLAY RAYS';
                $('fieldRayCount').textContent = `${imported.fieldRayCount.toLocaleString('zh-CN')} RAYS · ENV ${imported.fieldGridRows}×${imported.fieldGridColumns}`;
                syncLabels();
                syncEigenEnvironmentFromMain();
                renderSSPTables();
                drawSSP();
                markEigenStale();
                status.className = 'success';
                status.textContent = `已导入：${imported.title}${imported.rangeDependent ? ' · 2D SSP' : ''} · ${files.length} 个文件 · TL ${imported.fieldRayCount.toLocaleString('zh-CN')} beams · ENV ${imported.beamType} / ${imported.runMode}`;
            }
            else {
                const imported: any = await parseEnvironmentFiles(files);
                applyCanonicalEnvironment(imported);
                markEigenStale();
                status.className = 'success';
                status.textContent = `已导入：${imported.title} · JSON · ${state.customSSP.length} 个 SSP 节点${canonicalBathymetryVaries(imported.bathymetry) ? ` · ${imported.bathymetry.length} 个地形节点` : ''}`;
            }
            recalculateEnvironment();
        }
        catch (error: any) {
            status.className = 'error';
            status.textContent = `导入失败：${describeImportError(error)}`;
        }
        finally {
            button.disabled = false;
            event.target.value = '';
        }
    }
    function schedule(): any { ++state.eigenRequest; syncLabels(); syncEigenEnvironmentFromMain(); markEigenStale(); clearTimeout(debounce); debounce = setTimeout(recalculateEnvironment, 180); }
    function selectProfileFromControl(event: any): any {
        const previous: any = state.environmentMode;
        if (!activateProfile(event.target.value)) {
            controls.profile.value = previous;
            eigenEnvControls.profile.value = previous;
            return;
        }
        schedule();
        drawEigen();
    }
    listen(controls.profile, 'change', selectProfileFromControl);
    Object.entries(controls).filter(([key]: any): any => key !== 'profile').forEach(([, el]: any): any => listen(el, el.type === 'number' ? 'change' : 'input', schedule));
    Object.entries(bottomSliders).forEach(([key, slider]: any): any => {
        listen(slider, 'input', (): any => { controls[key].value = slider.value; });
        listen(slider, 'change', schedule);
        listen(controls[key], 'input', (): any => { slider.value = controls[key].value; });
    });
    Object.values(fieldControls).forEach((control: any): any => listen(control, 'change', (): any => { ++state.environmentRequest; clearTimeout(debounce); $('fieldOptionStatus').textContent = `正在应用 ${fieldControls.fieldMode.value} / ${fieldControls.beamType.value}…`; run(); }));
    listen(eigenEnvControls.profile, 'change', selectProfileFromControl);
    Object.entries(eigenEnvControls).filter(([key]: any): any => key !== 'profile').forEach(([key, el]: any): any => listen(el, el.type === 'number' ? 'change' : 'input', (): any => { controls[key].value = el.value; schedule(); drawEigen(); }));
    ['sspTableRows', 'eigenSSPTableRows'].forEach((id: any): any => { listen($(id), 'change', updateSSPTableCell); listen($(id), 'click', deleteSSPTableRow); });
    listen($('addSSPRow'), 'click', addSSPTableRow);
    listen($('eigenAddSSPRow'), 'click', addSSPTableRow);
    listen($('convertToCustomButton'), 'click', (): any => { ensureCustomSSP(); syncLabels(); syncEigenEnvironmentFromMain(); drawSSP(); schedule(); });
    listen($('sspCanvas'), 'pointerdown', (e: any): any => sspPointer(e));
    listen($('sspCanvas'), 'pointermove', (e: any): any => {
        if (state.sspDrag >= 0)
            sspPointer(e);
    });
    function finishSSPDrag(e: any): any {
        if (state.sspDrag < 0)
            return;
        sspPointer(e, true);
        state.sspDrag = -1;
        drawSSP();
    }
    listen($('sspCanvas'), 'pointerup', finishSSPDrag);
    listen($('sspCanvas'), 'pointercancel', finishSSPDrag);
    listen($('rayCanvas'), 'pointerdown', startSourceDrag);
    listen($('rayCanvas'), 'pointermove', moveSource);
    listen($('rayCanvas'), 'pointerup', finishSourceDrag);
    listen($('rayCanvas'), 'pointercancel', finishSourceDrag);
    listen($('runButton'), 'click', run);
    listen($('replayButton'), 'click', (): any => { drawRay(1); drawLoss(1); drawVelocity(1); });
    listen($('envImportButton'), 'click', (): any => $('envFileInput').click());
    listen($('envFileInput'), 'change', handleEnvImport);
    listen($('introReplay'), 'click', (): any => startIntroAnimation());
    listen(canvases.loss, 'mousemove', (e: any): any => {
        if (!state.data)
            return;
        const rect: any = e.target.getBoundingClientRect(), a: any = { l: 39, r: 12, t: 19, b: 28 };
        const px: any = Math.max(0, Math.min(1, (e.clientX - rect.left - a.l) / (rect.width - a.l - a.r))), py: any = Math.max(0, Math.min(1, (e.clientY - rect.top - a.t) / (rect.height - a.t - a.b)));
        const { cols, rows, values }: any = state.data.loss;
        const v: any = values[Math.min(rows - 1, Math.floor(py * rows)) * cols + Math.min(cols - 1, Math.floor(px * cols))];
        $('tlReadout').textContent = v.toFixed(1) + ' dB';
    });
    function bindVelocityReadout(canvas: any, key: any, readoutId: any): any {
        listen(canvas, 'mousemove', (event: any): any => {
            if (!state.data?.velocity)
                return;
            const rect: any = event.target.getBoundingClientRect(), a: any = { l: 39, r: 12, t: 19, b: 28 }, px: any = Math.max(0, Math.min(1, (event.clientX - rect.left - a.l) / (rect.width - a.l - a.r))), py: any = Math.max(0, Math.min(1, (event.clientY - rect.top - a.t) / (rect.height - a.t - a.b))), { cols, rows }: any = state.data.velocity, level: any = state.data.velocity[key][Math.min(rows - 1, Math.floor(py * rows)) * cols + Math.min(cols - 1, Math.floor(px * cols))], magnitude: any = Math.pow(10, -level / 20);
            $(readoutId).textContent = `${magnitude.toExponential(2)} · ${level.toFixed(1)} dB`;
        });
    }
    bindVelocityReadout(canvases.horizontalVelocity, 'horizontal_db', 'horizontalVelocityReadout');
    bindVelocityReadout(canvases.verticalVelocity, 'vertical_db', 'verticalVelocityReadout');
    listen(window, 'resize', (): any => { drawIntroRay(state.introProgress || 1); drawSSP(); drawEigenEnvironment(); drawRay(state.animation || 1); drawLoss(state.animation || 1); drawVelocity(state.animation || 1); });
    root.querySelectorAll('nav a').forEach((a: any): any => listen(a, 'click', (): any => { root.querySelectorAll('nav a').forEach((x: any): any => x.classList.remove('active')); a.classList.add('active'); }));
    listen($('eigenRun'), 'click', (): any => runEigen());
    listen($('receiverRange'), 'change', (): any => runEigen({ comparison: false }));
    listen($('receiverDepth'), 'change', (): any => runEigen({ comparison: false }));
    listen($('eigenTolerance'), 'change', (): any => runEigen({ comparison: false }));
    listen(canvases.eigen, 'pointerdown', startEigenInteraction);
    listen(canvases.eigen, 'pointermove', moveEigenInteraction);
    listen(canvases.eigen, 'pointerup', finishEigenInteraction);
    listen(canvases.eigen, 'pointercancel', finishEigenInteraction);
    listen(window, 'resize', (): any => { drawEigen(); drawArrivals(); });
    setImportedOptionAvailability();
    activateProfile('munk', { defaults: false });
    updateFieldOptionStatus();
    drawIntroRay(0);
    drawSSP();
    drawRay();
    drawLoss();
    drawVelocity();
    drawEigen();
    drawArrivals();
    startIntroAnimation(0);
    const ready: any = runtime.prepare().then(recalculateEnvironment).catch((error: any): any => {
        $('simStatus').textContent = 'WASM ERROR';
        $('simTime').textContent = error instanceof Error ? error.message : 'WASM LOAD FAILED';
    });
    return { ready, async dispose() { listenerScope.abort(); clearTimeout(debounce); cancelAnimationFrame(state.raf); cancelAnimationFrame(state.introRaf); state.request += 1; state.eigenRequest += 1; state.environmentRequest += 1; runtime.cancel('page disposed'); await runtime.dispose(); } };
}
