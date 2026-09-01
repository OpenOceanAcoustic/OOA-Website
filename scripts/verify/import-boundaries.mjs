import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(new URL("../..", import.meta.url).pathname);
const sourceRoots = [join(root, "apps"), join(root, "packages")];
const violations = [];
const generatedDirectories = new Set(["dist", "node_modules"]);

async function walk(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && !generatedDirectories.has(entry.name)) result.push(...await walk(path));
    else if ([".ts", ".tsx", ".mjs", ".js"].includes(extname(entry.name))) result.push(path);
  }
  return result;
}

for (const sourceRoot of sourceRoots) {
  for (const file of await walk(sourceRoot)) {
    const path = relative(root, file).replaceAll("\\", "/");
    const text = await readFile(file, "utf8");
    if (text.includes("@ts-nocheck")) {
      violations.push(`${path}: production source cannot opt out of TypeScript checking`);
    }
    if (text.includes("/legacy-sdk")) {
      violations.push(`${path}: legacy model SDK passthrough exports are forbidden`);
    }
    if (/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\b/.test(text)) {
      violations.push(`${path}: browser compute code cannot upload work to an external service`);
    }
    if (path.startsWith("apps/web/src/features/") && text.includes("@openocean/field-")) {
      violations.push(`${path}: feature must consume @ooa/runtime-* instead of a model SDK`);
    }
    if (path.startsWith("apps/web/src/features/") && /@ooa\/runtime-(?:ray|normal-mode|pe)\/page-runtime/.test(text)) {
      violations.push(`${path}: feature cannot use the retired page-runtime deep export`);
    }
    if (path.startsWith("apps/web/src/features/") && path.endsWith("page-controller.ts")) {
      violations.push(`${path}: retired imperative page controller is forbidden`);
    }
    if (path.includes("/controller/") && text.includes("@ooa/environment/model-file-import")) {
      violations.push(`${path}: controllers pass File objects to Runtime and cannot unpack native model documents`);
    }
    if (path.startsWith("apps/web/src/features/")
      && (/\.html\?raw/.test(text) || /new DOMParser\s*\(/.test(text) || /dangerouslySetInnerHTML/.test(text))) {
      violations.push(`${path}: model pages must be explicit TSX sections, not runtime HTML rendering`);
    }
    if (path.startsWith("apps/web/src/features/")
      && /\b(?:Bellhop2DInput|KrakenInput|RAMInput|nativeInput|ramInput)\b/.test(text)) {
      violations.push(`${path}: feature cannot receive or construct a concrete model SDK input`);
    }
    if (/packages\/runtime-(?:ray|normal-mode|pe)\/src\//.test(path)) {
      const importsFieldPackage = /(?:from\s*|import\s*\(\s*)["']@openocean\/field-/.test(text);
      if (importsFieldPackage && !path.endsWith("/sdk-loader.ts") && !path.endsWith(".test.ts")) {
        violations.push(`${path}: model SDK imports are restricted to sdk-loader.ts`);
      }
      if (/from ["'](?:react|zustand|.*canvas)/.test(text)) violations.push(`${path}: runtime packages cannot depend on React, Zustand or Canvas`);
      const own = path.includes("runtime-ray/") ? "ray" : path.includes("runtime-normal-mode/") ? "normal-mode" : "pe";
      for (const other of ["ray", "normal-mode", "pe"].filter((value) => value !== own)) {
        if (text.includes(`@ooa/runtime-${other}`)) violations.push(`${path}: runtime packages cannot import each other`);
      }
    }
    if (path.startsWith("packages/environment/") && text.includes("@openocean/field-")) violations.push(`${path}: environment cannot depend on a concrete SDK`);
    if (path.startsWith("packages/ui/")
      && /@(?:openocean\/field-|ooa\/(?:runtime-|environment))|from ["'][^"']*canvas/.test(text)) {
      violations.push(`${path}: shared UI cannot depend on a model SDK, Runtime, environment parser or Canvas`);
    }
    if (path.startsWith("packages/styles/") && /Bellhop|Kraken|\bRAM\b/.test(text)) violations.push(`${path}: shared styles contain model-specific terminology`);
    if (/\.\.\/OpenOcean-Field-|bindings\/wasm|OpenOcean-Field-[^"']+\/src/.test(text)) violations.push(`${path}: source-relative model access is forbidden`);
  }
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Import boundaries verified");
}
