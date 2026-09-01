import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createWasmPackageLock } from "./package-lock-utils.mjs";

const websiteRoot = resolve(new URL("../..", import.meta.url).pathname);
const lock = await createWasmPackageLock(websiteRoot);
await writeFile(
  resolve(websiteRoot, "wasm-package-lock.json"),
  `${JSON.stringify(lock, null, 2)}\n`,
);
console.log("Frozen the three clean Field npm packages in wasm-package-lock.json");
