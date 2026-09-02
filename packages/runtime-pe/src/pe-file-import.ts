import { parseEnvironmentDocuments } from "@ooa/environment/browser-import";
import { parsePEEnvironmentFiles } from "@ooa/environment/model-file-import";
import { RuntimeError } from "@ooa/runtime-core";

const MAX_FILE_BYTES = 32 * 1024 * 1024;
const RAM_EXTENSIONS = new Set([".env", ".in"]);

type NativeRamParser = (input: {
  readonly name: string;
  readonly text: string;
  readonly sourceFiles: readonly string[];
}) => Promise<unknown>;

function extension(name: string): string {
  return name.match(/(\.[^.]+)$/)?.[1]?.toLocaleLowerCase("en-US") ?? "";
}

function validBasename(name: string): boolean {
  return name.length > 0 && name.length <= 255 && !/[\\/]/.test(name)
    && name !== "." && name !== "..";
}

function cleanRamLines(text: string): string[] {
  return text.replace(/^\uFEFF/, "").split(/\r?\n/)
    .map((line) => line.replace(/!.*/, "").trim())
    .filter(Boolean);
}

function numbers(line: string): number[] {
  return (line.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[EeDd][+-]?\d+)?/g) ?? [])
    .map((value) => Number(value.replace(/[Dd]/, "E")));
}

function hasModelMarker(value: string, model: "rams" | "ramgeo"): boolean {
  const marker = model === "rams" ? /(?:^|[^a-z0-9])ram[\s_-]*s(?:[^a-z0-9]|$)/i
    : /(?:^|[^a-z0-9])ram[\s_-]*geo(?:[^a-z0-9]|$)/i;
  return marker.test(value);
}

/**
 * Recognise unsupported members of the RAM family without pretending that a
 * token-compatible, unlabelled RAMGeo document can be distinguished from RAM.
 */
export function unsupportedRamFamily(name: string, text: string): "RAMS" | "RAMGeo" | null {
  const lines = cleanRamLines(text);
  const explicitModelText = `${name}\n${lines[0] ?? ""}`;
  if (hasModelMarker(explicitModelText, "ramgeo")) return "RAMGeo";
  if (hasModelMarker(explicitModelText, "rams")) return "RAMS";

  // RAMS adds a direction value to its run header and then a negative-sentinel
  // receiver-depth list. RAM has exactly three header values and no list.
  const runHeader = numbers(lines[1] ?? "");
  const receiverLine = lines[2] ?? "";
  const receiverDepths = numbers(receiverLine);
  const direction = runHeader[3];
  if (runHeader.length === 4 && (direction === 1 || direction === -1)
    && receiverDepths.length >= 2 && (receiverDepths.at(-1) ?? 0) < 0) return "RAMS";

  return null;
}

export function peImportErrorDetail(error: unknown): string {
  const messages: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current !== undefined && current !== null; depth += 1) {
    const message = current instanceof Error ? current.message
      : typeof current === "string" ? current
        : "";
    const normalized = message.trim().replace(/\s+/g, " ");
    if (normalized && messages.at(-1) !== normalized) messages.push(normalized);
    current = current instanceof Error && "cause" in current ? current.cause : undefined;
  }
  return messages.join("：") || "原生 RAM 解析器未提供错误详情";
}

async function readText(file: File): Promise<string> {
  if (typeof file.size === "number" && Number.isFinite(file.size) && file.size > MAX_FILE_BYTES) {
    throw new RuntimeError("INPUT_INVALID", "PE 环境文件超过 32 MiB 限制");
  }
  if (typeof file.text === "function") return file.text();
  if (typeof file.arrayBuffer === "function") {
    return new TextDecoder().decode(new Uint8Array(await file.arrayBuffer()));
  }
  throw new RuntimeError("INPUT_INVALID", `无法读取 PE 环境文件 ${file.name || "(未命名)"}`);
}

/** Route PE files while retaining the shared JSON contract and native RAM validation. */
export async function parsePeEnvironmentFiles(
  files: readonly File[],
  parseRam: NativeRamParser,
): Promise<unknown> {
  const selected = Array.from(files ?? []);
  if (selected.length !== 1) {
    throw new RuntimeError("INPUT_INVALID", "PE 导入需要且只允许选择一个 RAM .in、.env 或环境 JSON 文件");
  }
  const file = selected[0];
  if (file === undefined || typeof file !== "object") {
    throw new RuntimeError("INPUT_INVALID", "PE 环境文件无效");
  }
  const name = String(file.name ?? "");
  if (!validBasename(name)) {
    throw new RuntimeError("INPUT_INVALID", `PE 环境文件名无效：${name || "(未命名)"}`);
  }
  const suffix = extension(name);
  if (suffix === ".json") return parsePEEnvironmentFiles(selected, parseRam);
  if (!RAM_EXTENSIONS.has(suffix)) {
    throw new RuntimeError("INPUT_INVALID", `不支持的 PE 文件 ${name}；请选择 RAM .in、.env 或环境 JSON`);
  }
  if (typeof parseRam !== "function") {
    throw new RuntimeError("LOCAL_PACKAGE_MISSING", "RAM 原生输入解析器不可用");
  }

  const text = await readText(file);
  if (new TextEncoder().encode(text).byteLength > MAX_FILE_BYTES) {
    throw new RuntimeError("INPUT_INVALID", "PE 环境文件超过 32 MiB 限制");
  }
  if (text.replace(/^\uFEFF/, "").trimStart().startsWith("{")) {
    const base = name.slice(0, suffix.length === 0 ? undefined : -suffix.length);
    return parseEnvironmentDocuments([{
      name: `${base}.json`,
      data: text,
      size: new TextEncoder().encode(text).byteLength,
    }]);
  }
  const unsupported = unsupportedRamFamily(name, text);
  if (unsupported !== null) {
    throw new RuntimeError(
      "INPUT_INVALID",
      `检测到 ${unsupported} 输入；当前网页 WASM 仅启用 RAM，请改用 RAM token 格式的 .in/.env 文件`,
    );
  }

  const sourceFiles = [name];
  const parsed = await parseRam({ name, text, sourceFiles });
  if (parsed === null || typeof parsed !== "object") {
    throw new RuntimeError("INPUT_INVALID", "RAM 原生解析器返回了无效结果");
  }
  return { format: suffix === ".env" ? "ram-env" : "ram-in", sourceFiles, ...parsed };
}
