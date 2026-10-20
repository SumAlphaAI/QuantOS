// Only current A5 features and directly affected shared auth/audit composition.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {snapshot as previousSnapshot,environment} from './bff-fe-010-functional-scope.mjs';
import {inventory,digest,nodesFromPlans,planInput} from './provider-a1-receipts.mjs';
export {environment};
export const nodeId='PROVIDER:A5',profile='A5_SCOPE_LOCAL',prerequisites=['FE:BFF-FE-009','FE:BFF-FE-008','FE:BFF-FE-010','PROVIDER:A4'];
const c=(id,command,reason)=>({id,command,reason,timeoutMs:600000});
const native=(id,filter,reason)=>c(id,['cargo','test','--locked','--offline','-p','bff-gateway','--lib',filter,'--','--test-threads=1'],reason);
export const checks=[
 c('contract',['node','scripts/check-provider-a5-boundary.mjs'],'Current58 C11/C14/C15/C16 operations and direct owner/no ledger write/venue boundaries; never component gates'),
 c('generated',['node','scripts/check-bff-generated.mjs'],'Six exact compatible v1 generated artifacts and registered58 operations; compatibility scope only'),
 native('aggregate','a5_tests::','One Shadow provider: immutable ledger/report versions, independent alert sources, three-domain same-key isolation, F05 roots, current member revocation, source/download expiry and quarantine; refreshed observer cannot extend old leases or download tickets'),
 native('reconciliation','reconciliation::tests::','Current C15 functionality within the aggregate: actual X05 read-only ledger/proofs, rerun CAS/idempotency/concurrency/scope/stream and retained source history'),
 native('performance','performance::tests::','Current C14 aggregate: actual X01/C15 book and provisional binding, immutable financial/report bytes, safe methods/periods, retention/authorization/recovery'),
 native('operations','operations::tests::','Current C11/C16 aggregate: actual X06/F09, versioned governance/last-owner/SoD, signed capabilities, bounded Runbook, alert CAS and subscriber restoration'),
 c('a2-boundary',['cargo','test','--locked','--offline','-p','bff-gateway','--test','auth_settings_provider','--test','audit_export_provider'],'Shared authentication/context/MFA and F05 unique audit roots directly exercised by the new mixed provider; no F06/F05 target gate'),
 c('build',['cargo','build','--locked','--offline','-p','bff-gateway','--bin','bff-gateway'],'One current binary for fresh58-API HTTP/generated consumers/basic Chromium, no target service installation'),
 c('http',['node','scripts/test-provider-a5-http.mjs','{attempt}/aggregate-http.json'],'Fresh current C15/C14/C11-C16 probes, every58 operation success401403/schema, three100-retry campaigns and basic Chromium; no borrowed receipts'),
 c('consumers',['pnpm','exec','vitest','run','apps/terminal/tests/a5-aggregate-consumer.test.ts','apps/terminal/tests/reconciliation-provider-consumer.test.ts','apps/terminal/tests/performance-provider-consumer.test.ts','apps/terminal/tests/operations-provider-consumer.test.ts','packages/api-client/tests/bff-response.test.ts','packages/api-client/tests/bff-transport.test.ts','packages/api-client/tests/sse-poc.test.ts','tests/contract','--coverage','--coverage.provider=v8','--coverage.include=apps/terminal/src/reconciliation/gateway.ts','--coverage.include=apps/terminal/src/performance/gateway.ts','--coverage.include=apps/terminal/src/operations/gateway.ts','--coverage.reporter=json-summary','--coverage.reportsDirectory={attempt}/consumer-coverage'],'Real generated consumers on shared host plus domain cases: authoritative provisional/alert facts, immutable downloaded versions, mixed loss recovery and revocation; three critical helpers branch coverage'),
 c('types',['pnpm','--filter','@sumalpha/api-client','--filter','@sumalpha/terminal','typecheck'],'Compile new A5 consumer with current generated client and pinned toolchain only'),
 c('lint',['pnpm','--filter','@sumalpha/api-client','--filter','@sumalpha/terminal','lint'],'Static checks for aggregate consumer and directly affected shared API boundaries'),
 c('clippy',['cargo','clippy','--locked','--offline','-p','bff-gateway','--lib','--','-D','warnings'],'Necessary native adapter/static validation for actual current mixed provider wiring'),
 c('confirmation',['node','--test','scripts/bff-fe-009-confirmation-20261020.test.mjs','scripts/bff-fe-008-confirmation-20261020.test.mjs','scripts/bff-fe-010-confirmation-20261020.test.mjs','scripts/provider-a4-confirmation-20261020.test.mjs','scripts/user-acceptance-confirmation.test.mjs'],'Four original user replies/drafts/source/receipts only; aggregate A5 confirmation remains PENDING'),
 c('gate-tests',['node','--test','scripts/provider-a5-functional-gate.test.mjs'],'Current source/log/API/child-byte/coverage/ref drift, historical READY/phase promotion refusals and atomic checkpoint rollback'),
 c('plan-policy',['node','--test','scripts/development-plan-order-negative.mjs','scripts/ci-stage-disposition.test.mjs'],'A5 checkpoint-only scope and mandatory CI disposition; upstream gates remain reference-only'),
 c('plans',['node','scripts/check-development-plans.mjs'],'Two plan stage declarations consistent; full UI/target/release obligations NOT_RUN')
];
export const commands=attempt=>checks.map(c=>({...c,command:c.command.map(v=>v.replace('{attempt}',attempt))}));
export function snapshot(){
 const previous=previousSnapshot();
 const inputs=inventory([...previous.inputs.map(i=>i.path),'services/bff-gateway/src/a5_tests.rs','apps/terminal/tests/a5-aggregate-consumer.test.ts','docs/operations/provider-a5-functional-admission.md','docs/audit/evidence/provider-a5-local-20261020/preflight/','docs/audit/evidence/bff-fe-010-confirmation-20261020/',...['bff-fe-009','bff-fe-008','bff-fe-010','provider-a4'].flatMap(n=>['docs/audit/evidence/'+n+'-local-20261020/manifest.json','docs/audit/evidence/'+n+'-local-20261020/confirmation-draft.md'])]);
 const nodes=nodesFromPlans(),normative=[nodeId,...prerequisites].map(id=>({nodeId:id,planInput:planInput(nodes.get(id))})),policy=JSON.parse(readFileSync('scripts/development-testing-policy.json'));
 assert(!inputs.some(i=>/(?:^|\/)\.env(?!\.example$)/.test(i.path)));assert(checks.every(c=>!c.command.includes('--workspace')));
 return{schema:'quantos-a5-aggregate-functional-inputs/v1',inputs,normative,checks,policy,inputDigest:digest(JSON.stringify({inputs,normative,checks,policy}))};
}
