import { ENVIRONMENT_PRESETS } from "./presets";
import { parseEnvironmentJson as parsePageEnvironmentJson } from "./browser-page-import";
import type {
  AcousticEnvironment,
  BathymetryPoint,
  EnvironmentDocument,
  ImportedEnvironment,
  SoundSpeedPoint,
} from "./types";
import { assertEnvironment } from "./validation";

type JsonRecord = Record<string, unknown>;
export type EnvironmentModelFamily = "ray" | "normal-mode" | "pe";

const MAX_FILE_COUNT = 16;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;

function finite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function tuples(value: unknown): readonly (readonly unknown[])[] {
  return Array.isArray(value) ? value.filter((item): item is readonly unknown[] => Array.isArray(item)) : [];
}

function profileFromJson(value: JsonRecord): SoundSpeedPoint[] {
  const candidate = value.soundSpeedProfile ?? value.profilePoints;
  if (!Array.isArray(candidate)) return [];
  return candidate.flatMap((item) => {
    if (Array.isArray(item)) {
      const depthM = finite(item[0], Number.NaN);
      const speedMps = finite(item[1], Number.NaN);
      return Number.isFinite(depthM) && Number.isFinite(speedMps) ? [{ depthM, speedMps }] : [];
    }
    if (item !== null && typeof item === "object") {
      const point = item as JsonRecord;
      const depthM = finite(point.depthM, Number.NaN);
      const speedMps = finite(point.speedMps, Number.NaN);
      return Number.isFinite(depthM) && Number.isFinite(speedMps) ? [{ depthM, speedMps }] : [];
    }
    return [];
  });
}

function jsonBathymetry(value: unknown, waterDepthM: number): BathymetryPoint[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (Array.isArray(item)) {
      const rangeKm = finite(item[0], Number.NaN);
      const depthM = finite(item[1], Number.NaN);
      return Number.isFinite(rangeKm) && Number.isFinite(depthM)
        ? [{ rangeM: rangeKm * 1000, depthM }]
        : [];
    }
    if (item !== null && typeof item === "object") {
      const point = item as JsonRecord;
      const rangeM = typeof point.rangeM === "number"
        ? point.rangeM
        : finite(point.rangeKm ?? point.range, Number.NaN) * 1000;
      const depthM = finite(point.depthM ?? point.depth, waterDepthM);
      return Number.isFinite(rangeM) ? [{ rangeM, depthM }] : [];
    }
    return [];
  });
}

function parseFieldDocumentJson(value: JsonRecord, document: EnvironmentDocument): ImportedEnvironment {
  const parsed = parsePageEnvironmentJson(value, { title: document.name }) as Readonly<Record<string, unknown>>;
  const profile = tuples(parsed.profilePoints).map((point) => ({
    depthM: finite(point[0], Number.NaN),
    speedMps: finite(point[1], Number.NaN),
  }));
  const waterDepthM = finite(parsed.waterDepthM, profile.at(-1)?.depthM ?? 0);
  const bathymetry = tuples(parsed.bathymetry).map((point) => ({
    rangeM: finite(point[0], 0) * 1000,
    depthM: finite(point[1], waterDepthM),
  }));
  const environment: AcousticEnvironment = {
    title: String(parsed.title ?? document.name),
    frequencyHz: finite(parsed.frequencyHz, 50),
    waterDepthM,
    soundSpeedProfile: profile,
    bathymetry,
    bottom: {
      soundSpeedMps: finite(parsed.bottomSoundSpeedMps, 1700),
      densityKgM3: finite(parsed.bottomDensityKgM3, 1800),
      attenuationDbPerWavelength: finite(parsed.bottomAttenuationDbPerWavelength, 0.5),
    },
  };
  const physicalKeys = new Set([
    "title", "frequencyHz", "waterDepthM", "profilePoints", "bathymetry",
    "bottomSoundSpeedMps", "bottomDensityKgM3", "bottomAttenuationDbPerWavelength",
  ]);
  const modelHints = Object.fromEntries(
    Object.entries(parsed).filter(([key]) => !physicalKeys.has(key)),
  );
  return { environment: assertEnvironment(environment), documents: [document], modelHints };
}

function parseJson(document: EnvironmentDocument): ImportedEnvironment {
  const decoded: unknown = JSON.parse(document.content.replace(/^\uFEFF/, ""));
  if (decoded === null || typeof decoded !== "object" || Array.isArray(decoded)) {
    throw new TypeError("environment JSON root must be an object");
  }
  const value = decoded as JsonRecord;
  if (value.parameters !== null && typeof value.parameters === "object"
    && !Array.isArray(value.parameters)) {
    return parseFieldDocumentJson(value, document);
  }
  const profile = profileFromJson(value);
  const waterDepthM = finite(value.waterDepthM, profile.at(-1)?.depthM ?? 0);
  const environment: AcousticEnvironment = {
    title: typeof value.title === "string" ? value.title : document.name,
    frequencyHz: finite(value.frequencyHz, 50),
    waterDepthM,
    soundSpeedProfile: profile,
    bathymetry: jsonBathymetry(value.bathymetry, waterDepthM),
    bottom: {
      soundSpeedMps: finite(value.bottomSoundSpeedMps, 1700),
      densityKgM3: finite(value.bottomDensityKgM3, 1800),
      attenuationDbPerWavelength: finite(value.bottomAttenuationDbPerWavelength, 0.5),
    },
  };
  const commonKeys = new Set([
    "title", "frequencyHz", "waterDepthM", "profilePoints", "soundSpeedProfile",
    "bathymetry", "bottomSoundSpeedMps", "bottomDensityKgM3", "bottomAttenuationDbPerWavelength",
  ]);
  const modelHints = Object.fromEntries(Object.entries(value).filter(([key]) => !commonKeys.has(key)));
  return { environment: assertEnvironment(environment), documents: [document], modelHints };
}

function stripComment(line: string): string {
  let quote: string | null = null;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if ((character === "'" || character === '"')) quote = quote === character ? null : quote === null ? character : quote;
    if (character === "!" && quote === null) return line.slice(0, index);
  }
  return line;
}

function cleanLines(content: string): string[] {
  return content.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => stripComment(line).trim()).filter(Boolean);
}

function numbers(line: string): number[] {
  return (line.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[EeDd][+-]?\d+)?/g) ?? [])
    .map((value) => Number(value.replace(/[Dd]/, "E")));
}

function quoted(line: string): string | null {
  return line.match(/^\s*(['"])(.*?)\1/)?.[2]?.trim() ?? null;
}

function longestProfile(lines: readonly string[]): SoundSpeedPoint[] {
  let best: SoundSpeedPoint[] = [];
  let current: SoundSpeedPoint[] = [];
  for (const line of lines) {
    const values = numbers(line.split("/", 1)[0] ?? line);
    const depthM = values[0];
    const speedMps = values[1];
    const plausible = depthM !== undefined && speedMps !== undefined
      && depthM >= 0 && speedMps >= 1300 && speedMps <= 2000;
    if (plausible && (current.length === 0 || depthM > (current.at(-1)?.depthM ?? -1))) {
      current.push({ depthM, speedMps });
    } else {
      if (current.length > best.length) best = current;
      current = [];
    }
  }
  if (current.length > best.length) best = current;
  return best;
}

function readAxis(lines: readonly string[], start: number) {
  const countValues = numbers((lines[start] ?? "").split("/", 1)[0] ?? "");
  const count = countValues[0] ?? 0;
  if (!Number.isInteger(count) || count < 1) throw new SyntaxError("native environment axis count is invalid");
  const values = countValues.slice(1);
  let cursor = start + 1;
  let terminated = (lines[start] ?? "").includes("/");
  while (!terminated && cursor < lines.length) {
    const line = lines[cursor] ?? "";
    values.push(...numbers(line.split("/", 1)[0] ?? line));
    terminated = line.includes("/") || values.length >= count;
    cursor += 1;
  }
  return { values, cursor };
}

function bellhopSsp(document: EnvironmentDocument, profile: readonly SoundSpeedPoint[]): SoundSpeedPoint[] {
  const tokens = numbers(cleanLines(document.content).join("\n"));
  const rangeCount = tokens[0] ?? 0;
  if (!Number.isInteger(rangeCount) || rangeCount < 1) throw new SyntaxError("Bellhop SSP range count is invalid");
  const values = tokens.slice(1 + rangeCount);
  if (values.length < rangeCount * profile.length) throw new SyntaxError("Bellhop SSP point data is incomplete");
  const ranges = tokens.slice(1, 1 + rangeCount);
  let selected = 0;
  for (let index = 1; index < ranges.length; index += 1) {
    if (Math.abs(ranges[index] ?? Infinity) < Math.abs(ranges[selected] ?? Infinity)) selected = index;
  }
  return profile.map((point, depthIndex) => ({
    depthM: point.depthM,
    speedMps: values[depthIndex * rangeCount + selected] ?? point.speedMps,
  }));
}

function bellhopBathymetry(document: EnvironmentDocument): BathymetryPoint[] {
  const lines = cleanLines(document.content);
  const tokens = numbers(lines.slice(1).join("\n"));
  const count = tokens[0] ?? 0;
  if (!Number.isInteger(count) || count < 1 || tokens.length < 1 + count * 2) {
    throw new SyntaxError("Bellhop BTY point data is invalid");
  }
  return Array.from({ length: count }, (_, index) => ({
    rangeM: (tokens[1 + index * 2] ?? 0) * 1000,
    depthM: tokens[2 + index * 2] ?? 0,
  }));
}

function nativeBase(primary: EnvironmentDocument) {
  const lines = cleanLines(primary.content);
  const profile = longestProfile(lines);
  if (profile.length < 2) throw new SyntaxError(`${primary.name} does not contain a usable sound-speed profile`);
  return {
    lines,
    profile,
    title: quoted(lines[0] ?? "") ?? lines[0] ?? primary.name,
    frequencyHz: numbers(lines[1] ?? "")[0] ?? 50,
  };
}

function parseBellhop(documents: readonly EnvironmentDocument[]): ImportedEnvironment {
  const primary = documents.find((document) => document.kind === "bellhop-env");
  if (primary === undefined) throw new TypeError("Ray import requires one Bellhop .env file");
  const parsed = nativeBase(primary);
  const ssp = documents.find((document) => document.kind === "bellhop-ssp");
  const profile = ssp === undefined ? parsed.profile : bellhopSsp(ssp, parsed.profile);
  const bty = documents.find((document) => document.kind === "bellhop-bty");
  const bathymetry = bty === undefined ? [] : bellhopBathymetry(bty);
  const quotedIndexes = parsed.lines.flatMap((line, index) => quoted(line) === null ? [] : [index]);
  const bottomIndex = quotedIndexes[2];
  const halfspace = bottomIndex === undefined ? [] : numbers(parsed.lines[bottomIndex + 1] ?? "");
  const waterDepthM = profile.at(-1)?.depthM ?? 0;
  const bottom = {
    soundSpeedMps: halfspace[1] ?? 1700,
    densityKgM3: (halfspace[3] ?? 1.8) * 1000,
    attenuationDbPerWavelength: halfspace[4] ?? 0.5,
  };
  const modelHints: Record<string, unknown> = {};
  if (bottomIndex !== undefined) {
    try {
      const source = readAxis(parsed.lines, bottomIndex + 2);
      const receiverDepth = readAxis(parsed.lines, source.cursor);
      const receiverRange = readAxis(parsed.lines, receiverDepth.cursor);
      modelHints.sourceDepthM = source.values[0];
      modelHints.maximumRangeKm = Math.max(...receiverRange.values);
      const runIndex = parsed.lines.findIndex((line, index) => index >= receiverRange.cursor && quoted(line) !== null);
      if (runIndex >= 0) {
        modelHints.beamCount = Math.abs(numbers(parsed.lines[runIndex + 1] ?? "")[0] ?? 0);
        modelHints.angleRangeDegrees = numbers(parsed.lines[runIndex + 2] ?? "").slice(0, 2);
      }
    } catch {
      // Environment physics remain usable even if optional Bellhop axes are absent.
    }
  }
  return {
    environment: assertEnvironment({ title: parsed.title, frequencyHz: parsed.frequencyHz, waterDepthM, soundSpeedProfile: profile, bathymetry, bottom }),
    documents: [...documents],
    modelHints,
  };
}

function parseKraken(documents: readonly EnvironmentDocument[]): ImportedEnvironment {
  const primary = documents.find((document) => document.kind === "kraken-env");
  if (primary === undefined) throw new TypeError("Normal Mode import requires one Kraken .env file");
  const parsed = nativeBase(primary);
  const waterDepthM = parsed.profile.at(-1)?.depthM ?? 0;
  const quotedIndexes = parsed.lines.flatMap((line, index) => quoted(line) === null ? [] : [index]);
  const bottomIndex = quotedIndexes[2];
  const halfspace = bottomIndex === undefined ? [] : numbers(parsed.lines[bottomIndex + 1] ?? "");
  const sourceDepths = bottomIndex === undefined ? [] : numbers(parsed.lines[bottomIndex + 5] ?? "");
  return {
    environment: assertEnvironment({
      title: parsed.title,
      frequencyHz: parsed.frequencyHz,
      waterDepthM,
      soundSpeedProfile: parsed.profile,
      bathymetry: [],
      bottom: {
        soundSpeedMps: halfspace[1] ?? 1700,
        densityKgM3: (halfspace[3] ?? 1.8) * 1000,
        attenuationDbPerWavelength: halfspace[4] ?? 0.5,
      },
    }),
    documents: [...documents],
    modelHints: sourceDepths[0] === undefined ? {} : { sourceDepthM: sourceDepths[0] },
  };
}

function readRamSection(lines: readonly string[], start: number) {
  const points: number[][] = [];
  let cursor = start;
  while (cursor < lines.length) {
    const values = numbers(lines[cursor] ?? "");
    cursor += 1;
    if ((values[0] ?? -1) < 0) break;
    if (values.length >= 2) points.push(values);
  }
  return { points, cursor };
}

function parseRam(document: EnvironmentDocument): ImportedEnvironment {
  const lines = cleanLines(document.content);
  if (lines.length < 10) throw new SyntaxError("RAM .in file is incomplete");
  const run = numbers(lines[1] ?? "");
  const range = numbers(lines[2] ?? "");
  const depth = numbers(lines[3] ?? "");
  const options = numbers(lines[4] ?? "");
  const bathymetrySection = readRamSection(lines, 5);
  const waterSection = readRamSection(lines, bathymetrySection.cursor);
  const bottomSpeedSection = readRamSection(lines, waterSection.cursor);
  const densitySection = readRamSection(lines, bottomSpeedSection.cursor);
  const attenuationSection = readRamSection(lines, densitySection.cursor);
  const soundSpeedProfile = waterSection.points.map(([depthM = 0, speedMps = 0]) => ({ depthM, speedMps }));
  if (soundSpeedProfile.length < 2) throw new SyntaxError("RAM .in water sound-speed section is incomplete");
  const bathymetry = bathymetrySection.points.map(([rangeM = 0, depthM = 0]) => ({ rangeM, depthM }));
  const waterDepthM = soundSpeedProfile.at(-1)?.depthM ?? 0;
  return {
    environment: assertEnvironment({
      title: lines[0] ?? document.name,
      frequencyHz: run[0] ?? 50,
      waterDepthM,
      soundSpeedProfile,
      bathymetry,
      bottom: {
        soundSpeedMps: bottomSpeedSection.points[0]?.[1] ?? 1700,
        densityKgM3: (densitySection.points[0]?.[1] ?? 1.8) * 1000,
        attenuationDbPerWavelength: attenuationSection.points[0]?.[1] ?? 0.5,
      },
    }),
    documents: [document],
    modelHints: {
      sourceDepthM: run[1] ?? 50,
      receiverDepthM: run[2] ?? 50,
      maximumRangeKm: (range[0] ?? 20_000) / 1000,
      rangeStepM: range[1] ?? 10,
      maximumDepthM: depth[0] ?? waterDepthM,
      depthStepM: depth[1] ?? 5,
      nPade: options[1] ?? 4,
    },
  };
}

function stem(name: string): string {
  return name.replace(/\.[^.]+$/, "").toLocaleLowerCase("en-US");
}

function validateDocuments(documents: readonly EnvironmentDocument[]): void {
  if (documents.length < 1 || documents.length > MAX_FILE_COUNT) {
    throw new RangeError(`environment import requires 1 to ${MAX_FILE_COUNT} files`);
  }
  const names = new Set<string>();
  let totalBytes = 0;
  for (const document of documents) {
    if (document.name.length === 0 || document.name.length > 255 || /[\\/]/.test(document.name)) {
      throw new TypeError(`invalid environment filename ${document.name || "(empty)"}`);
    }
    const name = document.name.toLocaleLowerCase("en-US");
    if (names.has(name)) throw new TypeError(`duplicate environment filename ${document.name}`);
    names.add(name);
    totalBytes += new TextEncoder().encode(document.content).byteLength;
  }
  if (totalBytes > MAX_TOTAL_BYTES) throw new RangeError("environment import exceeds the 32 MiB limit");
}

export async function importEnvironmentDocuments(
  documents: readonly EnvironmentDocument[],
): Promise<ImportedEnvironment> {
  validateDocuments(documents);
  const json = documents.filter((document) => document.kind === "json");
  if (json.length > 0) {
    if (documents.length !== 1 || json.length !== 1) throw new TypeError("JSON import requires exactly one .json file");
    return parseJson(json[0] as EnvironmentDocument);
  }
  const ram = documents.filter((document) => document.kind === "ram-in");
  if (ram.length > 0) {
    if (documents.length !== 1 || ram.length !== 1) throw new TypeError("PE import requires exactly one RAM .in file");
    return parseRam(ram[0] as EnvironmentDocument);
  }
  const krakenEnv = documents.filter((document) => document.kind === "kraken-env");
  const krakenFlp = documents.filter((document) => document.kind === "kraken-flp");
  if (krakenEnv.length > 0 || krakenFlp.length > 0) {
    if (documents.length !== 2 || krakenEnv.length !== 1 || krakenFlp.length !== 1) {
      throw new TypeError("Normal Mode import requires one Kraken .env and one same-stem .flp file");
    }
    if (stem(krakenEnv[0]?.name ?? "") !== stem(krakenFlp[0]?.name ?? "")) {
      throw new TypeError("Kraken ENV and FLP must have the same stem");
    }
    return parseKraken(documents);
  }
  const bellhopEnv = documents.filter((document) => document.kind === "bellhop-env");
  if (bellhopEnv.length !== 1) throw new TypeError("Ray import requires exactly one Bellhop .env file");
  const primaryStem = stem(bellhopEnv[0]?.name ?? "");
  if (documents.some((document) => stem(document.name) !== primaryStem)) {
    throw new TypeError("Bellhop companion files must have the same stem as the ENV file");
  }
  if (documents.filter((document) => document.kind === "bellhop-ssp").length > 1
    || documents.filter((document) => document.kind === "bellhop-bty").length > 1) {
    throw new TypeError("Bellhop import contains duplicate companion file kinds");
  }
  return parseBellhop(documents);
}

export function inferEnvironmentDocumentKind(
  name: string,
  family: EnvironmentModelFamily = "ray",
): EnvironmentDocument["kind"] {
  const lower = name.toLowerCase();
  if (lower.endsWith(".json")) return "json";
  if (family === "normal-mode") return lower.endsWith(".flp") ? "kraken-flp" : "kraken-env";
  if (family === "pe") return "ram-in";
  if (lower.endsWith(".ssp")) return "bellhop-ssp";
  if (lower.endsWith(".bty")) return "bellhop-bty";
  if (lower.endsWith(".env")) return "bellhop-env";
  return "bellhop-companion";
}
