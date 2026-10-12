import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {readFileSync,writeFileSync} from 'node:fs';
import {staticEnvironment,digest,executionOutcome} from '../../../../scripts/provider-a1-receipts.mjs';
const dir='docs/audit/evidence/research-local-20261012';
const checks=[
 ['local-check',['make','research-local-check'],0],
 ['reassessment',['node','scripts/reassess-a3-prerequisites.mjs'],0],
 ['a2-dispatch',['node','scripts/provider-a2-development.mjs'],0],
 ['bff003-dispatch',['node','scripts/bff-fe-003-development.mjs','--ready'],0],
 ['strict-target-denial',['node','scripts/provider-a2-development.mjs','--target'],1],
 ['plans',['node','scripts/check-development-plans.mjs'],0],
 ['frontend-handoffs',['node','scripts/check-frontend-gate-handoff.mjs'],0],
];
const env={...staticEnvironment(process.env),CARGO_NET_OFFLINE:'true',UV_OFFLINE:'1',npm_config_offline:'true',QUANTOS_RELEASE_PERFORMANCE:'0'},results=[];
for(const [id,command,expected]of checks){const executedAt=new Date().toISOString(),r=spawnSync(command[0],command.slice(1),{env,encoding:'utf8',timeout:600000,maxBuffer:32000000});const bytes=Buffer.from((r.stdout??'')+(r.stderr??'')),path=dir+'/'+id+'.log';writeFileSync(path,bytes);const row={id,command,executedAt,...executionOutcome(r,600000),expectedExitCode:expected,expectationMet:r.status===expected,log:path,sha256:digest(bytes)};results.push(row);writeFileSync(dir+'/postchecks.json',JSON.stringify({status:results.every(x=>x.expectationMet)?'PASS':'FAIL',scope:'local engineering and strict target rejection; no target execution',formalAccepted:false,databaseExecution:false,results},null,2)+'\n');console.log(id,r.status);assert(row.expectationMet,id+' failed');if(id==='reassessment')writeFileSync(dir+'/reassessment.json',r.stdout);}
