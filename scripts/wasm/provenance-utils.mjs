import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

export async function fileSha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function filesBelow(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name === "node_modules") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(path));
    else if (entry.isFile()) files.push(path);
  }
  return files.sort();
}

export async function directorySha256(directory) {
  const hash = createHash("sha256");
  for (const path of await filesBelow(directory)) {
    hash.update(relative(directory, path).replaceAll("\\", "/"));
    hash.update("\0");
    hash.update(await readFile(path));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export async function sourceStateSha256(sourceDirectory) {
  const hash = createHash("sha256");
  const commit = execFileSync("git", ["-C", sourceDirectory, "rev-parse", "HEAD"]);
  const trackedDiff = execFileSync("git", ["-C", sourceDirectory, "diff", "--binary", "HEAD", "--"]);
  const untrackedOutput = execFileSync(
    "git",
    ["-C", sourceDirectory, "ls-files", "--others", "--exclude-standard", "-z"],
  ).toString("utf8");
  hash.update(commit);
  hash.update(trackedDiff);
  const untracked = untrackedOutput.split("\0").filter(Boolean).sort();
  for (const relativePath of untracked) {
    hash.update(relativePath);
    hash.update("\0");
    hash.update(await readFile(join(sourceDirectory, relativePath)));
    hash.update("\0");
  }
  return hash.digest("hex");
}
