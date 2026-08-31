import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(new URL("../..", import.meta.url).pathname);
const sourceRoots = [join(root, "apps"), join(root, "packages")];
const violations = [];

async function walk(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(path));
    else if ([".ts", ".tsx", ".mjs", ".js"].includes(extname(entry.name))) result.push(path);
  }
  return result;
}

for (const sourceRoot of sourceRoots) {
  for (const file of await walk(sourceRoot)) {
    const path = relative(root, file).replaceAll("\\", "/");
    const text = await readFile(file, "utf8");
    if (path.startsWith("apps/web/src/features/") && text.includes("@openocean/field-")) {
      violations.push(`${path}: feature must consume @ooa/runtime-* instead of a model SDK`);
    }
    if (/packages\/runtime-(?:ray|normal-mode|pe)\/src\//.test(path)) {
      if (text.includes("@openocean/field-") && !path.endsWith("/sdk-loader.ts") && !path.endsWith(".test.ts")) {
        violations.push(`${path}: model SDK imports are restricted to sdk-loader.ts`);
      }
      if (/from ["'](?:react|zustand|.*canvas)/.test(text)) violations.push(`${path}: runtime packages cannot depend on React, Zustand or Canvas`);
      const own = path.includes("runtime-ray/") ? "ray" : path.includes("runtime-normal-mode/") ? "normal-mode" : "pe";
      for (const other of ["ray", "normal-mode", "pe"].filter((value) => value !== own)) {
        if (text.includes(`@ooa/runtime-${other}`)) violations.push(`${path}: runtime packages cannot import each other`);
      }
    }
    if (path.startsWith("packages/environment/") && text.includes("@openocean/field-")) violations.push(`${path}: environment cannot depend on a concrete SDK`);
    if (path.startsWith("packages/ui/") && /Bellhop|Kraken|\bRAM\b/.test(text)) violations.push(`${path}: UI package contains model-specific terminology`);
    if (/\.\.\/OpenOcean-Field-|bindings\/wasm|OpenOcean-Field-[^"']+\/src/.test(text)) violations.push(`${path}: source-relative model access is forbidden`);
  }
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Import boundaries verified");
}
