import { KrakenInput } from "@openocean/field-normal-mode-kraken";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { adaptNormalModeEnvironmentFiles } from "./import-compatibility";

const fixture = (name: string) => readFile(resolve(import.meta.dirname, "../../../tests/fixtures", name), "utf8");

function fileText(file: File): Promise<string> {
  return new Promise((resolveText, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolveText(String(reader.result ?? "")), { once: true });
    reader.addEventListener("error", () => reject(reader.error), { once: true });
    reader.readAsText(file);
  });
}

describe("Normal Mode import compatibility", () => {
  it("routes a JSON object saved with an ENV extension to the JSON parser", async () => {
    const source = new File(["\uFEFF  {\"title\":\"fixture\"}"], "fixture.env", { type: "text/plain", lastModified: 42 });
    const adapted = await adaptNormalModeEnvironmentFiles([source]);

    expect(adapted[0]).not.toBe(source);
    expect(adapted[0]).toMatchObject({ name: "fixture.json", type: "application/json", lastModified: 42 });
    expect(adapted[0]?.size).toBe(source.size);
  });

  it("does not classify an ordinary Kraken ENV as JSON", async () => {
    const source = new File(["'KRAKEN fixture'\n100.0\n1"], "fixture.env");
    await expect(adaptNormalModeEnvironmentFiles([source])).resolves.toBeInstanceOf(Array);
    expect(await adaptNormalModeEnvironmentFiles([source])).toEqual([source]);
  });

  it("does not rewrite either member of an ENV/FLP selection", async () => {
    const env = new File(["{not JSON in this native pair"], "fixture.env");
    const flp = new File(["'RA'"], "fixture.flp");
    expect(await adaptNormalModeEnvironmentFiles([env, flp])).toEqual([env, flp]);
  });

  it("normalizes the one-profile legacy FLP shorthand without changing its supplied range", async () => {
    const envText = await fixture("MunkK.env");
    const flpText = (await fixture("MunkK.flp")).replace("0.0 100.0 /", "0.0 /");
    const env = new File([envText], "MunkK.env");
    const flp = new File([flpText], "MunkK.flp");
    const adapted = await adaptNormalModeEnvironmentFiles([env, flp]);
    const adaptedFlp = adapted.find((file) => file.name.endsWith(".flp"));
    expect(adaptedFlp).toBeDefined();
    const normalizedFlp = await fileText(adaptedFlp!);
    expect(normalizedFlp).toContain("0.0 0.0 /");

    expect(() => KrakenInput.fromEnvironmentFiles({
      env: { name: env.name, text: envText },
      flp: { name: adaptedFlp!.name, text: normalizedFlp },
    })).not.toThrow();
  });
});
