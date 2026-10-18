// Current identity/settings function only; direct prerequisite references never grant upstream admission.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {relative,dirname} from 'node:path';
import {root,inventory,digest,nodesFromPlans,planInput} from './provider-a1-receipts.mjs';
export {environment} from './a1-functional-scope.mjs';
export const nodeId='FE:BFF-FE-001',profile='A2_IDENTITY_LOCAL';
export const prerequisites=['FE:BFF-FE-000','CORE:F06','PROVIDER:A1'];
const c=(id,command,reason)=>({id,command,reason,timeoutMs:id==='mutations'?1800000:600000});
export const checks=[
 c('semantics',['node','scripts/check-bff-fe-001.mjs'],'Current twenty C01/C17 operations, filtered live policy and reference provider/consumer regressions; target database separate'),
 c('contract-negative',['node','--test','scripts/bff-fe-001-gate-negative.mjs','scripts/bff-fe-001-development.test.mjs'],'Current schema/CSRF/version/recent-auth/SSE/audit contract and historical strict receipt refusal, without recursive execution'),
 c('generated',['node','scripts/check-bff-generated.mjs'],'A1 direct boundary: compare all six generated client/schema/MSW/input policy files against current pinned OpenAPI'),
 c('f06',['cargo','test','--locked','--offline','-p','quantos-auth','--lib'],'Direct F06 trust projection: verified subject/role/MFA/expiry and TLS URL policy; actual Supabase or IdP not executed'),
 c('session',['cargo','test','--locked','--offline','-p','bff-gateway','--lib','live::tests'],'Direct F06 cookie/context/origin and account-neutral errors, no upstream gate or target login'),
 c('cors',['cargo','test','--locked','--offline','-p','bff-gateway','--lib','live::cors_tests'],'Current credentialed recent-auth contract headers and untrusted-origin refusal at the F06 boundary'),
 c('http',['node','scripts/test-bff-provider-contract.mjs','{attempt}/reference-http.json','--identity-only'],'Actual Rust loopback HTTP validates all twenty C01/C17 successful response schemas and forged actor refusal; excludes audit/export task'),
 c('consumers',['pnpm','exec','vitest','run','apps/terminal/tests/auth-bff.test.ts','apps/terminal/tests/ui104-settings.test.ts','apps/terminal/tests/a2-provider-consumer.test.ts','packages/api-client/tests','tests/contract'],'Real Rust HTTP through auth/settings generated consumers plus shared SSE gap/replay/401/403 terminal recovery and transport/schema tests'),
 c('mutations',['node','scripts/test-bff-fe-001-mutations.mjs','{attempt}/mutations'],'Nine actual isolated source mutations must fail business assertions for CSRF/MFA/expiry/revocation, including queued unauthorized SSE replay'),
 c('types',['pnpm','--filter','@sumalpha/api-client','--filter','@sumalpha/terminal','typecheck'],'Changed shared SSE and settings consumer tests compile with generated request/response types and pinned lock'),
 c('lint',['pnpm','--filter','@sumalpha/api-client','--filter','@sumalpha/terminal','lint'],'Static validation of changed client/reducer, settings/auth consumers and provider-consumer integration test'),
 c('gate-tests',['node','--test','scripts/bff-fe-001-functional-gate.test.mjs'],'Current source/log/artifact/command binding, no historical READY, fail-closed target boundaries and atomic publication rollback'),
 c('plan-policy',['node','--test','scripts/development-plan-order-negative.mjs','scripts/ci-stage-disposition.test.mjs'],'New consumer-only local profile and activated CI dispatch retain scheduling and strict admission refusal'),
 c('plans',['node','scripts/check-development-plans.mjs'],'Both development plans and stage policy agree on bounded A2 identity admission and separate release obligations')
];
export const commands=attempt=>checks.map(c=>({...c,command:c.command.map(s=>s.replace('{attempt}',attempt))}));
export function snapshot(){
 const policy=JSON.parse(readFileSync(root+'/scripts/development-testing-policy.json'));assert.equal(policy.development.recursiveDependencyRevalidation,false);assert.equal(policy.development.defaultScope,'FUNCTION_AND_IMPACT');
 const meta=JSON.parse(execFileSync('cargo',['metadata','--locked','--offline','--no-deps','--format-version','1'],{encoding:'utf8',maxBuffer:8*1024*1024})),packages=new Map(meta.packages.map(p=>[p.name,p])),seen=new Set();
 function visit(n){const p=packages.get(n);if(!p||seen.has(n))return;seen.add(n);for(const d of p.dependencies)if(d.kind!=='dev'||n==='bff-gateway')visit(d.name);}visit('bff-gateway');
 const rust=[...seen].flatMap(n=>{const p=relative(root,dirname(packages.get(n).manifest_path));return [p+'/Cargo.toml',p+'/src/'];});
 const inputs=inventory([...rust,'services/bff-gateway/tests/auth_settings_provider.rs','AGENTS.md','Cargo.toml','Cargo.lock','rust-toolchain.toml','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','patches/','.nvmrc','tsconfig.base.json','eslint.config.mjs','bff/','packages/api-client/','packages/config/','apps/terminal/src/auth/','apps/terminal/src/settings/','apps/terminal/tests/auth-bff.test.ts','apps/terminal/tests/ui104-settings.test.ts','apps/terminal/tests/a2-provider-consumer.test.ts','apps/terminal/package.json','apps/terminal/tsconfig.json','tests/contract/','scripts/','env/local-mock.env.example','Makefile','.github/workflows/frontend-baseline.yml','supabase/migrations/20261003090000_bff_a2_identity_settings.sql','supabase/migrations/20261006*bff*.sql','docs/execution/BFF-FE-001-summary.md','docs/execution/BFF-FE-001-current-inventory.json','.github/workflows/ci.yml','docs/audit/evidence/bff-fe-001-local-20261018/preflight/a1-before-change.json','docs/audit/evidence/bff-fe-001-local-20261018/preflight/provider-a1-before-change.json','docs/audit/evidence/bff-fe-001-local-20261018/preflight/baseline.json','docs/operations/phased-testing.md','docs/operations/bff-fe-001-functional-admission.md']);
 assert(!inputs.some(i=>/(?:^|\/)\.env(?!\.example$)/.test(i.path)));
 const nodes=nodesFromPlans(),normative=[nodeId,...prerequisites].map(id=>({nodeId:id,planInput:planInput(nodes.get(id))}));
 return {schema:'quantos-a2-identity-functional-inputs/v1',inputs,normative,checks,policy,inputDigest:digest(JSON.stringify({inputs,normative,checks,policy}))};
}
