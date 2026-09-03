import { adaptNormalModeEnvironmentFiles } from "@ooa/runtime-normal-mode";

export type NormalEnvironmentSelection =
  | Readonly<{ kind: "ready"; files: readonly File[]; stem: string | null }>
  | Readonly<{ kind: "waiting"; message: string }>
  | Readonly<{ kind: "error"; message: string }>;

type NativePair = {
  displayStem: string;
  env?: File;
  flp?: File;
};

function fileExtension(name: string): string {
  const index = name.lastIndexOf(".");
  return index < 0 ? "" : name.slice(index).toLocaleLowerCase("en-US");
}

function fileStem(name: string): string {
  const extension = fileExtension(name);
  return name.slice(0, extension.length === 0 ? undefined : -extension.length);
}

function detailMessage(value: unknown): string | null {
  if (value instanceof Error && value.message.trim()) return value.message.trim();
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value !== null && typeof value === "object" && "message" in value) {
    const message = String((value as Readonly<{ message?: unknown }>).message ?? "").trim();
    if (message) return message;
  }
  return null;
}

/** Keep useful native parser detail instead of stopping at RuntimeError's wrapper message. */
export function describeNormalImportError(error: unknown): string {
  const messages: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current !== null && current !== undefined && !seen.has(current); depth += 1) {
    seen.add(current);
    const message = detailMessage(current);
    if (message !== null && messages.at(-1) !== message) messages.push(message);
    current = typeof current === "object" && "cause" in current
      ? (current as Readonly<{ cause?: unknown }>).cause
      : undefined;
  }
  if (messages.length > 0) return messages.join("：");
  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") return serialized;
  } catch {
    // Fall through to the actionable user-facing fallback.
  }
  return "未能识别文件内容，请同时选择同名的 Kraken ENV/FLP，或选择一个环境 JSON。";
}

/**
 * Pairs Kraken files across file-picker invocations. A complete pair is still
 * passed to the runtime in ENV/FLP order, so the native parser remains the
 * authority for all acoustic values.
 */
export class NormalEnvironmentSelectionBuffer {
  readonly #pairs = new Map<string, NativePair>();

  async accept(files: readonly File[]): Promise<NormalEnvironmentSelection> {
    if (files.length === 0) return { kind: "waiting", message: "尚未选择文件。" };

    const adaptedFiles = await adaptNormalModeEnvironmentFiles(files);
    if (adaptedFiles !== files) {
      this.#pairs.clear();
      return { kind: "ready", files: adaptedFiles, stem: null };
    }

    const extensions = files.map((file) => fileExtension(file.name));
    if (extensions.some((extension) => extension !== ".env" && extension !== ".flp")) {
      this.#pairs.clear();
      return { kind: "ready", files, stem: null };
    }

    const touched = new Set<string>();
    files.forEach((file, index) => {
      const displayStem = fileStem(file.name);
      const key = displayStem.toLocaleLowerCase("en-US");
      const pair = this.#pairs.get(key) ?? { displayStem };
      const extension = extensions[index];
      if (extension === ".env") pair.env = file;
      if (extension === ".flp") pair.flp = file;
      this.#pairs.set(key, pair);
      touched.add(key);
    });

    const complete = [...touched].filter((key) => {
      const pair = this.#pairs.get(key);
      return pair?.env !== undefined && pair.flp !== undefined;
    });
    if (complete.length > 1) {
      return { kind: "error", message: "一次检测到多组完整的 Kraken ENV/FLP；请每次只导入一组同名文件。" };
    }
    const readyStem = complete[0];
    if (readyStem !== undefined) {
      const pair = this.#pairs.get(readyStem)!;
      return { kind: "ready", files: [pair.env!, pair.flp!], stem: readyStem };
    }

    const waitingFor = [...this.#pairs.values()].flatMap((pair) => [
      ...(pair.env === undefined ? [`${pair.displayStem}.env`] : []),
      ...(pair.flp === undefined ? [`${pair.displayStem}.flp`] : []),
    ]);
    const staged = [...this.#pairs.values()].flatMap((pair) => [pair.env?.name, pair.flp?.name])
      .filter((name): name is string => name !== undefined);
    return {
      kind: "waiting",
      message: `已暂存 ${staged.join("、")}；等待选择同名的 ${waitingFor.join("、")}。`,
    };
  }

  consume(stem: string | null): void {
    if (stem === null) this.#pairs.clear();
    else this.#pairs.delete(stem);
  }
}
