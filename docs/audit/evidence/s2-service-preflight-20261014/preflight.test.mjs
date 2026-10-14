import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {validateRequest,validateResponse} from '../../../../tests/contract/http-contract.mjs';
import {base,fixtureInventory,requestFor,headers,uuid,inspect,validateMapping,operations} from './scope.mjs';
import {rolloutProbe,evaluationProbe} from './boundary-probe.mjs';
const fixtures=JSON.parse(readFileSync(base+'/fixtures.json'));
test('frozen synthetic examples match OpenAPI and are not provider proof',()=>assert.deepEqual(fixtures.examples,fixtureInventory()));
for(const f of fixtures.examples)test(`${f.operationId} ${f.kind} fixture`,async()=>{
 if(f.kind==='request'){const r=requestFor(f.operationId);assert.deepEqual((await validateRequest(f.operationId,r.request,r.params)).issues,[]);}
 else assert.deepEqual(await validateResponse(f.operationId,Response.json(f.value,{status:f.status,headers:{'X-Correlation-Id':uuid,'Cache-Control':'no-store',ETag:'draft-v3'}})),[]);
});
for(const op of operations)test(`${op.operationId} rejects absent authentication`,async()=>{const r=requestFor(op.operationId),h=new Headers(r.request.headers);h.delete('cookie');assert.equal((await validateRequest(op.operationId,new Request(r.request,{headers:h}),r.params)).status,401);});
for(const op of operations.filter(o=>['post','put'].includes(o.method)))test(`${op.operationId} rejects missing CSRF`,async()=>{const r=requestFor(op.operationId),h=new Headers(r.request.headers);h.delete('X-CSRF-Token');assert.equal((await validateRequest(op.operationId,new Request(r.request,{headers:h}),r.params)).status,403);});
for(const op of operations.filter(o=>o.requestBody))test(`${op.operationId} rejects forged ownership/venue fields`,async()=>{const r=requestFor(op.operationId,{body:{tenantId:uuid,venueApiKey:'synthetic-not-a-key'}});assert.equal((await validateRequest(op.operationId,r.request,r.params)).status,422);});
test('draft save requires optimistic concurrency precondition',async()=>{const r=requestFor('saveStrategyDraft'),h=new Headers(r.request.headers);h.delete('If-Match');assert.equal((await validateRequest('saveStrategyDraft',new Request(r.request,{headers:h}),r.params)).status,422);});
test('backtest create requires idempotency key',async()=>{const r=requestFor('createBacktest'),h=new Headers(r.request.headers);h.delete('Idempotency-Key');assert.equal((await validateRequest('createBacktest',new Request(r.request,{headers:h}),r.params)).status,422);});
test('wrong response correlation is refused',async()=>{const f=fixtures.examples.find(f=>f.kind==='response'&&f.operationId==='createBacktest');assert((await validateResponse(f.operationId,Response.json(f.value,{status:f.status,headers:{'X-Correlation-Id':'22222222-2222-4222-8222-222222222222','Cache-Control':'no-store'}}))).some(i=>i.includes('correlation')));});
for(const [label,mutate]of[
 ['missing TP01 node',r=>r.splice(r.findIndex(x=>x.nodeId==='CORE:TP01-F'),1)],
 ['missing evaluation node',r=>r.splice(r.findIndex(x=>x.nodeId==='EVALUATION:TP07'),1)],
 ['duplicate node',r=>r[0]=r[1]],
 ['wrong dependency',r=>r.at(-1).dependencies=[]],
 ['changed normative scope',r=>r.at(-1).normativeInput='forged'],
 ['empty check mapping',r=>r[0].checks=[]],
 ['missing source pointer',r=>r[0].sources=['absent-s2-file']],
 ['empty evidence boundary',r=>r[0].evidenceBoundary=''],
])test(`closure rejects ${label}`,()=>{const rows=structuredClone(inspect().closure);mutate(rows);assert.throws(()=>validateMapping(rows));});
test('39/31 mapping never grants local, BFF, target, performance or formal acceptance',()=>{const r=inspect();assert.equal(r.closureNodes,39);assert.equal(r.tp01ClosureNodes,31);assert.equal(r.r1ProofNodes,27);assert.equal(r.unmapped.length,12);assert.equal(r.registration,'PROPOSED_NOT_REGISTERED');assert.equal(r.gate,'NOT_ASSESSED');assert.equal(r.formalAccepted,false);assert.equal(r.databaseExecution,false);assert.equal(r.performanceAccepted,false);assert.deepEqual(r.stageCounts,{READY:0,NOT_ASSESSED:159,BLOCKED:0});});
test('rollout observation tests do not prove cryptographic signature or running rollback',()=>{const r=rolloutProbe();assert.equal(r.status,'LOCAL_FUNCTIONAL_GAPS');assert.equal(r.gaps.length,2);assert.equal(r.releaseWindowAccepted,false);});
test('TP07 missing pinned supply-chain evidence is not cured by TP12 reference rules',()=>{const r=evaluationProbe();assert.equal(r.status,'LOCAL_EVALUATION_GAPS');assert.equal(r.tp07.missing.length,2);assert.equal(r.tp07.runtimeAdoption,false);assert.equal(r.tp12.runtimeAdoption,false);assert.equal(r.tp12.cve,'not_run');});
