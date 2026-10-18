// A2 current-function aggregate, not recursive upstream admission.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {snapshot as auditSnapshot,environment} from './bff-fe-007-functional-scope.mjs';
import {inventory,digest,nodesFromPlans,planInput} from './provider-a1-receipts.mjs';
export {environment};
export const nodeId='PROVIDER:A2',profile='A2_SCOPE_LOCAL';
export const prerequisites=['FE:BFF-FE-001','FE:BFF-FE-007','PROVIDER:A1'];
const c=(id,command,reason)=>({id,command,reason,timeoutMs:600000});
export const checks=[
 c('contract',['node','scripts/check-bff-contract-coverage.mjs'],'Current C01/C17/C10 operation ownership, OpenAPI schema, permission/error and published implementation inventory'),
 c('contract-negative',['node','--test','scripts/provider-a2-development.test.mjs','scripts/bff-fe-007-gate-negative.mjs','scripts/bff-fe-001-gate-negative.mjs'],'Historical strict modes retain rejection guarantees while scoped aggregate never borrows historical target READY'),
 c('generated',['node','scripts/check-bff-generated.mjs'],'A1 direct consumed boundary: OpenAPI/client/schema/Zod/MSW outputs match current generator and catalog'),
 c('f05-static',['node','scripts/check-f05.mjs'],'Direct F05 append-only ledger/provenance/outbox contract inspection; no database or upstream gate execution'),
 c('f05-tenant',['cargo','test','--locked','--offline','-p','quantos-event','--lib','provenance_is_required_and_replay_filters_the_tenant_boundary'],'F05 directly consumed provenance and tenant isolation behavior on pure contract fixtures, not target database acceptance'),
 c('f05-recovery',['cargo','test','--locked','--offline','-p','quantos-event','--lib','projection_can_resume_after_restart_from_checkpoint'],'F05 directly consumed sequence/checkpoint recovery behavior, without unrelated complete persistence suite'),
 c('provider',['cargo','test','--locked','--offline','-p','bff-gateway','--test','auth_settings_provider','--test','audit_export_provider'],'Both current A2 providers: permissions, versions, concurrency, idempotency, redaction, cursor and retention refusal'),
 c('audit-core',['cargo','test','--locked','--offline','-p','bff-gateway','--lib','audit_core::tests'],'Shared live/reference canonical evidence hash, redaction, scope and watermarked artifact encoding'),
 c('http',['node','scripts/test-bff-provider-contract.mjs','{attempt}/reference-http.json','--aggregate'],'Fresh same-source real loopback HTTP for all 26 operations, audit 401/403, expiry and post-logout metadata refusals'),
 c('consumers',['pnpm','exec','vitest','run','apps/terminal/tests/auth-bff.test.ts','apps/terminal/tests/ui104-settings.test.ts','apps/terminal/tests/audit-gateway.test.ts','apps/terminal/tests/a2-provider-consumer.test.ts','apps/terminal/tests/audit-provider-consumer.test.ts','apps/terminal/tests/a2-aggregate-consumer.test.ts','packages/api-client/tests/bff-response.test.ts','packages/api-client/tests/bff-transport.test.ts','packages/api-client/tests/sse-poc.test.ts','tests/contract'],'Current generated consumers plus actual Rust combined identity/export boundary, lost-response replay and terminal SSE revocation'),
 c('types',['pnpm','--filter','@sumalpha/api-client','--filter','@sumalpha/terminal','typecheck'],'Compile combined generated consumers and current auth/settings/audit functions against current generated types'),
 c('lint',['pnpm','--filter','@sumalpha/api-client','--filter','@sumalpha/terminal','lint'],'Static validation for affected consumer packages and combined functional test without unrelated workspace build'),
 c('confirmation',['node','--test','scripts/user-acceptance-confirmation.test.mjs','scripts/committed-prose-confirmation.test.mjs','scripts/bff-fe-007-confirmation.test.mjs'],'Both original user confirmations bind exact original documents/receipts/sources; no current aggregate self approval'),
 c('gate-tests',['node','--test','scripts/provider-a2-functional-gate.test.mjs'],'Aggregate current-source/log/API coverage admission, no historical READY, no empty tests and atomic rollback'),
 c('plan-policy',['node','--test','scripts/development-plan-order-negative.mjs','scripts/ci-stage-disposition.test.mjs'],'Explicit A2 aggregate-only profile and mandatory CI disposition preserve stage ordering without upstream revalidation'),
 c('plans',['node','scripts/check-development-plans.mjs'],'Current plans and runtime gate agree on scoped A2 function status and independent integration/release obligations')
];
export const commands=attempt=>checks.map(c=>({...c,command:c.command.map(s=>s.replace('{attempt}',attempt))}));
export function snapshot(){
 const previous=auditSnapshot();const inputs=inventory([...previous.inputs.map(i=>i.path),'apps/terminal/src/settings/','apps/terminal/tests/a2-provider-consumer.test.ts','apps/terminal/tests/a2-aggregate-consumer.test.ts','docs/audit/evidence/bff-fe-007-local-20261018/manifest.json','docs/audit/evidence/bff-fe-007-local-20261018/confirmation-draft.md','docs/audit/evidence/bff-fe-007-confirmation-20261018/','docs/audit/evidence/provider-a2-local-20261018/preflight/','docs/operations/provider-a2-functional-admission.md','docs/execution/PRE-01-page-api-coverage-register.md']);
 assert(!inputs.some(i=>/(?:^|\/)\.env(?!\.example$)/.test(i.path)));const nodes=nodesFromPlans(),normative=[nodeId,...prerequisites,'CORE:F05','FE:BFF-FE-000'].map(id=>({nodeId:id,planInput:planInput(nodes.get(id))}));
 const policy=JSON.parse(readFileSync('scripts/development-testing-policy.json'));assert.equal(policy.development.recursiveDependencyRevalidation,false);assert(!checks.some(c=>c.command.includes('--workspace')));
 return {schema:'quantos-a2-aggregate-functional-inputs/v1',inputs,normative,checks,policy,inputDigest:digest(JSON.stringify({inputs,normative,checks,policy}))};
}
