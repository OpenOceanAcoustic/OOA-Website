import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const websiteRoot = resolve(new URL("../..", import.meta.url).pathname);
const argumentsList = process.argv.slice(2);
const mode = argumentsList.shift();
if (!["--freeze", "--locked"].includes(mode) || argumentsList.length !== 6) {
  throw new Error("verify-release-sources requires a mode and three repository/worktree pairs");
}

const provenance = JSON.parse(await readFile(resolve(websiteRoot, ".wasm-packages/provenance.json"), "utf8"));
const packageNames = [
  "@openocean/field-bellhop-2d",
  "@openocean/field-normal-mode-kraken",
  "@openocean/field-pe-ram",
];
const lock = mode === "--locked"
  ? JSON.parse(await readFile(resolve(websiteRoot, "wasm-package-lock.json"), "utf8"))
  : null;

const git = (directory, ...args) => execFileSync("git", ["-C", directory, ...args], { encoding: "utf8" }).trim();

for (let index = 0; index < packageNames.length; index += 1) {
  const sourceRepository = resolve(argumentsList[index * 2]);
  const releaseWorktree = resolve(argumentsList[index * 2 + 1]);
  const expectedCommit = mode === "--freeze"
    ? git(sourceRepository, "rev-parse", "origin/main")
    : lock.packages.find((item) => item.packageName === packageNames[index])?.sourceCommit;
  const actualCommit = git(releaseWorktree, "rev-parse", "HEAD");
  const record = provenance.packages.find((item) => item.packageName === packageNames[index]);
  if (typeof expectedCommit !== "string") {
    throw new Error(`${packageNames[index]} is missing from wasm-package-lock.json`);
  }
  if (actualCommit !== expectedCommit) {
    throw new Error(`${packageNames[index]} release worktree is ${actualCommit}, expected ${expectedCommit}`);
  }
  if (record === undefined || record.sourceDirty || record.sourceCommit !== expectedCommit) {
    throw new Error(`${packageNames[index]} provenance is not the expected clean commit`);
  }
}

console.log(mode === "--freeze"
  ? "Release packages were built from clean origin/main worktrees"
  : "Release packages were rebuilt from the frozen clean commits");
