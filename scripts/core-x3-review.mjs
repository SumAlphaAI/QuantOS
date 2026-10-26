// CORE-GATE:X3 current-loop assessment. No recursive admission or target actions.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {inputs as x06Inputs} from './core-x06-review.mjs';
import {files} from './core-s04-review.mjs';
import {webEnvironment} from './p0-functional-scope.mjs';
import {hash,verifyInputs} from './g1-download-review.mjs';
import {browserReport} from './core-r1-review.mjs';
export const directory='docs/audit/evidence/core-x3-local-20261026';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p));
export const boundary=()=>({nodeId:'CORE-GATE:X3',engineeringGate:'PASS_OWNED_LOCAL_X3_EXECUTION_GOVERNANCE_LOOP',developmentAssessment:'COMPLETED_CURRENT_SCOPE',businessIntegration:'PARTIAL_WITH_EXPLICIT_PORT_SUBSTITUTIONS',gate:'NOT_READY_GAPS_OPEN',stageGate:'NOT_ASSESSED',formalAccepted:false,runtimeAdmission:'DENIED',nativePaperShadow:'ACTUAL_X03_OPERATIONS_X04_X01_INDEPENDENT_SHADOW',nativeC15:'ACTUAL_NATIVE_BOOK_TRUSTED_CONSTRUCTOR_HANDLER',nativeBookToBrowser:'NOT_JOINED',webPaper:'ACTUAL_REFERENCE_APPROVAL_COMMAND_CANCEL_AUDIT_EXPORT',webShadow:'ACTUAL_REFERENCE_C15_C14_REPORT_C10',identity:'REFERENCE_COOKIE_MFA_TLS_CORS_BRIDGE',commonPersistentLedger:'NOT_RUN',c15ToC16Positive:'NOT_RUN',fullP13P14:'GAPS_OPEN',tp12CurrentBoundary:'SEVEN_RULES_SIX_INTERFACES_EIGHT_DESIGN_THREATS_REFERENCE_ONLY',tp12PostFullTp07BusinessReview:'NOT_RUN',database:'NOT_RUN',crossProcessDurableRecovery:'NOT_RUN',realIdpMfa:'NOT_RUN',tenTradingDaysShadow:'NOT_RUN_RELEASE_TRANSFER',fullBrowserManualAccessibility:'NOT_RUN',wholeWorkspaceIntegration:'NOT_RUN',performanceSoakAndSameShaRemoteCi:'NOT_RUN',release:'NOT_RUN',productionCredentialsUsed:false,externalPublished:false,pushed:false,betaCandidate:'NOT_READY',nextTask:'FRONTEND-GATE:G7'});
export function validateBoundary(v){assert.deepEqual(v,boundary());}
export const checks=[
 ['development',['node','scripts/development-execution.mjs','--development','CORE-GATE:X3']],
 ['bff-binary',['cargo','build','--locked','--offline','-p','bff-gateway','--bin','bff-gateway']],
 ['native-build',['cargo','test','--locked','--offline','-p','bff-gateway','--lib','--no-run','--message-format=json']],
 ['native-c15',['cargo','test','--locked','--offline','-p','bff-gateway','--lib','x3_current_tests::','--','--nocapture']],
 ['paper-process',['cargo','test','--locked','--offline','-p','execution-gateway','--test','service_x06_process','--','--nocapture']],
 ['reconcile-flow',['cargo','test','--locked','--offline','-p','quantos-reconcile','--test','x05_flow']],
 ['reconcile-sources',['cargo','test','--locked','--offline','-p','quantos-reconcile','--test','x05_sources']],
 ['reconcile-worker',['cargo','test','--locked','--offline','-p','quantos-reconcile','--test','x05_process']],
 ['c15-bff',['cargo','test','--locked','--offline','-p','bff-gateway','--lib','reconciliation::tests::']],
 ['c14-bff',['cargo','test','--locked','--offline','-p','bff-gateway','--lib','performance::tests::']],
 ['tp12-dispatch',['cargo','test','--locked','--offline','-p','quantos-execution','--test','tp12_boundary']],
 ['tp07-dispatch',['cargo','test','--locked','--offline','-p','quantos-execution','--test','tp07_dispatch']],
 ['tp12-boundary',['engines/.venv/bin/python','scripts/tp12-boundary-review.py']],
 ['no-submit',['engines/.venv/bin/python','scripts/check-x05-no-submit.py']],
 ['tp12-python',['engines/.venv/bin/python','-m','pytest','engines/tests/test_tp12_x3_boundary.py','engines/tests/test_tp12_nautilus_agents_rules.py','scripts/tests/test_tp12_evaluation.py','-v','--junitxml={attempt}/tp12-python.xml']],
 ['consumer',['pnpm','exec','vitest','run','apps/terminal/tests/x3-provider-consumer.test.ts','apps/terminal/tests/ui506.test.ts','apps/terminal/tests/ui506-provider-consumer.test.ts','apps/terminal/tests/ui-p22.test.ts','apps/terminal/tests/ui403.test.ts','apps/terminal/tests/ui403-provider-consumer.test.ts','apps/terminal/tests/fep7-hardening.test.ts','apps/terminal/tests/fep5-closure.test.ts','--reporter=verbose','--reporter=json','--outputFile={attempt}/consumer.json']],
 ['types',['pnpm','--filter','@sumalpha/terminal','typecheck']],
 ['lint',['pnpm','exec','eslint','apps/terminal/src/reconciliation/runtime.ts','apps/terminal/tests/x3-provider-consumer.test.ts','tests/e2e/x3-integration.spec.ts','tests/e2e/ui506.spec.ts','tests/e2e/fixtures/x3-reference.ts','playwright.config.ts','playwright.x3.config.ts','scripts/core-x3-review.mjs','scripts/core-x3-review.test.mjs']],
 ['rust-lint',['cargo','clippy','--locked','--offline','-p','bff-gateway','--tests','--no-deps','--','-D','warnings']],
 ['rust-format',['cargo','fmt','--check','-p','bff-gateway','-p','execution-gateway']],
 ['gate-tests',['node','--test','scripts/core-x3-review.test.mjs','scripts/development-execution.test.mjs','scripts/terminal-static-routes.test.mjs']],
 ['terminal-build',['pnpm','--filter','@sumalpha/terminal','build']],
 ['x3-browser',['pnpm','exec','playwright','test','--config','playwright.x3.config.ts','--project','chromium','--output','{attempt}/x3-browser','--reporter=list,json']],
 ['reconciliation-browser',['pnpm','exec','playwright','test','--config','playwright.ui506.config.ts','--project','chromium','--output','{attempt}/reconciliation-browser','--reporter=list,json']],
 ['paper-browser',['pnpm','exec','playwright','test','--config','playwright.x06.config.ts','--project','chromium','--grep','X06 actual Paper','--output','{attempt}/paper-browser','--reporter=list,json']],
 ['plans',['node','scripts/check-development-plans.mjs']],
 ['integration-refusal',['node','scripts/development-execution.mjs','--integration','CORE-GATE:X3'],1],
 ['next-development',['node','scripts/development-execution.mjs','--development','FRONTEND-GATE:G7']]
];
export function inputs(){
 const runtime=JSON.parse(execFileSync('engines/.venv/bin/python',['scripts/tp12-boundary-review.py','--inputs'],{encoding:'utf8',maxBuffer:8e6}));
 const extra=execFileSync('git',['ls-files','--','docs/operations/core-x3-current-assessment.md','docs/operations/x3-service-local-admission.md','docs/execution/core-x3-current-assessment.json','docs/adr/*tp07*','docs/adr/*tp12*','third_party/nautilus-agents','third_party/nautilus-trader/baseline.lock.json','services/execution-gateway/tests/x3_service.rs','services/execution-gateway/tests/service_x06_process.rs','services/execution-gateway/tests/fixtures/x3-service-golden.json','tests/e2e/x3-integration.spec.ts','tests/e2e/fixtures/x3-reference.ts','tests/e2e/ui506.spec.ts','tests/e2e/fixtures/ui506-reference.ts'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
 return [...new Set([...x06Inputs().map(f=>f.path),...extra,...runtime])].sort().map(path=>({path,sha256:hash(read(path))}));
}
export function validateNative(v){assert.equal(v.scope,'TRUSTED_CONSTRUCTOR_HANDLER_NOT_HTTP_OR_COMMON_PERSISTENT_LEDGER');assert.equal(v.paperCash,'999000');assert.notEqual(v.expectedSource,v.actualSource);assert.equal(v.actualBookHash,v.c15SourceHash);assert.match(v.actualBookHash,/^sha256:[a-f0-9]{64}$/);assert.equal(v.newSubmits,0);assert.equal(v.replays,32);assert.equal(v.provisional,true);assert.equal(v.httpIdentity,'NOT_RUN');assert.equal(v.productionCredentialsUsed,false);assert(v.command&&v.order&&v.fill&&v.nativeAuditHead);}
export function validateShadow(v){assert.equal(v.mode,'shadow');assert.equal(v.scope,'ACTUAL_REFERENCE_C15_C14_C10_C11_SEGMENTS');assert.equal(v.provisional,true);assert.equal(v.paperOrderToShadowLedger,'NOT_JOINED');assert.equal(v.nativeBookToBrowser,'NOT_JOINED');assert.equal(v.c15ToC16Positive,'NOT_RUN');assert.deepEqual(v.externalRequests,[]);assert.equal(v.productionCredentialsUsed,false);assert.equal(v.externalPublished,false);assert(v.entries.some(e=>e.side==='actual'&&e.sourceHash===v.point.ledgerVersion));assert.match(v.reportSha256,/^[a-f0-9]{64}$/);assert(v.reportBytes>0);assert.equal(v.pairs.length,2);assert.equal(v.pairs[0].source,'REFERENCE_COMMITTED_RESPONSE_DROPPED');for(const k of ['bodyHash','keyHash','version','responseHash']){assert(v.pairs[0][k]);assert.equal(v.pairs[0][k],v.pairs[1][k]);}}
export function verify(r){
 validateBoundary(r.boundary);verifyInputs(r.sourceCommit,r.inputs);assert.deepEqual(inputs(),r.inputs);
 assert.equal(r.executions.length,checks.length);
 for(const[i,e]of r.executions.entries()){const[id,args,exit=0]=checks[i];assert.equal(e.id,id);assert.deepEqual(e.command,args.map(s=>s.replaceAll('{attempt}',r.attempt)));assert.equal(e.exitCode,exit,id);assert.equal(e.signal,null);assert.equal(e.errorCode,null);assert.equal(hash(read(e.log)),e.logSha256);assert(Date.parse(e.finishedAt)>=Date.parse(e.startedAt));}
 assert.deepEqual(r.artifacts.map(f=>f.path),files(r.attempt));for(const f of r.artifacts)assert.equal(hash(read(f.path)),f.sha256,f.path);
 for(const name of ['binary','host']){const b=json(r.attempt+'/'+name+'.json');assert.equal(b.sourceCommit,r.sourceCommit);assert.equal(hash(read(b.executable)),b.sha256);}
 const selected=name=>r.artifacts.filter(f=>f.path.endsWith('/'+name));
 const matches=[...read(r.attempt+'/native-c15.log').toString().matchAll(/^X3_C15_EVIDENCE=(.+)$/gm)];assert.equal(matches.length,1);validateNative(JSON.parse(matches[0][1]));
 const service=[...read(r.attempt+'/native-c15.log').toString().matchAll(/^X3_SERVICE_EVIDENCE=(.+)$/gm)].map(m=>JSON.parse(m[1]));assert.equal(service.length,5);const proof=id=>service.find(v=>v.id===id).data;assert.equal(proof('chain').duplicates,0);assert.equal(proof('chain').paperSubmits,1);assert.equal(proof('chain').shadowSubmitCalls,0);assert.equal(proof('twenty-breaks').classes,20);assert.equal(proof('twenty-breaks').recurrence,'REOPENED');
 const rust=[];for(const id of ['native-c15','paper-process','reconcile-flow','reconcile-sources','reconcile-worker','c15-bff','c14-bff','tp12-dispatch','tp07-dispatch']){const rows=[...read(r.attempt+'/'+id+'.log').toString().matchAll(/test result: ok\. (\d+) passed; 0 failed; (\d+) ignored/g)];assert.equal(rows.length,1,id);assert(Number(rows[0][1])>0);assert.equal(rows[0][2],'0');rust.push(Number(rows[0][1]));}
 const unit=json(r.attempt+'/consumer.json');assert.equal(unit.success,true);assert.equal(unit.numTotalTests,unit.numPassedTests);assert(unit.numPassedTests>50);assert.equal(unit.numFailedTests,0);assert.equal(unit.numPendingTests,0);
 for(const[id,count]of [['x3-browser',2],['reconciliation-browser',10],['paper-browser',1]])browserReport(json(r.attempt+'/'+id+'.json'),count);
 assert.equal(json(r.attempt+'/terminal-build.json').buildId,'terminal-'+r.sourceCommit);assert.deepEqual(r.exportedFiles.map(f=>f.path),files('apps/terminal/out'));for(const f of r.exportedFiles)assert.equal(hash(read(f.path)),f.sha256);
 const journey=selected('x3-shadow-chain.json');assert.equal(journey.length,1);const shadow=json(journey[0].path);assert.equal(shadow.sourceCommit,r.sourceCommit);validateShadow(shadow);const bytes=read(selected('x3-performance-report.json')[0].path);assert.equal(hash(bytes),'sha256:'+shadow.reportSha256);assert.equal(bytes.length,shadow.reportBytes);
 const networks=selected('core-x3.json');assert.equal(networks.length,2);for(const f of networks){const n=json(f.path);assert.equal(n.sourceCommit,r.sourceCommit);assert.equal(n.status,'passed');assert.deepEqual(n.externalRequests,[]);assert.equal('sha256:'+n.binarySha256,json(r.attempt+'/binary.json').sha256);}
 const tp12=json(r.attempt+'/tp12-boundary.log');assert.equal(tp12.status,'PASS');assert.equal(tp12.runtimeAdmission,'DENIED');assert.equal(tp12.postTp07IntegrationFullReview,'NOT_RUN');assert.equal(tp12.rules,7);assert.equal(tp12.interfaces,6);assert.equal(tp12.threats,8);
 const assessment=json('docs/execution/core-x3-current-assessment.json');assert.deepEqual(assessment.boundary,r.boundary);assert.equal(assessment.fullChecklist.length,3);assert(assessment.fullChecklist.every(c=>c.status==='PARTIAL_GAPS_OPEN'));
 let axeScans=0,axeIncomplete=0;for(const f of r.artifacts.filter(f=>/axe\.json$/.test(f.path))){const a=json(f.path);for(const scan of a.scans??[a]){assert.equal(scan.violations.length,0);axeScans++;axeIncomplete+=scan.incomplete.length;}}
 assert.equal(json(r.attempt+'/integration-refusal.log').reason,'STAGE_NOT_READY');assert.equal(json(r.attempt+'/next-development.log').allowed,true);
 return{sourceCommit:r.sourceCommit,...r.boundary,checks:checks.length,rustCases:rust.reduce((a,b)=>a+b,0),consumerCases:unit.numPassedTests,chromiumCases:13,axeScans,axeIncomplete};
}
export function run(attempt){
 assert(new RegExp('^'+directory+'/attempt-[0-9]+$').test(attempt));assert(!existsSync(attempt));assert(!readdirSync('apps/terminal').some(p=>/^\.env(?:\.|$)/.test(p)&&!p.endsWith('.example')));
 const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceInputs=inputs();verifyInputs(sourceCommit,sourceInputs);mkdirSync(attempt,{recursive:true});writeFileSync(attempt+'/inputs.json',JSON.stringify({sourceCommit,inputs:sourceInputs},null,2)+'\n');
 const env={...webEnvironment(),NEXT_PUBLIC_QUANTOS_ENV:'local-integrated',NEXT_PUBLIC_QUANTOS_MOCK_ENABLED:'false',NEXT_PUBLIC_QUANTOS_BFF_ORIGIN:'https://127.0.0.1:4010',NEXT_PUBLIC_QUANTOS_OIDC_ISSUER:'https://127.0.0.1:4010',GITHUB_SHA:sourceCommit,CARGO_NET_OFFLINE:'true',CARGO_TERM_COLOR:'never',UV_OFFLINE:'1',CI:'1',QUANTOS_SKIP_ENV:'1'},executions=[];
 for(const[id,args,exit=0]of checks){const command=args.map(s=>s.replaceAll('{attempt}',attempt)),startedAt=new Date().toISOString(),out=spawnSync(command[0],command.slice(1),{env:{...env,PLAYWRIGHT_JSON_OUTPUT_NAME:resolve(attempt+'/'+id+'.json')},encoding:'utf8',maxBuffer:96e6,timeout:600000}),log=attempt+'/'+id+'.log';writeFileSync(log,(out.stdout??'')+(out.stderr??''));executions.push({id,command,exitCode:out.status,signal:out.signal,errorCode:out.error?.code??null,startedAt,finishedAt:new Date().toISOString(),log,logSha256:hash(read(log))});writeFileSync(attempt+'/executions.json',JSON.stringify(executions,null,2)+'\n');console.log(id,out.status);
 if(out.status!==exit){writeFileSync(attempt+'/failure.json',JSON.stringify({sourceCommit,failed:executions.at(-1),notRun:checks.slice(executions.length).map(c=>c[0])},null,2)+'\n');throw Error('see '+log);}
 if(id==='bff-binary'){const executable=resolve('target/debug/bff-gateway');writeFileSync(attempt+'/binary.json',JSON.stringify({sourceCommit,executable,sha256:hash(read(executable))})+'\n');}
 if(id==='native-build'){const a=out.stdout.trim().split('\n').map(s=>JSON.parse(s)).find(a=>a.executable&&a.target.name==='bff_gateway');assert(a);writeFileSync(attempt+'/host.json',JSON.stringify({sourceCommit,executable:a.executable,sha256:hash(read(a.executable))})+'\n');}
 if(id==='terminal-build')writeFileSync(attempt+'/terminal-build.json',read('apps/terminal/out/pre03-build.json'));
 }
 const r={schema:'quantos-core-x3-current/v1',sourceCommit,boundary:boundary(),inputs:sourceInputs,attempt,executions,exportedFiles:files('apps/terminal/out').map(path=>({path,sha256:hash(read(path))})),artifacts:files(attempt).map(path=>({path,sha256:hash(read(path))}))},result=verify(r);writeFileSync(directory+'/receipt.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(result));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{if(process.argv[2]==='--run')run(process.argv[3]);else{assert.equal(process.argv[2],'--verify');console.log(JSON.stringify(verify(json(directory+'/receipt.json'))));}}catch(e){console.error(e.stack);process.exitCode=1;}}
