import assert from "node:assert/strict";
import test from "node:test";

import { loadBffFe001Inputs, validateBffFe001 } from "./check-bff-fe-001.mjs";

import { executionSources, digest } from "./bff-fe-001-execution.mjs";
const { structuredClone } = globalThis;

// Receiver unit fixture only: ignored artifact caches are not test prerequisites.
// Actual executed semantics remain required by the CLI and scoped admission gate.
const actual = loadBffFe001Inputs();
const current = { ...actual, executionProof: {
  status: "PASS", results: Array.from({ length: 3 }, () => ({ exitCode: 0 })),
  sourceHashes: Object.fromEntries(Object.keys(executionSources).map(name => [name, digest(actual[name])])),
} };

test("synthetic receiver fixture passes current BFF-FE-001 contract validation", () => {
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

for (const field of ["provider", "providerTests", "authClient", "settingsClient", "liveProvider"]) {
  test(`${field} changes invalidate executed evidence`, () => {
    const report = validateBffFe001({ ...current, [field]: current[field] + "\n// altered source\n" });
    assert(report.failures.includes(`execution proof matches current ${field}`));
  });
}
for (const field of ["frontendWorkflow", "ciWorkflow"]) {
  test(`${field} commands in comments do not count as CI`, () => {
    const marker = field === "frontendWorkflow" ? "pnpm check:bff-fe-001 && pnpm test:bff-fe-001" : "make bff-provider-test";
    const workflow = current[field].replace(`run: ${marker}`, `run: echo disabled\n        # ${marker}`);
    assert.equal(validateBffFe001({ ...current, [field]: workflow }).status, "FAIL");
  });
}
test("disabled CI steps cannot satisfy the Gate", () => {
  const frontendWorkflow = current.frontendWorkflow.replace("run: pnpm check:bff-fe-001 && pnpm test:bff-fe-001", "if: false\n        run: pnpm check:bff-fe-001 && pnpm test:bff-fe-001");
  assert.equal(validateBffFe001({ ...current, frontendWorkflow }).status, "FAIL");
});
for (const [field, value] of [["apiVersion", "1.16.0"], ["operationCount", 134], ["schemaCount", 119]]) {
  test(`stale inventory ${field} cannot satisfy the active evidence Gate`, () => {
    const report = validateBffFe001({ ...current, activeEvidence: { ...current.activeEvidence, [field]: value } });
    assert.equal(report.status, "FAIL");
    assert(report.failures.includes("active evidence inventory matches current OpenAPI"));
  });
}
test("stale active summary cannot satisfy the current contract Gate", () => {
  const summary = current.summary.replaceAll(`API ${current.openapi.info.version}`, "API 1.16.0");
  assert.notEqual(summary, current.summary);
  const report = validateBffFe001({ ...current, summary });
  assert.equal(report.status, "FAIL");
  assert(report.failures.includes("active summary identifies current evidence and final-review boundary"));
});

test("commented Make recipes do not satisfy executable wiring", () => {
 const makefile=current.makefile.replace("\tpnpm check:bff-fe-001", "\t# pnpm check:bff-fe-001");
 assert.equal(validateBffFe001({...current,makefile}).status,"FAIL");
});
test("no semantic receipt cannot satisfy the Gate",()=>assert.equal(validateBffFe001({...current,executionProof:null}).status,"FAIL"));
test("deleted active evidence cannot satisfy the Gate",()=>assert.equal(validateBffFe001({...current,activeEvidenceExists:false}).status,"FAIL"));

test("actual current structure passes without borrowing an execution receipt", () => {
  assert.equal(validateBffFe001(actual, { structureOnly: true }).status, "PASS");
  assert.equal(validateBffFe001({ ...actual, executionProof: null }).status, "FAIL");
});
