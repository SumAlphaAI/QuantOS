// L01 current local protocol evidence. No network/credential implementation.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync,statSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import process from 'node:process';
import console from 'node:console';
import {webEnvironment} from './p0-functional-scope.mjs';
import {hash,verifyInputs} from './g1-download-review.mjs';
export const directory='docs/audit/evidence/core-l01-local-20261026';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p));
const files=dir=>readdirSync(dir).sort().flatMap(name=>{const p=dir+'/'+name;return statSync(p).isDirectory()?files(p):[p];});
export const boundary=()=>({nodeId:'CORE:L01',engineeringGate:'PASS_OWNED_LOCAL_L01_PROTOCOL_ADAPTER',gate:'NOT_READY_GAPS_OPEN',stageGate:'NOT_ASSESSED',formalAccepted:false,runtimeAdmission:'DENIED',developmentAssessment:'IMPLEMENTED_PENDING_ACCEPTANCE',profile:'LIMIT_GTC_FIXED_TESTNET_CREDENTIAL_FREE_PORT',mapping:'200_OWNED_CASES_TWO_REPLAY_SURFACES_NOT_400_INDEPENDENT_CASES',signedDispatch:'ONE_ACTUAL_X03_ISSUER_TO_SIGNED_GATEWAY_CASE',process:'ACTUAL_OWNED_STDIO_NOT_EXCHANGE_HTTP',rules:'OWNER_SYNTHETIC_SUBSET_NOT_LIVE_EXCHANGE_INFO',legacyAdapter:'FIXTURE_COMPATIBILITY_ONLY',realHttpAndSigning:'NOT_RUN',actualTestnet200:'NOT_RUN',globalExchangeWeightLimits:'NOT_RUN',durableRestartDedupe:'NOT_RUN',wholeBusinessIntegration:'NOT_RUN',targetDatabase:'NOT_RUN',remoteCiPerformanceSoakRelease:'NOT_RUN',productionCredentialsUsed:false,externalPublished:false,pushed:false,nextTask:'CORE:L02'});
export function validateBoundary(v){assert.deepEqual(v,boundary());}
export const checks=[
 ['development',['node','scripts/development-execution.mjs','--development','CORE:L01']],
 ['fixture-build',['cargo','build','--locked','--offline','-p','quantos-execution','--example','l01_fixture']],
 ['protocol',['cargo','test','--locked','--offline','-p','quantos-execution','--test','l01_protocol']],
 ['legacy-current',['cargo','test','--locked','--offline','-p','quantos-execution','--test','l01_legacy']],
 ['process',['cargo','test','--locked','--offline','-p','quantos-execution','--test','l01_process']],
 ['legacy-unit',['cargo','test','--locked','--offline','-p','quantos-execution','--lib','venue::tests::']],
 ['gateway',['cargo','test','--locked','--offline','-p','quantos-execution','--lib','gateway::tests::']],
 ['dispatch',['cargo','test','--locked','--offline','-p','quantos-execution','--test','tp07_dispatch']],
 ['oms',['cargo','test','--locked','--offline','-p','quantos-execution','--test','x04_oms','--','--skip','x04_one_hundred_thousand_mixed_kernel_events_replay_with_command_provenance']],
 ['evidence-compile-only',['cargo','test','--locked','--offline','-p','quantos-evidence','--lib','--no-run']],
 ['rust-lint',['cargo','clippy','--locked','--offline','-p','quantos-execution','--tests','--examples','--no-deps','--','-D','warnings']],
 ['rust-format',['cargo','fmt','--check','-p','quantos-execution']],
 ['gate-tests',['node','--test','--test-reporter=tap','scripts/core-l01-review.test.mjs','scripts/development-execution.test.mjs']],
 ['script-lint',['pnpm','exec','eslint','scripts/core-l01-review.mjs','scripts/core-l01-review.test.mjs']],
 ['plans',['node','scripts/check-development-plans.mjs']],
 ['integration-refusal',['node','scripts/development-execution.mjs','--integration','CORE:L01'],1],
 ['next-development',['node','scripts/development-execution.mjs','--development','CORE:L02']],
 ['artifact-scan',['node','scripts/core-l01-review.mjs','--scan','{attempt}']]
];
export function inputs(){
 const selectors=['AGENTS.md','Cargo.toml','Cargo.lock','rust-toolchain.toml','crates/','package.json','pnpm-lock.yaml','.nvmrc','eslint.config.mjs','env/local-mock.env.example','scripts/','docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md','docs/execution/development-followups.json','docs/operations/core-l01-current-function.md','docs/adr/20261026-l01-testnet-protocol.md'];
 return execFileSync('git',['ls-files','--',...selectors],{encoding:'utf8',maxBuffer:16e6}).trim().split('\n').filter(Boolean).sort().map(path=>({path,sha256:hash(read(path))}));
}
export function validateMatrices(d,p,corpus=json('crates/quantos-execution/tests/fixtures/l01-corpus.json').cases){
 assert.equal(d.schema,'quantos-l01-mapping/v1');assert.equal(d.scope,'OWNED_PROTOCOL_NOT_EXCHANGE_TESTNET');assert.equal(p.schema,'quantos-l01-owned-process/v1');assert.equal(p.transport,'ACTUAL_OWNED_STDIO_NOT_EXCHANGE_HTTP');
 for(const report of [d,p]){assert.equal(report.actualTestnetConnected,false);assert.equal(report.productionCredentialsUsed,false);assert.equal(report.cases.length,200);assert.equal(new Set(report.cases.map(c=>c.id)).size,200);}
 assert.equal(p.credentialsInherited,false);assert.equal(p.wireRequests,250);assert.equal(corpus.length,200);
 const counts={};for(const [i,c]of corpus.entries()){
 counts[c.kind]=(counts[c.kind]??0)+1;
 for(const r of [d.cases[i],p.cases[i]]){assert.equal(r.id,c.id);assert.equal(r.kind,c.kind);assert.equal(r.status,c.expectedStatus);assert.equal(r.fills,['filled','partial'].includes(c.kind)?1:0);}
 assert.equal(d.cases[i].requests,['cancelled','cancel_rejected'].includes(c.kind)?2:1);assert.equal(p.cases[i].duplicateWrites,0);assert.match(p.cases[i].anchor.head,/^sha256:[a-f0-9]{64}$/);
 }
 assert.deepEqual(counts,{filled:50,partial:50,rejected:50,cancelled:25,cancel_rejected:25});
}
export function safeArtifact(text){assert(!/(?:https?:\/\/)?api(?:[1-4]|-gcp)?\.binance\.com|BEGIN [A-Z ]*PRIVATE KEY|(?:apiSecret|X-MBX-APIKEY|Authorization)\s*[":=]/i.test(text),'production endpoint or credential-shaped content');}
export function scan(attempt){
 assert(new RegExp('^'+directory+'/attempt-[0-9]+$').test(attempt));
 const paths=[...files('crates/quantos-execution/tests/fixtures'),...files(attempt)].filter(p=>/\.(?:log|json|xml)$/.test(p));
 for(const p of paths)safeArtifact(read(p).toString());
 return{scope:'OWNED_FIXTURES_AND_CURRENT_ATTEMPT_TEXT_ONLY',files:paths.length,credentialOrProductionEndpointFindings:0,notARepositoryWideSecretAudit:true};
}
export function verify(r){
 assert.equal(r.schema,'quantos-core-l01-current/v1');validateBoundary(r.boundary);assert(new RegExp('^'+directory+'/attempt-[0-9]+$').test(r.attempt));
 verifyInputs(r.sourceCommit,r.inputs);assert.deepEqual(inputs(),r.inputs);assert.equal(r.executions.length,checks.length);
 for(const [i,e]of r.executions.entries()){const[id,args,exit=0]=checks[i];assert.equal(e.id,id);assert.deepEqual(e.command,args.map(s=>s.replaceAll('{attempt}',r.attempt)));assert.equal(e.exitCode,exit,id);assert.equal(e.signal,null);assert.equal(e.errorCode,null);assert.equal(e.log,r.attempt+'/'+id+'.log');assert.equal(hash(read(e.log)),e.logSha256);assert(Date.parse(e.finishedAt)>=Date.parse(e.startedAt));}
 assert.deepEqual(r.artifacts.map(f=>f.path),files(r.attempt));for(const f of r.artifacts)assert.equal(hash(read(f.path)),f.sha256,f.path);
 const binary=json(r.attempt+'/binary.json');assert.equal(binary.sourceCommit,r.sourceCommit);assert.equal(binary.executable,resolve('target/debug/examples/l01_fixture'));assert.equal(hash(read(binary.executable)),binary.sha256);
 validateMatrices(json(r.attempt+'/direct-matrix.json'),json(r.attempt+'/process-matrix.json'));
 let rustCases=0;for(const [id,count]of [['protocol',15],['legacy-current',6],['process',1],['legacy-unit',4],['gateway',null],['dispatch',8],['oms',8]]){const results=[...read(r.attempt+'/'+id+'.log').toString().matchAll(/test result: ok\. (\d+) passed; 0 failed; (\d+) ignored/g)];assert.equal(results.length,1,id);const n=Number(results[0][1]);assert(n>0);if(count!==null)assert.equal(n,count,id);assert.equal(results[0][2],'0');rustCases+=n;}
 const node=read(r.attempt+'/gate-tests.log').toString();assert.match(node,/# fail 0/);assert.match(node,/# pass [1-9][0-9]*/);
 assert.equal(json(r.attempt+'/development.log').allowed,true);assert.equal(json(r.attempt+'/integration-refusal.log').reason,'STAGE_NOT_READY');assert.equal(json(r.attempt+'/integration-refusal.log').allowed,false);assert.equal(json(r.attempt+'/next-development.log').allowed,true);
 assert.equal(json(r.attempt+'/artifact-scan.log').credentialOrProductionEndpointFindings,0);scan(r.attempt);
 return{sourceCommit:r.sourceCommit,...r.boundary,checks:checks.length,rustCases,ownedCases:200,replaySurfaces:2,protocolRequestsPerSurface:250};
}
export function run(attempt){
 assert(new RegExp('^'+directory+'/attempt-[0-9]+$').test(attempt));assert(!existsSync(attempt),'preserve previous attempts');
 const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceInputs=inputs();verifyInputs(sourceCommit,sourceInputs);mkdirSync(attempt,{recursive:true});writeFileSync(attempt+'/inputs.json',JSON.stringify({sourceCommit,inputs:sourceInputs},null,2)+'\n');
 const env={...webEnvironment(),CARGO_NET_OFFLINE:'true',CARGO_TERM_COLOR:'never',QUANTOS_L01_FIXTURE_EXECUTABLE:resolve('target/debug/examples/l01_fixture'),QUANTOS_L01_MATRIX:resolve(attempt+'/direct-matrix.json'),QUANTOS_L01_PROCESS_MATRIX:resolve(attempt+'/process-matrix.json')},executions=[];
 for(const[id,args,exit=0]of checks){const command=args.map(s=>s.replaceAll('{attempt}',attempt)),startedAt=new Date().toISOString(),out=spawnSync(command[0],command.slice(1),{env,encoding:'utf8',maxBuffer:32e6,timeout:300000}),log=attempt+'/'+id+'.log';writeFileSync(log,(out.stdout??'')+(out.stderr??''));executions.push({id,command,exitCode:out.status,signal:out.signal,errorCode:out.error?.code??null,startedAt,finishedAt:new Date().toISOString(),log,logSha256:hash(read(log))});writeFileSync(attempt+'/executions.json',JSON.stringify(executions,null,2)+'\n');console.log(id,out.status);
 if(out.status!==exit){writeFileSync(attempt+'/failure.json',JSON.stringify({sourceCommit,failed:executions.at(-1),notRun:checks.slice(executions.length).map(c=>c[0])},null,2)+'\n');throw Error('see '+log);}
 if(id==='fixture-build'){const executable=env.QUANTOS_L01_FIXTURE_EXECUTABLE;writeFileSync(attempt+'/binary.json',JSON.stringify({sourceCommit,executable,sha256:hash(read(executable)),credentialsInherited:false},null,2)+'\n');}
 }
 const r={schema:'quantos-core-l01-current/v1',sourceCommit,boundary:boundary(),inputs:sourceInputs,attempt,executions,artifacts:files(attempt).map(path=>({path,sha256:hash(read(path))}))},result=verify(r);writeFileSync(directory+'/receipt.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(result));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{if(process.argv[2]==='--run')run(process.argv[3]);else if(process.argv[2]==='--scan')console.log(JSON.stringify(scan(process.argv[3])));else{assert.equal(process.argv[2],'--verify');console.log(JSON.stringify(verify(json(directory+'/receipt.json'))));}}catch(e){console.error(e.stack);process.exitCode=1;}}
