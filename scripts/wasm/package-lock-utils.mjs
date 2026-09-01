import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { PACKAGE_CONTRACTS } from "./verify-packages.mjs";
import { directorySha256, fileSha256 } from "./provenance-utils.mjs";

export const WASM_PACKAGE_LOCK_VERSION = 1;

async function filesBelow(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name === "node_modules") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(path));
    else if (entry.isFile()) files.push(path);
  }
  return files.sort();
}

async function publishedFileHashes(directory) {
  const hashes = {};
  for (const path of await filesBelow(directory)) {
    hashes[relative(directory, path).replaceAll("\\", "/")] = await fileSha256(path);
  }
  return hashes;
}

async function generatedTarballs(websiteRoot) {
  return filesBelow(join(websiteRoot, ".wasm-packages", "generated"));
}

function git(directory, ...args) {
  return execFileSync("git", ["-C", directory, ...args], { encoding: "utf8" }).trim();
}

function packageRecord(records, packageName, source) {
  const record = records.find((item) => item.packageName === packageName);
  if (record === undefined) throw new Error(`${packageName} is missing from ${source}`);
  return record;
}

export async function createWasmPackageLock(websiteRoot) {
  const root = resolve(websiteRoot);
  const provenance = JSON.parse(await readFile(join(root, ".wasm-packages", "provenance.json"), "utf8"));
  const packages = [];

  for (const contract of PACKAGE_CONTRACTS) {
    const record = packageRecord(provenance.packages ?? [], contract.packageName, "provenance");
    if (record.sourceDirty) {
      throw new Error(`${contract.packageName} cannot be frozen from a dirty source worktree`);
    }
    const activeDirectory = join(root, ".wasm-packages", "active", contract.directory);
    packages.push({
      packageName: contract.packageName,
      packageVersion: record.packageVersion,
      sourceRepository: git(record.sourceDirectory, "config", "--get", "remote.origin.url"),
      sourceCommit: record.sourceCommit,
      emscriptenVersion: record.emscriptenVersion,
      tarballSha256: record.tarballSha256,
      publishedContentSha256: await directorySha256(activeDirectory),
      files: await publishedFileHashes(activeDirectory),
    });
  }

  return { lockVersion: WASM_PACKAGE_LOCK_VERSION, packages };
}

export async function verifyWasmPackageLock(websiteRoot) {
  const root = resolve(websiteRoot);
  const lock = JSON.parse(await readFile(join(root, "wasm-package-lock.json"), "utf8"));
  const provenance = JSON.parse(await readFile(join(root, ".wasm-packages", "provenance.json"), "utf8"));
  if (lock.lockVersion !== WASM_PACKAGE_LOCK_VERSION) {
    throw new Error(`unsupported WASM package lock version ${lock.lockVersion}`);
  }
  if (!Array.isArray(lock.packages) || lock.packages.length !== PACKAGE_CONTRACTS.length) {
    throw new Error("WASM package lock must contain exactly the three supported packages");
  }

  const tarballs = await generatedTarballs(root);
  for (const contract of PACKAGE_CONTRACTS) {
    const expected = packageRecord(lock.packages, contract.packageName, "wasm-package-lock.json");
    const record = packageRecord(provenance.packages ?? [], contract.packageName, "provenance");
    const activeDirectory = join(root, ".wasm-packages", "active", contract.directory);
    const actualFiles = await publishedFileHashes(activeDirectory);
    const tarballMatches = tarballs.filter((path) => path.endsWith(`/${record.tarball}`));

    if (record.sourceDirty) throw new Error(`${contract.packageName} provenance is dirty`);
    for (const field of ["packageVersion", "sourceCommit", "emscriptenVersion", "tarballSha256"]) {
      if (record[field] !== expected[field]) {
        throw new Error(`${contract.packageName} ${field} differs from the frozen package lock`);
      }
    }
    if (tarballMatches.length !== 1 || await fileSha256(tarballMatches[0]) !== expected.tarballSha256) {
      throw new Error(`${contract.packageName} tarball differs from the frozen package lock`);
    }
    if (await directorySha256(activeDirectory) !== expected.publishedContentSha256) {
      throw new Error(`${contract.packageName} published contents differ from the frozen package lock`);
    }
    if (JSON.stringify(actualFiles) !== JSON.stringify(expected.files)) {
      throw new Error(`${contract.packageName} published file hashes differ from the frozen package lock`);
    }
  }

  return lock;
}
