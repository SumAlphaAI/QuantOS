// Manual U01 checks with an explicit, credential-free local composition boundary.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {webEnvironment} from './p0-functional-scope.mjs';
import {hash,verifyInputs} from './g1-download-review.mjs';
export const directory='docs/audit/evidence/u01-local-20261026';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p));
export const boundary=()=>({nodeId:'CORE:U01',engineeringGate:'PASS_OWNED_LOCAL_U01_COMPOSITION',developmentStatus:'COMPLETED',integration:'PARTIAL_WITH_EXPLICIT_PORT_SUBSTITUTIONS',stageGate:'NOT_ASSESSED',gate:'NOT_READY_GAPS_OPEN',formalAccepted:false,runtimeAdmission:'DENIED',identity:'EXPLICIT_REFERENCE_COOKIE_BRIDGE',cors:'LOOPBACK_TLS_CORS_SUBSTITUTION',storage:'OWNED_IN_MEMORY_NOT_PERSISTENT_C03_C04',worker:'ACTUAL_R03_RD_AGENT_UDS',bffWorkerRunIdentity:'EXPLICIT_TEST_HOST_MAPPING',runningCancel:'NOT_RUN_COMBINED',deadlineAndRestartRecovery:'NOT_RUN_COMBINED',realOidc:'NOT_RUN',supabase:'NOT_RUN',fullBrowserMatrix:'NOT_RUN',performanceAndSoak:'NOT_RUN',remoteSameShaCi:'NOT_RUN',release:'NOT_RUN',productionCredentialsUsed:false,pushed:false,deployed:false});
export function validateBoundary(value){assert.deepEqual(value,boundary());}
const checks=[
 ['host-build',['cargo','test','--locked','--offline','-p','bff-gateway','--lib','--no-run','--message-format=json']],
 ['research-backend',['cargo','test','--locked','--offline','-p','bff-gateway','--lib','research::tests::']],
 ['auth-backend',['cargo','test','--locked','--offline','-p','bff-gateway','--test','auth_settings_provider']],
 ['research-runtime',['cargo','test','--locked','--offline','-p','quantos-runtime','--lib','research::']],
 ['frontend',['pnpm','exec','vitest','run','apps/terminal/tests/ui201.test.ts','apps/terminal/tests/ui202.test.ts','apps/terminal/tests/research-gateway.test.ts','apps/terminal/tests/auth-bff.test.ts','apps/terminal/tests/auth-poc.test.ts','apps/terminal/tests/ui203.test.ts']],
 ['gate-tests',['node','--test','scripts/u01-review.test.mjs','scripts/development-execution.test.mjs']],
 ['plans',['node','scripts/check-development-plans.mjs']],
 ['lint',['pnpm','exec','eslint','apps/terminal/app/research/workspace.tsx','apps/terminal/app/research/detail.tsx','apps/terminal/src/research/runtime.ts','apps/terminal/src/research/detail-runtime.ts','apps/terminal/tests/ui201.test.ts','apps/terminal/tests/ui202.test.ts','tests/e2e/fixtures/u01-reference.ts','tests/e2e/u01-integration.spec.ts','playwright.u01.config.ts','scripts/u01-review.mjs','scripts/u01-review.test.mjs']],
 ['terminal-build',['pnpm','--filter','@sumalpha/terminal','build']],
 ['terminal-types',['pnpm','--filter','@sumalpha/terminal','typecheck']],
 ['browser',['pnpm','exec','playwright','test','--config','playwright.u01.config.ts','--project','chromium','--output','{attempt}/browser','--reporter=list,json']],
 ['integration-refusal',['node','scripts/development-execution.mjs','--integration','CORE:U01'],1]
];
export function inputs(){const paths=execFileSync('git',['ls-files','--','AGENTS.md','scripts','docs/execution','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md','tsconfig.base.json','pnpm-workspace.yaml','eslint.config.mjs','vitest.config.ts','env/local-mock.env.example','Cargo.toml','Cargo.lock','rust-toolchain.toml','apps/terminal','packages','services/bff-gateway','crates','engines','bff','scripts/u01-review.mjs','scripts/u01-review.test.mjs','scripts/p0-functional-scope.mjs','scripts/pinned-pnpm.mjs','scripts/g1-download-review.mjs','scripts/development-execution.mjs','scripts/development-testing-policy.json','scripts/serve-static.mjs','scripts/pre03-build-receipt.mjs','scripts/check-client-secrets.mjs','tests/e2e/fixtures/u01-reference.ts','tests/e2e/u01-integration.spec.ts','playwright.u01.config.ts','playwright.config.ts','package.json','pnpm-lock.yaml','docs/SumAlpha-QuantOS-Development-Plan.md','docs/operations/u01-integration.md'],{encoding:'utf8'}).trim().split('\n');return [...new Set(paths)].sort().map(path=>({path,sha256:hash(read(path))}));}
const files=path=>readdirSync(path,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path+'/'+e.name):[path+'/'+e.name]).sort();
export function validateReport(r){assert.equal(r.errors.length,0);assert.deepEqual({expected:r.stats.expected,unexpected:r.stats.unexpected,skipped:r.stats.skipped,flaky:r.stats.flaky},{expected:5,unexpected:0,skipped:0,flaky:0});}
export function verify(receipt){
 validateBoundary(receipt.boundary);verifyInputs(receipt.sourceCommit,receipt.inputs);assert.deepEqual(inputs(),receipt.inputs);
 assert.equal(receipt.executions.length,checks.length);
 for(const [i,e]of receipt.executions.entries()){const [id,args,exit=0]=checks[i];assert.equal(e.id,id);assert.deepEqual(e.command,args.map(s=>s.replaceAll('{attempt}',receipt.attempt)));assert.equal(e.exitCode,exit,id);assert.equal(e.signal,null);assert.equal(hash(read(e.log)),e.logSha256);}
 assert.deepEqual(receipt.artifacts.map(f=>f.path).sort(),files(receipt.attempt));
 for(const f of receipt.artifacts)assert.equal(hash(read(f.path)),f.sha256,f.path);
 validateReport(json(receipt.attempt+'/report.json'));
 const worker=receipt.artifacts.filter(f=>f.path.endsWith('/worker-result.json'));assert.equal(worker.length,1);const result=json(worker[0].path).results[0];assert.equal(result.record.output.artifact_type,'ResearchArtifact');assert(result.record.stream_events.at(-1).done);assert(result.record.evidence_refs.length>0);
 const cancel=receipt.artifacts.filter(f=>f.path.endsWith('/worker-cancel.json'));assert.equal(cancel.length,1);assert.equal(json(cancel[0].path).results[0].artifactPublished,false);
 const networks=receipt.artifacts.filter(f=>f.path.endsWith('/u01-network.json'));assert.equal(networks.length,5);for(const f of networks){const n=json(f.path);assert.equal(n.status,'passed');assert.equal(n.sourceCommit,receipt.sourceCommit);assert.equal(n.binarySha256,json(receipt.attempt+'/host.json').sha256);assert(n.rows.every(r=>r.source==='REFERENCE_BYTES'));assert(!n.rows.some(r=>/commands|deployment|orders/.test(r.path)));}
 assert.equal(json(receipt.attempt+'/integration-refusal.log').allowed,false);
 return {sourceCommit:receipt.sourceCommit,...receipt.boundary,chromiumCases:5};
}
export function run(attempt){
 assert(new RegExp('^'+directory+'/attempt-[0-9]+$').test(attempt));assert(!existsSync(attempt),'preserve prior attempts');
 const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceInputs=inputs();verifyInputs(sourceCommit,sourceInputs);
 mkdirSync(attempt,{recursive:true});writeFileSync(attempt+'/inputs.json',JSON.stringify({sourceCommit,inputs:sourceInputs},null,2)+'\n');
 const env={...webEnvironment(),NEXT_PUBLIC_QUANTOS_ENV:'local-integrated',NEXT_PUBLIC_QUANTOS_MOCK_ENABLED:'false',NEXT_PUBLIC_QUANTOS_BFF_ORIGIN:'https://127.0.0.1:4010',NEXT_PUBLIC_QUANTOS_OIDC_ISSUER:'https://127.0.0.1:4010',GITHUB_SHA:sourceCommit,CARGO_NET_OFFLINE:'true',CARGO_TERM_COLOR:'never',QUANTOS_U01_HOST_RECEIPT:resolve(attempt+'/host.json'),PLAYWRIGHT_JSON_OUTPUT_NAME:resolve(attempt+'/report.json')};
 const executions=[];
 for(const [id,args,exit=0]of checks){const command=args.map(s=>s.replaceAll('{attempt}',attempt)),startedAt=new Date().toISOString(),r=spawnSync(command[0],command.slice(1),{env,encoding:'utf8',maxBuffer:64e6,timeout:600000}),log=attempt+'/'+id+'.log';writeFileSync(log,(r.stdout??'')+(r.stderr??''));executions.push({id,command,exitCode:r.status,signal:r.signal,startedAt,finishedAt:new Date().toISOString(),log,logSha256:hash(read(log))});writeFileSync(attempt+'/executions.json',JSON.stringify(executions,null,2)+'\n');console.log(id,r.status);assert.equal(r.status,exit,'see '+log);
 if(id==='host-build'){const a=r.stdout.trim().split('\n').map(s=>JSON.parse(s)).find(a=>a.executable&&a.target.name==='bff_gateway');assert(a);writeFileSync(attempt+'/host.json',JSON.stringify({sourceCommit,executable:a.executable,sha256:hash(read(a.executable))},null,2)+'\n');}
 }
 const receipt={schema:'quantos-u01-local-review/v1',sourceCommit,boundary:boundary(),inputs:sourceInputs,attempt,executions,artifacts:files(attempt).map(path=>({path,sha256:hash(read(path))}))};
 console.log(JSON.stringify(verify(receipt)));writeFileSync(directory+'/receipt.json',JSON.stringify(receipt,null,2)+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{if(process.argv[2]==='--run')run(process.argv[3]);else{assert.equal(process.argv[2],'--verify');console.log(JSON.stringify(verify(json(directory+'/receipt.json'))));}}catch(e){console.error(e.stack);process.exitCode=1;}}
