import {
  createNormalModeRuntime,
  type NormalModePageRequest,
  type NormalModePageResult,
  type NormalModeRuntime,
  type NormalModeSingleField,
} from "@ooa/runtime-normal-mode";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import {
  environmentPreset,
  normalizeProfilePoints,
  profilePointsForPreset,
  resampleProfilePoints,
  type ProfilePoint,
} from "../../shared-page/environment-presets";
import {
  renderNormalCanvases,
  selectedModeFromPointer,
  type NormalCanvasElements,
  type NormalSpectrumPlot,
} from "../canvas/normal-renderers";

export type NormalFieldView = "sum" | "single";
export type SolveStatus = "READY" | "SOLVING" | "COMPLETE" | "FAILED";
export type ImportStatusKind = "idle" | "busy" | "success" | "error";

export interface NormalPageParameters {
  readonly model: string;
  readonly profile: string;
  readonly environmentTitle: string | null;
  readonly frequencyHz: string;
  readonly sourceDepthM: string;
  readonly waterDepthM: string;
  readonly maximumRangeKm: string;
  readonly phaseSpeedLowMps: string;
  readonly phaseSpeedHighMps: string;
  readonly bottomSoundSpeedMps: string;
  readonly bottomDensityKgM3: string;
  readonly bottomAttenuationDbPerWavelength: string;
  readonly interpolation: string;
  readonly sourceId: string | null;
  readonly modeLimit: string;
}

export type NormalNumericParameter = Exclude<keyof NormalPageParameters,
  "model" | "profile" | "environmentTitle" | "interpolation" | "sourceId">;

export interface NormalRuntimeView {
  readonly mode: "loading" | "wasm" | "demo" | "error";
  readonly badge: string;
  readonly engine: string;
  readonly message: string;
  readonly resultSource: string;
}

export interface NormalImportView {
  readonly kind: ImportStatusKind;
  readonly message: string;
  readonly busy: boolean;
}

export interface NormalCanvasRefs {
  readonly ssp: RefObject<HTMLCanvasElement | null>;
  readonly spectrum: RefObject<HTMLCanvasElement | null>;
  readonly eigenfunction: RefObject<HTMLCanvasElement | null>;
  readonly field: RefObject<HTMLCanvasElement | null>;
  readonly delta: RefObject<HTMLCanvasElement | null>;
}

export interface UseNormalModePageResult {
  readonly parameters: NormalPageParameters;
  readonly profilePoints: readonly ProfilePoint[];
  readonly profileDescription: string;
  readonly profileMode: "custom" | "preset";
  readonly solveStatus: SolveStatus;
  readonly solveBusy: boolean;
  readonly importView: NormalImportView;
  readonly runtimeView: NormalRuntimeView;
  readonly result: NormalModePageResult | null;
  readonly selectedMode: number;
  readonly modeMaximum: number;
  readonly fieldView: NormalFieldView;
  readonly singleModeField: NormalModeSingleField | null;
  readonly canvases: NormalCanvasRefs;
  setProfile(profile: string): void;
  setNumericInput(parameter: NormalNumericParameter, value: string): void;
  commitNumericInput(parameter: NormalNumericParameter, value: string): void;
  commitWaterDepth(value: string): void;
  setBottomMaterial(parameter: NormalNumericParameter, value: string): void;
  commitBottomMaterial(parameter: NormalNumericParameter, value: string): void;
  setSelectedMode(modeNumber: number): void;
  setFieldView(view: NormalFieldView): void;
  updateProfilePoint(index: number, field: "depth" | "speed", value: string): void;
  deleteProfilePoint(index: number): void;
  addProfilePoint(): void;
  importEnvironmentFiles(files: FileList): Promise<void>;
  run(): Promise<void>;
  selectModeFromSpectrum(event: ReactPointerEvent<HTMLCanvasElement>): void;
}

export interface UseNormalModePageOptions {
  readonly demonstration: boolean;
  readonly createRuntime?: () => NormalModeRuntime;
}

const DEFAULT_IMPORT_MESSAGE = "支持 Kraken .env、同名 .flp 与统一环境 JSON；文件仅在本机浏览器中解析。";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Number(value)));
}

function number(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function initialParameters(): NormalPageParameters {
  const preset = environmentPreset("pekeris");
  return {
    model: "kraken",
    profile: "pekeris",
    environmentTitle: null,
    frequencyHz: String(preset.frequencyHz),
    sourceDepthM: String(preset.sourceDepthM),
    waterDepthM: String(preset.waterDepthM),
    maximumRangeKm: String(preset.maximumRangeKm),
    phaseSpeedLowMps: String(preset.phaseSpeedLowMps),
    phaseSpeedHighMps: String(preset.phaseSpeedHighMps),
    bottomSoundSpeedMps: String(preset.bottomSoundSpeedMps),
    bottomDensityKgM3: String(preset.bottomDensityKgM3),
    bottomAttenuationDbPerWavelength: String(preset.bottomAttenuationDbPerWavelength),
    interpolation: "linear",
    sourceId: null,
    modeLimit: "24",
  };
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error.trim();
  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") return serialized;
  } catch {
    // Fall through to the user-facing parser error.
  }
  return "未能识别文件内容，请同时选择同名的 Kraken ENV/FLP，或选择一个环境 JSON。";
}

function unknownArray(record: Readonly<Record<string, unknown>>, key: string): readonly unknown[] {
  const value = record[key];
  return Array.isArray(value) ? value : [];
}

function bathymetryVaries(points: readonly unknown[]): boolean {
  if (points.length < 2) return false;
  const first = points[0];
  const firstDepth = Array.isArray(first) ? number(first[1], Number.NaN) : Number.NaN;
  return Number.isFinite(firstDepth) && points.some((point) => (
    Array.isArray(point) && Math.abs(number(point[1], firstDepth) - firstDepth) > 1e-6
  ));
}

function runtimeView(result: NormalModePageResult): NormalRuntimeView {
  const isWasm = result.runtime.mode === "wasm";
  return {
    mode: isWasm ? "wasm" : "demo",
    badge: isWasm ? "WASM ACTIVE" : "DEMO FALLBACK",
    engine: result.runtime.engine || (isWasm ? "NORMAL MODE WASM" : "DEMO FALLBACK"),
    message: isWasm
      ? "Normal Mode 正在浏览器 Web Worker / WebAssembly 中计算，输入和结果不会上传到服务器。"
      : `WASM SDK 尚未生效：${result.runtime.warning || "backend unavailable"}。当前显示确定性的演示数据，不能用于工程计算。`,
    resultSource: isWasm ? "OOB WASM" : "DEMO",
  };
}

function pointsFor(parameters: NormalPageParameters, customSSP: readonly ProfilePoint[]): ProfilePoint[] {
  return profilePointsForPreset(
    parameters.profile,
    clamp(number(parameters.waterDepthM, 200), 50, 8000),
    customSSP,
  );
}

function requestFor(parameters: NormalPageParameters, customSSP: readonly ProfilePoint[]): NormalModePageRequest {
  const waterDepthM = clamp(number(parameters.waterDepthM, 200), 50, 8000);
  return {
    contractVersion: 1,
    model: parameters.model,
    profile: parameters.profile,
    environmentTitle: parameters.environmentTitle,
    sspPoints: profilePointsForPreset(parameters.profile, waterDepthM, customSSP),
    frequencyHz: clamp(number(parameters.frequencyHz, 100), 10, 1000),
    sourceDepthM: clamp(number(parameters.sourceDepthM, 50), 1, waterDepthM - 1),
    waterDepthM,
    maximumRangeKm: clamp(number(parameters.maximumRangeKm, 20), 2, 250),
    phaseSpeedLowMps: number(parameters.phaseSpeedLowMps, 1400),
    phaseSpeedHighMps: number(parameters.phaseSpeedHighMps, 1700),
    bottomSoundSpeedMps: clamp(number(parameters.bottomSoundSpeedMps, 1700), 1400, 3000),
    bottomDensityRelative: clamp(number(parameters.bottomDensityKgM3, 1800) / 1000, 1, 3.5),
    bottomAttenuationDbPerWavelength: clamp(number(parameters.bottomAttenuationDbPerWavelength, 0.5), 0, 5),
    interpolation: parameters.interpolation,
    sourceId: parameters.profile === "custom" ? parameters.sourceId : null,
    modeLimit: number(parameters.modeLimit, 24),
    rangeCount: 161,
    depthCount: 121,
  };
}

export function useNormalModePage(options: UseNormalModePageOptions): UseNormalModePageResult {
  const [parameters, setParameters] = useState<NormalPageParameters>(initialParameters);
  const parametersRef = useRef(parameters);
  const [customSSP, setCustomSSP] = useState<readonly ProfilePoint[]>(() => profilePointsForPreset("custom", 5000));
  const customSSPRef = useRef(customSSP);
  const [customProfileDescription, setCustomProfileDescription] = useState(environmentPreset("custom").description);
  const [result, setResult] = useState<NormalModePageResult | null>(null);
  const [selectedMode, setSelectedModeState] = useState(0);
  const [fieldView, setFieldViewState] = useState<NormalFieldView>("sum");
  const [solveStatus, setSolveStatus] = useState<SolveStatus>("READY");
  const [solveBusy, setSolveBusy] = useState(false);
  const [importView, setImportView] = useState<NormalImportView>({ kind: "idle", message: DEFAULT_IMPORT_MESSAGE, busy: false });
  const [runtimeState, setRuntimeState] = useState<NormalRuntimeView>({
    mode: "loading",
    badge: "WASM LOADING",
    engine: "WASM LOADING",
    message: "正在加载本地 Kraken WebAssembly Runtime；输入和结果不会上传到服务器。",
    resultSource: "—",
  });
  const runtimeRef = useRef<NormalModeRuntime | null>(null);
  const mountedRef = useRef(false);
  const requestRef = useRef(0);
  const spectrumPlotRef = useRef<NormalSpectrumPlot | null>(null);
  const ssp = useRef<HTMLCanvasElement>(null);
  const spectrum = useRef<HTMLCanvasElement>(null);
  const eigenfunction = useRef<HTMLCanvasElement>(null);
  const field = useRef<HTMLCanvasElement>(null);
  const delta = useRef<HTMLCanvasElement>(null);

  const setParameterSnapshot = useCallback((next: NormalPageParameters) => {
    parametersRef.current = next;
    setParameters(next);
  }, []);

  const setCustomSnapshot = useCallback((next: readonly ProfilePoint[]) => {
    customSSPRef.current = next;
    setCustomSSP(next);
  }, []);

  const calculateWith = useCallback(async (runtime: NormalModeRuntime): Promise<void> => {
    const token = ++requestRef.current;
    setSolveBusy(true);
    setSolveStatus("SOLVING");
    try {
      const nextResult = await runtime.run(requestFor(parametersRef.current, customSSPRef.current));
      if (!mountedRef.current || token !== requestRef.current) return;
      setResult(nextResult);
      const maximum = Math.max(1, nextResult.modes.count);
      const nextParameters = {
        ...parametersRef.current,
        modeLimit: String(Math.min(maximum, number(parametersRef.current.modeLimit, 24))),
      };
      setParameterSnapshot(nextParameters);
      setSelectedModeState((current) => Math.round(clamp(current + 1, 1, maximum)) - 1);
      setRuntimeState(runtimeView(nextResult));
      setSolveStatus("COMPLETE");
    } catch (error) {
      if (!mountedRef.current || token !== requestRef.current) return;
      setSolveStatus("FAILED");
      setRuntimeState((current) => ({
        ...current,
        mode: "error",
        message: `计算失败：${error instanceof Error ? error.message : String(error)}`,
      }));
    } finally {
      if (mountedRef.current && token === requestRef.current) setSolveBusy(false);
    }
  }, [setParameterSnapshot]);

  const run = useCallback(async (): Promise<void> => {
    const runtime = runtimeRef.current;
    if (runtime !== null) await calculateWith(runtime);
  }, [calculateWith]);

  useEffect(() => {
    mountedRef.current = true;
    const runtime = options.createRuntime?.() ?? createNormalModeRuntime({ demonstration: options.demonstration });
    runtimeRef.current = runtime;
    const initialize = async () => {
      try {
        await runtime.prepare();
        if (mountedRef.current && runtimeRef.current === runtime) await calculateWith(runtime);
      } catch (error) {
        if (!mountedRef.current || runtimeRef.current !== runtime) return;
        setSolveStatus("FAILED");
        setSolveBusy(false);
        setRuntimeState((current) => ({
          ...current,
          mode: "error",
          message: `WASM 加载失败：${error instanceof Error ? error.message : String(error)}`,
        }));
      }
    };
    void initialize();
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
      if (runtimeRef.current === runtime) runtimeRef.current = null;
      runtime.cancel("page disposed");
      void runtime.dispose();
    };
  }, [calculateWith, options.createRuntime, options.demonstration]);

  const singleModeField = useMemo(() => {
    const runtime = runtimeRef.current;
    if (fieldView !== "single" || result === null || runtime === null) return null;
    try {
      return runtime.singleModeField(result.experimentId, selectedMode);
    } catch {
      return null;
    }
  }, [fieldView, result, selectedMode]);

  const render = useCallback(() => {
    if (result === null || ssp.current === null || spectrum.current === null
      || eigenfunction.current === null || field.current === null || delta.current === null) return;
    const canvases: NormalCanvasElements = {
      ssp: ssp.current,
      spectrum: spectrum.current,
      eigenfunction: eigenfunction.current,
      field: field.current,
      delta: delta.current,
    };
    spectrumPlotRef.current = renderNormalCanvases(canvases, {
      result,
      selectedMode,
      fieldView,
      singleModeField,
    });
  }, [fieldView, result, selectedMode, singleModeField]);

  useLayoutEffect(render, [render]);
  useEffect(() => {
    window.addEventListener("resize", render);
    return () => window.removeEventListener("resize", render);
  }, [render]);

  const setNumericInput = useCallback((parameter: NormalNumericParameter, value: string) => {
    setParameterSnapshot({ ...parametersRef.current, [parameter]: value });
  }, [setParameterSnapshot]);

  const commitNumericInput = useCallback((parameter: NormalNumericParameter, value: string) => {
    setParameterSnapshot({ ...parametersRef.current, [parameter]: value });
    void run();
  }, [run, setParameterSnapshot]);

  const commitWaterDepth = useCallback((value: string) => {
    const waterDepthM = clamp(number(value, 200), 50, 8000);
    const sourceDepthM = clamp(number(parametersRef.current.sourceDepthM, 50), 1, waterDepthM - 1);
    setParameterSnapshot({
      ...parametersRef.current,
      waterDepthM: String(waterDepthM),
      sourceDepthM: String(sourceDepthM),
    });
    if (parametersRef.current.profile === "custom") {
      setCustomSnapshot(normalizeProfilePoints(customSSPRef.current, waterDepthM));
    }
    void run();
  }, [run, setCustomSnapshot, setParameterSnapshot]);

  const setBottomMaterial = useCallback((parameter: NormalNumericParameter, value: string) => {
    setNumericInput(parameter, value);
  }, [setNumericInput]);

  const commitBottomMaterial = useCallback((parameter: NormalNumericParameter, value: string) => {
    const limits: Partial<Record<NormalNumericParameter, readonly [number, number, number]>> = {
      bottomSoundSpeedMps: [1400, 3000, 1700],
      bottomDensityKgM3: [1000, 3500, 1800],
      bottomAttenuationDbPerWavelength: [0, 5, 0.5],
    };
    const limit = limits[parameter];
    const normalized = limit === undefined ? value : String(clamp(number(value, limit[2]), limit[0], limit[1]));
    setParameterSnapshot({ ...parametersRef.current, [parameter]: normalized });
    void run();
  }, [run, setParameterSnapshot]);

  const setProfile = useCallback((profile: string) => {
    const preset = environmentPreset(profile);
    const next: NormalPageParameters = {
      ...parametersRef.current,
      profile,
      environmentTitle: null,
      frequencyHz: String(preset.frequencyHz),
      sourceDepthM: String(preset.sourceDepthM),
      waterDepthM: String(preset.waterDepthM),
      maximumRangeKm: String(preset.maximumRangeKm),
      phaseSpeedLowMps: String(preset.phaseSpeedLowMps),
      phaseSpeedHighMps: String(preset.phaseSpeedHighMps),
      bottomSoundSpeedMps: String(preset.bottomSoundSpeedMps),
      bottomDensityKgM3: String(preset.bottomDensityKgM3),
      bottomAttenuationDbPerWavelength: String(preset.bottomAttenuationDbPerWavelength),
      interpolation: "linear",
      sourceId: null,
    };
    setParameterSnapshot(next);
    void run();
  }, [run, setParameterSnapshot]);

  const displayedProfilePoints = useMemo(() => {
    const raw = pointsFor(parameters, customSSP);
    return parameters.profile === "custom"
      ? raw
      : resampleProfilePoints(raw, number(parameters.waterDepthM, 200), 500);
  }, [customSSP, parameters]);

  const convertToCustom = useCallback((points: readonly ProfilePoint[]): NormalPageParameters => {
    const next = { ...parametersRef.current, profile: "custom", sourceId: null };
    setParameterSnapshot(next);
    setCustomProfileDescription(environmentPreset("custom").description);
    setCustomSnapshot(points.map((point) => [...point] as ProfilePoint));
    return next;
  }, [setCustomSnapshot, setParameterSnapshot]);

  const updateProfilePoint = useCallback((index: number, fieldName: "depth" | "speed", value: string) => {
    const points = pointsFor(parametersRef.current, customSSPRef.current).map((point) => [...point] as [number, number]);
    if (parametersRef.current.profile !== "custom") convertToCustom(points);
    const point = points[index];
    if (point === undefined) return;
    point[fieldName === "depth" ? 0 : 1] = number(value, 0);
    setCustomSnapshot(normalizeProfilePoints(points, number(parametersRef.current.waterDepthM, 200)));
    void run();
  }, [convertToCustom, run, setCustomSnapshot]);

  const deleteProfilePoint = useCallback((index: number) => {
    const points = displayedProfilePoints.map((point) => [...point] as ProfilePoint);
    if (points.length <= 2) return;
    if (parametersRef.current.profile !== "custom") convertToCustom(points);
    points.splice(index, 1);
    setCustomSnapshot(normalizeProfilePoints(points, number(parametersRef.current.waterDepthM, 200)));
    void run();
  }, [convertToCustom, displayedProfilePoints, run, setCustomSnapshot]);

  const addProfilePoint = useCallback(() => {
    const points = displayedProfilePoints.map((point) => [...point] as [number, number]);
    if (parametersRef.current.profile !== "custom") convertToCustom(points);
    let insertion = 1;
    let widestGap = -1;
    for (let index = 1; index < points.length; index += 1) {
      const left = points[index - 1];
      const right = points[index];
      if (left === undefined || right === undefined) continue;
      const gap = right[0] - left[0];
      if (gap > widestGap) {
        widestGap = gap;
        insertion = index;
      }
    }
    const left = points[insertion - 1];
    const right = points[insertion];
    if (left === undefined || right === undefined) return;
    points.splice(insertion, 0, [(left[0] + right[0]) / 2, (left[1] + right[1]) / 2]);
    setCustomSnapshot(points);
    void run();
  }, [convertToCustom, displayedProfilePoints, run, setCustomSnapshot]);

  const importEnvironmentFiles = useCallback(async (files: FileList): Promise<void> => {
    const selectedFiles = Array.from(files);
    const runtime = runtimeRef.current;
    if (selectedFiles.length === 0 || runtime === null) return;
    setImportView({ kind: "busy", message: `正在解析 ${selectedFiles.length} 个环境文件…`, busy: true });
    try {
      const imported = await runtime.importEnvironment(selectedFiles);
      const record: Readonly<Record<string, unknown>> = imported;
      if (imported.profilePoints.length < 2) {
        throw new Error("环境文件中没有找到至少两个有效的声速剖面节点。Kraken ENV 必须与同名 FLP 一起选择。");
      }
      const bathymetry = unknownArray(record, "bathymetry");
      const deepestProfilePoint = Math.max(...imported.profilePoints.map((point) => number(point[0], 0)));
      const firstBathymetry = bathymetry[0];
      const firstBathymetryDepth = Array.isArray(firstBathymetry) ? number(firstBathymetry[1], 0) : 0;
      const waterDepthM = clamp(number(imported.waterDepthM, firstBathymetryDepth || deepestProfilePoint || 200), 50, 8000);
      const title = String(imported.title || selectedFiles[0]?.name || "用户环境");
      const format = String(record.format || selectedFiles[0]?.name.split(".").pop() || "ENV").toUpperCase();
      const interpolation = String(record.interpolation || "LINEAR").toUpperCase() === "SQUARED_SLOWNESS_LINEAR"
        ? "squared-slowness-linear"
        : "linear";
      const normalized = normalizeProfilePoints(imported.profilePoints, waterDepthM);
      const next: NormalPageParameters = {
        ...parametersRef.current,
        profile: "custom",
        environmentTitle: title,
        frequencyHz: String(clamp(number(imported.frequencyHz, 100), 10, 1000)),
        sourceDepthM: String(clamp(number(imported.sourceDepthM, 50), 1, waterDepthM - 1)),
        waterDepthM: String(waterDepthM),
        maximumRangeKm: String(clamp(number(imported.maximumRangeKm, 20), 2, 250)),
        phaseSpeedLowMps: String(clamp(number(record.phaseSpeedLowMps, number(parametersRef.current.phaseSpeedLowMps, 1400)), 1300, 1900)),
        phaseSpeedHighMps: String(clamp(number(record.phaseSpeedHighMps, number(parametersRef.current.phaseSpeedHighMps, 1700)), 1400, 2400)),
        bottomSoundSpeedMps: String(clamp(number(record.bottomSoundSpeedMps, 1700), 1400, 3000)),
        bottomDensityKgM3: String(clamp(number(record.bottomDensityKgM3, 1800), 1000, 3500)),
        bottomAttenuationDbPerWavelength: String(clamp(number(record.bottomAttenuationDbPerWavelength, 0.5), 0, 5)),
        interpolation,
        sourceId: imported.sourceId || null,
      };
      setParameterSnapshot(next);
      setCustomSnapshot(normalized);
      setCustomProfileDescription(`已导入 ${title} · ${format} · ${normalized.length} 个 SSP 节点`);
      const receiverRanges = unknownArray(record, "receiverRangesM");
      const receiverDepths = unknownArray(record, "receiverDepthsM");
      const bathymetryNote = record.format === "kraken-env-flp"
        ? ` · 原生 Kraken 解析 · ${receiverRanges.length}×${receiverDepths.length} FLP 网格`
        : bathymetryVaries(bathymetry) ? " · NM 按入口水深建立距离无关波导" : "";
      setImportView({
        kind: "success",
        message: `已导入：${title} · ${format} · ${selectedFiles.length} 个文件${bathymetryNote}`,
        busy: false,
      });
      await calculateWith(runtime);
    } catch (error) {
      setImportView({ kind: "error", message: `导入失败：${describeError(error)}`, busy: false });
    }
  }, [calculateWith, setCustomSnapshot, setParameterSnapshot]);

  const selectModeFromSpectrum = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (result === null || spectrumPlotRef.current === null) return;
    setSelectedModeState(selectedModeFromPointer(event.currentTarget, event, spectrumPlotRef.current, result.modes.count));
  }, [result]);

  return {
    parameters,
    profilePoints: displayedProfilePoints,
    profileDescription: parameters.profile === "custom"
      ? customProfileDescription
      : environmentPreset(parameters.profile).description,
    profileMode: parameters.profile === "custom" ? "custom" : "preset",
    solveStatus,
    solveBusy,
    importView,
    runtimeView: runtimeState,
    result,
    selectedMode,
    modeMaximum: Math.max(1, result?.modes.count ?? 100),
    fieldView,
    singleModeField,
    canvases: { ssp, spectrum, eigenfunction, field, delta },
    setProfile,
    setNumericInput,
    commitNumericInput,
    commitWaterDepth,
    setBottomMaterial,
    commitBottomMaterial,
    setSelectedMode: (modeNumber) => setSelectedModeState(Math.round(clamp(modeNumber, 1, Math.max(1, result?.modes.count ?? 100))) - 1),
    setFieldView: setFieldViewState,
    updateProfilePoint,
    deleteProfilePoint,
    addProfilePoint,
    importEnvironmentFiles,
    run,
    selectModeFromSpectrum,
  };
}

export function isCommitChange(event: ChangeEvent<HTMLInputElement>): boolean {
  return event.nativeEvent.type === "change";
}
