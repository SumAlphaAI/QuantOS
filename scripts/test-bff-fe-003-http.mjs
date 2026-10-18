// Real local Rust reference HTTP; synthetic fixtures, no DB/IdP/storage/worker.
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {operations as specs,validateRequest,validateResponse} from '../tests/contract/http-contract.mjs';
import {validateFixture} from '../tests/contract/validate.mjs';
import {operations} from './bff-fe-003-development.mjs';
const output=process.argv[2];assert(output&&process.argv.length===3);const records=[];let child,failure=null;
const snapshot='11111111-1111-4111-8111-000000000001',artifact='44444444-4444-4444-8444-444444444444';let runId=randomUUID(),correlationId=randomUUID(),base;
const body={capability:'research.hypothesis.v1',dataSnapshotId:snapshot,question:'Explain this synthetic market observation',budget:'10',deadlineAt:new Date(Date.now()+3600000).toISOString(),attachments:[]};
async function call(id,{body:input,query={},headers:overrides={},status=200,unsafe=false,resource}={}){
 const op=specs.get(id),params={runId:resource??runId,snapshotId:resource??snapshot,artifactId:resource??artifact,correlationId};const url=new URL(op.path.replace(/\{([^}]+)\}/g,(_,name)=>params[name]),base);for(const[k,v]of Object.entries(query))url.searchParams.set(k,v);
 const headers={cookie:'quantos_session=session-current; quantos_csrf=csrf-token-0000000000000001',origin:'http://localhost:3190','x-csrf-token':'csrf-token-0000000000000001','x-request-id':randomUUID(),'idempotency-key':randomUUID(),...overrides};if(input!==undefined)headers['content-type']='application/json';
 const request=new Request(url,{method:op.method,headers,body:input===undefined?undefined:JSON.stringify(input)});
 const requestIssues=(await validateRequest(id,request,params)).issues;if(!unsafe)assert.deepEqual(requestIssues,[],id+' request');
 const response=await fetch(request),issues=await validateResponse(id,response);let payload;
 if(response.ok&&id==='subscribeResearchRun'){const text=await response.text(),events=text.split('\n').filter(l=>l.startsWith('data: ')).map(l=>JSON.parse(l.slice(6)));assert(events.length>0);for(const event of events)issues.push(...validateFixture(event,{schema:'StreamEvent'}));payload={events};}
 else if(response.status!==204)payload=await response.json();
 records.push({operationId:id,status:response.status,requestValidation:unsafe?'EXPECTED_INVALID':'PASS',responseValidation:issues.length?'FAIL':'PASS',issues});assert.deepEqual(issues,[],id+' response');assert.equal(response.status,status,id+' business status');return payload;
}
try{
 const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));base=`http://127.0.0.1:${port}`;
 execFileSync('cargo',['build','-p','bff-gateway','--bin','bff-gateway','--locked','--offline'],{stdio:'inherit'});
 child=spawn(resolve('target/debug/bff-gateway'),[],{env:{...process.env,QUANTOS_SKIP_ENV:'1',QUANTOS_BFF_MODE:'reference',QUANTOS_BFF_BIND:`127.0.0.1:${port}`},stdio:['ignore','pipe','pipe']});
 await new Promise((r,j)=>{const t=setTimeout(()=>j(Error('reference startup timeout')),30000);child.once('error',e=>{clearTimeout(t);j(e);});child.once('exit',()=>{clearTimeout(t);j(Error('reference early exit'));});child.stdout.on('data',c=>{if(String(c).includes('"ready":true')){clearTimeout(t);r();}});child.stderr.on('data',()=>{});});
 const key=randomUUID(),accepted=await call('createResearchRun',{body,status:202,headers:{'idempotency-key':key}});runId=accepted.jobId;correlationId=accepted.correlationId;
 assert.deepEqual(await call('createResearchRun',{body,status:202,headers:{'idempotency-key':key}}),accepted);
 await call('createResearchRun',{body:{...body,question:'Changed intent'},status:409,headers:{'idempotency-key':key}});
 assert.equal((await call('getResearchRun')).runId,runId);assert.equal((await call('listResearchRuns')).items.length,1);
 const first=await call('listDataSnapshots',{query:{pageSize:1,sort:'snapshotId:asc'}});const next=await call('listDataSnapshots',{query:{pageSize:1,sort:'snapshotId:asc',cursor:first.nextCursor}});assert.notEqual(first.items[0].snapshotId,next.items[0].snapshotId);
 await call('listDataSnapshots',{query:{pageSize:2,sort:'snapshotId:asc',cursor:first.nextCursor},status:422});
 await call('getDataSnapshot');const metadata=await call('getArtifact'),attachment=await call('getArtifactAttachment');assert.equal(metadata.contentHash,attachment.contentHash);assert(attachment.auditRef);
 const cancelKey=randomUUID(),cancel=await call('cancelResearchRun',{status:202,headers:{'idempotency-key':cancelKey}});assert.deepEqual(await call('cancelResearchRun',{status:202,headers:{'idempotency-key':cancelKey}}),cancel);
 const all=await call('subscribeResearchRun'),replayed=await call('subscribeResearchRun',{query:{afterSequence:1}});assert.equal(all.events.length,2);assert.equal(replayed.events.length,1);assert.deepEqual(replayed.events[0],all.events[1]);
 await call('subscribeResearchRun',{query:{afterSequence:999},status:409});
 const chain=await call('getEvidenceChain');assert.equal(chain.items[0].eventId,accepted.auditRef);assert(chain.items.some(e=>e.eventId===cancel.auditRef&&e.causationId===accepted.auditRef));
 for(const tail of ['000000000002','000000000003'])await call('createResearchRun',{body:{...body,dataSnapshotId:'11111111-1111-4111-8111-'+tail},status:422});
 await call('createResearchRun',{body:{...body,actorId:randomUUID()},status:422,unsafe:true});await call('createResearchRun',{body:{...body,budget:'0'},status:422,unsafe:true});
 await call('getArtifact',{resource:randomUUID(),status:404});
 for(const id of operations)for(const[cookie,status]of [['',401],['quantos_session=session-viewer; quantos_csrf=csrf-token-0000000000000001',403]])await call(id,{body:id==='createResearchRun'?body:undefined,status,unsafe:status===401,headers:{cookie}});
 await call('logout',{status:204});await call('subscribeResearchRun',{status:401});await call('getResearchRun',{status:401});
 assert(operations.every(id=>records.some(r=>r.operationId===id&&r.status>=200&&r.status<300)));
}catch(e){failure=e.message;}finally{if(child&&child.exitCode===null){child.kill('SIGTERM');await new Promise(r=>child.once('close',r));}}
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify({schema:'quantos-bff-research-http/v1',scope:'actual loopback reference; synthetic artifact; no worker/database/private storage acceptance',status:failure?'FAIL':'PASS',failure,records},null,2)+'\n');console.log(JSON.stringify({status:failure?'FAIL':'PASS',operations:9,records:records.length,failure}));if(failure)process.exitCode=1;
