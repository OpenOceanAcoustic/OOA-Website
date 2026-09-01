import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(new URL("../..", import.meta.url).pathname);
const provenancePath = resolve(root, ".wasm-packages/provenance.json");
const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
const lock = JSON.parse(await readFile(resolve(root, "wasm-package-lock.json"), "utf8"));
const dirtyPackages = provenance.packages.filter((item) => item.sourceDirty);

if (dirtyPackages.length > 0) {
  const details = dirtyPackages
    .map((item) => `${item.packageName} (${item.sourceCommit})`)
    .join(", ");
  console.error(`Release blocked: Field sources must be clean commits. Dirty packages: ${details}`);
  process.exitCode = 1;
} else {
  const git = (directory, ...args) => execFileSync("git", ["-C", directory, ...args], { encoding: "utf8" }).trim();
  const stalePackages = provenance.packages.filter((item) => {
    const locked = lock.packages.find((candidate) => candidate.packageName === item.packageName);
    return locked === undefined
      || item.sourceCommit !== locked.sourceCommit
      || git(item.sourceDirectory, "rev-parse", "HEAD") !== locked.sourceCommit
      || git(item.sourceDirectory, "status", "--porcelain") !== "";
  });
  if (stalePackages.length > 0) {
    console.error(`Release blocked: provenance is not pinned to the frozen clean commits: ${stalePackages.map((item) => item.packageName).join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log("All release Field sources match the frozen clean commits");
  }
}
