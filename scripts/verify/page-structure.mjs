import { access, readFile, readdir } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

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

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Page structure verified (${assetIds.size} catalogued assets)`);
}
