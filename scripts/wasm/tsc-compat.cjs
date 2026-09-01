#!/usr/bin/env node

const path = require("node:path");

const typeRoots = path.resolve(__dirname, "../@types");
process.argv.splice(2, 0, "--typeRoots", typeRoots);
require("../typescript/lib/tsc.js");
