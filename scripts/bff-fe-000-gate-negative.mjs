import assert from "node:assert/strict";
import test from "node:test";

import { loadBffFe000Inputs, validateBffFe000 } from "./check-bff-fe-000.mjs";

const current = loadBffFe000Inputs();

test("current BFF-FE-000 repository Gate passes", () => {
  const report = validateBffFe000(current);
  assert.equal(report.status, "PASS", report.failures.join("\n"));
  assert.deepEqual([report.contracts, report.pages, report.publishedOperations], [17, 22, current.manifest.operations.length]);
});

test("missing phase-one page mapping is rejected", () => {
  const catalog = structuredClone(current.catalog);
  catalog.scope.pages = catalog.scope.pages.filter((page) => page !== "P23");
  const report = validateBffFe000({ ...current, catalog });
  assert(report.failures.includes("catalog covers phase-one P01-P15/P17-P23 exactly"));
});

test("published operation drift is rejected", () => {
  const catalog = structuredClone(current.catalog);
  catalog.contracts.C01.publishedOperations.pop();
  const report = validateBffFe000({ ...current, catalog });
  assert(report.failures.includes("published catalog operations exactly match versioned OpenAPI"));
});

test("future planned operation traceability deletion is rejected after C02 publication", () => {
  const catalog=structuredClone(current.catalog);catalog.contracts.C02.plannedOperations.push("getFutureCommandSummary");
  const report=validateBffFe000({...current,catalog});
  assert(report.failures.includes("planned operation getFutureCommandSummary is traceable from Page API Coverage"));
});

test("shared idempotency baseline deletion is rejected", () => {
  const openapi = structuredClone(current.openapi);
  delete openapi.components.parameters.IdempotencyKey;
  const report = validateBffFe000({ ...current, openapi });
  assert(report.failures.includes("OpenAPI defines shared IdempotencyKey parameter"));
});

test("dependency regression is rejected", () => {
  const corePlan = current.corePlan.replace(
    /(- task_id: `F06`[\s\S]*?- development_status: `)COMPLETED(`)/,
    "$1IN_PROGRESS$2",
  );
  const report = validateBffFe000({ ...current, corePlan });
  assert(report.failures.includes("dependency F06 is COMPLETED"));
});

test("error correlation header deletion is rejected", () => {
  const openapi = structuredClone(current.openapi);
  delete openapi.components.responses.Forbidden.headers["X-Correlation-Id"];
  const report = validateBffFe000({ ...current, openapi });
  assert(report.failures.includes("Forbidden error response exposes X-Correlation-Id"));
});

test("generated Zod export deletion is rejected", () => {
  const apiClientIndex = current.apiClientIndex.replace('export { bffZodSchemas } from "./bff-gen/quantos-bff.zod.js";', "");
  const report = validateBffFe000({ ...current, apiClientIndex });
  assert(report.failures.includes("API client exports generated Zod schemas"));
});

test("new-domain success headers remain mandatory", () => {
  for (const path of ["/v1/performance/summary", "/v1/operations/health", "/v1/admin/members", "/v1/alerts"]) {
    for (const header of ["X-Correlation-Id", "Cache-Control"]) {
      const openapi = structuredClone(current.openapi);
      const operation = openapi.paths[path].get;
      delete operation.responses["200"].headers[header];
      assert(validateBffFe000({ ...current, openapi }).failures.includes(`${operation.operationId}/200 correlation/cache headers`));
    }
  }
});

test("named pagination cannot lose declared filters or bounded sort", () => {
  for (const mutate of [
    op => { op.parameters = op.parameters.filter(p => p.name !== "status"); },
    op => { delete op["x-quantos-policy"].filter; },
    op => { op["x-quantos-policy"].filter = ["invented"]; },
    op => { op.parameters.find(p => p.name === "sort").schema.enum.push("arbitrary"); },
    op => { op.parameters.find(p => p.name === "status").schema = { type: "string" }; },
    op => { op.parameters.push({ in: "query", name: "filter", schema: { type: "string" } }); },
  ]) {
    const openapi = structuredClone(current.openapi);
    mutate(openapi.paths["/v1/alerts"].get);
    assert(validateBffFe000({ ...current, openapi }).failures.includes("listAlerts bounded sort/filter policy"));
  }
});
