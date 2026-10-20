import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {snapshot as previousSnapshot,environment} from './provider-a6-functional-scope.mjs';
import {inventory,digest,nodesFromPlans,planInput} from './provider-a1-receipts.mjs';
export {environment};
export const nodeId='PROVIDER:ALL',profile='ALL_SCOPE_LOCAL';
export const prerequisites=[...Array.from({length:6},(_,i)=>`PROVIDER:A${i+1}`),...Array.from({length:12},(_,i)=>`FE:BFF-FE-${String(i).padStart(3,'0')}`),'FRONTEND-GATE:G0'];
const c=(id,command,reason)=>({id,command,reason,timeoutMs:600000});
export const checks=[
 c('contract',['node','scripts/check-provider-all-boundary.mjs'],'All 12 API task scopes: BFF000 infrastructure and134 published runtime operations,17 contracts,113 schemas; no recursive provider Gates'),
 c('generated',['node','scripts/check-bff-generated.mjs'],'Current six generated OpenAPI/client/Zod/JSONSchema/MSW/native-policy files match'),
 c('inventory',['node','scripts/pre04-inventory.mjs'],'Current provider implementation registry hashes after adding ALL composition tests; no original target receipt promotion'),
 c('g0-minimum',['node','scripts/check-bff-fe-000.mjs'],'Current G0 minimum/field binding/page traceability across all published APIs only; original G0 confirmation remains pending'),
 c('g0-records',['node','scripts/check-g0-records.mjs'],'Current G0 ledger19 owner/deadline/compatibility dispositions and no fake formal acceptance'),
 c('pre01',['node','scripts/check-pre01.mjs'],'Direct current G0 contract/import and platform foundation static checks without rerunning preparation Gates'),
 c('native',['cargo','test','--locked','--offline','-p','bff-gateway','--lib','--','--skip','live::f09_live_tests','--test-threads=1'],'All current BFF native domains, mixed provider authority, permissions, idempotency, leases/recovery and deadlines; explicit target DB test excluded NOT_RUN'),
 c('identity-audit',['cargo','test','--locked','--offline','-p','bff-gateway','--test','auth_settings_provider','--test','audit_export_provider'],'Current shared auth/settings/audit/export provider ownership and refusal regressions, without DB/IdP/F05/F06 Gate execution'),
 c('build',['cargo','build','--locked','--offline','-p','bff-gateway','--bin','bff-gateway'],'One current BFF binary for owned HTTP/Chromium/generated consumer probes, no whole workspace builds'),
 c('http',['node','scripts/test-provider-all-http.mjs','{attempt}/aggregate-http.json'],'Fresh current probes of all134 operations using owned reference hosts, schema/success/refusal/recovery controls and basic Chromium only'),
 c('consumers',['pnpm','exec','vitest','run','apps/terminal/tests/provider-all-aggregate-consumer.test.ts',...['a2-provider','audit-provider','research-provider','market-provider','execution-provider','strategy-provider','reconciliation-provider','performance-provider','operations-provider','command-provider','browser-platform-provider','a2-aggregate','a3-aggregate','a4-aggregate','a5-aggregate','a6-aggregate'].map(n=>'apps/terminal/tests/'+n+'-consumer.test.ts'),'packages/api-client/tests','tests/contract'],'Generated clients for every current runtime API family plus one shared ALL provider, transports/SSE/schema/refusal; excludes unrelated UI/workspace suites'),
 c('types',['pnpm','--filter','@sumalpha/api-client','--filter','@sumalpha/terminal','typecheck'],'Current generated client and shared ALL consumer compile against pinned dependencies'),
 c('lint',['pnpm','--filter','@sumalpha/api-client','--filter','@sumalpha/terminal','lint'],'Direct generated API and Terminal boundary static regression for ALL composition'),
 c('clippy',['cargo','clippy','--locked','--offline','-p','bff-gateway','--lib','--','-D','warnings'],'Current BFF library static validation, no live host or database credentials'),
 c('web-poc',['node','scripts/a1-web-poc.mjs'],'Current G0 Web/OIDC/route/SSE foundation and one Terminal build/Chromium PoC; mock interception and static JS budget do not prove full page integration or performance acceptance'),
 c('confirmation',['node','--test','scripts/provider-a6-confirmation-20261020.test.mjs','scripts/user-acceptance-confirmation.test.mjs'],'Original A6 user reply/draft/source/receipt scope binding only; G0 and ALL current confirmation remain pending'),
 c('gate-tests',['node','--test','scripts/provider-all-functional-gate.test.mjs'],'Current ALL source/log/command/nested HTTP/freeze tamper refusal and atomic BLOCKED publication rollback'),
 c('plan-policy',['node','--test','scripts/development-plan-order-negative.mjs','scripts/ci-stage-disposition.test.mjs'],'Current ALL mandatory CI dispatch validates engineering BLOCKED without admitting pages or recursively evaluating dependencies'),
 c('plans',['node','scripts/check-development-plans.mjs'],'Both plan stage contracts and ALL scope agree; all19 dependencies remain original reference-only')
];
export const commands=attempt=>checks.map(c=>({...c,command:c.command.map(v=>v.replace('{attempt}',attempt))}));
export function snapshot(){const prev=previousSnapshot(),refs=JSON.parse(readFileSync('docs/audit/evidence/provider-all-local-20261020/preflight/original-receipts.json'));
 const inputs=inventory([...prev.inputs.map(i=>i.path),'docs/operations/provider-all-functional-admission.md','docs/audit/evidence/provider-all-local-20261020/preflight/','docs/audit/evidence/provider-a6-confirmation-20261020/',...refs.map(r=>r.path)]),nodes=nodesFromPlans(),normative=[nodeId,...prerequisites].map(id=>({nodeId:id,planInput:planInput(nodes.get(id))})),policy=JSON.parse(readFileSync('scripts/development-testing-policy.json'));
 assert(!checks.some(c=>c.command.includes('--workspace')));assert(!inputs.some(i=>/(?:^|\/)\.env(?!\.example$)/.test(i.path)));return{schema:'quantos-provider-all-functional-inputs/v1',inputs,normative,checks,policy,inputDigest:digest(JSON.stringify({inputs,normative,checks,policy}))};}
