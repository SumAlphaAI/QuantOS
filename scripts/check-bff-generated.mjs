#!/usr/bin/env node

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateBffContracts, generatedBffFiles } from "./generate-bff-contracts.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const scratch = mkdtempSync(join(tmpdir(), "quantos-bff-generated-"));
let failures = 0;

try {
  generateBffContracts(scratch);
  for (const relative of generatedBffFiles()) {
    let expected;
    let actual;
    try {
      expected = readFileSync(join(scratch, relative));
      actual = readFileSync(join(repoRoot, relative));
    } catch (error) {
      failures += 1;
      console.error(`FAIL  generated file missing: ${relative} (${error.code ?? error.message})`);
      continue;
    }
    if (!expected.equals(actual)) {
      failures += 1;
      console.error(`FAIL  generated drift: ${relative}`);
    } else {
      console.log(`ok    ${relative}`);
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`\n${failures} generated BFF artifact(s) drifted. Run: pnpm generate:bff`);
  process.exit(1);
}
console.log("\nBFF generated artifacts match the frozen OpenAPI.");
