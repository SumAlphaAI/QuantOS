import assert from "node:assert/strict";
import test from "node:test";

import { loadRuntimeInputs, validateRuntimeContract } from "./pre03-smoke.mjs";

const current = loadRuntimeInputs();

test("current PRE-03 runtime contract passes", () => {
  const report = validateRuntimeContract(current);
  assert.equal(report.status, "PASS", report.failures.join("\n"));
  assert.equal(report.locked_dependencies, 26);
});

test("runtime dependency drift is rejected", () => {
  const pnpmLock = structuredClone(current.pnpmLock);
  pnpmLock.importers["apps/terminal"].dependencies.next.version = "16.0.0";
  const report = validateRuntimeContract({ ...current, pnpmLock });
  assert.equal(report.status, "FAIL");
  assert(report.failures.includes("apps/terminal next locked at 15.5.23"));
});

test("desktop artifact fork is rejected", () => {
  const tauriConfig = structuredClone(current.tauriConfig);
  tauriConfig.build.frontendDist = "../terminal-desktop/out";
  const report = validateRuntimeContract({ ...current, tauriConfig });
  assert.equal(report.status, "FAIL");
  assert(report.failures.includes("Desktop loads the shared Terminal out directory"));
});

test("missing deep-link reauthorization wiring is rejected", () => {
  const report = validateRuntimeContract({ ...current, rustMain: current.rustMain.replaceAll("sanitize_deep_link", "unsafe_link") });
  assert.equal(report.status, "FAIL");
  assert(report.failures.includes("deep links are sanitized before local navigation"));
});

test("toolchain pin drift is rejected", () => {
  const report = validateRuntimeContract({ ...current, nodeVersion: "25.0.0" });
  assert.equal(report.status, "FAIL");
  assert(report.failures.includes("Node is pinned to 24.12.0"));
});
