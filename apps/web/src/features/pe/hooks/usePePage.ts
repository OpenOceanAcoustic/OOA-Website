import {
  createPeRuntime,
  type PeImportedEnvironment,
  type PePageRequest,
  type PePageResult,
  type PeRuntime,
  type PeVerticalProfile,
} from "@ooa/runtime-pe";
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
  padeFromPointer,
  renderPeCanvases,
  type PeCanvasElements,
  type PeConvergencePlot,
} from "../canvas/pe-renderers";

export type PeSolveStatus = "READY" | "MARCHING" | "COMPLETE" | "FAILED";
export type PeImportStatusKind = "idle" | "busy" | "success" | "error";

export interface PePageParameters {
  readonly model: string;
  readonly profile: string;
  readonly environmentTitle: string | null;
  readonly frequencyHz: string;
  readonly sourceDepthM: string;
  readonly waterDepthM: string;
  readonly maximumRangeKm: string;
  readonly maximumDepthM: string;
  readonly rangeStepM: string;
  readonly depthStepM: string;
  readonly bottomSoundSpeedMps: string;
  readonly bottomDensityKgM3: string;
  readonly bottomAttenuationDbPerWavelength: string;
  readonly sourceId: string | null;
  readonly nPade: string;
  readonly inspectRangeKm: string;
}

export type PeNumericParameter = Exclude<keyof PePageParameters,
  "model" | "profile" | "environmentTitle" | "sourceId">;

export interface PeRuntimeView {
  readonly mode: "loading" | "wasm" | "demo" | "error";
  readonly badge: string;
  readonly engine: string;
  readonly message: string;
  readonly resultSource: string;
}

export interface PeImportView {
  readonly kind: PeImportStatusKind;
  readonly message: string;
  readonly busy: boolean;
}

export interface PeCanvasRefs {
  readonly ssp: RefObject<HTMLCanvasElement | null>;
  readonly field: RefObject<HTMLCanvasElement | null>;
  readonly delta: RefObject<HTMLCanvasElement | null>;
  readonly convergence: RefObject<HTMLCanvasElement | null>;
  readonly profile: RefObject<HTMLCanvasElement | null>;
}

interface ImportedPeMetadata {
  readonly title: string;
  readonly format: string;
  readonly bathymetry: readonly ProfilePoint[];
  readonly sourceId: string | null;
  readonly mediumSectionCount: number;
  readonly receiverDepthCount: number;
}

export interface UsePePageResult {
  readonly parameters: PePageParameters;
  readonly profilePoints: readonly ProfilePoint[];
  readonly profileDescription: string;
  readonly profileMode: "custom" | "preset";
  readonly solveStatus: PeSolveStatus;
  readonly solveBusy: boolean;
  readonly importView: PeImportView;
  readonly runtimeView: PeRuntimeView;
  readonly result: PePageResult | null;
  readonly profileResult: PeVerticalProfile | null;
  readonly canvases: PeCanvasRefs;
  setProfile(profile: string): void;
  setNumericInput(parameter: PeNumericParameter, value: string): void;
  commitNumericInput(parameter: PeNumericParameter, value: string): void;
  commitWaterDepth(value: string): void;
  setBottomMaterial(parameter: PeNumericParameter, value: string): void;
  commitBottomMaterial(parameter: PeNumericParameter, value: string): void;
  selectPade(nPade: number): Promise<void>;
  setInspectRange(value: string): void;
  updateProfilePoint(index: number, field: "depth" | "speed", value: string): void;
  deleteProfilePoint(index: number): void;
  addProfilePoint(): void;
  importEnvironmentFiles(files: FileList): Promise<void>;
  run(): Promise<void>;
  selectPadeFromConvergence(event: ReactPointerEvent<HTMLCanvasElement>): void;
}

export interface UsePePageOptions {
  readonly demonstration: boolean;
  readonly createRuntime?: () => PeRuntime;
}

const DEFAULT_IMPORT_MESSAGE = "支持 RAM .in 与统一环境 JSON；文件仅在本机浏览器中解析。";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Number(value)));
}

function number(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function format(value: number, digits = 3): string {
  return Number(value).toLocaleString("zh-CN", { maximumFractionDigits: digits });
}

function initialParameters(): PePageParameters {
  const preset = environmentPreset("pekeris");
  return {
    model: "ram",
    profile: "pekeris",
    environmentTitle: null,
    frequencyHz: String(preset.frequencyHz),
    sourceDepthM: String(preset.sourceDepthM),
    waterDepthM: String(preset.waterDepthM),
    maximumRangeKm: String(preset.maximumRangeKm),
    maximumDepthM: String(preset.maximumDepthM),
    rangeStepM: String(preset.rangeStepM),
    depthStepM: String(preset.depthStepM),
    bottomSoundSpeedMps: String(preset.bottomSoundSpeedMps),
    bottomDensityKgM3: String(preset.bottomDensityKgM3),
    bottomAttenuationDbPerWavelength: preset.bottomAttenuationDbPerWavelength.toFixed(2),
    sourceId: null,
    nPade: "4",
    inspectRangeKm: "18",
  };
}

function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error.trim();
  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") return serialized;
  } catch {
    // Fall through to the stable parser error.
  }
  return "未能识别文件内容，请选择一个 RAM .in 文件或一个环境 JSON。";
}

function bathymetryVaries(bathymetry: readonly ProfilePoint[]): boolean {
  const first = bathymetry[0];
  return first !== undefined && bathymetry.length > 1
    && bathymetry.some((point) => Math.abs(point[1] - first[1]) > 1e-6);
}

function runtimeView(result: PePageResult): PeRuntimeView {
  const isWasm = result.runtime.mode === "wasm";
  return {
    mode: isWasm ? "wasm" : "demo",
    badge: isWasm ? "WASM ACTIVE" : "DEMO FALLBACK",
    engine: result.runtime.engine || (isWasm ? "PE WASM" : "DEMO FALLBACK"),
    message: isWasm
      ? "PE 正在浏览器 Web Worker / WebAssembly 中推进，环境参数和场结果不会上传到服务器。"
      : `WASM SDK 尚未生效：${result.runtime.warning || "backend unavailable"}。当前数据只演示 nPade 交互与图表，不能用于工程计算。`,
    resultSource: isWasm ? "OOB WASM" : "DEMO",
  };
}

function requestFor(
  parameters: PePageParameters,
  customSSP: readonly ProfilePoint[],
  imported: ImportedPeMetadata | null,
): PePageRequest {
  const waterDepthM = clamp(number(parameters.waterDepthM, 200), 50, 8000);
  const maximumDepthM = clamp(number(parameters.maximumDepthM, 300), waterDepthM, 10000);
  return {
    contractVersion: 1,
    model: parameters.model,
    profile: parameters.profile,
    environmentTitle: imported?.title ?? null,
    sspPoints: profilePointsForPreset(parameters.profile, waterDepthM, customSSP),
    frequencyHz: clamp(number(parameters.frequencyHz, 100), 10, 1000),
    sourceDepthM: clamp(number(parameters.sourceDepthM, 50), 1, waterDepthM - 1),
    waterDepthM,
    maximumRangeKm: clamp(number(parameters.maximumRangeKm, 20), 2, 250),
    maximumDepthM,
    rangeStepM: clamp(number(parameters.rangeStepM, 25), 1, 100),
    depthStepM: clamp(number(parameters.depthStepM, 2), 0.25, 20),
    bottomSoundSpeedMps: clamp(number(parameters.bottomSoundSpeedMps, 1700), 1400, 3000),
    bottomDensityKgM3: clamp(number(parameters.bottomDensityKgM3, 1800), 1000, 3500),
    bottomAttenuationDbPerWavelength: clamp(number(parameters.bottomAttenuationDbPerWavelength, 0.5), 0, 5),
    bathymetry: parameters.profile === "custom" ? imported?.bathymetry ?? null : null,
    sourceId: parameters.profile === "custom" ? imported?.sourceId ?? null : null,
    nPade: Math.round(clamp(number(parameters.nPade, 4), 1, 10)),
    referenceNPade: 10,
    rangeCount: 181,
    depthCount: 131,
  };
}

export function usePePage(options: UsePePageOptions): UsePePageResult {
  const [parameters, setParameters] = useState<PePageParameters>(initialParameters);
  const parametersRef = useRef(parameters);
  const [customSSP, setCustomSSP] = useState<readonly ProfilePoint[]>(() => profilePointsForPreset("custom", 5000));
  const customSSPRef = useRef(customSSP);
  const [imported, setImported] = useState<ImportedPeMetadata | null>(null);
  const importedRef = useRef(imported);
  const [result, setResult] = useState<PePageResult | null>(null);
  const [profileResult, setProfileResult] = useState<PeVerticalProfile | null>(null);
  const profileCacheRef = useRef(new Map<string, PeVerticalProfile>());
  const [solveStatus, setSolveStatus] = useState<PeSolveStatus>("READY");
  const [solveBusy, setSolveBusy] = useState(false);
  const [importView, setImportView] = useState<PeImportView>({ kind: "idle", message: DEFAULT_IMPORT_MESSAGE, busy: false });
  const [runtimeState, setRuntimeState] = useState<PeRuntimeView>({
    mode: "loading",
    badge: "WASM LOADING",
    engine: "WASM LOADING",
    message: "正在加载本地 RAM WebAssembly Runtime；输入和结果不会上传到服务器。",
    resultSource: "—",
  });
  const runtimeRef = useRef<PeRuntime | null>(null);
  const mountedRef = useRef(false);
  const requestRef = useRef(0);
  const convergencePlotRef = useRef<PeConvergencePlot | null>(null);
  const ssp = useRef<HTMLCanvasElement>(null);
  const field = useRef<HTMLCanvasElement>(null);
  const delta = useRef<HTMLCanvasElement>(null);
  const convergence = useRef<HTMLCanvasElement>(null);
  const profile = useRef<HTMLCanvasElement>(null);

  const setParameterSnapshot = useCallback((next: PePageParameters) => {
    parametersRef.current = next;
    setParameters(next);
  }, []);
  const setCustomSnapshot = useCallback((next: readonly ProfilePoint[]) => {
    customSSPRef.current = next;
    setCustomSSP(next);
  }, []);
  const setImportedSnapshot = useCallback((next: ImportedPeMetadata | null) => {
    importedRef.current = next;
    setImported(next);
  }, []);

  const verticalProfile = useCallback((runtime: PeRuntime, nextResult: PePageResult, rangeKm: number): PeVerticalProfile => {
    const key = `${nextResult.experimentId}:${rangeKm}`;
    const cached = profileCacheRef.current.get(key);
    if (cached !== undefined) return cached;
    const created = runtime.verticalProfile(nextResult.experimentId, rangeKm);
    const normalizedKey = `${nextResult.experimentId}:${created.rangeKm}`;
    profileCacheRef.current.set(key, created);
    profileCacheRef.current.set(normalizedKey, created);
    return created;
  }, []);

  const acceptResult = useCallback((runtime: PeRuntime, nextResult: PePageResult) => {
    const maximumRangeKm = nextResult.parameters.maximumRangeKm;
    const inspectRangeKm = clamp(number(parametersRef.current.inspectRangeKm, maximumRangeKm * 0.6), 0, maximumRangeKm);
    const nextParameters = {
      ...parametersRef.current,
      nPade: String(nextResult.parameters.nPade),
      inspectRangeKm: String(inspectRangeKm),
    };
    setParameterSnapshot(nextParameters);
    setResult(nextResult);
    setProfileResult(verticalProfile(runtime, nextResult, inspectRangeKm));
    setRuntimeState(runtimeView(nextResult));
  }, [setParameterSnapshot, verticalProfile]);

  const calculateWith = useCallback(async (runtime: PeRuntime): Promise<void> => {
    const token = ++requestRef.current;
    setSolveBusy(true);
    setSolveStatus("MARCHING");
    try {
      const nextResult = await runtime.run(requestFor(parametersRef.current, customSSPRef.current, importedRef.current));
      if (!mountedRef.current || token !== requestRef.current) return;
      acceptResult(runtime, nextResult);
      setSolveStatus("COMPLETE");
    } catch (error) {
      if (!mountedRef.current || token !== requestRef.current) return;
      setSolveStatus("FAILED");
      setRuntimeState((current) => ({ ...current, mode: "error", message: `计算失败：${error instanceof Error ? error.message : String(error)}` }));
    } finally {
      if (mountedRef.current && token === requestRef.current) setSolveBusy(false);
    }
  }, [acceptResult]);

  const run = useCallback(async () => {
    const runtime = runtimeRef.current;
    if (runtime !== null) await calculateWith(runtime);
  }, [calculateWith]);

  useEffect(() => {
    mountedRef.current = true;
    const runtime = options.createRuntime?.() ?? createPeRuntime({ demonstration: options.demonstration });
    runtimeRef.current = runtime;
    const initialize = async () => {
      try {
        await runtime.prepare();
        if (mountedRef.current && runtimeRef.current === runtime) await calculateWith(runtime);
      } catch (error) {
        if (!mountedRef.current || runtimeRef.current !== runtime) return;
        setSolveStatus("FAILED");
        setSolveBusy(false);
        setRuntimeState((current) => ({ ...current, mode: "error", message: `WASM 加载失败：${error instanceof Error ? error.message : String(error)}` }));
      }
    };
    void initialize();
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
      if (runtimeRef.current === runtime) runtimeRef.current = null;
      runtime.cancel("page disposed");
      profileCacheRef.current.clear();
      void runtime.dispose();
    };
  }, [calculateWith, options.createRuntime, options.demonstration]);

  const inspectRangeKm = result === null
    ? number(parameters.inspectRangeKm, 18)
    : clamp(number(parameters.inspectRangeKm, 18), 0, result.parameters.maximumRangeKm);

  const render = useCallback(() => {
    if (result === null || profileResult === null || ssp.current === null || field.current === null
      || delta.current === null || convergence.current === null || profile.current === null) return;
    const canvases: PeCanvasElements = {
      ssp: ssp.current,
      field: field.current,
      delta: delta.current,
      convergence: convergence.current,
      profile: profile.current,
    };
    convergencePlotRef.current = renderPeCanvases(canvases, result, inspectRangeKm, profileResult);
  }, [inspectRangeKm, profileResult, result]);

  useLayoutEffect(render, [render]);
  useEffect(() => {
    window.addEventListener("resize", render);
    return () => window.removeEventListener("resize", render);
  }, [render]);

  const setNumericInput = useCallback((parameter: PeNumericParameter, value: string) => {
    setParameterSnapshot({ ...parametersRef.current, [parameter]: value });
  }, [setParameterSnapshot]);

  const commitNumericInput = useCallback((parameter: PeNumericParameter, value: string) => {
    setParameterSnapshot({ ...parametersRef.current, [parameter]: value });
    void run();
  }, [run, setParameterSnapshot]);

  const commitWaterDepth = useCallback((value: string) => {
    const waterDepthM = clamp(number(value, 200), 50, 8000);
    setParameterSnapshot({
      ...parametersRef.current,
      waterDepthM: String(waterDepthM),
      sourceDepthM: String(clamp(number(parametersRef.current.sourceDepthM, 50), 1, waterDepthM - 1)),
      maximumDepthM: String(Math.max(waterDepthM, number(parametersRef.current.maximumDepthM, 300))),
    });
    if (parametersRef.current.profile === "custom") setCustomSnapshot(normalizeProfilePoints(customSSPRef.current, waterDepthM));
    void run();
  }, [run, setCustomSnapshot, setParameterSnapshot]);

  const commitBottomMaterial = useCallback((parameter: PeNumericParameter, value: string) => {
    const limits: Partial<Record<PeNumericParameter, readonly [number, number, number, number]>> = {
      bottomSoundSpeedMps: [1400, 3000, 1700, 0],
      bottomDensityKgM3: [1000, 3500, 1800, 0],
      bottomAttenuationDbPerWavelength: [0, 5, 0.5, 2],
    };
    const limit = limits[parameter];
    const bounded = limit === undefined ? number(value, 0) : clamp(number(value, limit[2]), limit[0], limit[1]);
    const normalized = limit !== undefined && limit[3] > 0 ? bounded.toFixed(limit[3]) : String(Math.round(bounded));
    setParameterSnapshot({ ...parametersRef.current, [parameter]: normalized });
    void run();
  }, [run, setParameterSnapshot]);

  const setProfile = useCallback((profileKey: string) => {
    const preset = environmentPreset(profileKey);
    setImportedSnapshot(null);
    setImportView({ kind: "idle", message: DEFAULT_IMPORT_MESSAGE, busy: false });
    setParameterSnapshot({
      ...parametersRef.current,
      profile: profileKey,
      environmentTitle: null,
      frequencyHz: String(preset.frequencyHz),
      sourceDepthM: String(preset.sourceDepthM),
      waterDepthM: String(preset.waterDepthM),
      maximumRangeKm: String(preset.maximumRangeKm),
      maximumDepthM: String(preset.maximumDepthM),
      rangeStepM: String(preset.rangeStepM),
      depthStepM: String(preset.depthStepM),
      bottomSoundSpeedMps: String(preset.bottomSoundSpeedMps),
      bottomDensityKgM3: String(preset.bottomDensityKgM3),
      bottomAttenuationDbPerWavelength: preset.bottomAttenuationDbPerWavelength.toFixed(2),
      sourceId: null,
    });
    void run();
  }, [run, setImportedSnapshot, setParameterSnapshot]);

  const displayedProfilePoints = useMemo(() => {
    const waterDepthM = number(parameters.waterDepthM, 200);
    const raw = profilePointsForPreset(parameters.profile, waterDepthM, customSSP);
    return parameters.profile === "custom" ? raw : resampleProfilePoints(raw, waterDepthM, 500);
  }, [customSSP, parameters.profile, parameters.waterDepthM]);

  const convertToCustom = useCallback((points: readonly ProfilePoint[]) => {
    setImportedSnapshot(null);
    setParameterSnapshot({ ...parametersRef.current, profile: "custom", environmentTitle: null, sourceId: null });
    setCustomSnapshot(points.map((point) => [...point] as ProfilePoint));
  }, [setCustomSnapshot, setImportedSnapshot, setParameterSnapshot]);

  const updateProfilePoint = useCallback((index: number, fieldName: "depth" | "speed", value: string) => {
    const points = displayedProfilePoints.map((point) => [...point] as [number, number]);
    if (parametersRef.current.profile !== "custom") convertToCustom(points);
    const point = points[index];
    if (point === undefined) return;
    point[fieldName === "depth" ? 0 : 1] = number(value, 0);
    setCustomSnapshot(normalizeProfilePoints(points, number(parametersRef.current.waterDepthM, 200)));
    void run();
  }, [convertToCustom, displayedProfilePoints, run, setCustomSnapshot]);

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

  const selectPade = useCallback(async (nPade: number) => {
    const runtime = runtimeRef.current;
    const current = result;
    const selected = Math.round(clamp(nPade, 1, 10));
    setParameterSnapshot({ ...parametersRef.current, nPade: String(selected) });
    if (runtime === null || current === null) return;
    const token = ++requestRef.current;
    setSolveBusy(true);
    setSolveStatus("MARCHING");
    try {
      const nextResult = await runtime.selectPadeField(current.experimentId, selected);
      if (!mountedRef.current || token !== requestRef.current) return;
      acceptResult(runtime, nextResult);
      setSolveStatus("COMPLETE");
    } catch (error) {
      if (!mountedRef.current || token !== requestRef.current) return;
      setSolveStatus("FAILED");
      setRuntimeState((state) => ({ ...state, mode: "error", message: `计算失败：${error instanceof Error ? error.message : String(error)}` }));
    } finally {
      if (mountedRef.current && token === requestRef.current) setSolveBusy(false);
    }
  }, [acceptResult, result, setParameterSnapshot]);

  const setInspectRange = useCallback((value: string) => {
    const next = { ...parametersRef.current, inspectRangeKm: value };
    setParameterSnapshot(next);
    const runtime = runtimeRef.current;
    if (runtime !== null && result !== null) {
      setProfileResult(verticalProfile(runtime, result, clamp(number(value, 0), 0, result.parameters.maximumRangeKm)));
    }
  }, [result, setParameterSnapshot, verticalProfile]);

  const importEnvironmentFiles = useCallback(async (files: FileList): Promise<void> => {
    const selectedFiles = Array.from(files);
    const runtime = runtimeRef.current;
    if (selectedFiles.length === 0 || runtime === null) return;
    setImportView({ kind: "busy", message: "正在本地解析环境文件…", busy: true });
    try {
      const parsed: PeImportedEnvironment = await runtime.importEnvironment(selectedFiles);
      if (parsed.profilePoints.length < 2) throw new Error("导入文件中没有至少两个有效的声速剖面节点");
      const deepest = parsed.profilePoints.reduce((maximum, point) => Math.max(maximum, point[0]), 0);
      const waterDepthM = clamp(number(parsed.waterDepthM, deepest || 200), 50, 8000);
      const modelHints = parsed.modelHints;
      const metadata: ImportedPeMetadata = {
        title: String(parsed.title || selectedFiles[0]?.name || "导入环境"),
        format: String(parsed.format || "ENVIRONMENT"),
        bathymetry: parsed.bathymetry,
        sourceId: parsed.sourceId || null,
        mediumSectionCount: number(modelHints.mediumSectionCount, 0),
        receiverDepthCount: number(modelHints.receiverDepthCount, 0),
      };
      setImportedSnapshot(metadata);
      setCustomSnapshot(normalizeProfilePoints(parsed.profilePoints, waterDepthM));
      setParameterSnapshot({
        ...parametersRef.current,
        profile: "custom",
        environmentTitle: metadata.title,
        sourceId: metadata.sourceId,
        waterDepthM: String(waterDepthM),
        sourceDepthM: String(clamp(number(parsed.sourceDepthM, number(parametersRef.current.sourceDepthM, 50)), 1, waterDepthM - 1)),
        frequencyHz: String(clamp(number(parsed.frequencyHz, number(parametersRef.current.frequencyHz, 100)), 10, 1000)),
        maximumRangeKm: String(clamp(number(parsed.maximumRangeKm, number(parametersRef.current.maximumRangeKm, 20)), 2, 250)),
        maximumDepthM: String(clamp(Math.max(waterDepthM, number(parsed.maximumDepthM, number(parametersRef.current.maximumDepthM, 300))), waterDepthM, 10000)),
        rangeStepM: String(clamp(number(parsed.rangeStepM, number(parametersRef.current.rangeStepM, 25)), 1, 100)),
        depthStepM: String(clamp(number(parsed.depthStepM, number(parametersRef.current.depthStepM, 2)), 0.25, 20)),
        nPade: String(Math.round(clamp(number(parsed.nPade, number(parametersRef.current.nPade, 4)), 1, 10))),
        bottomSoundSpeedMps: String(Math.round(clamp(number(parsed.bottomSoundSpeedMps, 1700), 1400, 3000))),
        bottomDensityKgM3: String(Math.round(clamp(number(parsed.bottomDensityKgM3, 1800), 1000, 3500))),
        bottomAttenuationDbPerWavelength: clamp(number(parsed.bottomAttenuationDbPerWavelength, 0.5), 0, 5).toFixed(2),
      });
      const terrainPoints = parsed.bathymetry.length;
      setImportView({
        kind: "success",
        message: parsed.sourceId
          ? `已导入并原生解析 ${metadata.title}；${terrainPoints} 个地形节点、${metadata.mediumSectionCount} 个介质段和 ${metadata.receiverDepthCount} 个接收深度将完整送入 RAM WASM。`
          : `已导入 ${metadata.title}；SSP、水深、声源与底质将送入本地 PE WASM。`,
        busy: false,
      });
      await calculateWith(runtime);
    } catch (error) {
      setImportView({ kind: "error", message: `导入失败：${errorText(error)}`, busy: false });
    }
  }, [calculateWith, setCustomSnapshot, setImportedSnapshot, setParameterSnapshot]);

  const selectPadeFromConvergence = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (result === null || convergencePlotRef.current === null) return;
    void selectPade(padeFromPointer(event.currentTarget, event, convergencePlotRef.current));
  }, [result, selectPade]);

  const profileDescription = parameters.profile === "custom" && imported !== null
    ? `${imported.title || "导入环境"} · ${imported.format || "ENVIRONMENT"} · ${customSSP.length} 个 SSP 节点${bathymetryVaries(imported.bathymetry) ? " · 原生 RAM 距离相关地形" : ""}${imported.mediumSectionCount > 1 ? ` · ${imported.mediumSectionCount} 个介质段` : ""}`
    : environmentPreset(parameters.profile).description;

  return {
    parameters,
    profilePoints: displayedProfilePoints,
    profileDescription,
    profileMode: parameters.profile === "custom" ? "custom" : "preset",
    solveStatus,
    solveBusy,
    importView,
    runtimeView: runtimeState,
    result,
    profileResult,
    canvases: { ssp, field, delta, convergence, profile },
    setProfile,
    setNumericInput,
    commitNumericInput,
    commitWaterDepth,
    setBottomMaterial: setNumericInput,
    commitBottomMaterial,
    selectPade,
    setInspectRange,
    updateProfilePoint,
    deleteProfilePoint,
    addProfilePoint,
    importEnvironmentFiles,
    run,
    selectPadeFromConvergence,
  };
}

export function isPeCommitChange(event: ChangeEvent<HTMLInputElement>): boolean {
  return event.nativeEvent.type === "change";
}

export { format as formatPeValue };
