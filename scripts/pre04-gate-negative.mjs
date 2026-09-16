import assert from "node:assert/strict";
import test from "node:test";

import { loadPre04Inputs, validatePre04Inventory } from "./pre04-inventory.mjs";

const current = loadPre04Inputs();

test("current PRE-04 inventory contract passes", () => {
  const report = validatePre04Inventory(current);
  assert.equal(report.status, "PASS", report.failures.join("\n"));
  assert.deepEqual([report.contracts, report.gaps, report.p0_pages], [17, 17, 18]);
});

test("missing OpenAPI gap row is rejected", () => {
  const gaps = current.gaps.replace(/^\| GAP-13 \|.*\n/m, "");
  const report = validatePre04Inventory({ ...current, gaps });
  assert.equal(report.status, "FAIL");
  assert(report.failures.includes("gap list contains GAP-01-GAP-17 exactly once and in order"));
});

test("undecided P0 realtime dependency is rejected", () => {
  const ledger = current.ledger.replace(/(\| P20 Trade Ticket \|[^\n]*\| )C13 preflight\/quote refresh( \|)/, "$1待开发时再定$2");
  const report = validatePre04Inventory({ ...current, ledger });
  assert.equal(report.status, "FAIL");
  assert(report.failures.includes("P20 Realtime dependency is explicit"));
});

test("field without authoritative source is rejected", () => {
  const fields = current.fields.replace("bff:SessionContext（映射 F06 主上下文）", "manual:SessionContext（映射 F06 主上下文）");
  const report = validatePre04Inventory({ ...current, fields });
  assert.equal(report.status, "FAIL");
  assert(report.failures.includes("C01 field row has an authoritative proto/bff source"));
});

test("generated manifest drift is rejected", () => {
  const manifest = structuredClone(current.manifest);
  manifest.operations.pop();
  const report = validatePre04Inventory({ ...current, manifest });
  assert.equal(report.status, "FAIL");
  assert(report.failures.includes("generated operation manifest exactly matches OpenAPI"));
});

test("frozen contract mock status regression is rejected", () => {
  const ledger = current.ledger.replace("Contract Mocked；同源生成 client/schema/MSW + session fixture", "Draft；无 fixture");
  const report = validatePre04Inventory({ ...current, ledger });
  assert.equal(report.status, "FAIL");
  assert(report.failures.includes("C01 frozen contract is recorded as Contract Mocked"));
});
