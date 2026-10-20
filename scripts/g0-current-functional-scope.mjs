import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scopeRequest} from './g0-development.mjs';
import {environment} from './a1-functional-scope.mjs';
import {inventory,digest,nodesFromPlans,planInput} from './provider-a1-receipts.mjs';
export {environment};
export const directory='docs/audit/evidence/g0-local-20261020',g0Id='FRONTEND-GATE:G0',allId='PROVIDER:ALL';
const c=(id,command,reason)=>({id,command,reason,timeoutMs:600000});
export const checks=[
 c('ledger',['node','scripts/g0-current-ledger.mjs'],'Exactly8 API engineering dispositions map to confirmed original134-operation proof; other11 items and4 remaining legacy fixture classes remain explicitly unchanged'),
 c('records',['node','scripts/check-g0-records.mjs'],'Current19 dispositions match human/policy owner/deadline/stage plus original10 historical rows; no formal G0 activation'),
 c('minimum',['node','scripts/check-bff-fe-000.mjs'],'Current17 contract/22 page/134 operation and14 minimum schema freeze; infrastructure only, no upstream Gate execution'),
 c('pre01',['node','scripts/check-pre01.mjs'],'Current pages, routes, permissions, all published operation source and acceptance traceability'),
 c('generated',['node','scripts/check-bff-generated.mjs'],'Compare all six generated client/Zod/schema/MSW/native policy outputs; no current API source change'),
 c('proto',['node','scripts/a1-proto-boundary.mjs'],'Direct G0 protocol boundary: offline lint/descriptor/breaking against explicit trusted ancestor and JSONSchema; remote codegen/full F03 Gate NOT_RUN'),
 c('negative',['node','--test','scripts/tests/check-pre01.test.mjs','scripts/frontend-import-boundary.test.mjs','scripts/g0-development.test.mjs','scripts/bff-fe-000-gate-negative.mjs','scripts/bff-remediation-negative.mjs','scripts/tests/check-proto-config.test.mjs','scripts/tests/check-json-schemas.test.mjs'],'Current G0 scope/contract/import/confirmation/protocol mutation refusal without upstream revalidation'),
 c('consumers',['pnpm','exec','vitest','run','apps/terminal/tests/auth-poc.test.ts','packages/api-client/tests','tests/contract'],'Current auth/CSRF/generated client/schema/permission/sensitive field/SSE recovery foundation; original unchanged API runtime134 operations remain source-bound reference only'),
 c('types',['pnpm','--filter','@sumalpha/api-client','--filter','@sumalpha/terminal','--filter','@sumalpha/website','typecheck'],'Current G0 generated client/Terminal/website foundation types, without whole workspace or upstream builds'),
 c('lint',['pnpm','--filter','@sumalpha/api-client','--filter','@sumalpha/terminal','--filter','@sumalpha/website','lint'],'Current G0 frontend production import and security boundary static check'),
 c('web-poc',['node','scripts/a1-web-poc.mjs'],'One current Terminal build plus11 Chromium route/mock OIDC/axe/visual cases, client-secret scan and static JS budget; full UI/target performance NOT_RUN'),
 c('linux-baselines',['node','scripts/check-visual-baselines.mjs','--platform','linux'],'Current required Linux snapshot inventory/checksums only; no full platform campaign'),
 c('confirmation',['node','--test','scripts/provider-all-confirmation-20261020.test.mjs','scripts/user-acceptance-confirmation.test.mjs'],'Actual original ALL human reply/draft/source/receipt binding only; new G0 scope is not implicitly approved'),
 c('gate-tests',['node','--test','scripts/g0-current-functional-gate.test.mjs'],'Current ledger/source delta/original proof/log/command/user scope/blocker/atomic publication refusal; L10-2 prevents premature ALL READY'),
 c('plan-policy',['node','--test','scripts/development-plan-order-negative.mjs','scripts/ci-stage-disposition.test.mjs'],'G0 current local profile and ALL G0 reassessment profile register mandatory CI while current blockers deny page admission'),
 c('plans',['node','scripts/check-development-plans.mjs'],'Both plan contracts and current stage registration agree without granting unchanged upstream Gates')
];
export const commands=attempt=>checks.map(c=>({...c,command:c.command.map(v=>v.replace('{attempt}',attempt))}));
export function snapshot(){const original=JSON.parse(readFileSync('docs/audit/evidence/provider-all-local-20261020/manifest.json')),g0Request=scopeRequest(),nodes=nodesFromPlans();
 const selectors=[...original.inputs.inputs.map(i=>i.path),...g0Request.inputs.map(i=>i.path),'docs/audit/evidence/provider-all-local-20261020/manifest.json','docs/audit/evidence/provider-all-local-20261020/confirmation-draft.md','docs/audit/evidence/provider-all-confirmation-20261020/','docs/operations/g0-current-functional-admission.md',directory+'/preflight/'];
 const inputs=inventory(selectors),normative=[...new Set([g0Id,allId,...nodes.get(g0Id).dependencies,...nodes.get(allId).dependencies])].map(nodeId=>({nodeId,planInput:planInput(nodes.get(nodeId))})),policy=JSON.parse(readFileSync('scripts/development-testing-policy.json'));
 assert(!inputs.some(i=>/(?:^|\/)\.env(?!\.example$)/.test(i.path)));assert(!checks.some(c=>c.command.includes('--workspace')));return{schema:'quantos-g0-current-functional-inputs/v1',inputs,normative,g0Request,checks,policy,inputDigest:digest(JSON.stringify({inputs,normative,g0Request,checks,policy}))};
}
