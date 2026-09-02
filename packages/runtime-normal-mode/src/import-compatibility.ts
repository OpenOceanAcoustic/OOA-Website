const NUMBER_PATTERN = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[EeDd][+-]?\d+)?/g;

function extension(name: string): string {
  const match = name.match(/(\.[^.]+)$/);
  return match?.[1]?.toLocaleLowerCase("en-US") ?? "";
}

function jsonAliasName(name: string): string {
  const suffix = extension(name);
  return `${name.slice(0, suffix.length === 0 ? undefined : -suffix.length)}.json`;
}

async function blobText(blob: Blob): Promise<string> {
  if ("text" in blob && typeof blob.text === "function") return blob.text();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")), { once: true });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("无法读取环境文件")), { once: true });
    reader.readAsText(blob);
  });
}

async function startsWithJsonObject(file: File): Promise<boolean> {
  const prefix = await blobText(file.slice(0, 4096));
  return prefix.trimStart().startsWith("{");
}

function stem(name: string): string {
  const suffix = extension(name);
  return name.slice(0, suffix.length === 0 ? undefined : -suffix.length).toLocaleLowerCase("en-US");
}

function normalizedRangeIndependentFlp(text: string): string {
  const lines = text.split(/\r?\n/);
  const significant = lines
    .map((line, index) => ({ index, content: line.split("!", 1)[0]?.trim() ?? "" }))
    .filter(({ content }) => content.length > 0);
  if (significant.length < 5) return text;

  const profileCount = Number(significant[3]?.content.match(NUMBER_PATTERN)?.[0]);
  const rangeLine = significant[4];
  const rangeValues = rangeLine?.content.split("/", 1)[0]?.match(NUMBER_PATTERN) ?? [];
  if (profileCount !== 1 || rangeLine === undefined || rangeValues.length !== 1) return text;

  const original = lines[rangeLine.index] ?? "";
  const commentIndex = original.indexOf("!");
  const data = commentIndex < 0 ? original : original.slice(0, commentIndex);
  const comment = commentIndex < 0 ? "" : original.slice(commentIndex);
  const slashIndex = data.indexOf("/");
  const prefix = (slashIndex < 0 ? data : data.slice(0, slashIndex)).trimEnd();
  const suffix = slashIndex < 0 ? " /" : ` ${data.slice(slashIndex).trimStart()}`;
  lines[rangeLine.index] = `${prefix} ${rangeValues[0]}${suffix}${comment.length > 0 ? ` ${comment}` : ""}`;
  return lines.join(text.includes("\r\n") ? "\r\n" : "\n");
}

async function adaptLegacyFlpPair(files: readonly File[]): Promise<readonly File[]> {
  if (files.length !== 2) return files;
  const env = files.find((file) => extension(file.name) === ".env");
  const flp = files.find((file) => extension(file.name) === ".flp");
  if (env === undefined || flp === undefined || stem(env.name) !== stem(flp.name)) return files;

  const source = await blobText(flp);
  const normalized = normalizedRangeIndependentFlp(source);
  if (normalized === source) return files;
  const replacement = new File([normalized], flp.name, {
    type: flp.type,
    lastModified: flp.lastModified,
  });
  return files.map((file) => file === flp ? replacement : file);
}

/**
 * Recognize a unified/FieldDocument JSON object even when it was saved with a
 * native extension, and normalize the legacy range-independent FLP shorthand
 * that supplies one RPROF start for one profile. No acoustic values are
 * inferred or supplemented.
 */
export async function adaptNormalModeEnvironmentFiles(files: readonly File[]): Promise<readonly File[]> {
  if (files.length === 2) return adaptLegacyFlpPair(files);
  if (files.length !== 1) return files;
  const file = files[0];
  if (file === undefined || extension(file.name) === ".json" || !await startsWithJsonObject(file)) return files;
  return [new File([file], jsonAliasName(file.name), {
    type: "application/json",
    lastModified: file.lastModified,
  })];
}
