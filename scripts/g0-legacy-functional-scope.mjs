import{readFileSync}from'node:fs';import{scopeRequest}from'./g0-development.mjs';import{inventory,digest,nodesFromPlans,planInput}from'./provider-a1-receipts.mjs';
export{environment}from'./a1-functional-scope.mjs';
export const directory='docs/audit/evidence/g0-legacy-local-20261020',g0Id='FRONTEND-GATE:G0',allId='PROVIDER:ALL';
const c=(id,command,reason)=>({id,command,reason,timeoutMs:600000});
export const checks=[
 c('types',['pnpm','--filter','@sumalpha/api-client','--filter','@sumalpha/domain-ui','--filter','@sumalpha/terminal','--filter','@sumalpha/website','typecheck'],'Type-only compatibility models and all direct UI consumers compile'),
 c('lint',['pnpm','--filter','@sumalpha/api-client','--filter','@sumalpha/domain-ui','--filter','@sumalpha/terminal','--filter','@sumalpha/website','lint'],'Production fixture/import/security boundary and migrated scenario adapters'),
 c('api-build',['pnpm','--filter','@sumalpha/api-client','build'],'Current production client build; four compatibility modules must emit no runtime'),
 c('removal',['node','scripts/legacy-backend-boundary.mjs','--artifacts'],'Four production classes/constructors absent; no renamed runtime or fixture re-export; compiled models empty'),
 c('generated',['node','scripts/check-bff-generated.mjs'],'All six generated contract outputs unchanged'),
 c('consumers',['pnpm','exec','vitest','run','apps/terminal/tests/u01-scenarios.test.ts','apps/terminal/tests/s04-scenarios.test.ts','apps/terminal/tests/x06-scenarios.test.ts','apps/terminal/tests/l03-scenarios.test.ts','apps/terminal/tests/generated-scenario-adapters.test.ts','apps/terminal/tests/auth-poc.test.ts','packages/api-client/tests','packages/domain-ui/tests','tests/contract'],'All29 historical assertions retained; generated schema adapters, public exports, direct client/read-model/auth/SSE/contract regressions'),
 c('negative',['node','--test','scripts/legacy-backend-boundary.test.mjs','scripts/frontend-import-boundary.test.mjs','scripts/g0-current-functional-gate.test.mjs','scripts/g0-development.test.mjs','scripts/user-acceptance-confirmation.test.mjs'],'Removal/source/production bypass and existing G0 confirmation refusal regressions; historical fixtures retain original scope'),
 c('web-poc',['node','scripts/a1-web-poc.mjs'],'One current build and11 Chromium route/mock OIDC/axe/visual cases after production export removal; static JS budget only'),
 c('original-g0',['node','scripts/g0-confirmation-20261020.mjs'],'Verify actual immutable original G0 approval/engineering closure at original e4434952/f7141e4b, no reexecution or later scope approval'),
 c('original-all',['node','scripts/provider-all-confirmation-20261020.mjs'],'Verify actual original ALL approval only; no134 API/Rust rerun or new-source rebinding'),
 c('gate-tests',['node','--test','scripts/g0-legacy-functional-gate.test.mjs'],'Current source delta, legacy completion, confirmation scope, logs/commands and atomic publication fail closed'),
 c('plan-policy',['node','--test','scripts/development-plan-order-negative.mjs','scripts/ci-stage-disposition.test.mjs'],'Current local profiles and mandatory CI preserve strict admission'),
 c('records',['node','scripts/check-g0-records.mjs'],'Only L10-2 changes beyond approved8 mappings;19 owners/deadlines preserved, future obligations not closed'),
 c('minimum',['node','scripts/check-bff-fe-000.mjs'],'Direct G0 minimum contract source check, no upstream Gate reruns'),
 c('pre01',['node','scripts/check-pre01.mjs'],'Current contract/page/permissions traceability'),
 c('plans',['node','scripts/check-development-plans.mjs'],'Both plans and actual stage registrations agree')
];
export const commands=()=>checks;
export function snapshot(){const previous=JSON.parse(readFileSync('docs/audit/evidence/g0-confirmation-20261020/confirmed-g0.json')),g0Request=scopeRequest(),nodes=nodesFromPlans();const inputs=inventory([...previous.inputs.inputs.map(i=>i.path),...g0Request.inputs.map(i=>i.path),'docs/audit/evidence/g0-confirmation-20261020/',directory+'/preflight/','docs/operations/g0-legacy-backend-migration.md']);const normative=[...new Set([g0Id,allId,...nodes.get(g0Id).dependencies,...nodes.get(allId).dependencies])].map(nodeId=>({nodeId,planInput:planInput(nodes.get(nodeId))}));const policy=JSON.parse(readFileSync('scripts/development-testing-policy.json'));return{schema:'quantos-g0-legacy-inputs/v1',inputs,normative,g0Request,checks,policy,inputDigest:digest(JSON.stringify({inputs,normative,g0Request,checks,policy}))};}
