import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { assetCatalog } from "./catalog";

const assetRoot = resolve(import.meta.dirname);
const allowedKinds = new Set(["brand", "icon", "illustration", "texture"]);

describe("@ooa/assets catalog", () => {
  it("contains unique, existing, in-package visual resources", async () => {
    expect(new Set(assetCatalog.map((asset) => asset.id)).size).toBe(assetCatalog.length);
    for (const asset of assetCatalog) {
      expect(allowedKinds.has(asset.kind)).toBe(true);
      expect(asset.path.startsWith("/")).toBe(false);
      expect(asset.path.split("/")).not.toContain("..");
      await expect(access(resolve(assetRoot, asset.path))).resolves.toBeUndefined();
    }
  });

  it("does not classify model inputs or binaries as page assets", () => {
    for (const asset of assetCatalog) {
      expect(asset.path).not.toMatch(/\.(?:env|flp|in|json|wasm|mjs)$/i);
    }
  });
});
