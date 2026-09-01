import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const script = resolve(import.meta.dirname, "../../scripts/wasm/verify-sources.sh");

async function sourceFixture(root, name, binding, marker) {
  const source = join(root, name);
  await mkdir(join(source, binding), { recursive: true });
  await writeFile(join(source, "CMakeLists.txt"), "cmake_minimum_required(VERSION 3.20)\n");
  await writeFile(join(source, binding, "CMakeLists.txt"), `${marker}\n`);
  return source;
}

async function createSources() {
  const root = await mkdtemp(join(tmpdir(), "ooa-wasm-sources-"));
  return {
    root,
    ray: await sourceFixture(root, "ray", "bindings/wasm/bellhop_2d", "bellhop_2d_wasm_package"),
    normal: await sourceFixture(root, "normal", "bindings/wasm/kraken", "oonm_add_wasm_model(kraken"),
    pe: await sourceFixture(root, "pe", "bindings/wasm/ram", "oope_add_wasm_model(ram"),
  };
}

function verify(sources) {
  return spawnSync("bash", [script], {
    encoding: "utf8",
    env: {
      ...process.env,
      OOA_RAY_MODE_SOURCE: sources.ray,
      OOA_NORMAL_MODE_SOURCE: sources.normal,
      OOA_PE_SOURCE: sources.pe,
    },
  });
}

test("accepts source overrides with all required bindings and targets", async () => {
  const sources = await createSources();
  assert.equal(verify(sources).status, 0);
});

test("rejects a missing model source path", async () => {
  const sources = await createSources();
  const result = verify({ ...sources, pe: join(sources.root, "absent") });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /PE source directory is missing/);
});

test("rejects a binding that cannot create the required package target", async () => {
  const sources = await createSources();
  await writeFile(join(sources.normal, "bindings/wasm/kraken/CMakeLists.txt"), "# missing target\n");
  const result = verify(sources);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Normal Mode WASM package target marker is missing/);
});
