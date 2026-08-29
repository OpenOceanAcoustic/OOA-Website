import { defineConfig } from "vite";
import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const isolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  optimizeDeps: {
    // The SDK resolves its module worker relative to its own dist/index.js.
    // Keeping it out of Vite's deps cache preserves that URL in dev mode.
    exclude: ["@openocean/field-bellhop-2d"],
  },
  plugins: [{
    name: "copy-bellhop-wasm-runtime",
    async closeBundle() {
      const source = resolve("node_modules/@openocean/field-bellhop-2d/dist");
      const destination = resolve("dist/assets");
      await mkdir(destination, { recursive: true });
      await Promise.all([
        "_bellhop_2d_native.mjs",
        "_bellhop_2d_native.worker.js",
        "_bellhop_2d_native.wasm",
      ].map((file) => copyFile(resolve(source, file), resolve(destination, file))));
    },
  }],
  server: { headers: isolationHeaders },
  preview: { headers: isolationHeaders },
  build: { target: "es2022" },
});
