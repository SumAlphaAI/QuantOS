import assert from "node:assert/strict";
import test from "node:test";

import { loadBffFe001Inputs, validateBffFe001 } from "./check-bff-fe-001.mjs";

const current = loadBffFe001Inputs();

test("current BFF-FE-001 repository Gate passes", () => {
  const report = validateBffFe001(current);
  assert.equal(report.status, "PASS", report.failures.join("\n"));
  assert.equal(report.scope, "local_contract");
});

test("CSRF deletion is rejected", () => {
  const openapi = structuredClone(current.openapi);
  openapi.paths["/v1/settings/profile"].put.parameters = openapi.paths["/v1/settings/profile"].put.parameters.filter((parameter) => !parameter.$ref?.endsWith("/CsrfToken"));
  assert(validateBffFe001({ ...current, openapi }).failures.includes("saveProfile requires the shared CSRF header"));
});

test("bearer session regression is rejected", () => {
  const openapi = structuredClone(current.openapi);
  openapi.components.securitySchemes.cookieAuth.in = "header";
  assert(validateBffFe001({ ...current, openapi }).failures.includes("session auth uses an HttpOnly-compatible cookie security scheme"));
});

test("recent-auth deletion is rejected", () => {
  const openapi = structuredClone(current.openapi);
  openapi.paths["/v1/settings/sessions/{sessionId}"].delete.parameters = openapi.paths["/v1/settings/sessions/{sessionId}"].delete.parameters.filter((parameter) => parameter.name !== "X-Reauth-Token-Ref");
  assert(validateBffFe001({ ...current, openapi }).failures.includes("revokeSession requires recent authentication"));
});

test("idempotency deletion is rejected", () => {
  const openapi = structuredClone(current.openapi);
  openapi.paths["/v1/settings/notification-preferences"].put.parameters = openapi.paths["/v1/settings/notification-preferences"].put.parameters.filter((parameter) => !parameter.$ref?.endsWith("/IdempotencyKey"));
  assert(validateBffFe001({ ...current, openapi }).failures.includes("saveNotificationPrefs requires the shared idempotency key"));
});

test("last-factor protection deletion is rejected", () => {
  const openapi = structuredClone(current.openapi);
  delete openapi.paths["/v1/settings/mfa/factors/{factorId}"].delete.responses["409"];
  assert(validateBffFe001({ ...current, openapi }).failures.includes("last valid MFA factor protection is documented as 409"));
});

test("resource-hiding 404 deletion is rejected", () => {
  const openapi = structuredClone(current.openapi);
  delete openapi.paths["/v1/settings/trusted-devices/{deviceId}"].delete.responses["404"];
  assert(validateBffFe001({ ...current, openapi }).failures.includes("revokeDevice documents 404"));
});

test("revocation replay deletion is rejected", () => {
  const openapi = structuredClone(current.openapi);
  openapi.paths["/v1/settings/sessions/stream"].get.parameters = [];
  assert(validateBffFe001({ ...current, openapi }).failures.includes("session revocation SSE supports afterSequence replay"));
});

test("security audit reference deletion is rejected", () => {
  const openapi = structuredClone(current.openapi);
  openapi.components.schemas.AuditedAsyncAccepted.allOf[1].required = [];
  assert(validateBffFe001({ ...current, openapi }).failures.includes("security mutations return an auditRef without breaking shared AsyncAccepted"));
});

test("dependency regression is rejected", () => {
  const frontendPlan = current.frontendPlan.replace(/(- task_id: `BFF-FE-000`[\s\S]*?- development_status: `)COMPLETED(`)/, "$1IN_PROGRESS$2");
  assert(validateBffFe001({ ...current, frontendPlan }).failures.includes("dependency BFF-FE-000 is COMPLETED"));
});
