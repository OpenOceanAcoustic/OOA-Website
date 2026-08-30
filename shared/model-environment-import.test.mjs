import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseNormalModeEnvironmentDocuments,
  parsePEEnvironmentDocuments,
} from "./model-environment-import.js";

async function fixture(name) {
  return readFile(new URL(`../tests/${name}`, import.meta.url), "utf8");
}

test("routes same-stem Kraken ENV and FLP text to the native parser", async () => {
  const [envText, flpText] = await Promise.all([fixture("MunkK.env"), fixture("MunkK.flp")]);
  let calls = 0;
  const result = await parseNormalModeEnvironmentDocuments([
    { name: "MunkK.env", data: envText },
    { name: "MunkK.flp", data: flpText },
  ], async (input) => {
    calls += 1;
    assert.match(input.envText, /BBMunk profile/);
    assert.match(input.flpText, /'RA'/);
    return { title: "BBMunk profile", frequencyHz: 50 };
  });
  assert.equal(calls, 1);
  assert.equal(result.format, "kraken-env-flp");
  assert.deepEqual(result.sourceFiles, ["MunkK.env", "MunkK.flp"]);
});

test("rejects a missing or mismatched Kraken FLP", async () => {
  const envText = await fixture("MunkK.env");
  await assert.rejects(
    parseNormalModeEnvironmentDocuments([{ name: "MunkK.env", data: envText }], () => ({})),
    /one Kraken \.env and one same-stem \.flp/,
  );
  await assert.rejects(
    parseNormalModeEnvironmentDocuments([
      { name: "MunkK.env", data: envText },
      { name: "other.flp", data: "'RA'" },
    ], () => ({})),
    /same stem/,
  );
});

test("routes RAM IN text to the native parser", async () => {
  const text = await fixture("ram.in");
  const result = await parsePEEnvironmentDocuments([
    { name: "ram.in", data: text },
  ], async (input) => {
    assert.match(input.text, /range-dependent example/);
    return { title: "range-dependent example", frequencyHz: 25 };
  });
  assert.equal(result.format, "ram-in");
  assert.equal(result.frequencyHz, 25);
  assert.deepEqual(result.sourceFiles, ["ram.in"]);
});

test("both model routes retain the shared JSON contract", async () => {
  const json = await fixture("Pekeris.environment.json");
  const normal = await parseNormalModeEnvironmentDocuments([
    { name: "Pekeris.environment.json", data: json },
  ], () => { throw new Error("native parser must not be called"); });
  const pe = await parsePEEnvironmentDocuments([
    { name: "Pekeris.environment.json", data: json },
  ], () => { throw new Error("native parser must not be called"); });
  assert.equal(normal.format, "json");
  assert.equal(pe.format, "json");
  assert.deepEqual(pe.profilePoints, [[0, 1500], [200, 1500]]);
});

test("PE rejects Bellhop ENV instead of guessing its grammar", async () => {
  await assert.rejects(
    parsePEEnvironmentDocuments([{ name: "case.env", data: "'Bellhop'" }], () => ({})),
    /unsupported environment file/,
  );
});
