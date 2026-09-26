import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const stable = JSON.parse(readFileSync("target/f08-rust-coverage.json", "utf8"));
const nightly = existsSync("target/f08-rust-nightly-coverage.json")
  ? JSON.parse(readFileSync("target/f08-rust-nightly-coverage.json", "utf8"))
  : null;
const waivers = JSON.parse(readFileSync("docs/audit/F08-coverage-waivers.json", "utf8"));
const clone = (value) => structuredClone(value);
const probe = (report, branches = false) => {
  const dir = mkdtempSync(join(tmpdir(), "f08-coverage-negative-"));
  try {
    const file = join(dir, "coverage.json");
    writeFileSync(file, JSON.stringify(report));
    return spawnSync("node", ["scripts/check-f08-rust-coverage.mjs", file, ...(branches ? ["--require-branches"] : [])], { encoding: "utf8" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test("F08 coverage rejects missing and duplicated production source", () => {
  const missing = clone(stable);
  missing.data[0].files = missing.data[0].files.filter((file) => !file.filename.endsWith("/src/durable.rs"));
  assert.notEqual(probe(missing).status, 0);
  const duplicate = clone(stable);
  duplicate.data[0].files.push(clone(duplicate.data[0].files.find((file) => file.filename.endsWith("/src/durable.rs"))));
  assert.notEqual(probe(duplicate).status, 0);
});

test("F08 coverage does not credit absent audited regions", () => {
  const changed = clone(stable);
  const regions = new Set(waivers.items.filter((waiver) => waiver.metric === "region").map((item) => `${item.file}:${item.span.join(":")}`));
  let removed = 0;
  for (const fn of changed.data[0].functions) {
    fn.regions = fn.regions.filter((region) => {
      const relative = fn.filenames[region[5]]?.split("/quantos-engine-manager/")[1];
      const target = relative && regions.has(`crates/quantos-engine-manager/${relative}:${region.slice(0, 4).join(":")}`);
      if (target) removed += 1;
      return !target;
    });
  }
  assert(removed > 0);
  const result = probe(changed);
  assert.notEqual(result.status, 0);
});

test("F08 coverage rejects lost source lines", () => {
  const noLines = clone(stable);
  for (const file of noLines.data[0].files) {
    if (file.filename.includes("quantos-engine-manager/")) {
      for (const segment of file.segments) segment[2] = 0;
    }
  }
  assert.notEqual(probe(noLines).status, 0);
});

test("F08 coverage rejects lost branch outcomes", { skip: !nightly }, () => {
  const noBranches = clone(nightly);
  for (const file of noBranches.data[0].files) {
    if (file.filename.includes("quantos-engine-manager/")) {
      for (const branch of file.branches) { branch[4] = 0; branch[5] = 0; }
    }
  }
  assert.notEqual(probe(noBranches, true).status, 0);
});
