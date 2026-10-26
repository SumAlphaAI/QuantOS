// CORE:S04 current function and directly affected local composition. No stage promotion.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {webEnvironment} from './p0-functional-scope.mjs';
import {hash,verifyInputs} from './g1-download-review.mjs';
import {browserReport} from './core-r1-review.mjs';
import {validateChain,validateRegistration} from './g3-integration-01-review.mjs';
import {validateNetwork} from './ui303-review.mjs';
export const directory='docs/audit/evidence/core-s04-local-20261026';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p));
export const files=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(p+'/'+e.name):[p+'/'+e.name]).sort();
export const boundary=()=>({nodeId:'CORE:S04',engineeringGate:'PASS_OWNED_LOCAL_S04_STRATEGY_LIFECYCLE',developmentStatus:'COMPLETED',businessIntegration:'PARTIAL_WITH_EXPLICIT_PORT_SUBSTITUTIONS',stageGate:'NOT_ASSESSED',gate:'NOT_READY_GAPS_OPEN',g3Gate:'NOT_READY_GAPS_OPEN',formalAccepted:false,runtimeAdmission:'DENIED',research:'ACTUAL_R03_RD_AGENT_AND_STRATEGY_LAB_UDS',catalog:'OWNER_VERIFIED_FRESH_PROCESS_LOCAL_INSTALL',fixtureDiversity:'20_INDEPENDENT_JOURNEYS_ONE_OWNED_MOMENTUM_TEMPLATE',identity:'REFERENCE_COOKIE_BRIDGE',cors:'LOOPBACK_TLS_PROXY',approval:'INDEPENDENT_REFERENCE_ACTOR_MFA_CONTROL',targetSelection:'PAGE_LOCAL_PAPER_SHADOW_PREVIEW_NO_DEPLOYMENT',productionQueueAndIncrementalRegistration:'NOT_RUN',database:'NOT_RUN',persistentRecovery:'NOT_RUN',realIdpMfa:'NOT_RUN',fullBrowserAndManualAccessibility:'NOT_RUN',wholeWorkspace:'NOT_RUN',remoteCiAndRelease:'NOT_RUN',productionCredentialsUsed:false,externalPublished:false,pushed:false,nextTask:'CORE-GATE:S2'});
export function validateBoundary(value){assert.deepEqual(value,boundary());}
export const checks=[
 ['development',['node','scripts/development-execution.mjs','--development','CORE:S04']],
 ['bff-binary',['cargo','build','--locked','--offline','-p','bff-gateway','--bin','bff-gateway']],
 ['c05-c08',['cargo','test','--locked','--offline','-p','bff-gateway','--lib','strategy::tests::']],
 ['worker-handoff',['cargo','test','--locked','--offline','-p','bff-gateway','--lib','g3_research_tests::worker','--','--nocapture']],
 ['s04-tcp',['cargo','test','--locked','--offline','-p','quantos-strategy','--test','service_s04','--','--nocapture']],
 ['consumer',['pnpm','exec','vitest','run','apps/terminal/tests/ui301.test.ts','apps/terminal/tests/ui302.test.ts','apps/terminal/tests/ui303.test.ts','apps/terminal/tests/strategy-recovery.test.ts','apps/terminal/tests/strategy-provider-consumer.test.ts','apps/terminal/tests/ui-p06-presentation.test.ts','apps/terminal/tests/ui-p07-presentation.test.ts','apps/terminal/tests/fep3-closure.test.ts','apps/terminal/tests/ui504-provider-consumer.test.ts','apps/terminal/tests/s04-scenarios.test.ts','--reporter=verbose','--reporter=json','--outputFile={attempt}/consumer.json']],
 ['types',['pnpm','--filter','@sumalpha/terminal','typecheck']],
 ['lint',['pnpm','exec','eslint','apps/terminal/src/strategy/release-policy.ts','apps/terminal/app/releases/workspace.tsx','apps/terminal/tests/ui303.test.ts','apps/terminal/tests/ui504-provider-consumer.test.ts','tests/e2e/fixtures/frontend-g3-reference.ts','tests/e2e/s04-integration.spec.ts','playwright.s04.config.ts','playwright.config.ts','scripts/core-s04-review.mjs','scripts/core-s04-review.test.mjs']],
 ['gate-tests',['node','--test','scripts/core-s04-review.test.mjs','scripts/development-execution.test.mjs','scripts/terminal-static-routes.test.mjs']],
 ['host-build',['cargo','test','--locked','--offline','-p','bff-gateway','--lib','--no-run','--message-format=json']],
 ['terminal-build',['pnpm','--filter','@sumalpha/terminal','build']],
 ['s04-browser',['pnpm','exec','playwright','test','--config','playwright.s04.config.ts','--project','chromium','--output','{attempt}/s04-browser','--reporter=list,json']],
 ['browser-regression',['pnpm','exec','playwright','test','--config','playwright.frontend-g3.config.ts','--project','chromium','--grep-invert','G3 ','--output','{attempt}/browser-regression','--reporter=list,json']],
 ['plans',['node','scripts/check-development-plans.mjs']],
 ['integration-refusal',['node','scripts/development-execution.mjs','--integration','CORE:S04'],1],
 ['g3-refusal',['node','scripts/development-execution.mjs','--integration','FRONTEND-GATE:G3'],1],
 ['next-development',['node','scripts/development-execution.mjs','--development','CORE-GATE:S2']]
];
export function inputs(){return execFileSync('git',['ls-files','--','AGENTS.md','Cargo.toml','Cargo.lock','rust-toolchain.toml','apps/terminal','apps/website','packages','services/bff-gateway','crates','engines','scripts','bff','proto','docs/execution','docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md','docs/operations/core-s04-current-function.md','docs/operations/g3-integration-01.md','docs/operations/frontend-g3-integration.md','docs/audit/evidence/r04-preflight-20261012/attempt-02/signal-matrix.json','docs/audit/evidence/r04-preflight-20261012/attempt-02/proposal-matrix.json','docs/adr/20260814-pre03-runtime-stack.md','tests/e2e/s04-integration.spec.ts','tests/e2e/fixtures/frontend-g3-reference.ts','tests/e2e/fixtures/ui301-reference.ts','tests/e2e/fixtures/ui-p07-reference.ts','tests/e2e/frontend-g3.spec.ts','tests/e2e/ui301.spec.ts','tests/e2e/ui302.spec.ts','tests/e2e/ui303.spec.ts','tests/e2e/ui-p07.spec.ts','tests/e2e/ui-p07.spec.ts-snapshots','playwright*.config.ts','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','.nvmrc','tsconfig.base.json','eslint.config.mjs','env/local-mock.env.example'],{encoding:'utf8'}).trim().split('\n').sort().map(path=>({path,sha256:hash(read(path))}));}
export function validateInformationRequest(r){assert.equal(r.approvalState,'rejected');assert(r.approvalRef);const event=r.approvalTimeline.at(-1);assert.equal(event.action,'request_info');assert.equal(typeof event.reason,'string');assert(event.reason.length>0);assert(r.evidenceRefs.length>0);}
export function validateRecovery(r){assert.equal(r.calls.length,2);assert(r.calls.every(c=>c.status===202));assert.equal(r.calls[0].source,'REFERENCE_COMMITTED_RESPONSE_DROPPED');for(const key of ['keyHash','bodyHash','version']){assert(r.calls[0][key]);assert.equal(r.calls[0][key],r.calls[1][key]);}assert.equal(r.release.approvalState,'pending');assert.equal(r.release.approvalTimeline.filter(e=>e.action==='submitted').length,1);}
export function verify(r){
 validateBoundary(r.boundary);verifyInputs(r.sourceCommit,r.inputs);assert.deepEqual(inputs(),r.inputs);assert.equal(r.executions.length,checks.length);
 for(const[i,e]of r.executions.entries()){const[id,args,exit=0]=checks[i];assert.equal(e.id,id);assert.deepEqual(e.command,args.map(s=>s.replaceAll('{attempt}',r.attempt)));assert.equal(e.exitCode,exit,id);assert.equal(e.signal,null);assert.equal(e.errorCode,null);assert.equal(hash(read(e.log)),e.logSha256);assert(Date.parse(e.finishedAt)>=Date.parse(e.startedAt));}
 assert.deepEqual(r.artifacts.map(f=>f.path),files(r.attempt));for(const f of r.artifacts)assert.equal(hash(read(f.path)),f.sha256,f.path);
 browserReport(json(r.attempt+'/s04-browser.json'),26);browserReport(json(r.attempt+'/browser-regression.json'),20);
 const host=json(r.attempt+'/host.json'),binary=json(r.attempt+'/binary.json');assert.equal(host.sourceCommit,r.sourceCommit);assert.equal(binary.sourceCommit,r.sourceCommit);assert.equal(hash(read(host.executable)),host.sha256);assert.equal(hash(read(binary.executable)),binary.sha256);
 assert.equal(json(r.attempt+'/terminal-build.json').buildId,'terminal-'+r.sourceCommit);for(const f of r.exportedFiles)assert.equal(hash(read(f.path)),f.sha256,f.path);assert.deepEqual(r.exportedFiles.map(f=>f.path),files('apps/terminal/out'));
 const consumer=json(r.attempt+'/consumer.json');assert.equal(consumer.success,true);assert(consumer.numTotalTests>125);assert.equal(consumer.numPassedTests,consumer.numTotalTests);assert.equal(consumer.numPendingTests,0);assert.equal(consumer.numFailedTests,0);
 const rows=r.artifacts.filter(f=>f.path.endsWith('/g3-fixture.json')).map(f=>json(f.path));assert.equal(rows.length,20);assert.equal(new Set(rows.map(v=>v.index)).size,20);assert.equal(new Set(rows.map(v=>v.approved.releaseId)).size,20);
 for(const v of rows){assert.equal(v.sourceCommit,r.sourceCommit);assert.equal(v.approved.approvalState,'approved');assert.equal(v.approved.sourceDigest,r.sourceCommit);assert.equal(v.approved.imageDigest,host.sha256);assert.equal(v.approved.contentHash,v.release?.contentHash??v.pending.contentHash);assert.deepEqual(v.approved.evidenceRefs,v.draft.artifactRefs);}
 const chains=r.artifacts.filter(f=>f.path.endsWith('/r03-causal-chain.json')).map(f=>json(f.path));assert.equal(chains.length,20);for(const row of chains){validateRegistration(row.registration);validateChain(row.chain);}
 const networks=r.artifacts.filter(f=>f.path.endsWith('/ui301.json'));assert.equal(networks.length,46);for(const f of networks){const n=json(f.path);validateNetwork(n,r.sourceCommit,f.path.includes('/s04-browser/')?host.sha256:binary.sha256);assert(!n.rows.some(row=>/commands|deployment|orders/.test(row.path)));}
 const one=suffix=>{const found=r.artifacts.filter(f=>f.path.endsWith('/'+suffix));assert.equal(found.length,1);return json(found[0].path);};
 validateInformationRequest(one('s04-request-info.json'));validateRecovery(one('s04-submission-recovery.json'));assert.equal(one('g3-rejected.json').approvalState,'rejected');assert.equal(one('g3-expired.json').approvalState,'expired');const race=one('g3-concurrency.json');assert.equal(race.statuses.filter(s=>s===200).length,1);assert.equal(race.statuses.filter(s=>[403,409].includes(s)).length,19);
 let axeScans=0,incomplete=0;for(const f of r.artifacts.filter(f=>/axe\.json$/.test(f.path))){const a=json(f.path);for(const scan of a.scans??[a]){assert.equal(scan.violations.length,0);axeScans++;incomplete+=scan.incomplete.length;}}assert(axeScans>=7);
 assert.match(read(r.attempt+'/s04-tcp.log').toString(),/test result: ok\. 6 passed; 0 failed; 0 ignored/);assert.match(read(r.attempt+'/worker-handoff.log').toString(),/test result: ok\. 2 passed; 0 failed; 0 ignored/);
 for(const name of ['integration-refusal','g3-refusal'])assert.equal(json(r.attempt+'/'+name+'.log').reason,'STAGE_NOT_READY');assert.equal(json(r.attempt+'/next-development.log').allowed,true);
 return{sourceCommit:r.sourceCommit,...r.boundary,checks:checks.length,consumerCases:consumer.numTotalTests,chromiumCases:46,uiFixtureJourneys:20,axeScans,axeIncomplete:incomplete};
}
export function run(attempt){
 assert(new RegExp('^'+directory+'/attempt-[0-9]+$').test(attempt));assert(!existsSync(attempt),'never overwrite evidence');assert(!readdirSync('apps/terminal').some(p=>/^\.env(?:\.|$)/.test(p)&&!p.endsWith('.example')),'private app dotenv is outside this scope');
 const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceInputs=inputs();verifyInputs(sourceCommit,sourceInputs);mkdirSync(attempt,{recursive:true});writeFileSync(attempt+'/inputs.json',JSON.stringify({sourceCommit,inputs:sourceInputs},null,2)+'\n');
 const env={...webEnvironment(),NEXT_PUBLIC_QUANTOS_ENV:'local-integrated',NEXT_PUBLIC_QUANTOS_MOCK_ENABLED:'false',NEXT_PUBLIC_QUANTOS_BFF_ORIGIN:'https://127.0.0.1:4010',NEXT_PUBLIC_QUANTOS_OIDC_ISSUER:'https://127.0.0.1:4010',GITHUB_SHA:sourceCommit,CARGO_NET_OFFLINE:'true',CARGO_TERM_COLOR:'never',CI:'1',QUANTOS_SKIP_ENV:'1',QUANTOS_G3_HOST_RECEIPT:resolve(attempt+'/host.json')},executions=[];
 for(const[id,args,exit=0]of checks){const command=args.map(s=>s.replaceAll('{attempt}',attempt)),startedAt=new Date().toISOString(),r=spawnSync(command[0],command.slice(1),{env:{...env,QUANTOS_G3_R03:id==='s04-browser'?'1':'0',PLAYWRIGHT_JSON_OUTPUT_NAME:resolve(attempt+'/'+id+'.json')},encoding:'utf8',maxBuffer:96e6,timeout:600000}),log=attempt+'/'+id+'.log';writeFileSync(log,(r.stdout??'')+(r.stderr??''));executions.push({id,command,exitCode:r.status,signal:r.signal,errorCode:r.error?.code??null,startedAt,finishedAt:new Date().toISOString(),log,logSha256:hash(read(log))});writeFileSync(attempt+'/executions.json',JSON.stringify(executions,null,2)+'\n');console.log(id,r.status);
 if(r.status!==exit){writeFileSync(attempt+'/failure.json',JSON.stringify({failed:executions.at(-1),notRun:checks.slice(executions.length).map(c=>c[0])},null,2)+'\n');throw Error('see '+log);}
 if(id==='bff-binary'){const executable=resolve('target/debug/bff-gateway');writeFileSync(attempt+'/binary.json',JSON.stringify({sourceCommit,executable,sha256:hash(read(executable))})+'\n');}
 if(id==='host-build'){const a=r.stdout.trim().split('\n').map(s=>JSON.parse(s)).find(a=>a.executable&&a.target.name==='bff_gateway');assert(a);writeFileSync(attempt+'/host.json',JSON.stringify({sourceCommit,executable:a.executable,sha256:hash(read(a.executable))})+'\n');}
 if(id==='terminal-build')writeFileSync(attempt+'/terminal-build.json',read('apps/terminal/out/pre03-build.json'));}
 const receipt={schema:'quantos-core-s04-current/v1',sourceCommit,boundary:boundary(),inputs:sourceInputs,attempt,executions,exportedFiles:files('apps/terminal/out').map(path=>({path,sha256:hash(read(path))})),artifacts:files(attempt).map(path=>({path,sha256:hash(read(path))}))};const result=verify(receipt);writeFileSync(directory+'/receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(result));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{if(process.argv[2]==='--run')run(process.argv[3]);else{assert.equal(process.argv[2],'--verify');console.log(JSON.stringify(verify(json(directory+'/receipt.json'))));}}catch(e){console.error(e.stack);process.exitCode=1;}}
