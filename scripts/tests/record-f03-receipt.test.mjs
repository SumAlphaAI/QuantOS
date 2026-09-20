import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import YAML from "yaml";
import {acceptance} from "../record-f03-receipt.mjs";

const valid = {
  sourceSha: "a".repeat(40), expectedSha: "a".repeat(40), outcome: "success", changes: "",
  files: [{path: "generated.rs", sha256: "b".repeat(64)}],
  log: "Proto checks passed.\nValidated all six ProtoJSON directions\n15 invalid-JSON rejection probes passed.",
};
test("receipt requires same SHA, executed successful gate, clean artifacts and complete log", () => {
  assert.equal(acceptance(valid), true);
  for (const mutation of [
    {expectedSha: "b".repeat(40)}, {expectedSha: ""}, {outcome: "skipped"},
    {outcome: "failure"}, {changes: " M generated.rs"}, {changes: "?? extra.rs"},
    {files: []}, {files: [{path: "missing", sha256: null}]}, {log: ""}, {log: "Proto checks passed."},
  ]) assert.equal(acceptance({...valid, ...mutation}), false);
});
test("protocol workflow is independent, fail closed, and always archives receipts", () => {
  const workflow = YAML.parse(readFileSync(new URL("../../.github/workflows/f03-protocol.yml", import.meta.url), "utf8"));
  const job = workflow.jobs["proto-check"];
  assert.equal(job.needs, undefined);
  assert.equal(job["continue-on-error"], undefined);
  assert.equal(workflow.permissions.contents, "read");
  const step = job.steps.find(step => step.id === "protocol");
  assert.equal(step.shell, "bash"); // GitHub explicitly configured bash uses -e -o pipefail.
  assert.match(step.run, /make proto-check/);
  assert.equal(step["continue-on-error"], undefined);
  for (const step of job.steps.slice(-2)) assert.equal(step.if, "always()");
});
