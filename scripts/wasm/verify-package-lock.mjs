import { resolve } from "node:path";

import { verifyWasmPackageLock } from "./package-lock-utils.mjs";

const websiteRoot = resolve(new URL("../..", import.meta.url).pathname);
const lock = await verifyWasmPackageLock(websiteRoot);
for (const item of lock.packages) {
  console.log(`${item.packageName}@${item.packageVersion} locked=${item.sourceCommit} content=${item.publishedContentSha256}`);
}
