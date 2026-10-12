import {spawnSync} from 'node:child_process';import {mkdirSync,existsSync,writeFileSync} from 'node:fs';
import {staticEnvironment,digest} from '../../../../scripts/provider-a1-receipts.mjs';
const base='docs/audit/evidence/tp01-d-local-20261012',directory=base+'/'+(process.argv[2]??'final-01');if(existsSync(directory))throw Error('preserve final attempt');mkdirSync(directory,{recursive:true});
const env=staticEnvironment({...process.env,PATH:'/Users/anray/Library/pnpm/.tools/pnpm/10.20.0/bin:'+process.env.PATH}),results=[];
for(const [id,cmd,expected,marker]of[
 ['evidence',['node',base+'/verify-evidence.mjs','--record'],0,/"status": "PASS"/],
 ['admission',['make','tp01-d-local-check'],0,/"stageGate": "READY"/],
 ['gate-negatives',['node','--test','scripts/tp01-d-local-gate.test.mjs','scripts/tp01-c-local-gate.test.mjs','scripts/provider-a1-receipts.test.mjs'],0,/fail 0/],
 ['release-refusal',['make','tp01-d-release-check'],2,/NOT_RUN/],
 ['old-c-refusal',['make','tp01-c-local-check'],2,/not READY/],
 ['strict-d-refusal',['node','engines/vibe-adapter/check-absorption.mjs','--ready'],2,/"stageGate":"BLOCKED"/],
 ['strict-f0-refusal',['node','scripts/provider-a1-receipts.mjs','--f0'],1,/dependency is not READY/],
 ['plans',['pnpm','check:development-plans'],0,/"cross_plan_order": "PASS"/],
 ['plans-negative',['pnpm','test:development-plans'],0,/fail 0/],
 ['handoff',['make','development-handoff-check'],0,/PASS/],
 ['diff',['git','diff','--check'],0,/.*/],
 ['secrets',['artifacts/tools/gitleaks','dir','--config','.gitleaks.toml','--gitleaks-ignore-path','.gitleaksignore','--redact','--no-banner',base],0,/no leaks found/],
 ['attempt-secrets',['artifacts/tools/gitleaks','dir','--config','.gitleaks.toml','--gitleaks-ignore-path','.gitleaksignore','--redact','--no-banner','docs/audit/evidence/provider-a1-remediation-20261004/tp01-d-local-20261012'],0,/no leaks found/]]){
 const executedAt=new Date().toISOString(),r=spawnSync(cmd[0],cmd.slice(1),{env,encoding:'utf8',timeout:180000,maxBuffer:32*1024*1024}),output=(r.stdout??'')+(r.stderr??''),log=directory+'/'+id+'.log';writeFileSync(log,output);const result={id,command:cmd,executedAt,completedAt:new Date().toISOString(),exitCode:r.status,expectedExitCode:expected,timedOut:r.error?.code==='ETIMEDOUT',executionErrorCode:r.error?.code??null,signal:r.signal,log,logSha256:digest(output),status:r.status===expected&&!r.error&&!r.signal&&marker.test(output)?'PASS':'FAIL'};results.push(result);writeFileSync(directory+'/results.json',JSON.stringify(results,null,2)+'\n');console.log(id,result.status,result.exitCode);}
if(results.some(r=>r.status!=='PASS'))process.exitCode=1;
