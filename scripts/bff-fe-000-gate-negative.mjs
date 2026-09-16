import assert from "node:assert/strict";
import test from "node:test";

import { loadBffFe000Inputs, validateBffFe000 } from "./check-bff-fe-000.mjs";

const current = loadBffFe000Inputs();

test("current BFF-FE-000 repository Gate passes", () => {
  const report = validateBffFe000(current);
  assert.equal(report.status, "PASS", report.failures.join("\n"));
  assert.deepEqual([report.contracts, report.pages, report.publishedOperations], [17, 22, 56]);
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

test("planned operation traceability deletion is rejected", () => {
  const coverage = current.coverage.replace("getCommandSummary", "removedCommandSummary");
  const report = validateBffFe000({ ...current, coverage });
  assert(report.failures.includes("planned operation getCommandSummary is traceable from Page API Coverage"));
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
