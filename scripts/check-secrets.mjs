#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(process.env.QUANTOS_GATE_ROOT ?? process.cwd());
const ignored = new Set([".git", "node_modules", "target", ".venv", "artifacts"]);
const patterns = [
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["Supabase service role JWT", /\beyJ[a-zA-Z0-9_-]{20,}\.eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\b/],
];

function* files(directory) {
  for (const entry of readdirSync(directory)) {
    if (ignored.has(entry)) continue;
    const path = join(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) yield* files(path);
    else if (stat.isFile() && stat.size <= 2_000_000) yield path;
  }
}

let failed = false;
for (const path of files(root)) {
  const content = readFileSync(path, "utf8");
  for (const [label, pattern] of patterns) {
    if (pattern.test(content)) {
      console.error(`Potential ${label} found in ${relative(root, path)}`);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
console.log("Repository secret-pattern checks passed.");
