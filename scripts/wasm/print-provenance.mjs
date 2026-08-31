import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const path = resolve(new URL("../..", import.meta.url).pathname, ".wasm-packages/provenance.json");
const provenance = JSON.parse(await readFile(path, "utf8"));
for (const item of provenance.packages) {
  console.log(`${item.packageName}@${item.packageVersion} commit=${item.sourceCommit} dirty=${item.sourceDirty} sha256=${item.tarballSha256}`);
}
