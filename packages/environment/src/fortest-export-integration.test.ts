import { readdir, readFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { parseEnvironmentDocuments, parseEnvironmentJson } from "./browser-page-import";

const fixtureRoot = process.env.OOA_FORTEST_JSON_ROOT;
const expectedBackends = [
  "normal_mode.kraken",
  "normal_mode.krakenc",
  "pe.ram",
  "pe.ramgeo",
  "pe.rams",
  "ray_mode.bellhop.2d",
];

async function jsonFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
}

describe("FieldRunner fortest export integration", () => {
  it.skipIf(fixtureRoot === undefined)("imports every exported six-model FieldDocument", async () => {
    const root = fixtureRoot as string;
    const files = await jsonFiles(root);
    let projectedCount = 0;
    let receiverPointCount = 0;
    const failures: string[] = [];

    for (const file of files) {
      try {
        const text = await readFile(file, "utf8");
        const source = JSON.parse(text) as {
          documentInfo?: { formatRevision?: number };
          runs?: { backend?: string }[];
        };
        expect(source.documentInfo?.formatRevision).toBe(4);
        expect((source.runs ?? []).map((run) => run.backend).sort()).toEqual(expectedBackends);
        const parsed = parseEnvironmentJson(source);
        expect(parsed.adaptiveParser).toBe("field-document");
        expect(parsed.profilePoints.length).toBeGreaterThanOrEqual(2);
        expect(parsed.frequencyHz).toBeGreaterThan(0);
        expect(parsed.waterDepthM).toBeGreaterThan(0);
        expect(parsed.maximumRangeKm).toBeGreaterThan(0);
        const routed = parseEnvironmentDocuments([{
          name: basename(file),
          data: text,
          size: Buffer.byteLength(text),
        }]);
        expect(routed.title).toBe(parsed.title);
        if (parsed.projectionMode !== "EXACT") projectedCount += 1;
        receiverPointCount += Number(parsed.receiverPointCount ?? 0);
      } catch (error) {
        failures.push(
          relative(root, file) + ": " + (error instanceof Error ? error.message : String(error)),
        );
      }
    }

    expect(files).toHaveLength(117);
    expect(projectedCount).toBeGreaterThan(0);
    expect(receiverPointCount).toBe(22_407_379);
    expect(failures, failures.join("\n")).toEqual([]);
  }, 60_000);
});
