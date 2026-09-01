import { execFileSync } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { directorySha256, fileSha256, sourceStateSha256 } from "./provenance-utils.mjs";

const [raySource, normalSource, peSource, generatedRoot, activeRoot, outputFile] = process.argv.slice(2);
const sources = [
  ["@openocean/field-bellhop-2d", "field-bellhop-2d", raySource, "openocean-field-bellhop-2d-"],
  ["@openocean/field-normal-mode-kraken", "field-normal-mode-kraken", normalSource, "openocean-field-normal-mode-kraken-"],
  ["@openocean/field-pe-ram", "field-pe-ram", peSource, "openocean-field-pe-ram-"],
];

function git(source, args) {
  return execFileSync("git", ["-C", source, ...args], { encoding: "utf8" }).trim();
}

async function findTarball(prefix) {
  const pending = [generatedRoot];
  const matches = [];
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) pending.push(path);
      else if (entry.name.startsWith(prefix) && entry.name.endsWith(".tgz")) matches.push(path);
    }
  }
  if (matches.length !== 1) throw new Error(`expected one ${prefix}*.tgz, found ${matches.length}`);
  return matches[0];
}

const emscriptenVersion = (() => {
  try {
    return execFileSync("emcc", ["--version"], { encoding: "utf8" }).split("\n", 1)[0].trim();
  } catch {
    return "unavailable";
  }
})();

const packages = [];
for (const [packageName, directory, sourceDirectory, tarballPrefix] of sources) {
  const packageJson = JSON.parse(await readFile(join(activeRoot, directory, "package.json"), "utf8"));
  const tarball = await findTarball(tarballPrefix);
  const digest = await fileSha256(tarball);
  const activeDirectory = join(activeRoot, directory);
  packages.push({
    packageName,
    packageVersion: packageJson.version,
    sourceDirectory,
    sourceCommit: git(sourceDirectory, ["rev-parse", "HEAD"]),
    sourceDirty: git(sourceDirectory, ["status", "--porcelain"]).length > 0,
    sourceStateSha256: await sourceStateSha256(sourceDirectory),
    tarball: basename(tarball),
    tarballSha256: digest,
    activeContentSha256: await directorySha256(activeDirectory),
    builtAt: new Date().toISOString(),
    emscriptenVersion,
  });
}
await writeFile(outputFile, `${JSON.stringify({ packages }, null, 2)}\n`);
