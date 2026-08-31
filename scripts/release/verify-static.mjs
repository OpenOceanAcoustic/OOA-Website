import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(new URL("../..", import.meta.url).pathname);
const dist = resolve(root, "dist");
const [headers, redirects, assets] = await Promise.all([
  readFile(resolve(dist, "_headers"), "utf8"),
  readFile(resolve(dist, "_redirects"), "utf8"),
  readdir(resolve(dist, "assets")),
]);
assert.match(headers, /Cross-Origin-Opener-Policy:\s*same-origin/);
assert.match(headers, /Cross-Origin-Embedder-Policy:\s*require-corp/);
assert.match(headers, /Content-Type:\s*application\/wasm/);
assert.match(redirects, /\/index\.html\s+200/);
assert.ok(assets.some((file) => file.endsWith(".wasm")), "dist/assets has no WASM binary");
console.log("Static deployment headers, SPA fallback and WASM assets verified");
