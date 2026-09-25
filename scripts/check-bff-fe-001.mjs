#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import YAML from "yaml";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const httpMethods = new Set(["get", "post", "put", "patch", "delete"]);
const requiredOperations = [
  "getSession", "getContext", "reauth", "mfaChallenge", "logout", "submitAccessRequest",
  "getProfile", "saveProfile", "getNotificationPrefs", "saveNotificationPrefs",
  "getSecuritySettings", "listSessions", "revokeSession", "subscribeSessionRevocations",
  "listDevices", "revokeDevice", "setupMfa", "revokeMfaFactor", "listDownloads", "getPlatformCapabilities",
];
const csrfOperations = ["reauth", "mfaChallenge", "logout", "saveProfile", "saveNotificationPrefs", "revokeSession", "revokeDevice", "setupMfa", "revokeMfaFactor"];
const recentAuthOperations = ["revokeSession", "revokeDevice", "setupMfa", "revokeMfaFactor"];

function text(relative) { return readFileSync(resolve(root, relative), "utf8"); }
function taskStatus(plan, taskId) {
  const match = plan.match(new RegExp("- task_id: `" + taskId + "`([\\s\\S]*?)(?=\\n<a id=|$)"));
  return match?.[1].match(/- development_status: `([^`]+)`/)?.[1] ?? null;
}
function operationMap(openapi) {
  const result = new Map();
  for (const [path, item] of Object.entries(openapi.paths ?? {})) {
    for (const [method, operation] of Object.entries(item ?? {})) {
      if (httpMethods.has(method) && operation?.operationId) result.set(operation.operationId, { ...operation, path, method });
    }
  }
  return result;
}
function hasParameter(operation, componentName) {
  return (operation?.parameters ?? []).some((parameter) => parameter.$ref === `#/components/parameters/${componentName}`);
}
function hasHeader(operation, name) {
  return (operation?.parameters ?? []).some((parameter) => parameter.in === "header" && parameter.name === name && parameter.required === true);
}

export function loadBffFe001Inputs() {
  return {
    openapi: YAML.parse(text("bff/openapi/quantos-bff.v1.yaml")),
    catalog: YAML.parse(text("bff/page-operation-catalog.yaml")),
    corePlan: text("docs/SumAlpha-QuantOS-Development-Plan.md"),
    frontendPlan: text("docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md"),
    provider: text("services/bff-gateway/src/lib.rs"),
    providerTests: text("services/bff-gateway/tests/auth_settings_provider.rs"),
    cargo: text("Cargo.toml"),
    authClient: text("apps/terminal/src/auth/bff.ts"),
    settingsClient: text("apps/terminal/src/settings/gateway.ts"),
    packageJson: JSON.parse(text("package.json")),
    makefile: text("Makefile"),
    frontendWorkflow: text(".github/workflows/frontend-baseline.yml"),
    ciWorkflow: text(".github/workflows/ci.yml"),
    summaryExists: existsSync(resolve(root, "docs/BFF-FE-001-summary.md")),
    evidenceExists: existsSync(resolve(root, "docs/audit/BFF-FE-001-acceptance-evidence-2026-09-16.md")),
  };
}

export function validateBffFe001(inputs) {
  const failures = [];
  const operations = operationMap(inputs.openapi);
  const fail = (condition, message) => { if (!condition) failures.push(message); };

  fail(taskStatus(inputs.frontendPlan, "BFF-FE-000") === "COMPLETED", "dependency BFF-FE-000 is COMPLETED");
  fail(taskStatus(inputs.corePlan, "F06") === "COMPLETED", "F06 development prerequisite is COMPLETED (local contract check only)");
  fail(taskStatus(inputs.frontendPlan, "BFF-FE-001") === "COMPLETED", "BFF-FE-001 development status is COMPLETED");
  fail(Number(inputs.openapi.info?.version?.split(".")[0]) === 1 && Number(inputs.openapi.info?.version?.split(".")[1]) >= 2, "OpenAPI retains the BFF-FE-001 1.2.0 baseline");
  fail(inputs.openapi.components?.securitySchemes?.cookieAuth?.in === "cookie", "session auth uses an HttpOnly-compatible cookie security scheme");
  fail(JSON.stringify(inputs.openapi.security) === JSON.stringify([{ cookieAuth: [] }]), "authenticated operations default to cookieAuth");

  for (const operationId of requiredOperations) fail(operations.has(operationId), `BFF-FE-001 operation ${operationId} is published`);
  const c01c17 = [...(inputs.catalog.contracts?.C01?.publishedOperations ?? []), ...(inputs.catalog.contracts?.C17?.publishedOperations ?? [])];
  fail(JSON.stringify([...c01c17].sort()) === JSON.stringify([...requiredOperations].sort()), "C01/C17 catalog exactly tracks the 20 A2 operations");
  fail(inputs.catalog.contracts?.C17?.ownerTask === "BFF-FE-001" && inputs.catalog.contracts?.C17?.coOwnerTask === "BFF-FE-011", "C17 separates A2 Web settings ownership from Desktop phase two");

  for (const operationId of csrfOperations) fail(hasParameter(operations.get(operationId), "CsrfToken"), `${operationId} requires the shared CSRF header`);
  for (const operationId of ["saveProfile", "saveNotificationPrefs", "revokeSession", "revokeDevice", "setupMfa", "revokeMfaFactor"]) {
    fail(hasParameter(operations.get(operationId), "IdempotencyKey"), `${operationId} requires the shared idempotency key`);
  }
  for (const operationId of ["saveProfile", "saveNotificationPrefs"]) fail(hasParameter(operations.get(operationId), "IfMatch"), `${operationId} requires optimistic concurrency`);
  for (const operationId of recentAuthOperations) fail(hasHeader(operations.get(operationId), "X-Reauth-Token-Ref"), `${operationId} requires recent authentication`);
  for (const operationId of ["revokeSession", "revokeDevice", "revokeMfaFactor"]) {
    const responses = operations.get(operationId)?.responses ?? {};
    for (const status of ["401", "403", "404"]) fail(Boolean(responses[status]), `${operationId} documents ${status}`);
  }
  fail(Boolean(operations.get("revokeMfaFactor")?.responses?.["409"]), "last valid MFA factor protection is documented as 409");
  fail(hasParameter(operations.get("subscribeSessionRevocations"), "AfterSequence"), "session revocation SSE supports afterSequence replay");
  fail(Boolean(inputs.openapi.components?.schemas?.ReauthRequest), "reauth has a versioned request schema");
  const auditedAccepted = inputs.openapi.components?.schemas?.AuditedAsyncAccepted?.allOf?.find((entry) => entry.type === "object");
  fail((auditedAccepted?.required ?? []).includes("auditRef"), "security mutations return an auditRef without breaking shared AsyncAccepted");
  for (const operationId of ["submitAccessRequest", "revokeSession", "revokeDevice", "setupMfa", "revokeMfaFactor"]) {
    const schemaRef = operations.get(operationId)?.responses?.["202"]?.content?.["application/json"]?.schema?.$ref;
    fail(schemaRef === "#/components/schemas/AuditedAsyncAccepted", `${operationId} uses the audited acceptance envelope`);
  }

  for (const marker of ["mutation_guard", "require_reauth", "LAST_FACTOR_PROTECTED", "permission_revoked", "SameSite=Strict", "access.request"]) {
    fail(inputs.provider.includes(marker), `local reference provider implements ${marker}`);
  }
  for (const marker of ["authentication_csrf_and_resource_failures_fail_closed", "session_revocation_requires_recent_auth_is_idempotent_and_emits_sse_audit", "current_session_and_last_mfa_factor_are_protected", "logout_expires_secure_http_only_same_site_cookie"]) {
    fail(inputs.providerTests.includes(marker), `provider integration test covers ${marker}`);
  }
  fail(inputs.cargo.includes('"services/bff-gateway"'), "Rust workspace includes the BFF gateway reference provider");
  fail(inputs.authClient.includes('headers["x-csrf-token"] = csrfToken') && inputs.authClient.includes("completeRecentAuth"), "auth client forwards CSRF and exposes recent-auth completion");
  fail(inputs.settingsClient.includes("X-CSRF-Token") && inputs.settingsClient.includes("revokeMfaFactor"), "settings client forwards CSRF and supports MFA factor revoke");

  fail(inputs.packageJson.scripts?.["check:bff-fe-001"] === "node scripts/check-bff-fe-001.mjs", "package script exposes the BFF-FE-001 Gate");
  fail(inputs.packageJson.scripts?.["test:bff-fe-001"] === "node --test scripts/bff-fe-001-gate-negative.mjs", "package script exposes BFF-FE-001 negative probes");
  fail(inputs.makefile.includes("pnpm check:bff-fe-001") && inputs.makefile.includes("pnpm test:bff-fe-001"), "Makefile BFF contract Gate runs A2 positive and negative checks");
  fail(inputs.makefile.includes("cargo test -p bff-gateway"), "Makefile exposes the local provider integration test");
  fail(inputs.frontendWorkflow.includes("pnpm check:bff-fe-001 && pnpm test:bff-fe-001"), "Frontend Baseline CI runs the A2 contract Gate");
  fail(inputs.ciWorkflow.includes("make bff-provider-test"), "main CI runs the Rust provider integration tests");
  fail(inputs.summaryExists && inputs.evidenceExists, "A2 summary and acceptance evidence are checked in");

  return { status: failures.length ? "FAIL" : "PASS", scope: "local_contract", failures, operations: requiredOperations.length };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = validateBffFe001(loadBffFe001Inputs());
  if (report.failures.length) {
    report.failures.forEach((failure) => console.error(`FAIL  ${failure}`));
    process.exitCode = 1;
  } else console.log(`BFF-FE-001 local contract Gate PASS: ${report.operations} C01/C17 operations, cookie session, CSRF, recent-auth, MFA protection, audit and revocation stream checks. F06 target acceptance requires make f06-acceptance-gate.`);
}
