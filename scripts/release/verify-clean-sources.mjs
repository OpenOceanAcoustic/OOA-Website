import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(new URL("../..", import.meta.url).pathname);
const provenancePath = resolve(root, ".wasm-packages/provenance.json");
const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
const dirtyPackages = provenance.packages.filter((item) => item.sourceDirty);

if (dirtyPackages.length > 0) {
  const details = dirtyPackages
    .map((item) => `${item.packageName} (${item.sourceCommit})`)
    .join(", ");
  console.error(`Release blocked: Field sources must be clean commits. Dirty packages: ${details}`);
  process.exitCode = 1;
} else {
  console.log("All release Field sources are clean commits");
}
