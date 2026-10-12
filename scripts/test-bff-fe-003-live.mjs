// Explicit nonproduction target harness. It does not apply SQL or provision roles,
// invent license approvals, start a database, or print credential values.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {validateResponse} from '../tests/contract/http-contract.mjs';
const required=name=>{assert(process.env[name],name+' is required');return process.env[name];};
assert.equal(required('QUANTOS_BFF003_TARGET_ENABLED'),'1');
assert.equal(required('QUANTOS_BFF_ENVIRONMENT'),'dev','target harness requires dev configuration');
const base=new URL(required('QUANTOS_BFF003_TARGET_URL'));
assert(base.protocol==='https:'||['localhost','127.0.0.1'].includes(base.hostname),'HTTPS is required');
assert(!/(?:^|[.-])prod(?:uction)?(?:[.-]|$)/i.test(base.hostname),'production target forbidden');
const cookie=required('QUANTOS_BFF003_TARGET_COOKIE');const csrf=required('QUANTOS_BFF003_TARGET_CSRF');const origin=required('QUANTOS_TERMINAL_ORIGIN');
const snapshot=required('QUANTOS_BFF003_TARGET_SNAPSHOT_ID');const artifact=required('QUANTOS_BFF003_TARGET_ARTIFACT_ID');
const evidence={schema:'quantos-bff-fe-003-target/v1',environment:'dev',status:'RUNNING',databaseExecution:true,production:false,formalAccepted:false,checks:[],cleanup:{status:'NOT_RUN'}};
const headers={cookie,'X-CSRF-Token':csrf,Origin:origin,'content-type':'application/json','X-Request-Id':randomUUID()};
let job;
async function call(operation,path,{method='GET',body,key=randomUUID(),expected=200}={}){
 const response=await fetch(new URL(path,base),{method,headers:{...headers,'Idempotency-Key':key},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)});
 assert.equal(response.status,expected,operation+' status');
 const issues=await validateResponse(operation,response.clone());assert.deepEqual(issues,[],operation+' schema');const payload=await response.json();evidence.checks.push({operation,status:response.status,schema:'PASS'});return payload;
}
try{
 await call('listDataSnapshots','/v1/data-snapshots?pageSize=1');await call('getDataSnapshot','/v1/data-snapshots/'+snapshot);
 await call('getArtifact','/v1/artifacts/'+artifact);await call('getArtifactAttachment','/v1/artifacts/'+artifact+'/attachment');
 const body={capability:'research.hypothesis.v1',dataSnapshotId:snapshot,question:'BFF003 isolated target test',budget:'10',deadlineAt:new Date(Date.now()+600000).toISOString()};const key=randomUUID();
 const created=await call('createResearchRun','/v1/research-runs',{method:'POST',body,key,expected:202});job=created.jobId;
 assert.deepEqual(await call('createResearchRun','/v1/research-runs',{method:'POST',body,key,expected:202}),created);
 await call('getResearchRun',created.statusRef);await call('listResearchRuns','/v1/research-runs?filter=runId:eq:'+job);
 const stream=await fetch(new URL(created.statusRef+'/stream?afterSequence=0',base),{headers,signal:AbortSignal.timeout(15000)});assert.equal(stream.status,200);const reader=stream.body.getReader();const first=await reader.read();assert(new TextDecoder().decode(first.value).includes('data: '));await reader.cancel();evidence.checks.push({operation:'subscribeResearchRun',status:200,firstFrame:'PASS'});
 const cancelled=await call('cancelResearchRun',created.statusRef+'/cancel',{method:'POST',expected:202});assert.equal(cancelled.jobId,job);
 let terminal;for(let attempt=0;attempt<20;attempt++){terminal=await call('getResearchRun',created.statusRef);if(['cancelled','failed','succeeded'].includes(terminal.status))break;await new Promise(r=>setTimeout(r,100));}assert(['cancelled','failed','succeeded'].includes(terminal.status));
 evidence.cleanup={status:'PASS',jobId:job,terminalStatus:terminal.status};evidence.status='PASS';
}finally{
 // On failure keep the created job visible; a failed cleanup is never a PASS.
 if(job&&evidence.cleanup.status!=='PASS')evidence.cleanup={status:'PENDING',jobId:job};
 if(evidence.status!=='PASS')evidence.status='FAIL';writeFileSync(required('QUANTOS_BFF003_TARGET_RECEIPT'),JSON.stringify(evidence,null,2)+'\n');
}
