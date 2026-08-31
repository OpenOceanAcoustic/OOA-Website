import { parseEnvironmentDocuments } from "./browser-page-import";
const MAX_FILE_COUNT: any = 8;
const MAX_TOTAL_BYTES: any = 16 * 1024 * 1024;
function isObject(value: any): any {
    return value !== null && typeof value === "object";
}
function validName(value: any): any {
    return value.length > 0 && value.length <= 255 && !/[\\/]/.test(value)
        && value !== "." && value !== "..";
}
function extension(name: any): any {
    return name.match(/(\.[^.]+)$/)?.[1]?.toLocaleLowerCase("en-US") || "";
}
function stem(name: any): any {
    return name.slice(0, -extension(name).length).toLocaleLowerCase("en-US");
}
function documentText(document: any): any {
    if (typeof document.data === "string")
        return document.data;
    if (typeof document.text === "string")
        return document.text;
    const value: any = document.data ?? document.bytes ?? document.buffer;
    if (value instanceof ArrayBuffer)
        return new TextDecoder().decode(new Uint8Array(value));
    if (ArrayBuffer.isView(value))
        return new TextDecoder().decode(value);
    throw new TypeError(`environment document ${document.name} has no text or byte data`);
}
function normalizeDocuments(documents: any, allowedExtensions: any): any {
    const list: any = Array.from(documents ?? []);
    if (list.length < 1 || list.length > MAX_FILE_COUNT) {
        throw new RangeError(`environment import requires 1 to ${MAX_FILE_COUNT} files`);
    }
    const normalized: any = list.map((document: any): any => {
        if (!isObject(document))
            throw new TypeError("environment document must be an object");
        const name: any = String(document.name ?? "");
        if (!validName(name))
            throw new TypeError(`invalid environment filename ${name || "(empty)"}`);
        const text: any = documentText(document);
        const bytes: any = typeof document.size === "number" && Number.isFinite(document.size)
            ? document.size
            : new TextEncoder().encode(text).byteLength;
        const suffix: any = extension(name);
        if (!allowedExtensions.has(suffix)) {
            throw new TypeError(`unsupported environment file ${name}`);
        }
        return { name, lowerName: name.toLocaleLowerCase("en-US"), extension: suffix, text, bytes };
    });
    const names: any = new Set();
    for (const document of normalized) {
        if (names.has(document.lowerName))
            throw new TypeError(`duplicate environment filename ${document.name}`);
        names.add(document.lowerName);
    }
    const bytes: any = normalized.reduce((total: any, document: any): any => total + document.bytes, 0);
    if (bytes > MAX_TOTAL_BYTES)
        throw new RangeError("environment import exceeds the 16 MiB limit");
    return normalized;
}
async function fileDocuments(files: any): Promise<any> {
    return Promise.all(Array.from(files ?? []).map(async (file: any): Promise<any> => {
        if (!isObject(file))
            throw new TypeError("environment file must be a File-like object");
        const name: any = String(file.name ?? "");
        if (typeof file.text === "function") {
            return { name, data: await file.text(), size: file.size };
        }
        if (typeof file.arrayBuffer === "function") {
            return { name, data: new Uint8Array(await file.arrayBuffer()), size: file.size };
        }
        if (file.data !== undefined || typeof file.text === "string") {
            return { name, data: file.data ?? file.text, size: file.size };
        }
        throw new TypeError(`environment file ${name || "(empty)"} cannot be read`);
    }));
}
function parseJsonOnly(documents: any): any {
    if (documents.length !== 1 || documents[0].extension !== ".json") {
        throw new TypeError("JSON environment imports must contain exactly one .json file");
    }
    return parseEnvironmentDocuments([{ name: documents[0].name, data: documents[0].text }]);
}
/**
 * Route a Normal Mode import to either the shared JSON contract or the native
 * Kraken ENV/FLP parser supplied by the caller.
 */
export async function parseNormalModeEnvironmentDocuments(documents: any, parseKraken: any): Promise<any> {
    const normalized: any = normalizeDocuments(documents, new Set([".env", ".flp", ".json"]));
    if (normalized.some((document: any): any => document.extension === ".json"))
        return parseJsonOnly(normalized);
    if (typeof parseKraken !== "function")
        throw new TypeError("Kraken ENV parser is unavailable");
    const envFiles: any = normalized.filter((document: any): any => document.extension === ".env");
    const flpFiles: any = normalized.filter((document: any): any => document.extension === ".flp");
    if (normalized.length !== 2 || envFiles.length !== 1 || flpFiles.length !== 1) {
        throw new TypeError("Normal Mode import requires one Kraken .env and one same-stem .flp file");
    }
    if (stem(envFiles[0].name) !== stem(flpFiles[0].name)) {
        throw new TypeError(`Kraken FLP ${flpFiles[0].name} must have the same stem as ${envFiles[0].name}`);
    }
    const sourceFiles: any = normalized.map((document: any): any => document.name);
    const parsed: any = await parseKraken({
        envText: envFiles[0].text,
        flpText: flpFiles[0].text,
        envName: envFiles[0].name,
        flpName: flpFiles[0].name,
        sourceFiles,
    });
    if (!isObject(parsed))
        throw new TypeError("native Kraken parser returned an invalid document");
    return { format: "kraken-env-flp", sourceFiles, ...parsed };
}
export async function parseNormalModeEnvironmentFiles(files: any, parseKraken: any): Promise<any> {
    return parseNormalModeEnvironmentDocuments(await fileDocuments(files), parseKraken);
}
/** Route a PE import to either shared JSON or the native RAM IN parser. */
export async function parsePEEnvironmentDocuments(documents: any, parseRamIn: any): Promise<any> {
    const normalized: any = normalizeDocuments(documents, new Set([".in", ".json"]));
    if (normalized.some((document: any): any => document.extension === ".json"))
        return parseJsonOnly(normalized);
    if (typeof parseRamIn !== "function")
        throw new TypeError("RAM IN parser is unavailable");
    if (normalized.length !== 1 || normalized[0].extension !== ".in") {
        throw new TypeError("PE import requires exactly one RAM .in file");
    }
    const sourceFiles: any = [normalized[0].name];
    const parsed: any = await parseRamIn({
        text: normalized[0].text,
        name: normalized[0].name,
        sourceFiles,
    });
    if (!isObject(parsed))
        throw new TypeError("native RAM parser returned an invalid document");
    return { format: "ram-in", sourceFiles, ...parsed };
}
export async function parsePEEnvironmentFiles(files: any, parseRamIn: any): Promise<any> {
    return parsePEEnvironmentDocuments(await fileDocuments(files), parseRamIn);
}
