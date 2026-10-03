import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { loadBffFe000Inputs, validateBffFe000 } from '../../../../scripts/check-bff-fe-000.mjs';
import { bffZodSchemas } from '../../../../packages/api-client/src/bff-gen/quantos-bff.zod.ts';
import { validateFixture } from '../../../../tests/contract/validate.mjs';
const dir = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(dir, '../../../..');
const input = loadBffFe000Inputs();
const doc = input.openapi;
const deref = obj => obj?.$ref ? doc.components[obj.$ref.split('/')[2]][obj.$ref.split('/')[3]] : obj;
const operations = Object.entries(doc.paths).flatMap(([path, item]) =>
  Object.entries(item).filter(([, op]) => op.operationId).map(([method, op]) => ({ path, method, ...op })));
const hasParameter = (op, name) => (op.parameters ?? []).some(p => deref(p)?.name === name);
const success = operations.flatMap(op => Object.entries(op.responses).filter(([status]) => /^2/.test(status))
  .map(([status, res]) => ({operationId: op.operationId, status, response: deref(res)})));
const lists = operations.filter(op => Object.values(op.responses).some(r =>
  r.content?.['application/json']?.schema?.allOf?.some(s => s.$ref === '#/components/schemas/Page')));
const bodies = operations.filter(op => op.requestBody).map(op => ({ operationId: op.operationId,
  schema: deref(op.requestBody.content['application/json']?.schema) }));
const missing = (list, predicate) => list.filter(predicate).map(op => op.operationId);
const mutations = {
  'remove-cookie-security': clone => { clone.openapi.security = []; },
  'idempotency-not-required': clone => { clone.openapi.components.parameters.IdempotencyKey.required = false; },
  'remove-sort-from-shared-schema': clone => { clone.openapi.components.parameters.Sort.schema = {type:'integer'}; },
  'wrong-contract-page-map': clone => { clone.catalog.contracts.C03.pages = ['P23']; },
  'inactive-a1-ci-step': clone => { clone.workflow = clone.workflow.replace('run: pnpm check:bff-fe-000 && pnpm test:bff-fe-000', 'if: false\n        run: pnpm check:bff-fe-000 && pnpm test:bff-fe-000'); },
  'same-version-breaking-decimal': clone => { clone.openapi.components.schemas.DecimalValue = {type:'number'}; },
  'missing-stream-payload-version-constraint': clone => { clone.openapi.components.schemas.StreamEvent.properties.payloadVersion = {}; },
};
const gateProbes = Object.entries(mutations).map(([name, mutate]) => {
  const clone = structuredClone(input); mutate(clone);
  const result = validateBffFe000(clone);
  return {name, actual:result.status, failures:result.failures};
});
const uuid = '11111111-1111-4111-8111-111111111111';
const stream = {streamId:uuid, sequence:1, eventId:uuid, occurredAt:'2026-10-03T00:00:00Z',
  correlationId:uuid, payloadVersion:'v1', payload:{type:'permission_revoked', orderId:uuid}};
const draft = JSON.parse(readFileSync(resolve(root,'tests/contract/fixtures/strategy/default.json')));
draft.parameters = {riskBudget:'0.01', nested:{venue:'synthetic'}};
const parsing = [ ['StreamEvent',stream], ['StrategyDraft',draft] ].map(([schema,value]) => {
  const parsed = bffZodSchemas[schema].safeParse(value);
  return {schema, jsonSchemaIssues:validateFixture(value,{schema}), zodSuccess:parsed.success,
    input:value, output:parsed.success ? parsed.data : null};
});
const enumOneOf = {
  code:'RANDOM_NEW_ERROR', message:'safe message', correlationId:uuid,
  debug:'synthetic-stack-only'
};
const requestExamples = Object.values(doc.components.responses).filter(r => r.content?.['application/json']?.example).length;
const report = {
  version:doc.info.version, operations:operations.length, schemas:Object.keys(doc.components.schemas).length,
  published:Object.values(input.catalog.contracts).flatMap(c=>c.publishedOperations??[]).length,
  planned:Object.values(input.catalog.contracts).flatMap(c=>c.plannedOperations??[]).length,
  lists:lists.map(op=>({operationId:op.operationId, sort:hasParameter(op,'sort'), filter:hasParameter(op,'filter'),
    cursor:hasParameter(op,'cursor'), pageSize:hasParameter(op,'pageSize')})),
  successResponses:success.length,
  missingSuccessCorrelation:missing(success, op=>!op.response.headers?.['X-Correlation-Id']),
  missingServerError:missing(operations, op=>!Object.keys(op.responses).some(k=>/^5/.test(k)||k==='default')),
  mutationOperations:operations.filter(op=>['post','put','patch','delete'].includes(op.method)).length,
  missingCsrf:missing(operations, op=>['post','put','patch','delete'].includes(op.method) &&
    op.path!=='/v1/access-requests' && !hasParameter(op,'X-CSRF-Token')),
  missingIdempotency:missing(operations,op=>['post','put','patch','delete'].includes(op.method)&&!hasParameter(op,'Idempotency-Key')),
  requestBodies:bodies.length,
  permissiveRequestBodies:bodies.filter(b=>b.schema?.additionalProperties!==false).map(b=>b.operationId),
  operationExamples:operations.filter(op=>op.requestBody?.content?.['application/json']?.example ||
    Object.values(op.responses).some(r=>r.content?.['application/json']?.example)).map(op=>op.operationId),
  sharedResponseExamples:requestExamples,
  gateProbes, parsing,
  errorEnvelopeUnknownProperties:{input:enumOneOf,issues:validateFixture(enumOneOf,{schema:'ErrorEnvelope'})},
};
writeFileSync(resolve(dir,'inspection.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report, parsing:report.parsing.map(p=>({schema:p.schema,jsonSchemaIssues:p.jsonSchemaIssues,
  zodSuccess:p.zodSuccess, inputParameters:p.input.parameters, outputParameters:p.output?.parameters,
  inputPayload:p.input.payload,outputPayload:p.output?.payload}))},null,2));
