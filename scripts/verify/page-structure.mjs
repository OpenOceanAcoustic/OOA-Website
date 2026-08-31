import { access, readFile, readdir } from "node:fs/promises";
import { extname, join, normalize, relative, resolve, sep } from "node:path";

const root = resolve(new URL("../..", import.meta.url).pathname);
const violations = [];

async function exists(path, label) {
  try {
    await access(path);
  } catch {
    violations.push(`${label}: missing ${path.slice(root.length + 1)}`);
  }
}

for (const model of ["ray-mode", "normal-mode", "pe"]) {
  const feature = join(root, "apps/web/src/features", model);
  for (const directory of ["page", "controller", "styles", "route"]) {
    await exists(join(feature, directory), `${model} page structure`);
  }
  const entries = await readdir(feature, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && extname(entry.name) === ".html") {
      violations.push(`${model}: raw HTML page source is forbidden (${entry.name})`);
    }
    if (entry.isFile() && extname(entry.name) === ".js" && entry.parentPath.includes(`${sep}controller`)) {
      violations.push(`${model}: production controllers must be TypeScript (${entry.name})`);
    }
  }
}

for (const runtime of ["runtime-ray", "runtime-normal-mode", "runtime-pe"]) {
  const source = join(root, "packages", runtime, "src");
  for (const entry of await readdir(source, { recursive: true, withFileTypes: true })) {
    if (entry.isFile() && extname(entry.name) === ".js") {
      violations.push(`${runtime}: production Runtime sources must be TypeScript (${entry.name})`);
    }
    if (entry.isFile() && entry.name.includes("page-runtime")) {
      violations.push(`${runtime}: the retired page-runtime seam must not return (${entry.name})`);
    }
  }
}

for (const entry of await readdir(join(root, "apps/web/src/features/shared-page"), { recursive: true, withFileTypes: true })) {
  if (entry.isFile() && extname(entry.name) === ".js") {
    violations.push(`shared-page: production shared tools must be TypeScript (${entry.name})`);
  }
}

const assetRoot = join(root, "packages/assets/src");
const catalog = JSON.parse(await readFile(join(assetRoot, "catalog.json"), "utf8"));
const assetIds = new Set();
for (const asset of catalog.assets ?? []) {
  if (typeof asset.id !== "string" || assetIds.has(asset.id)) {
    violations.push(`assets: invalid or duplicate id ${String(asset.id)}`);
    continue;
  }
  assetIds.add(asset.id);
  const target = normalize(join(assetRoot, String(asset.path)));
  if (!target.startsWith(`${assetRoot}${sep}`)) {
    violations.push(`assets: ${asset.id} escapes the asset package`);
    continue;
  }
  await exists(target, `assets: ${asset.id}`);
}

const stylePackage = JSON.parse(await readFile(join(root, "packages/styles/package.json"), "utf8"));
for (const [name, relativePath] of Object.entries(stylePackage.exports ?? {})) {
  const target = join(root, "packages/styles", String(relativePath));
  await exists(target, `styles export ${name}`);
  const css = await readFile(target, "utf8");
  if (/Bellhop|Kraken|\bRAM\b/.test(css)) {
    violations.push(`styles export ${name}: shared CSS contains model SDK terminology`);
  }
}

for (const packageRoot of [join(root, "apps/web"), ...await readdir(join(root, "packages")).then((names) => names.map((name) => join(root, "packages", name)))]) {
  const manifestPath = join(packageRoot, "package.json");
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    continue;
  }
  const sourceRoot = join(packageRoot, "src");
  let sourceText = "";
  try {
    const entries = await readdir(sourceRoot, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || ![".ts", ".tsx", ".js", ".css"].includes(extname(entry.name))) continue;
      sourceText += await readFile(join(entry.parentPath, entry.name), "utf8");
    }
  } catch {
    continue;
  }
  for (const dependency of Object.keys(manifest.dependencies ?? {}).filter((name) => name.startsWith("@ooa/"))) {
    if (!sourceText.includes(dependency)) {
      violations.push(`${relative(root, manifestPath)}: declared internal dependency ${dependency} has no source import`);
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Page structure verified (${assetIds.size} catalogued assets)`);
}
