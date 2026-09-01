import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  PACKAGE_CONTRACTS,
  verifyMaterializedPackages,
} from "../../scripts/wasm/verify-packages.mjs";

async function createPackage(root, contract, omittedSuffix = null) {
  const directory = join(root, contract.directory);
  await mkdir(join(directory, "dist"), { recursive: true });
  await writeFile(join(directory, "package.json"), JSON.stringify({
    name: contract.packageName,
    version: "2.0.0",
    exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } },
  }));
  const files = [
    "index.js",
    "index.d.ts",
    `model${contract.moduleStem}.worker.js`,
    `_${contract.moduleStem}_native_single-thread.mjs`,
    `_${contract.moduleStem}_native_single-thread.wasm`,
  ];
  for (const file of files) {
    if (omittedSuffix !== null && file.endsWith(omittedSuffix)) continue;
    await writeFile(
      join(directory, "dist", file),
      file === "index.d.ts"
        ? "horizontalVelocityInterleaved verticalVelocityInterleaved"
        : "fixture",
    );
  }
}

test("accepts the three complete local OpenOcean WASM packages", async () => {
  const root = await mkdtemp(join(tmpdir(), "ooa-wasm-packages-"));
  await Promise.all(PACKAGE_CONTRACTS.map((contract) => createPackage(root, contract)));

  const report = await verifyMaterializedPackages(root);

  assert.deepEqual(report.map(({ packageName }) => packageName), [
    "@openocean/field-bellhop-2d",
    "@openocean/field-normal-mode-kraken",
    "@openocean/field-pe-ram",
  ]);
});

test("rejects a package that has no WebAssembly binary", async () => {
  const root = await mkdtemp(join(tmpdir(), "ooa-wasm-packages-"));
  await Promise.all(PACKAGE_CONTRACTS.map((contract) => (
    createPackage(root, contract, contract.packageName.endsWith("kraken") ? ".wasm" : null)
  )));

  await assert.rejects(
    verifyMaterializedPackages(root),
    /field-normal-mode-kraken.*\.wasm/,
  );
});

test("rejects an export whose declaration target is absent", async () => {
  const root = await mkdtemp(join(tmpdir(), "ooa-wasm-packages-"));
  await Promise.all(PACKAGE_CONTRACTS.map((contract) => createPackage(root, contract)));
  const broken = join(root, PACKAGE_CONTRACTS[0].directory, "package.json");
  await writeFile(broken, JSON.stringify({
    name: PACKAGE_CONTRACTS[0].packageName,
    version: "2.0.0",
    exports: { ".": { types: "./dist/missing.d.ts", import: "./dist/index.js" } },
  }));

  await assert.rejects(
    verifyMaterializedPackages(root),
    /field-bellhop-2d.*exports.*missing\.d\.ts/,
  );
});

test("rejects a Bellhop2D package that omits the velocity field contract", async () => {
  const root = await mkdtemp(join(tmpdir(), "ooa-wasm-packages-"));
  await Promise.all(PACKAGE_CONTRACTS.map((contract) => createPackage(root, contract)));
  await writeFile(
    join(root, PACKAGE_CONTRACTS[0].directory, "dist", "index.d.ts"),
    "export interface PressureField { readonly pressureInterleaved: Float32Array }",
  );

  await assert.rejects(
    verifyMaterializedPackages(root),
    /field-bellhop-2d.*horizontalVelocityInterleaved/,
  );
});
