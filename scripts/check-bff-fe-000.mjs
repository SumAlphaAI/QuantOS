#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import YAML from "yaml";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const expectedContracts = Array.from({ length: 17 }, (_, index) => `C${String(index + 1).padStart(2, "0")}`);
const expectedPages = [
  ...Array.from({ length: 15 }, (_, index) => `P${String(index + 1).padStart(2, "0")}`),
  ...Array.from({ length: 7 }, (_, index) => `P${String(index + 17).padStart(2, "0")}`),
];
const httpMethods = new Set(["get", "post", "put", "patch", "delete", "options", "head"]);

function text(relative) {
  return readFileSync(resolve(root, relative), "utf8");
}

function taskStatus(plan, taskId) {
  const match = plan.match(new RegExp("- task_id: `" + taskId + "`([\\s\\S]*?)(?=\\n<a id=|$)"));
  return match?.[1].match(/- development_status: `([^`]+)`/)?.[1] ?? null;
}

function operationIds(openapi) {
  const result = [];
  for (const pathItem of Object.values(openapi.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (httpMethods.has(method) && operation?.operationId) result.push(operation.operationId);
    }
  }
  return result;
}

export function loadBffFe000Inputs() {
  return {
    catalog: YAML.parse(text("bff/page-operation-catalog.yaml")),
    openapi: YAML.parse(text("bff/openapi/quantos-bff.v1.yaml")),
    manifest: JSON.parse(text("tests/contract/generated/quantos-bff.operations.json")),
    corePlan: text("docs/SumAlpha-QuantOS-Development-Plan.md"),
    frontendPlan: text("docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md"),
    coverage: text("docs/PRE-01-page-api-coverage-register.md"),
    packageJson: JSON.parse(text("package.json")),
    apiClientIndex: text("packages/api-client/src/index.ts"),
    makefile: text("Makefile"),
    workflow: text(".github/workflows/frontend-baseline.yml"),
  };
}

export function validateBffFe000(inputs) {
  const failures = [];
  const { catalog, openapi, manifest } = inputs;
  const contracts = Object.keys(catalog.contracts ?? {});
  const scopedPages = catalog.scope?.pages ?? [];
  const published = [];
  const planned = [];

  if (catalog.schema !== "quantos-bff-page-operation-catalog/v1") failures.push("operation catalog schema is v1");
  if (JSON.stringify(contracts) !== JSON.stringify(expectedContracts)) failures.push("catalog contains C01-C17 exactly once and in order");
  if (JSON.stringify(scopedPages) !== JSON.stringify(expectedPages)) failures.push("catalog covers phase-one P01-P15/P17-P23 exactly");
  if (!catalog.scope?.excludedPages?.P16?.includes("Desktop phase two")) failures.push("P16 is explicitly excluded as Desktop phase two");

  for (const [contract, entry] of Object.entries(catalog.contracts ?? {})) {
    if (!/^BFF-FE-(?:00[1-9]|01[01])$/.test(entry.ownerTask ?? "")) failures.push(`${contract} has a follow-up BFF owner task`);
    if (!(entry.pages ?? []).length) failures.push(`${contract} has page coverage`);
    published.push(...(entry.publishedOperations ?? []));
    planned.push(...(entry.plannedOperations ?? []));
  }

  const allCatalogOperations = [...published, ...planned];
  if (new Set(allCatalogOperations).size !== allCatalogOperations.length) failures.push("operationIds are globally unique across published and planned catalog entries");

  const sourceIds = operationIds(openapi).sort();
  const publishedIds = [...published].sort();
  const manifestIds = (manifest.operations ?? []).map((operation) => operation.operationId).sort();
  if (JSON.stringify(sourceIds) !== JSON.stringify(publishedIds)) failures.push("published catalog operations exactly match versioned OpenAPI");
  if (JSON.stringify(sourceIds) !== JSON.stringify(manifestIds)) failures.push("generated operation manifest exactly matches versioned OpenAPI");
  if (openapi.info?.version !== manifest.version) failures.push("OpenAPI and generated manifest versions match");

  const parameters = openapi.components?.parameters ?? {};
  for (const parameter of ["Cursor", "PageSize", "Sort", "Filter", "IdempotencyKey", "IfMatch", "AfterSequence"]) {
    if (!parameters[parameter]) failures.push(`OpenAPI defines shared ${parameter} parameter`);
  }
  const headers = openapi.components?.headers ?? {};
  for (const header of ["X-Correlation-Id", "ETag"]) {
    if (!headers[header]) failures.push(`OpenAPI defines shared ${header} header`);
  }
  const schemas = openapi.components?.schemas ?? {};
  for (const schema of ["ErrorEnvelope", "Page", "AsyncAccepted", "StreamEvent"]) {
    if (!schemas[schema]) failures.push(`OpenAPI defines shared ${schema} schema`);
  }
  const errorRequired = schemas.ErrorEnvelope?.required ?? [];
  for (const field of ["code", "message", "correlationId"]) {
    if (!errorRequired.includes(field)) failures.push(`ErrorEnvelope requires ${field}`);
  }
  const streamRequired = schemas.StreamEvent?.required ?? [];
  for (const field of ["streamId", "sequence", "eventId", "occurredAt", "correlationId", "payloadVersion", "payload"]) {
    if (!streamRequired.includes(field)) failures.push(`StreamEvent requires ${field}`);
  }
  for (const [name, response] of Object.entries(openapi.components?.responses ?? {})) {
    if (!response.headers?.["X-Correlation-Id"]) failures.push(`${name} error response exposes X-Correlation-Id`);
  }

  for (const dependency of ["F03", "F05", "F06"]) {
    if (taskStatus(inputs.corePlan, dependency) !== "COMPLETED") failures.push(`dependency ${dependency} is COMPLETED`);
  }
  for (const dependency of ["PRE-04", "PRE-06"]) {
    if (taskStatus(inputs.frontendPlan, dependency) !== "COMPLETED") failures.push(`dependency ${dependency} is COMPLETED`);
  }
  if (taskStatus(inputs.frontendPlan, "BFF-FE-000") !== "COMPLETED") failures.push("BFF-FE-000 development status is COMPLETED");

  for (const page of expectedPages) {
    const line = inputs.coverage.split("\n").find((candidate) => candidate.startsWith(`| ${page} |`));
    if (!line) failures.push(`${page} has a Page API Coverage row`);
    else if (line.includes("待回填")) failures.push(`${page} has stable operationId traceability instead of a placeholder`);
  }
  for (const operationId of planned) {
    if (!inputs.coverage.includes(operationId)) failures.push(`planned operation ${operationId} is traceable from Page API Coverage`);
  }

  if (inputs.packageJson.scripts?.["check:bff-fe-000"] !== "node scripts/check-bff-fe-000.mjs") failures.push("package script exposes the BFF-FE-000 Gate");
  if (inputs.packageJson.scripts?.["test:bff-fe-000"] !== "node --test scripts/bff-fe-000-gate-negative.mjs") failures.push("package script exposes BFF-FE-000 negative probes");
  if (!inputs.apiClientIndex.includes('export { bffZodSchemas } from "./bff-gen/quantos-bff.zod.js"')) failures.push("API client exports generated Zod schemas");
  if (!inputs.makefile.includes("pnpm check:bff-fe-000") || !inputs.makefile.includes("pnpm test:bff-fe-000")) failures.push("Makefile BFF contract Gate runs A1 positive and negative checks");
  if (!inputs.workflow.includes("pnpm check:bff-fe-000 && pnpm test:bff-fe-000")) failures.push("Frontend Baseline CI runs the A1 Gate");

  return {
    status: failures.length ? "FAIL" : "PASS",
    failures,
    contracts: contracts.length,
    pages: scopedPages.length,
    publishedOperations: published.length,
    plannedOperations: planned.length,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = validateBffFe000(loadBffFe000Inputs());
  if (report.failures.length) {
    report.failures.forEach((failure) => console.error(`FAIL  ${failure}`));
    process.exitCode = 1;
  } else {
    console.log(`BFF-FE-000 Gate PASS: ${report.contracts} contracts, ${report.pages} phase-one pages, ${report.publishedOperations} published + ${report.plannedOperations} planned operationIds.`);
  }
}
