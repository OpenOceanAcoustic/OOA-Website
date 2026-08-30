import { defineConfig } from "vite";
import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const isolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

const wasmRuntimes = [
  {
    packageName: "@openocean/field-bellhop-2d",
    runtimeDirectory: "dist",
    files: [
      "_bellhop_2d_native.mjs",
      "_bellhop_2d_native.worker.js",
      "_bellhop_2d_native.wasm",
    ],
  },
  {
    packageName: "@openocean/field-normal-mode-kraken",
    runtimeDirectory: "dist",
    files: [
      "_kraken_native_pthread.mjs",
      "_kraken_native_pthread.wasm",
      "_kraken_native_single-thread.mjs",
      "_kraken_native_single-thread.wasm",
    ],
  },
  {
    packageName: "@openocean/field-pe-ram",
    runtimeDirectory: "dist",
    files: [
      "_ram_native_single-thread.mjs",
      "_ram_native_single-thread.wasm",
    ],
  },
];

export default defineConfig({
  optimizeDeps: {
    // Each SDK resolves a module worker relative to its own dist/index.js.
    // Keeping them out of Vite's deps cache preserves those URLs in dev mode.
    exclude: wasmRuntimes.map(({ packageName }) => packageName),
  },
  plugins: [{
    name: "copy-openocean-wasm-runtimes",
    async closeBundle() {
      const destination = resolve("dist/assets");
      await mkdir(destination, { recursive: true });
      await Promise.all(wasmRuntimes.flatMap(({ packageName, runtimeDirectory, files }) => {
        const source = resolve("node_modules", packageName, runtimeDirectory);
        return files.map((file) => (
          copyFile(resolve(source, file), resolve(destination, file))
        ));
      }));
    },
  }],
  server: { headers: isolationHeaders },
  preview: { headers: isolationHeaders },
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        rayMode: resolve("index.html"),
        normalMode: resolve("normal-mode/index.html"),
        pe: resolve("pe/index.html"),
      },
    },
  },
});
