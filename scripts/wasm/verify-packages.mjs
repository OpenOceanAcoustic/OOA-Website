import { pathToFileURL } from "node:url";
import { access, readFile, readdir, realpath } from "node:fs/promises";
import { resolve, join } from "node:path";
import { directorySha256, fileSha256, sourceStateSha256 } from "./provenance-utils.mjs";

export const PACKAGE_CONTRACTS = Object.freeze([
  Object.freeze({
    directory: "field-bellhop-2d",
    packageName: "@openocean/field-bellhop-2d",
    moduleStem: "bellhop_2d",
    requiredTypeDeclarations: Object.freeze([
      "horizontalVelocityInterleaved",
      "verticalVelocityInterleaved",
    ]),
  }),
  Object.freeze({
    directory: "field-normal-mode-kraken",
    packageName: "@openocean/field-normal-mode-kraken",
    moduleStem: "kraken",
  }),
  Object.freeze({
    directory: "field-pe-ram",
    packageName: "@openocean/field-pe-ram",
    moduleStem: "ram",
  }),
]);

async function walk(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(path));
    else result.push(path);
  }
  return result;
}

export async function verifyMaterializedPackages(activeRoot) {
  const report = [];
  for (const contract of PACKAGE_CONTRACTS) {
    const directory = join(activeRoot, contract.directory);
    let packageJson;
    let files;
    try {
      packageJson = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
      files = (await walk(join(directory, "dist"))).map((path) => path.slice(directory.length + 1));
    } catch (error) {
      throw new Error(`${contract.packageName} is not materialized at ${directory}: ${error.message}`);
    }
    if (packageJson.name !== contract.packageName) {
      throw new Error(`${contract.packageName} has package name ${packageJson.name}`);
    }
    if (typeof packageJson.version !== "string" || packageJson.version.length === 0) {
      throw new Error(`${contract.packageName} has no package version`);
    }
    const packageExport = packageJson.exports?.["."];
    for (const condition of ["types", "import"]) {
      const target = packageExport?.[condition];
      if (typeof target !== "string" || !target.startsWith("./")) {
        throw new Error(`${contract.packageName} exports.${condition} is invalid`);
      }
      try {
        await access(join(directory, target));
      } catch {
        throw new Error(`${contract.packageName} exports.${condition} target ${target} is missing`);
      }
    }
    for (const suffix of ["index.js", "index.d.ts", ".worker.js", ".mjs", ".wasm"]) {
      if (!files.some((file) => file.endsWith(suffix))) {
        throw new Error(`${contract.packageName} is missing a ${suffix} runtime file`);
      }
    }
    if (contract.requiredTypeDeclarations !== undefined) {
      const declarationFiles = files.filter((file) => file.endsWith(".d.ts"));
      const declarations = (await Promise.all(
        declarationFiles.map((file) => readFile(join(directory, file), "utf8")),
      )).join("\n");
      for (const symbol of contract.requiredTypeDeclarations) {
        if (!declarations.includes(symbol)) {
          throw new Error(`${contract.packageName} declarations are missing ${symbol}`);
        }
      }
    }
    report.push({
      packageName: contract.packageName,
      version: packageJson.version,
      runtimeFileCount: files.length,
    });
  }
  return report;
}

export async function verifyInstalledPackageLinks(websiteRoot, activeRoot) {
  for (const contract of PACKAGE_CONTRACTS) {
    const installed = join(websiteRoot, "node_modules", ...contract.packageName.split("/"));
    const active = join(activeRoot, contract.directory);
    let installedTarget;
    try {
      installedTarget = await realpath(installed);
    } catch (error) {
      throw new Error(`${contract.packageName} is not installed: ${error.message}`);
    }
    if (installedTarget !== await realpath(active)) {
      throw new Error(`${contract.packageName} is not linked to ${active}`);
    }
  }
}

export async function verifyProvenance(websiteRoot, activeRoot) {
  const provenancePath = join(websiteRoot, ".wasm-packages", "provenance.json");
  let provenance;
  try {
    provenance = JSON.parse(await readFile(provenancePath, "utf8"));
  } catch (error) {
    throw new Error(`WASM provenance is missing or invalid: ${error.message}`);
  }
  const generatedFiles = await walk(join(websiteRoot, ".wasm-packages", "generated"));
  for (const contract of PACKAGE_CONTRACTS) {
    const record = provenance.packages?.find((item) => item.packageName === contract.packageName);
    if (record === undefined) throw new Error(`${contract.packageName} has no provenance record`);
    const activeDirectory = join(activeRoot, contract.directory);
    const packageJson = JSON.parse(await readFile(join(activeDirectory, "package.json"), "utf8"));
    if (record.packageVersion !== packageJson.version) {
      throw new Error(`${contract.packageName} provenance version does not match the active package`);
    }
    const tarballs = generatedFiles.filter((path) => path.endsWith(`/${record.tarball}`));
    if (tarballs.length !== 1 || await fileSha256(tarballs[0]) !== record.tarballSha256) {
      throw new Error(`${contract.packageName} generated tarball hash does not match provenance`);
    }
    if (await directorySha256(activeDirectory) !== record.activeContentSha256) {
      throw new Error(`${contract.packageName} active package contents do not match provenance`);
    }
    if (await sourceStateSha256(record.sourceDirectory) !== record.sourceStateSha256) {
      throw new Error(`${contract.packageName} source working tree changed after the package was built; run npm run wasm:sync`);
    }
  }
}

async function main() {
  const websiteRoot = resolve(new URL("../..", import.meta.url).pathname);
  const activeRoot = process.argv[2] ? resolve(process.argv[2]) : join(websiteRoot, ".wasm-packages", "active");
  const report = await verifyMaterializedPackages(activeRoot);
  if (!process.argv[2]) {
    await verifyInstalledPackageLinks(websiteRoot, activeRoot);
    await verifyProvenance(websiteRoot, activeRoot);
  }
  for (const item of report) {
    console.log(`${item.packageName}@${item.version}: ${item.runtimeFileCount} runtime files`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  await main();
}
