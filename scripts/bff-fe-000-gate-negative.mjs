import assert from "node:assert/strict";
import test from "node:test";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { loadBffFe000Inputs, validateBffFe000 } from "./check-bff-fe-000.mjs";
import { loadBffCoverageInputs, validateBffCoverage } from "./check-bff-contract-coverage.mjs";

const current = loadBffFe000Inputs();
const pageCoverage = loadBffCoverageInputs();
const { structuredClone } = globalThis;

test('controlled review examples validate and cannot claim execution authority or accept injected fields', () => {
  const ajv = addFormats(new Ajv({ strict: false, allErrors: true }));
  for (const item of Object.values(current.openapi.paths)) for (const operation of Object.values(item)) {
    if (!/Assisted(Financial|Source)|createAssistedNativeRiskReview|getAssistedActivationHistory/.test(operation.operationId ?? '')) continue;
    const response = operation.responses['200'].content['application/json'];
    const validateResponse = ajv.compile({ ...response.schema, components: current.openapi.components });
    assert(validateResponse(response.example), `${operation.operationId}: ${JSON.stringify(validateResponse.errors)}`);
    assert.equal(validateResponse({ ...response.example, executionAuthority: true }), false);
    const request = operation.requestBody?.content['application/json'];
    if (request) {
      const validateRequest = ajv.compile({ ...request.schema, components: current.openapi.components });
      assert(validateRequest(request.example), `${operation.operationId}: ${JSON.stringify(validateRequest.errors)}`);
      assert.equal(validateRequest({ ...request.example, injectedAuthority: true }), false);
    }
  }
});

test('all review action verbs participate in page coverage and unknown-operation refusal', () => {
  assert.deepEqual(validateBffCoverage(pageCoverage).failures, []);
  for (const verb of ['endorse', 'authorize', 'retain']) for (const domain of ['Financial', 'Source']) {
    const operation = verb === 'retain' ? `${verb}Assisted${domain}Block` : `${verb}Assisted${domain}Review`;
    assert(pageCoverage.coverage.includes(operation));
    const missing = validateBffCoverage({ ...pageCoverage, coverage: pageCoverage.coverage.replaceAll(operation, '') });
    assert(missing.failures.includes(`frozen operation has no page coverage reference: ${operation}`));
    const unknown = `${verb}Unknown${domain}Review`;
    const renamed = validateBffCoverage({ ...pageCoverage, coverage: pageCoverage.coverage.replaceAll(operation, unknown) });
    assert(renamed.failures.includes(`page coverage references unknown operationId: ${unknown}`));
  }
});

test('every feature-flag union branch must close untrusted request properties', () => {
  for (const name of ['GovernanceFeatureFlagAction', 'AssistedActivationAction']) {
    const openapi = structuredClone(current.openapi);
    delete openapi.components.schemas[name].additionalProperties;
    assert(validateBffFe000({ ...current, openapi }).failures.includes('saveFeatureFlag closes untrusted request fields'));
  }
});

test('immutable activation history cannot gain unbounded sorting or filtering', () => {
  for (const mutate of [
    op => { delete op['x-quantos-policy'].sortFilterNotApplicable; },
    op => { op.parameters.push({ in: 'query', name: 'filter', schema: { type: 'string' } }); },
    op => { op.parameters.find(p => p.name === 'pageSize').schema.maximum = 1000; },
  ]) {
    const openapi = structuredClone(current.openapi);
    mutate(openapi.paths['/v1/admin/feature-flags/{resourceId}/history'].get);
    assert(validateBffFe000({ ...current, openapi }).failures.includes('getAssistedActivationHistory bounded sort/filter policy'));
  }
});

test('review and activation operations retain required examples and safe response headers', () => {
  for (const [path, item] of Object.entries(current.openapi.paths)) for (const [method, operation] of Object.entries(item)) {
    if (!/Assisted(Financial|Source)|createAssistedNativeRiskReview|getAssistedActivationHistory/.test(operation.operationId ?? '')) continue;
    for (const header of ['X-Correlation-Id', 'Cache-Control']) {
      const openapi = structuredClone(current.openapi);
      delete openapi.paths[path][method].responses['200'].headers[header];
      assert(validateBffFe000({ ...current, openapi }).failures.includes(`${operation.operationId}/200 correlation/cache headers`));
    }
    const openapi = structuredClone(current.openapi);
    delete openapi.paths[path][method].responses['200'].content['application/json'].example;
    assert(validateBffFe000({ ...current, openapi }).failures.includes(`${operation.operationId} success example`));
  }
});

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
