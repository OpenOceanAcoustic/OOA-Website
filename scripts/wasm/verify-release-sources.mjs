import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const websiteRoot = resolve(new URL("../..", import.meta.url).pathname);
const argumentsList = process.argv.slice(2);
if (argumentsList.length !== 6) {
  throw new Error("verify-release-sources requires three repository/worktree pairs");
}

const provenance = JSON.parse(await readFile(resolve(websiteRoot, ".wasm-packages/provenance.json"), "utf8"));
const packageNames = [
  "@openocean/field-bellhop-2d",
  "@openocean/field-normal-mode-kraken",
  "@openocean/field-pe-ram",
];

const git = (directory, ...args) => execFileSync("git", ["-C", directory, ...args], { encoding: "utf8" }).trim();

for (let index = 0; index < packageNames.length; index += 1) {
  const sourceRepository = resolve(argumentsList[index * 2]);
  const releaseWorktree = resolve(argumentsList[index * 2 + 1]);
  const expectedCommit = git(sourceRepository, "rev-parse", "origin/main");
  const actualCommit = git(releaseWorktree, "rev-parse", "HEAD");
  const record = provenance.packages.find((item) => item.packageName === packageNames[index]);
  if (actualCommit !== expectedCommit) {
    throw new Error(`${packageNames[index]} release worktree is ${actualCommit}, expected origin/main ${expectedCommit}`);
  }
  if (record === undefined || record.sourceDirty || record.sourceCommit !== expectedCommit) {
    throw new Error(`${packageNames[index]} provenance is not the clean origin/main commit`);
  }
}

console.log("Release packages were built from clean origin/main worktrees");
