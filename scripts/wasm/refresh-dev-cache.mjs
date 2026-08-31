import { rm } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(new URL("../..", import.meta.url).pathname);
for (const path of [resolve(root, "node_modules/.vite"), resolve(root, "apps/web/node_modules/.vite")]) {
  await rm(path, { recursive: true, force: true });
}
console.log("Vite dependency cache refreshed");
