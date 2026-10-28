// CORE:L04 current local development only; never grants target/release admission.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync,mkdtempSync,copyFileSync,rmSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {resolve,join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {createHash,randomBytes} from 'node:crypto';
import {validateFixture} from '../tests/contract/validate.mjs';
import {webEnvironment} from './p0-functional-scope.mjs';
import {scanConfig} from './core-l02-review.mjs';
export const base='58ebf4a9ca96e71059b0d4c80427fcd1052b6e75', directory='docs/audit/evidence/core-l04-local-20261028';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p)),hash=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:64e6});
export function boundary(){return {nodeId:'CORE:L04',engineeringGate:'PASS_OWNED_LOCAL_CORE_L04_MTLS_C10_DURABLE_RECOVERY',developmentStatus:'IMPLEMENTED_PENDING_ACCEPTANCE',gate:'NOT_READY_GAPS_OPEN',stageGate:'NOT_ASSESSED',formalAccepted:false,runtimeAdmission:'DENIED',actualTestnetConnected:false,identity:'REFERENCE_C01_F06_NOT_REAL_IDP',source:'OWNED_SUBJECT_RISK_NOT_FULL_R04_X02',mtls:'ACTUAL_L02_TLS_PROCESS_WITH_EPHEMERAL_OWNED_CA_AND_SIGNER',persistence:'AUTHENTICATED_FSYNC_ATOMIC_FILES_SINGLE_HOST_SHARED_INODE_LOCK_NOT_DATABASE',commonAudit:'CURRENT_PUBLIC_C10_FROM_DURABLE_APPROVAL_AND_NATIVE_FACTS',unknownRecovery:'DURABLE_RESERVATION_NO_AUTO_RESUBMIT_NO_AUTOMATIC_UNKNOWN_PROMOTION',killSwitch:'NATIVE_DURABLE_ONE_WAY_STOP',multiReplica:'COOPERATING_LOCAL_PROCESSES_ON_ONE_FILESYSTEM_NOT_DISTRIBUTED',targetVaultDatabaseRls:'NOT_RUN',targetLoadSecuritySoakNotificationsSameShaCIRelease:'NOT_RUN',browserFullMatrixManualA11y:'NOT_RUN',openInheritedGaps:19,m5:'PREPARED_NOT_READY',productionCredentialsUsed:false,pushed:false,published:false,nextTask:'CORE-GATE:L4',nextPhase:'DEVELOPMENT'};}
export function validateBoundary(b){assert.deepEqual(b,boundary());}
export function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+'/'+e.name):[dir+'/'+e.name]).sort();}
export const checks=[
 ['development',['node','scripts/development-execution.mjs','--development','CORE:L04']],
 ['build',['cargo','build','--locked','--offline','-p','bff-gateway','-p','execution-gateway']],
 ['native-l04',['cargo','test','--locked','--offline','-p','quantos-execution','--test','core_l04']],
 ['native-approval-regression',['cargo','test','--locked','--offline','-p','quantos-execution','--test','core_l03','--test','service_l03','--test','service_l03_native','--test','l4_service_boundary']],
 ['public-process',['cargo','test','--locked','--offline','-p','bff-gateway','--test','core_l04']],
 ['bff-native',['cargo','test','--locked','--offline','-p','bff-gateway','--lib','assisted::tests::']],
 ['bff-paper',['cargo','test','--locked','--offline','-p','bff-gateway','--lib','execution::tests::']],
 ['bff-c10',['cargo','test','--locked','--offline','-p','bff-gateway','--test','audit_export_provider']],
 ['l02-process',['cargo','test','--locked','--offline','-p','execution-gateway','--test','l02_mtls']],
 ['l02-guard',['cargo','test','--locked','--offline','-p','execution-gateway','--lib','restricted_zone::tests::']],
 ['clippy',['cargo','clippy','--locked','--offline','-p','quantos-execution','-p','execution-gateway','-p','bff-gateway','--all-targets','--','-D','warnings']],
 ['format',['cargo','fmt','--all','--check']],
 ['generated',['node','scripts/check-bff-generated.mjs']],
 ['openapi',['node','scripts/check-bff-openapi.mjs']],
 ['contract',['pnpm','exec','vitest','run','tests/contract','packages/api-client/tests','--reporter=json','--outputFile={attempt}/contract.json']],
 ['consumer',['pnpm','exec','vitest','run','apps/terminal/tests/core-l03-hardening.test.ts','apps/terminal/tests/core-l03-provider-consumer.test.ts','--reporter=json','--outputFile={attempt}/consumer.json']],
 ['gate-tests',['node','--test','--test-reporter=tap','scripts/core-l04-review.test.mjs','scripts/development-execution.test.mjs']],
 ['lint',['pnpm','exec','eslint','scripts/core-l04-review.mjs','scripts/core-l04-review.test.mjs']],
 ['plans',['node','scripts/check-development-plans.mjs']],
 ['integration-refusal',['node','scripts/development-execution.mjs','--integration','CORE:L04'],1],
 ['next-development',['node','scripts/development-execution.mjs','--development','CORE-GATE:L4']],
 ['secret-scan',['node','scripts/core-l04-review.mjs','--scan','{attempt}']]
];
const selectors=['Cargo.lock','Cargo.toml','AGENTS.md','rust-toolchain.toml','crates/quantos-execution/','services/execution-gateway/','services/bff-gateway/','bff/openapi/','packages/api-client/','apps/terminal/src/assisted/','apps/terminal/tests/core-l03*','scripts/core-l04','scripts/development-execution','scripts/development-testing-policy.json','scripts/p0-functional-scope.mjs','docs/execution/core-l04-scope-assessment.json','docs/execution/core-l03-scope-assessment.json','docs/operations/core-l04-current-function.md','docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md','package.json','pnpm-lock.yaml','docs/audit/evidence/core-l03-local-20261027/handoff.json'];
export function inputs(){return git('ls-files','--',...selectors).trim().split('\n').filter(Boolean).sort().map(path=>({path,sha256:hash(read(path))}));}
export function validateFlow(flow,crash,source){
 assert.equal(flow.sourceCommit,source);for(const k of ['sameSource','mutualTls','realBffProcesses','unknownNotReissued','corruptStoreDenied'])assert.equal(flow[k],true);
 assert.equal(flow.replicaRequests,12);assert.equal(flow.nativeProtocolCalls,1);assert.equal(flow.commonC10Nodes,5);assert.equal(flow.actualTestnetConnected,false);assert.equal(flow.gate,'NOT_READY_GAPS_OPEN');assert.equal(flow.runtimeAdmission,'DENIED');
 assert.deepEqual(flow.fourDrills,['replay','process-recovery','engine-fault','kill-switch']);
 assert.equal(crash.sourceCommit,source);assert.equal(crash.zoneProtocolCallsBeforeKill,1);assert.equal(crash.callerObservedResponseLoss,true);assert.equal(crash.recoveredState,'unknown');assert.equal(crash.recoveredOrderAbsent,true);assert.equal(crash.commonC10ReservationNodes,4);assert.equal(crash.noReplayTrace,true);assert.equal(crash.actualTestnetConnected,false);
}
export function scan(attempt){
 assert(new RegExp('^'+directory+'/attempt-[0-9]+$').test(attempt));
 const paths=[...new Set([...git('diff','--name-only',base,'HEAD').trim().split('\n').filter(Boolean),...files(attempt)])].sort();
 const temporary=mkdtempSync(join(tmpdir(),'quantos-l04-scan-')),env=webEnvironment(),tool='artifacts/tools/gitleaks';
 try{
  const config=resolve(attempt+'/secret-config.toml');writeFileSync(config,scanConfig(git('show',base+':services/execution-gateway/src/main.rs'),read('services/execution-gateway/src/main.rs').toString(),read('.gitleaks.toml').toString()));
  for(const p of paths){assert(!p.startsWith('/')&&!p.includes('..')&&!/(?:^|\/)\.env(?:\.|$)/.test(p));const out=join(temporary,'positive',p);mkdirSync(dirname(out),{recursive:true});copyFileSync(p,out);}
  assert.equal(execFileSync(tool,['version'],{env,encoding:'utf8'}).trim(),'8.28.0');
  const run=(kind,report)=>spawnSync(tool,['dir',join(temporary,kind),'--config',config,'--redact','--no-banner','--report-format','json','--report-path',resolve(attempt+'/'+report)],{env,encoding:'utf8',timeout:60000});
  const good=run('positive','secret-report.json');writeFileSync(attempt+'/gitleaks.log',good.stdout+good.stderr);assert.equal(good.status,0,'unreviewed secret finding');assert.deepEqual(json(attempt+'/secret-report.json'),[]);
  const negative=join(temporary,'negative/probe.rs');mkdirSync(dirname(negative),{recursive:true});writeFileSync(negative,'api_key = '+JSON.stringify(randomBytes(32).toString('hex'))+';\n');
  const bad=run('negative','secret-negative.json');writeFileSync(attempt+'/gitleaks-negative.log',bad.stdout+bad.stderr);assert.equal(bad.status,1);assert.equal(json(attempt+'/secret-negative.json').length,1);
  return {scope:'CURRENT_TASK_DIFF_AND_ATTEMPT_NOT_WHOLE_REPOSITORY',files:paths.length,unreviewedFindings:0,actualCanaryRefusals:1,binarySha256:hash(read(tool))};
 }finally{rmSync(temporary,{recursive:true,force:true});}
}
export const expectedRustCases={'native-l04':5,'native-approval-regression':24,'public-process':3,'bff-native':5,'bff-paper':29,'l02-process':4};
export function validateRustCases(actual){for(const[id,n]of Object.entries(expectedRustCases))assert.equal(actual[id],n,id);}
const validatorPaths=['scripts/core-l04-review.mjs','scripts/core-l04-review.test.mjs'];
export function validateValidation(v,source){
 assert.equal(v.schema,'quantos-core-l04-validation-repair/v1');assert.equal(v.sourceCommit,source);assert.equal(v.reason,'CORRECT_L02_EXPECTED_TEST_COUNT_NO_RUNTIME_SOURCE_CHANGE');
 assert(/^[a-f0-9]{40}$/.test(v.validatorCommit));git('merge-base','--is-ancestor',source,v.validatorCommit);
 const changed=git('diff','--name-only',source,v.validatorCommit).trim().split('\n').filter(Boolean);assert(changed.length>0&&changed.every(p=>validatorPaths.includes(p)));
 assert.deepEqual(v.inputs.map(f=>f.path),validatorPaths);
 for(const f of v.inputs){assert.equal(hash(read(f.path)),f.sha256);assert.equal(hash(execFileSync('git',['show',v.validatorCommit+':'+f.path])),f.sha256);}
 for(const[id,args]of [['gate',['node','--test','--test-reporter=tap',...validatorPaths.filter(p=>p.endsWith('.test.mjs')),'scripts/development-execution.test.mjs']],['lint',['pnpm','exec','eslint',...validatorPaths]]]){
  const e=v.executions.find(e=>e.id===id);assert(e);assert.deepEqual(e.command,args);assert.equal(e.exitCode,0);assert.equal(e.signal,null);assert.equal(hash(read(e.log)),e.logSha256);
 }
 assert.match(read(v.executions[0].log).toString(),/# fail 0/);assert.match(read(v.executions[0].log).toString(),/# skipped 0/);
}
export function validateAssessment(){
 const a=json('docs/execution/core-l04-scope-assessment.json'),prior=json('docs/execution/core-l03-scope-assessment.json');
 assert.equal(a.nodeId,'CORE:L04');assert.equal(a.developmentStatus,'IMPLEMENTED_PENDING_ACCEPTANCE');assert.equal(a.gate,'NOT_READY_GAPS_OPEN');assert.equal(a.stageGate,'NOT_ASSESSED');assert.equal(a.formalAccepted,false);assert.equal(a.runtimeAdmission,'DENIED');assert.equal(a.confirmation.selfApproved,false);assert.equal(a.confirmation.status,'PENDING_USER_REVIEW');assert.equal(a.gaps.length,19);
 const retained=gaps=>gaps.map(({id,status,owners,closureCriterion})=>({id,status,owners,closureCriterion}));assert.deepEqual(retained(a.gaps),retained(prior.gaps));assert(a.gaps.every(g=>g.status==='OPEN'));
}
export function verify(r){
 validateAssessment();assert.equal(r.schema,'quantos-core-l04-development/v1');validateBoundary(r.boundary);assert(/^[a-f0-9]{40}$/.test(r.sourceCommit)&&!/^0+$/.test(r.sourceCommit));
 const current=inputs();assert.deepEqual(current.map(f=>f.path),r.inputs.map(f=>f.path));
 if(r.validation)validateValidation(r.validation,r.sourceCommit);
 for(const f of current)if(!r.validation||!validatorPaths.includes(f.path))assert.equal(f.sha256,r.inputs.find(i=>i.path===f.path).sha256,f.path);
 for(const f of r.inputs)assert.equal(hash(execFileSync('git',['show',r.sourceCommit+':'+f.path],{maxBuffer:64e6})),f.sha256,f.path);
 assert.equal(r.executions.length,checks.length);
 for(const[i,e]of r.executions.entries()){const[id,args,code=0]=checks[i];assert.equal(e.id,id);assert.deepEqual(e.command,args.map(a=>a.replaceAll('{attempt}',r.attempt)));assert.equal(e.exitCode,code,id);assert.equal(e.signal,null);assert.equal(e.errorCode,null);assert.equal(e.log,r.attempt+'/'+id+'.log');assert.equal(hash(read(e.log)),e.logSha256);}
 assert.deepEqual(r.artifacts.map(f=>f.path),files(r.attempt));for(const f of r.artifacts)assert.equal(hash(read(f.path)),f.sha256,f.path);
 validateFlow(json(r.attempt+'/flow.json'),json(r.attempt+'/crash.json'),r.sourceCommit);
 const c10=json(r.attempt+'/c10.json');assert.equal(c10.sourceCommit,r.sourceCommit);assert.deepEqual(validateFixture(c10.events,{schema:'AuditEventPage'}),[]);assert.deepEqual(validateFixture(c10.chain,{schema:'EvidenceChainPage'}),[]);
 const rustCases={};for(const id of ['native-l04','native-approval-regression','public-process','bff-native','bff-paper','bff-c10','l02-process','l02-guard']){
  const rows=[...read(r.attempt+'/'+id+'.log').toString().matchAll(/test result: ok\. (\d+) passed; 0 failed; 0 ignored/g)];assert(rows.length>0);rustCases[id]=rows.reduce((n,m)=>n+Number(m[1]),0);
 }
 validateRustCases(rustCases);
 assert(rustCases['bff-c10']>0&&rustCases['l02-guard']>0);
 const counts={};for(const id of ['contract','consumer']){const packet=json(r.attempt+'/'+id+'.json');assert.equal(packet.success,true);assert.equal(packet.numFailedTests,0);assert.equal(packet.numPendingTests,0);counts[id]=packet.numPassedTests;}
 assert.equal(counts.consumer,26);assert.equal(counts.contract,106);
 const nodes=read(r.attempt+'/gate-tests.log').toString();assert.match(nodes,/# fail 0/);assert.match(nodes,/# skipped 0/);
 assert.equal(json(r.attempt+'/integration-refusal.log').reason,'STAGE_NOT_READY');assert.equal(json(r.attempt+'/next-development.log').allowed,true);
 assert.equal(json(r.attempt+'/secret-scan.log').unreviewedFindings,0);assert.deepEqual(json(r.attempt+'/secret-report.json'),[]);
 return {sourceCommit:r.sourceCommit,...boundary(),checks:checks.length,rustCases,...counts,nodeCases:Number(nodes.match(/# pass (\d+)/)[1]),validatorCommit:r.validation?.validatorCommit??r.sourceCommit,validatorNodeCases:r.validation?Number(read(r.validation.executions[0].log).toString().match(/# pass (\d+)/)[1]):null};
}
export function run(attempt){
 assert(new RegExp('^'+directory+'/attempt-[0-9]+$').test(attempt));assert(!existsSync(attempt),'fresh attempt required');mkdirSync(attempt,{recursive:true});
 const sourceCommit=git('rev-parse','HEAD').trim(),snapshot=inputs();for(const f of snapshot)assert.equal(hash(execFileSync('git',['show',sourceCommit+':'+f.path],{maxBuffer:64e6})),f.sha256,'freeze source first: '+f.path);
 const env={...webEnvironment(),CARGO_NET_OFFLINE:'true',GITHUB_SHA:sourceCommit,QUANTOS_L02_FIXTURE_EXECUTABLE:resolve('target/debug/execution-gateway'),QUANTOS_CORE_L04_RESULT:resolve(attempt+'/flow.json'),QUANTOS_CORE_L04_C10_RESULT:resolve(attempt+'/c10.json'),QUANTOS_CORE_L04_CRASH_RESULT:resolve(attempt+'/crash.json')};
 const executions=[];for(const[id,args,code=0]of checks){const command=args.map(a=>a.replaceAll('{attempt}',attempt)),startedAt=new Date().toISOString(),out=spawnSync(command[0],command.slice(1),{env,encoding:'utf8',maxBuffer:64e6,timeout:300000}),log=attempt+'/'+id+'.log';writeFileSync(log,(out.stdout??'')+(out.stderr??''));executions.push({id,command,exitCode:out.status,signal:out.signal,errorCode:out.error?.code??null,startedAt,finishedAt:new Date().toISOString(),log,logSha256:hash(read(log))});writeFileSync(attempt+'/executions.json',JSON.stringify(executions,null,2)+'\n');console.log(id,out.status);if(out.status!==code){writeFileSync(attempt+'/failure.json',JSON.stringify({sourceCommit,status:'FAIL',failed:executions.at(-1),notRun:checks.slice(executions.length).map(c=>c[0])},null,2)+'\n');throw Error('see '+log);}if(id==='build')writeFileSync(attempt+'/binaries.json',JSON.stringify(['bff-gateway','execution-gateway'].map(name=>({path:'target/debug/'+name,sha256:hash(read('target/debug/'+name))})),null,2)+'\n');}
 const r={schema:'quantos-core-l04-development/v1',sourceCommit,boundary:boundary(),inputs:snapshot,attempt,executions,artifacts:files(attempt).map(path=>({path,sha256:hash(read(path))}))};let result;try{result=verify(r);}catch(e){writeFileSync(attempt+'/verification-failure.json',JSON.stringify({sourceCommit,status:'FAIL',error:e.stack},null,2)+'\n');throw e;}
 writeFileSync(directory+'/receipt.json',JSON.stringify(r,null,2)+'\n');writeFileSync(directory+'/result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
export function reverify(attempt,source){
 assert(new RegExp('^'+directory+'/attempt-[0-9]+$').test(attempt));
 assert.equal(json(attempt+'/verification-failure.json').sourceCommit,source);
 const validatorCommit=git('rev-parse','HEAD').trim(),validationDirectory=directory+'/validation-01';assert(!existsSync(validationDirectory));mkdirSync(validationDirectory);
 const v={schema:'quantos-core-l04-validation-repair/v1',sourceCommit:source,validatorCommit,reason:'CORRECT_L02_EXPECTED_TEST_COUNT_NO_RUNTIME_SOURCE_CHANGE',inputs:validatorPaths.map(path=>({path,sha256:hash(read(path))})),executions:[]};
 for(const[id,command]of [['gate',['node','--test','--test-reporter=tap','scripts/core-l04-review.test.mjs','scripts/development-execution.test.mjs']],['lint',['pnpm','exec','eslint',...validatorPaths]]]){
  const out=spawnSync(command[0],command.slice(1),{env:webEnvironment(),encoding:'utf8',maxBuffer:16e6,timeout:60000}),log=validationDirectory+'/'+id+'.log';writeFileSync(log,out.stdout+out.stderr);v.executions.push({id,command,exitCode:out.status,signal:out.signal,log,logSha256:hash(read(log))});assert.equal(out.status,0);
 }
 writeFileSync(validationDirectory+'/receipt.json',JSON.stringify(v,null,2)+'\n');validateValidation(v,source);
 const snapshot=inputs().map(({path})=>({path,sha256:hash(execFileSync('git',['show',source+':'+path],{maxBuffer:64e6}))}));
 const r={schema:'quantos-core-l04-development/v1',sourceCommit:source,boundary:boundary(),inputs:snapshot,attempt,executions:json(attempt+'/executions.json'),artifacts:files(attempt).map(path=>({path,sha256:hash(read(path))})),validation:v};
 const result=verify(r);writeFileSync(directory+'/receipt.json',JSON.stringify(r,null,2)+'\n');writeFileSync(directory+'/result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{
 if(process.argv[2]==='--reverify')reverify(process.argv[3],process.argv[4]);else if(process.argv[2]==='--run')run(process.argv[3]);else if(process.argv[2]==='--verify')console.log(JSON.stringify(verify(json(directory+'/receipt.json'))));else if(process.argv[2]==='--scan')console.log(JSON.stringify(scan(process.argv[3])));else throw Error('Use --run <fresh attempt>, --verify or --scan');
}catch(e){console.error(e.stack);process.exitCode=1;}}
