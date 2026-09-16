#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import YAML from "yaml";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const httpMethods = new Set(["get", "post", "put", "patch", "delete"]);
const requiredOperations = ["searchAuditEvents", "getEvidenceChain", "createExport", "getExportStatus", "cancelExport", "getExportDownload"];
const expectedPages = ["P04", "P07", "P09", "P10", "P11", "P12", "P13", "P14", "P22", "P23"];

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

export function loadBffFe007Inputs() {
  return {
    openapi: YAML.parse(text("bff/openapi/quantos-bff.v1.yaml")),
    catalog: YAML.parse(text("bff/page-operation-catalog.yaml")),
    corePlan: text("docs/SumAlpha-QuantOS-Development-Plan.md"),
    frontendPlan: text("docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md"),
    provider: text("services/bff-gateway/src/lib.rs"),
    providerTests: text("services/bff-gateway/tests/audit_export_provider.rs"),
    gateway: text("apps/terminal/src/audit/gateway.ts"),
    gatewayTests: text("apps/terminal/tests/audit-gateway.test.ts"),
    bffClient: text("packages/api-client/src/bff.ts"),
    packageJson: JSON.parse(text("package.json")),
    makefile: text("Makefile"),
    workflow: text(".github/workflows/frontend-baseline.yml"),
    summaryExists: existsSync(resolve(root, "docs/BFF-FE-007-summary.md")),
    evidenceExists: existsSync(resolve(root, "docs/audit/BFF-FE-007-acceptance-evidence-2026-09-16.md")),
  };
}

export function validateBffFe007(inputs) {
  const failures = [];
  const operations = operationMap(inputs.openapi);
  const fail = (condition, message) => { if (!condition) failures.push(message); };

  fail(taskStatus(inputs.frontendPlan, "BFF-FE-001") === "COMPLETED", "dependency BFF-FE-001 is COMPLETED");
  fail(taskStatus(inputs.corePlan, "F05") === "COMPLETED", "dependency F05 is COMPLETED");
  fail(taskStatus(inputs.frontendPlan, "BFF-FE-007") === "COMPLETED", "BFF-FE-007 development status is COMPLETED");
  fail(inputs.openapi.info?.version === "1.3.0", "BFF-FE-007 publishes OpenAPI 1.3.0");

  for (const operationId of requiredOperations) fail(operations.has(operationId), `BFF-FE-007 operation ${operationId} is published`);
  const c10 = inputs.catalog.contracts?.C10;
  fail(c10?.ownerTask === "BFF-FE-007", "C10 is owned by BFF-FE-007");
  fail(JSON.stringify(c10?.pages) === JSON.stringify(expectedPages), "C10 maps the ten audit/export consumer pages exactly");
  fail(JSON.stringify(c10?.publishedOperations) === JSON.stringify(requiredOperations) && c10?.plannedOperations?.length === 0, "C10 catalog publishes exactly six operations without planned residue");

  for (const operationId of ["searchAuditEvents", "getEvidenceChain", "getExportStatus"]) {
    fail(operations.get(operationId)?.["x-quantos-capability"] === "audit:read", `${operationId} requires audit:read`);
  }
  for (const operationId of ["createExport", "cancelExport", "getExportDownload"]) {
    fail(operations.get(operationId)?.["x-quantos-capability"] === "audit:export", `${operationId} requires audit:export`);
  }
  for (const operationId of ["searchAuditEvents", "getEvidenceChain"]) {
    fail(hasParameter(operations.get(operationId), "Cursor") && hasParameter(operations.get(operationId), "PageSize"), `${operationId} supports bounded opaque pagination`);
  }
  for (const operationId of ["createExport", "cancelExport"]) {
    fail(hasParameter(operations.get(operationId), "CsrfToken"), `${operationId} requires CSRF`);
    fail(hasParameter(operations.get(operationId), "IdempotencyKey"), `${operationId} requires idempotency`);
    fail(hasHeader(operations.get(operationId), "X-Reauth-Token-Ref"), `${operationId} requires recent authentication`);
  }
  fail(Boolean(operations.get("getEvidenceChain")?.responses?.["404"]), "evidence lookup documents resource-hiding 404");
  fail(Boolean(operations.get("getExportDownload")?.responses?.["410"]), "expired export download documents 410 Gone");

  const schemas = inputs.openapi.components?.schemas ?? {};
  for (const schema of ["AuditEvent", "AuditEventPage", "EvidenceNode", "EvidenceChainPage", "ExportScope", "ExportRequest", "ExportJob", "ExportDownloadMetadata"]) {
    fail(Boolean(schemas[schema]), `OpenAPI defines ${schema}`);
  }
  fail(JSON.stringify(schemas.AuditEvent?.properties?.redactionApplied?.enum) === "[true]", "audit events attest server-side redaction");
  fail((schemas.AuditEvent?.required ?? []).includes("payloadHash") && (schemas.AuditEvent?.required ?? []).includes("retentionUntil"), "audit events preserve integrity and retention metadata");
  fail((schemas.EvidenceChainPage?.required ?? []).includes("correlationId") && Boolean(schemas.EvidenceChainPage?.properties?.nextCursor), "evidence chain is correlation-bound and cursor paginated");
  fail(!schemas.ExportJob?.properties?.downloadUrl, "export status never exposes a download URL");
  fail((schemas.ExportJob?.properties?.status?.enum ?? []).includes("cancelled") && (schemas.ExportJob?.properties?.status?.enum ?? []).includes("expired"), "export status models cancelled and expired terminal states");
  fail(JSON.stringify(schemas.ExportDownloadMetadata?.properties?.watermarked?.enum) === "[true]", "download metadata requires a watermark");
  fail((schemas.ExportDownloadMetadata?.required ?? []).includes("expiresAt") && (schemas.ExportDownloadMetadata?.required ?? []).includes("retentionUntil") && (schemas.ExportDownloadMetadata?.required ?? []).includes("auditRef"), "download metadata binds URL expiry, retention and audit reference");

  for (const marker of ["search_audit_events", "get_evidence_chain", "create_export", "cancel_export", "get_export_download", "downloads.invalid", "audit:export", "[REDACTED]"]) {
    fail(inputs.provider.includes(marker), `local reference provider implements ${marker}`);
  }
  for (const marker of ["audit_search_is_capability_guarded_redacted_and_cursor_paginated", "evidence_chain_preserves_causation_order_and_hides_missing_resources", "export_lifecycle_is_idempotent_watermarked_short_lived_and_audited", "export_cancel_expiry_and_validation_fail_closed"]) {
    fail(inputs.providerTests.includes(marker), `provider integration test covers ${marker}`);
  }
  for (const marker of ["searchAuditEvents", "getEvidenceChain", "createExport", "cancelExport", "getExportDownload", "X-Reauth-Token-Ref"]) {
    fail(inputs.gateway.includes(marker), `Terminal audit gateway implements ${marker}`);
  }
  fail(inputs.bffClient.includes('credentials: "include"'), "generated BFF client always includes the session cookie");
  fail(inputs.gatewayTests.includes("maps expired downloads without exposing transport details"), "Terminal gateway tests safe expired-download mapping");

  fail(inputs.packageJson.scripts?.["check:bff-fe-007"] === "node scripts/check-bff-fe-007.mjs", "package script exposes the BFF-FE-007 Gate");
  fail(inputs.packageJson.scripts?.["test:bff-fe-007"] === "node --test scripts/bff-fe-007-gate-negative.mjs", "package script exposes BFF-FE-007 negative probes");
  fail(inputs.makefile.includes("pnpm check:bff-fe-007") && inputs.makefile.includes("pnpm test:bff-fe-007"), "Makefile runs BFF-FE-007 positive and negative checks");
  fail(inputs.workflow.includes("pnpm check:bff-fe-007 && pnpm test:bff-fe-007"), "Frontend Baseline CI runs the BFF-FE-007 Gate");
  fail(inputs.summaryExists && inputs.evidenceExists, "BFF-FE-007 summary and acceptance evidence are checked in");

  return { status: failures.length ? "FAIL" : "PASS", failures, operations: requiredOperations.length };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = validateBffFe007(loadBffFe007Inputs());
  if (report.failures.length) {
    report.failures.forEach((failure) => console.error(`FAIL  ${failure}`));
    process.exitCode = 1;
  } else console.log(`BFF-FE-007 Gate PASS: ${report.operations} C10 operations, redacted evidence pagination, controlled export lifecycle and fail-closed download checks.`);
}
