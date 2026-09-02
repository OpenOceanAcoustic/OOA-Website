import { describe, expect, it, vi } from "vitest";
import { createPePageEngine } from "./page-engine";
import { parsePeEnvironmentFiles, peImportErrorDetail, unsupportedRamFamily } from "./pe-file-import";

const RAM_TEXT = `'RAM fluid bottom'
100 20 30
1000 100 1
100 5 1 100
1500 4 0 0
0 80
1000 80
-1 -1
0 1500
100 1500
-1 -1
0 1600
100 1600
-1 -1
0 1.6
100 1.6
-1 -1
0 0.2
100 0.2
-1 -1`;

const RAMS_TEXT = `'elastic bottom'
50 0 20 1
30 -1
500 50 1
120 5 1 100
1500 3 0 0
0 80`;

function inputFile(name: string, text: string, size = new TextEncoder().encode(text).byteLength): File {
  return { name, size, text: async () => text } as File;
}

describe("PE file adaptation", () => {
  it.each([
    ["ram.in", "ram-in"],
    ["ram.env", "ram-env"],
  ])("routes %s through the same native RAM parser", async (name, format) => {
    const parseRam = vi.fn(async ({ text }: { readonly text: string }) => ({ title: "parsed", text }));
    await expect(parsePeEnvironmentFiles([inputFile(name, RAM_TEXT)], parseRam)).resolves.toMatchObject({
      format,
      sourceFiles: [name],
      title: "parsed",
    });
    expect(parseRam).toHaveBeenCalledWith({ name, text: RAM_TEXT, sourceFiles: [name] });
  });

  it("accepts a RAM .env through the real native token parser", async () => {
    const engine = createPePageEngine();
    try {
      await expect(parsePeEnvironmentFiles(
        [inputFile("renamed.env", RAM_TEXT)],
        engine.importEnvironment,
      )).resolves.toMatchObject({
        format: "ram-env",
        title: "'RAM fluid bottom'",
        frequencyHz: 100,
        sourceDepthM: 20,
        modelHints: { model: "RAM" },
      });
    } finally {
      await engine.dispose();
    }
  });

  it("surfaces the native parser reason instead of a generic import error", async () => {
    const engine = createPePageEngine();
    await expect(engine.importEnvironment({ name: "broken.env", text: "not RAM" }))
      .rejects.toThrow("RAM 输入无法解析：RAM .in file is incomplete");
    await engine.dispose();
  });

  it.each(["exported.env", "exported.in"])(
    "sniffs a unified JSON object saved as %s before native RAM parsing",
    async (name) => {
      const parseRam = vi.fn();
      const json = JSON.stringify({
        title: "Unified PE fixture",
        frequencyHz: 100,
        waterDepthM: 200,
        sourceDepthM: 50,
        maximumRangeKm: 20,
        profilePoints: [[0, 1500], [200, 1510]],
        bathymetry: [[0, 200], [20, 200]],
        bottomSoundSpeedMps: 1700,
        bottomDensityKgM3: 1800,
        bottomAttenuationDbPerWavelength: 0.5,
      });

      await expect(parsePeEnvironmentFiles([inputFile(name, json)], parseRam))
        .resolves.toMatchObject({ title: "Unified PE fixture", format: "json" });
      expect(parseRam).not.toHaveBeenCalled();
    },
  );
  it("recognises RAMS from its receiver-list token shape before native parsing", async () => {
    const parseRam = vi.fn();
    expect(unsupportedRamFamily("input.env", RAMS_TEXT)).toBe("RAMS");
    await expect(parsePeEnvironmentFiles([inputFile("input.env", RAMS_TEXT)], parseRam))
      .rejects.toThrow("检测到 RAMS 输入");
    expect(parseRam).not.toHaveBeenCalled();
  });

  it.each([
    ["ramgeo.env", RAM_TEXT, "RAMGeo"],
    ["input.in", "'RAMGeo sloping bottom'\n" + RAM_TEXT, "RAMGeo"],
    ["rams.env", RAM_TEXT, "RAMS"],
  ])("recognises an explicit model marker in %s", (name, text, model) => {
    expect(unsupportedRamFamily(name, text)).toBe(model);
  });

  it("preserves strict file-count, extension and size validation", async () => {
    const parseRam = vi.fn();
    await expect(parsePeEnvironmentFiles([], parseRam)).rejects.toThrow("需要且只允许选择一个");
    await expect(parsePeEnvironmentFiles([inputFile("ram.txt", RAM_TEXT)], parseRam))
      .rejects.toThrow("不支持的 PE 文件");
    await expect(parsePeEnvironmentFiles([inputFile("ram.env", RAM_TEXT, 32 * 1024 * 1024 + 1)], parseRam))
      .rejects.toThrow("超过 32 MiB 限制");
    expect(parseRam).not.toHaveBeenCalled();
  });

  it("keeps nested native parser details for the UI", () => {
    const native = new SyntaxError("RAM .in plot maximum depth is missing or invalid");
    const wrapped = new Error("native parse failed", { cause: native });
    expect(peImportErrorDetail(wrapped)).toBe(
      "native parse failed：RAM .in plot maximum depth is missing or invalid",
    );
  });
});
