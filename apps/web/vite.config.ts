import react from "@vitejs/plugin-react";
import { copyFile, mkdir, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

const websiteRoot = resolve(import.meta.dirname, "../..");
const outputDirectory = resolve(websiteRoot, "dist");
const packageDirectories = [
  "field-bellhop-2d",
  "field-normal-mode-kraken",
  "field-pe-ram",
];

function localWasmAssets(): Plugin {
  return {
    name: "ooa-local-wasm-assets",
    async closeBundle() {
      const destination = resolve(outputDirectory, "assets");
      await mkdir(destination, { recursive: true });
      for (const packageDirectory of packageDirectories) {
        const source = resolve(websiteRoot, ".wasm-packages/active", packageDirectory, "dist");
        for (const entry of await readdir(source, { withFileTypes: true })) {
          if (entry.isFile() && /(?:\.mjs|\.wasm)$/.test(entry.name)) {
            await copyFile(resolve(source, entry.name), resolve(destination, entry.name));
          }
        }
      }
    },
  };
}

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react(), localWasmAssets()],
  build: { outDir: outputDirectory, emptyOutDir: true, sourcemap: true },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    fs: { allow: [websiteRoot] },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  optimizeDeps: {
    exclude: [
      "@openocean/field-bellhop-2d",
      "@openocean/field-normal-mode-kraken",
      "@openocean/field-pe-ram",
    ],
  },
});
