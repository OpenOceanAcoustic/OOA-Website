import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createWasmPackageLock, verifyWasmPackageLock } from "../../scripts/wasm/package-lock-utils.mjs";
import { directorySha256, fileSha256, sourceStateSha256 } from "../../scripts/wasm/provenance-utils.mjs";
import { PACKAGE_CONTRACTS } from "../../scripts/wasm/verify-packages.mjs";

function git(directory, args) {
  const result = spawnSync("git", ["-C", directory, ...args], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "ooa-wasm-lock-"));
  const generated = join(root, ".wasm-packages", "generated");
  const active = join(root, ".wasm-packages", "active");
  await mkdir(generated, { recursive: true });
  const packages = [];

  for (const contract of PACKAGE_CONTRACTS) {
    const source = join(root, "sources", contract.directory);
    const directory = join(active, contract.directory);
    const tarball = `${contract.directory}.tgz`;
    await mkdir(join(directory, "dist"), { recursive: true });
    await mkdir(source, { recursive: true });
    await writeFile(join(directory, "package.json"), JSON.stringify({
      name: contract.packageName,
      version: "2.0.0",
      exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } },
    }));
    await writeFile(join(directory, "dist", "index.js"), "export {};\n");
    await writeFile(join(directory, "dist", "index.d.ts"), "export {};\n");
    await writeFile(join(generated, tarball), `${contract.packageName}\n`);
    await writeFile(join(source, "source.txt"), `${contract.packageName}\n`);
    git(source, ["init", "-q"]);
    git(source, ["remote", "add", "origin", `https://example.invalid/${contract.directory}.git`]);
    git(source, ["add", "source.txt"]);
    git(source, ["-c", "user.name=OOA Test", "-c", "user.email=ooa@example.invalid", "commit", "-qm", "fixture"]);
    const sourceCommit = git(source, ["rev-parse", "HEAD"]);
    packages.push({
      packageName: contract.packageName,
      packageVersion: "2.0.0",
      sourceDirectory: source,
      sourceCommit,
      sourceDirty: false,
      sourceStateSha256: await sourceStateSha256(source),
      tarball,
      tarballSha256: await fileSha256(join(generated, tarball)),
      activeContentSha256: await directorySha256(directory),
      emscriptenVersion: "emcc fixture",
    });
  }

  await writeFile(
    join(root, ".wasm-packages", "provenance.json"),
    JSON.stringify({ packages }),
  );
  const lock = await createWasmPackageLock(root);
  await writeFile(join(root, "wasm-package-lock.json"), JSON.stringify(lock));
  return { root, active };
}

test("freezes and verifies every published package file", async () => {
  const { root } = await createFixture();
  const lock = await verifyWasmPackageLock(root);
  assert.equal(lock.packages.length, 3);
  assert.ok(lock.packages.every((item) => Object.keys(item.files).includes("dist/index.js")));
});

test("rejects a published file changed after the freeze", async () => {
  const { root, active } = await createFixture();
  await writeFile(join(active, PACKAGE_CONTRACTS[0].directory, "dist", "index.js"), "changed\n");
  await assert.rejects(verifyWasmPackageLock(root), /published contents differ/);
});

test("lock writer records repository URL and exact source commit", async () => {
  const { root } = await createFixture();
  const lock = JSON.parse(await readFile(join(root, "wasm-package-lock.json"), "utf8"));
  assert.match(lock.packages[0].sourceRepository, /^https:\/\/example\.invalid\//);
  assert.match(lock.packages[0].sourceCommit, /^[0-9a-f]{40}$/);
});
