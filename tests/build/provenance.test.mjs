import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const script = resolve(import.meta.dirname, "../../scripts/wasm/write-provenance.mjs");
const contracts = [
  ["@openocean/field-bellhop-2d", "field-bellhop-2d", "openocean-field-bellhop-2d-2.0.0.tgz"],
  ["@openocean/field-normal-mode-kraken", "field-normal-mode-kraken", "openocean-field-normal-mode-kraken-2.0.0.tgz"],
  ["@openocean/field-pe-ram", "field-pe-ram", "openocean-field-pe-ram-2.0.0.tgz"],
];

function git(directory, args) {
  const result = spawnSync("git", ["-C", directory, ...args], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

async function gitSource(root, name) {
  const directory = join(root, name);
  await mkdir(directory, { recursive: true });
  git(directory, ["init", "-q"]);
  await writeFile(join(directory, "source.txt"), "clean\n");
  git(directory, ["add", "source.txt"]);
  git(directory, ["-c", "user.name=OOA Test", "-c", "user.email=ooa@example.invalid", "commit", "-qm", "fixture"]);
  return directory;
}

test("records clean and dirty model worktrees with package hashes", async () => {
  const root = await mkdtemp(join(tmpdir(), "ooa-provenance-"));
  const sources = await Promise.all(["ray", "normal", "pe"].map((name) => gitSource(root, name)));
  await writeFile(join(sources[1], "source.txt"), "dirty\n");
  const generated = join(root, "generated");
  const active = join(root, "active");
  await mkdir(generated, { recursive: true });
  for (const [packageName, directory, tarball] of contracts) {
    await mkdir(join(active, directory), { recursive: true });
    await writeFile(join(active, directory, "package.json"), JSON.stringify({ name: packageName, version: "2.0.0" }));
    await writeFile(join(generated, tarball), `${packageName}\n`);
  }
  const output = join(root, "provenance.json");
  const result = spawnSync(process.execPath, [script, ...sources, generated, active, output], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);

  const provenance = JSON.parse(await readFile(output, "utf8"));
  assert.deepEqual(provenance.packages.map((item) => item.sourceDirty), [false, true, false]);
  for (const item of provenance.packages) {
    assert.match(item.sourceCommit, /^[0-9a-f]{40}$/);
    assert.match(item.tarballSha256, /^[0-9a-f]{64}$/);
    assert.match(item.sourceStateSha256, /^[0-9a-f]{64}$/);
    assert.match(item.activeContentSha256, /^[0-9a-f]{64}$/);
    assert.equal(item.packageVersion, "2.0.0");
  }
});
