import assert from "node:assert/strict";
import test from "node:test";

import { loadBffFe007Inputs, validateBffFe007 } from "./check-bff-fe-007.mjs";

const current = loadBffFe007Inputs();

test("current BFF-FE-007 repository Gate passes", () => {
  const report = validateBffFe007(current);
  assert.equal(report.status, "PASS", report.failures.join("\n"));
});

test("redaction attestation deletion is rejected", () => {
  const openapi = structuredClone(current.openapi);
  delete openapi.components.schemas.AuditEvent.properties.redactionApplied.enum;
  assert(validateBffFe007({ ...current, openapi }).failures.includes("audit events attest server-side redaction"));
});

test("evidence cursor deletion is rejected", () => {
  const openapi = structuredClone(current.openapi);
  openapi.paths["/v1/audit/evidence-chains/{correlationId}"].get.parameters = openapi.paths["/v1/audit/evidence-chains/{correlationId}"].get.parameters.filter((parameter) => !parameter.$ref?.endsWith("/Cursor"));
  assert(validateBffFe007({ ...current, openapi }).failures.includes("getEvidenceChain supports bounded opaque pagination"));
});

test("export capability regression is rejected", () => {
  const openapi = structuredClone(current.openapi);
  openapi.paths["/v1/exports"].post["x-quantos-capability"] = "audit:read";
  assert(validateBffFe007({ ...current, openapi }).failures.includes("createExport requires audit:export"));
});

test("CSRF deletion is rejected", () => {
  const openapi = structuredClone(current.openapi);
  openapi.paths["/v1/exports/{exportId}/cancel"].post.parameters = openapi.paths["/v1/exports/{exportId}/cancel"].post.parameters.filter((parameter) => !parameter.$ref?.endsWith("/CsrfToken"));
  assert(validateBffFe007({ ...current, openapi }).failures.includes("cancelExport requires CSRF"));
});

test("recent-auth deletion is rejected", () => {
  const openapi = structuredClone(current.openapi);
  openapi.paths["/v1/exports"].post.parameters = openapi.paths["/v1/exports"].post.parameters.filter((parameter) => parameter.name !== "X-Reauth-Token-Ref");
  assert(validateBffFe007({ ...current, openapi }).failures.includes("createExport requires recent authentication"));
});

test("idempotency deletion is rejected", () => {
  const openapi = structuredClone(current.openapi);
  openapi.paths["/v1/exports"].post.parameters = openapi.paths["/v1/exports"].post.parameters.filter((parameter) => !parameter.$ref?.endsWith("/IdempotencyKey"));
  assert(validateBffFe007({ ...current, openapi }).failures.includes("createExport requires idempotency"));
});

test("expired download response deletion is rejected", () => {
  const openapi = structuredClone(current.openapi);
  delete openapi.paths["/v1/exports/{exportId}/download"].get.responses["410"];
  assert(validateBffFe007({ ...current, openapi }).failures.includes("expired export download documents 410 Gone"));
});

test("download URL leakage through status is rejected", () => {
  const openapi = structuredClone(current.openapi);
  openapi.components.schemas.ExportJob.properties.downloadUrl = { type: "string" };
  assert(validateBffFe007({ ...current, openapi }).failures.includes("export status never exposes a download URL"));
});

test("watermark deletion is rejected", () => {
  const openapi = structuredClone(current.openapi);
  delete openapi.components.schemas.ExportDownloadMetadata.properties.watermarked.enum;
  assert(validateBffFe007({ ...current, openapi }).failures.includes("download metadata requires a watermark"));
});

test("dependency regression is rejected", () => {
  const frontendPlan = current.frontendPlan.replace(/(- task_id: `BFF-FE-001`[\s\S]*?- development_status: `)COMPLETED(`)/, "$1IN_PROGRESS$2");
  assert(validateBffFe007({ ...current, frontendPlan }).failures.includes("dependency BFF-FE-001 is COMPLETED"));
});
