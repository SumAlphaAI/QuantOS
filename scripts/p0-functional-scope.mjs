// P0 current function checks; no recursive prerequisite admission or target execution.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {root,inventory,digest,nodesFromPlans,planInput} from './provider-a1-receipts.mjs';
export const nodeId='PREPARATION:P0',profile='P0_LOCAL';
export const prerequisites=Array.from({length:6},(_,i)=>`FE:PRE-0${i+1}`);
export const policy=JSON.parse(readFileSync(root+'/scripts/development-testing-policy.json'));
const check=(id,command,reason)=>({id,command,reason,timeoutMs:['web-poc','clean-web'].includes(id)?1200000:300000});
export const checks=[
 check('pre01',['node','scripts/check-pre01.mjs'],'Current thirty-page, seven-state requirements, route permissions, story and owner traceability'),
 check('pre01-negative',['node','--test','scripts/tests/check-pre01.test.mjs'],'Direct requirement, role, API-version and G0 owner/deadline refusal tests'),
 check('pre02',['node','packages/ui/scripts/pre02-checks.mjs'],'Current tokens, WCAG contrast, financial styles, safety i18n and component inventory'),
 check('pre02-negative',['node','--test','packages/ui/scripts/pre02-gate-negative.mjs'],'Design baseline mutations must reject weakened contrast, missing safety strings and component evidence'),
 check('pre03-negative',['node','--test','scripts/pre03-gate-negative.mjs'],'Web runtime lock/ADR, effective config isolation, stale build and browser-resource refusals'),
 check('pre04',['node','scripts/pre04-inventory.mjs'],'Current Proto/OpenAPI/catalog identity, owner, schema fields and P0 page Query/Command/Realtime inventory'),
 check('pre04-negative',['node','--test','scripts/pre04-gate-negative.mjs'],'Direct contract inventory cannot promote planned or fixture capabilities to implemented provider'),
 check('pre05',['node','packages/config/scripts/check-env.mjs','--examples'],'Three public environment templates validate without loading private root dotenv or target credentials'),
 check('pre05-negative',['node','--test','scripts/pre05-gate-negative.mjs'],'Secret scanning, dotenv isolation and both actual application build fail-closed regressions'),
 check('config-unit',['pnpm','--filter','@sumalpha/config','test'],'Current environment/mode isolation, required variables and configuration policies'),
 check('ui-unit',['pnpm','--filter','@sumalpha/ui','test'],'Current design components, dangerous-action confirmation, state indicators and shared runtime PoC'),
 check('pre06',['node','scripts/check-pre06.mjs'],'Current CI/test structure, fixture ownership, platform visual baselines and performance budget configuration'),
 check('pre06-negative',['node','--test','scripts/pre06-gate-negative.mjs','scripts/pre06-runtime-negative.mjs'],'Actual negative execution, flaky rejection and disabled/empty contract/visual evidence refusal'),
 check('contract',['pnpm','exec','vitest','run','tests/contract'],'Execute generated-schema, authorization and sensitive-field fixture assertions on current source'),
 check('sabotage',['node','scripts/pre06-sabotage-check.mjs'],'Four actual schema/auth/sensitive-field/PNG sabotage classes must be detected'),
 check('generated',['node','scripts/check-bff-generated.mjs'],'A1 input boundary: generated client, Zod, schema, MSW and input policy match current OpenAPI'),
 check('a1-inventory',['node','scripts/check-bff-fe-000.mjs'],'A1 prerequisite inspection only: seventeen contract groups and published/planned operation coverage; no A1 admission'),
 check('critical-coverage',['pnpm','coverage:critical'],'PRE06 baseline six security/authorization policies retain per-file 100 percent branches on actual execution'),
 check('web-poc',['node','scripts/p0-web-poc.mjs'],'Fresh one-round website/Terminal/Storybook builds, current-source route PoC, Chromium visual/axe/OIDC and client-secret scan'),
 check('clean-web',['node','scripts/p0-clean-web.mjs'],'PRE03 explicit clean-workspace requirement: frozen offline cached bootstrap, fresh dual Web build, config/UI tests and route smoke within thirty minutes; no core dependency closure'),
 check('gate-tests',['node','--test','scripts/p0-functional-gate.test.mjs'],'Current functional receipt must reject source/log/command drift, historical READY, false phase promotion and unsafe paths'),
 check('formal-gate-negative',['node','--test','scripts/p0-acceptance-negative.mjs'],'Keep existing formal same-SHA F06/P0 acceptance independent and fail closed'),
 check('plan-policy',['node','--test','scripts/development-plan-order-negative.mjs'],'Direct new local profile registration preserves plan stage/order and reference-only prerequisite rules'),
 check('plans',['node','scripts/check-development-plans.mjs'],'Both plans agree on stage contracts and preserve historical formal acceptance without automatic admission')
];
export function environment(base=process.env){
 const env=Object.fromEntries(Object.entries(base).filter(([k])=>['PATH','HOME','TMPDIR','LANG','LC_ALL'].includes(k)));
 const pinned=env.HOME+'/Library/pnpm/.tools/pnpm/10.20.0/bin';assert(existsSync(pinned+'/pnpm'),'pinned pnpm 10.20.0 required');env.PATH=pinned+':'+env.PATH;
 for(const line of readFileSync(root+'/env/local-mock.env.example','utf8').split('\n'))if(line.startsWith('NEXT_PUBLIC_')){const i=line.indexOf('=');env[line.slice(0,i)]=line.slice(i+1);}
 return {...env,NEXT_TELEMETRY_DISABLED:'1',STORYBOOK_DISABLE_TELEMETRY:'1',npm_config_offline:'true',QUANTOS_RELEASE_PERFORMANCE:'0'};
}
export function webEnvironment(){return {...environment(),NEXT_PUBLIC_SITE_ORIGIN:'http://localhost:3196',NEXT_PUBLIC_QUANTOS_TERMINAL_ORIGIN:'http://localhost:3190',NEXT_PUBLIC_QUANTOS_OIDC_REDIRECT_URI:'http://localhost:3190/auth/callback'};}
export function validateScope(){assert.equal(policy.development.defaultScope,'FUNCTION_AND_IMPACT');assert.equal(policy.development.recursiveDependencyRevalidation,false);assert(checks.every(c=>c.reason.length>30));assert(!checks.some(c=>c.command.includes('--workspace')||c.command.includes('install')));}
export function snapshot(){
 validateScope();const nodes=nodesFromPlans();
 const selectors=['AGENTS.md','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','.nvmrc','tsconfig.base.json','eslint.config.mjs','apps/terminal/','apps/website/','packages/','scripts/','tests/','playwright*.config.ts','vitest*.config.ts','env/','.github/workflows/','bff/','proto/','docs/execution/','docs/adr/','docs/gate-records/G0-*','docs/operations/phased-testing.md','docs/operations/p0-functional-admission.md','services/bff-gateway/src/','services/bff-gateway/tests/auth_settings_provider.rs','services/bff-gateway/tests/audit_export_provider.rs','rust-toolchain.toml','Makefile'];
 const artifacts=Object.values(JSON.parse(readFileSync(root+'/docs/execution/PRE-04-inventory-baseline.json')).implementations).flatMap(e=>e.artifacts.map(a=>a.path));
 const inputs=inventory([...selectors,...artifacts]);assert(!inputs.some(i=>/(?:^|\/)\.env(?!\.example$)/.test(i.path)),'private dotenv must not enter evidence');
 const normative=[nodeId,...prerequisites,'FE:BFF-FE-000'].map(id=>({nodeId:id,planInput:planInput(nodes.get(id))}));
 return {schema:'quantos-p0-functional-inputs/v1',inputs,normative,checks,policy,inputDigest:digest(JSON.stringify({inputs,normative,checks,policy}))};
}
