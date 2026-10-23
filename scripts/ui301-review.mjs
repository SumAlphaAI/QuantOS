import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {hash,verifyInputs} from './g1-download-review.mjs';
import {webEnvironment} from './p0-functional-scope.mjs';
import {nodesFromPlans} from './provider-a1-receipts.mjs';
export const directory = 'docs/audit/evidence/ui301-local-20261023';
const read = p => readFileSync(p), json = p => JSON.parse(read(p)), git = (...args) => execFileSync('git',args,{encoding:'utf8',maxBuffer:64e6});
export const focusedTests = ['apps/terminal/tests/ui301.test.ts','apps/terminal/tests/strategy-recovery.test.ts'];
const c = (id,command,exit = 0) => ({id,command,exit});
export const checks = [
 c('development',['node','scripts/development-execution.mjs','--development','FE:UI-301']),
 c('unit',['pnpm','exec','vitest','run',...focusedTests,'--reporter=json','--outputFile={attempt}/unit.json']),
 c('rust-conflict',['cargo','test','--locked','--offline','-p','bff-gateway','--lib','strategy::tests::concurrent_edit_is_unique_and_returns_current_diff','--','--nocapture']),
 c('rust-idempotency',['cargo','test','--locked','--offline','-p','bff-gateway','--lib','strategy::tests::lost_save_response_replays_original_and_changed_intent_conflicts','--','--nocapture']),
 c('reference-build',['cargo','build','--locked','--offline','-p','bff-gateway','--bin','bff-gateway']),
 c('types',['pnpm','--filter','@sumalpha/terminal','typecheck']),
 c('lint',['pnpm','exec','eslint','apps/terminal/src/strategy/policy.ts','apps/terminal/src/strategy/runtime.ts','apps/terminal/app/strategies','apps/terminal/tests/ui301.test.ts','scripts/ui301-review.mjs','scripts/ui301-review.test.mjs','scripts/terminal-static-routes.mjs','scripts/terminal-static-routes.test.mjs','playwright.config.ts','playwright.ui301.config.ts','tests/e2e/ui301.spec.ts','tests/e2e/fixtures/ui301-reference.ts']),
 c('routes-gate',['node','--test','scripts/ui301-review.test.mjs','scripts/terminal-static-routes.test.mjs','scripts/serve-static.test.mjs']),
 c('terminal-build',['pnpm','--filter','@sumalpha/terminal','build']),
 c('browser',['pnpm','exec','playwright','test','--config=playwright.ui301.config.ts','--project=chromium','--workers=1','--retries=0','--reporter=list,json','--output={attempt}/browser']),
 c('plans',['node','scripts/check-development-plans.mjs']),
 c('integration-refusal',['node','scripts/development-execution.mjs','--integration','FE:UI-301'],1),
 c('next-development',['node','scripts/development-execution.mjs','--development','FE:UI-P06']),
];
export function boundary(sourceCommit) {return {schema:'quantos-ui301-local-function/v1',nodeId:'FE:UI-301',sourceCommit,engineeringGate:'PASS_UI301_CURRENT_FUNCTION',confirmation:'PENDING',stageGate:'NOT_ASSESSED',formalAccepted:false,runtimeAdmission:'DENIED',integrationAcceptance:'NOT_RUN_FULL_ACCEPTANCE',releaseAcceptance:'NOT_RUN',identity:'EXPLICIT_REFERENCE_COOKIE_BRIDGE',cors:'LOOPBACK_PROXY_SUBSTITUTION',browserCreateStrategy:'UNAVAILABLE_IN_C05',realIdpMfa:'NOT_RUN',realCookieCors:'NOT_RUN',targetDatabaseStorage:'NOT_RUN',productionHostingRewrite:'NOT_RUN',manualScreenReader:'NOT_RUN',nativeZoom200:'NOT_RUN',firefox:'NOT_RUN',webkit:'NOT_RUN',remoteCI:'NOT_RUN',performanceAndSoak:'NOT_RUN',recursiveDependencyRevalidation:false,productionCredentialsUsed:false,pushed:false,deployed:false,nextTask:'FE:UI-P06'};}
export function validateBoundary(r) {assert.match(r.sourceCommit,/^[a-f0-9]{40}$/);for (const [key,value] of Object.entries(boundary(r.sourceCommit))) assert.deepEqual(r[key],value,key);}
export function inputs() {
 const paths = git('ls-files','-z','--','AGENTS.md','apps/terminal/','packages/','crates/','services/bff-gateway/','.cargo/','Cargo.toml','Cargo.lock','rust-toolchain.toml','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.base.json','eslint.config.mjs','env/','scripts/ui301-review.mjs','scripts/ui301-review.test.mjs','scripts/terminal-static-routes.mjs','scripts/terminal-static-routes.test.mjs','scripts/serve-static.mjs','scripts/serve-static.test.mjs','scripts/development-execution.mjs','scripts/development-testing-policy.json','scripts/check-development-plans.mjs','scripts/provider-a1-receipts.mjs','scripts/g1-download-review.mjs','scripts/p0-functional-scope.mjs','scripts/pinned-pnpm.mjs','scripts/pre03-build-receipt.mjs','scripts/check-client-secrets.mjs','playwright.config.ts','playwright.ui301.config.ts','tests/e2e/ui301.spec.ts','tests/e2e/fixtures/ui301-reference.ts','docs/operations/ui301-strategy-drafts.md').split('\0').filter(Boolean);
 return paths.sort().map(path => ({path,sha256:hash(read(path))}));
}
export function validateExecutions(rows,attempt) {assert.equal(rows.length,checks.length);for (const [i,row] of rows.entries()) {const expected = checks[i];assert.equal(row.id,expected.id);assert.deepEqual(row.command,expected.command.map(s => s.replaceAll('{attempt}',attempt)));assert.equal(row.expectedExitCode,expected.exit);assert.equal(row.exitCode,expected.exit);assert.equal(row.signal,null);assert.equal(row.errorCode,null);assert.equal(hash(read(row.log)),row.logSha256);}}
export function validateBrowser(report) {assert.equal(report.errors.length,0);assert.deepEqual({expected:report.stats.expected,unexpected:report.stats.unexpected,skipped:report.stats.skipped,flaky:report.stats.flaky},{expected:6,unexpected:0,skipped:0,flaky:0});const specs = s => [...(s.specs ?? []),...(s.suites ?? []).flatMap(specs)], rows = report.suites.flatMap(specs).flatMap(s => s.tests);assert.equal(rows.length,6);for (const row of rows) {assert.equal(row.projectName,'chromium');assert.equal(row.results.length,1);assert.equal(row.results[0].status,'passed');}}
const files = path => readdirSync(path,{withFileTypes:true}).flatMap(e => e.isDirectory() ? files(path+'/'+e.name) : [path+'/'+e.name]);
export function verify(r) {
 validateBoundary(r);assert(r.attempt.startsWith(directory+'/attempt-') && !r.attempt.includes('..'));assert.deepEqual(inputs(),r.inputs);verifyInputs(r.sourceCommit,r.inputs);validateExecutions(r.executions,r.attempt);
 assert.deepEqual(r.artifacts.map(f => f.path).sort(),files(r.attempt).sort());for (const f of r.artifacts) {assert(f.path.startsWith(r.attempt+'/') && !f.path.includes('..'));assert.equal(hash(read(f.path)),f.sha256);}
 const unit = json(r.attempt+'/unit.json');assert.equal(unit.success,true);assert.equal(unit.numTotalTests,38);assert.equal(unit.numPassedTests,38);assert.equal(unit.numPendingTests,0);
 for (const id of ['rust-conflict','rust-idempotency']) assert.match(read(r.attempt+'/'+id+'.log').toString(),/test result: ok\. 1 passed; 0 failed;/);
 validateBrowser(json(r.attempt+'/browser/report.json'));const binary = json(r.attempt+'/binary.json');assert.equal(binary.sourceCommit,r.sourceCommit);
 const probes = r.artifacts.filter(f => f.path.endsWith('/ui301.json'));assert.equal(probes.length,6);for (const f of probes) {const p = json(f.path);assert.equal(p.status,'passed');assert.equal(p.sourceCommit,r.sourceCommit);assert.equal('sha256:'+p.binarySha256,binary.sha256);assert.equal(p.identity,r.identity);assert.equal(p.cors,r.cors);assert.equal(p.businessWrites,'LOCAL_REFERENCE_C05_DRAFT_ONLY');assert(p.rows.every(row => row.method === 'GET' || row.method === 'PUT' && /^\/v1\/strategies\/[^/]+\/draft$/.test(row.path)));}
 const axes = r.artifacts.filter(f => f.path.endsWith('/axe.json'));assert.equal(axes.length,1);const a = json(axes[0].path);assert.equal(a.scans.length,12);for (const scan of a.scans) assert.equal(scan.violations.length,0);assert.equal(a.manualScreenReader,'NOT_RUN');assert.equal(a.nativeZoom200,'NOT_RUN');
 assert.equal(json(r.attempt+'/terminal-build.json').buildId,'terminal-'+r.sourceCommit);
 const decision = json(r.attempt+'/integration-refusal.log');assert.equal(decision.allowed,false);assert.equal(decision.reason,'STAGE_NOT_READY');assert.equal(json(r.attempt+'/next-development.log').allowed,true);
 const node = nodesFromPlans().get('FE:UI-301');assert.equal(node.development_status,'IMPLEMENTED_PENDING_ACCEPTANCE');assert.deepEqual(node.stage_gate,{stage:'INTEGRATION',status:'NOT_ASSESSED',input_digest:null,evidence:[]});
 return {sourceCommit:r.sourceCommit,engineeringGate:r.engineeringGate,functionTests:38,rustTests:2,chromiumCases:6,axeScans:12,axeIncomplete:a.scans.reduce((n,s) => n+s.incomplete.length,0),stageGate:r.stageGate,confirmation:r.confirmation,formalAccepted:false,nextTask:r.nextTask};
}
export function run(attempt) {
 assert(attempt?.startsWith(directory+'/attempt-') && !attempt.includes('..'));assert(!existsSync(attempt));const sourceCommit = git('rev-parse','HEAD').trim(), sourceInputs = inputs();verifyInputs(sourceCommit,sourceInputs);mkdirSync(attempt,{recursive:true});writeFileSync(attempt+'/inputs.json',JSON.stringify({sourceCommit,inputs:sourceInputs},null,2)+'\n');
 const env = {...webEnvironment(),NEXT_PUBLIC_QUANTOS_ENV:'local-integrated',NEXT_PUBLIC_QUANTOS_MOCK_ENABLED:'false',NEXT_PUBLIC_QUANTOS_BFF_ORIGIN:'https://127.0.0.1:4010',NEXT_PUBLIC_QUANTOS_OIDC_ISSUER:'https://127.0.0.1:4010',GITHUB_SHA:sourceCommit,CI:'1',PLAYWRIGHT_JSON_OUTPUT_NAME:resolve(attempt,'browser/report.json')}, executions = [];
 for (const check of checks) {const command = check.command.map(s => s.replaceAll('{attempt}',attempt)),startedAt = new Date().toISOString(), result = spawnSync(command[0],command.slice(1),{env,encoding:'utf8',maxBuffer:64e6,timeout:180000}), log = attempt+'/'+check.id+'.log';writeFileSync(log,(result.stdout ?? '')+(result.stderr ?? ''));executions.push({id:check.id,command,expectedExitCode:check.exit,exitCode:result.status,signal:result.signal,errorCode:result.error?.code ?? null,startedAt,finishedAt:new Date().toISOString(),log,logSha256:hash(read(log))});writeFileSync(attempt+'/executions.json',JSON.stringify(executions,null,2)+'\n');console.log(check.id,result.status);assert.equal(result.status,check.exit,check.id);if (check.id === 'reference-build') writeFileSync(attempt+'/binary.json',JSON.stringify({sourceCommit,sha256:hash(read('target/debug/bff-gateway')),rebuilt:true})+'\n');if (check.id === 'terminal-build') writeFileSync(attempt+'/terminal-build.json',read('apps/terminal/out/pre03-build.json'));}
 const r = {...boundary(sourceCommit),attempt,inputs:sourceInputs,executions,artifacts:files(attempt).map(path => ({path,sha256:hash(read(path))}))};verify(r);writeFileSync(directory+'/receipt.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(verify(r)));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {try {if (process.argv[2] === '--verify') console.log(JSON.stringify(verify(json(directory+'/receipt.json'))));else if (process.argv[2] === '--run') run(process.argv[3]);else throw Error('Use --run <fresh attempt> or --verify');} catch (e) {console.error(e.stack);process.exitCode = 1;}}
