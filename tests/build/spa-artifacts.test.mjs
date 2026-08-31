import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const websiteRoot = resolve(import.meta.dirname, "../..");
const distRoot = resolve(websiteRoot, "dist");

async function collectFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...await collectFiles(resolve(directory, entry.name), relativePath));
    } else {
      files.push(relativePath);
    }
  }
  return files;
}

test("production SPA ships exactly the three first-phase model families", async () => {
  const files = await collectFiles(distRoot);
  assert.ok(files.includes("index.html"));

  for (const workerPrefix of ["bellhop2d.worker-", "kraken.worker-", "ram.worker-"]) {
    assert.equal(
      files.filter((file) => file.startsWith(`assets/${workerPrefix}`) && file.endsWith(".js")).length,
      1,
      `${workerPrefix} must have one hashed worker`,
    );
  }

  const expectedNativeAssets = [
    "_bellhop_2d_native_pthread.mjs",
    "_bellhop_2d_native_pthread.wasm",
    "_bellhop_2d_native_single-thread.mjs",
    "_bellhop_2d_native_single-thread.wasm",
    "_kraken_native_pthread.mjs",
    "_kraken_native_pthread.wasm",
    "_kraken_native_single-thread.mjs",
    "_kraken_native_single-thread.wasm",
    "_ram_native_single-thread.mjs",
    "_ram_native_single-thread.wasm",
  ];
  for (const asset of expectedNativeAssets) {
    assert.ok(files.includes(`assets/${asset}`), `${asset} is missing`);
  }

  const searchable = await Promise.all(
    files
      .filter((file) => /\.(?:html|js|mjs|map)$/.test(file))
      .map(async (file) => `${file}\n${await readFile(resolve(distRoot, file), "utf8")}`),
  );
  const bundleText = searchable.join("\n").toLowerCase();
  for (const forbidden of ["nx2d", "bellhop3d", "krakenc", "ramgeo", "rams.worker"]) {
    assert.equal(bundleText.includes(forbidden), false, `${forbidden} leaked into production output`);
  }
});
