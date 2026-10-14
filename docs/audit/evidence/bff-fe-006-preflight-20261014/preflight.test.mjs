import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {validateRequest,validateResponse} from '../../../../tests/contract/http-contract.mjs';
import {validateFixture} from '../../../../tests/contract/validate.mjs';
import {base,fixtureInventory,requestFor,headers,uuid,inspect} from './scope.mjs';
const fixtures=JSON.parse(readFileSync(base+'/fixtures.json'));
test('frozen own synthetic examples equal current OpenAPI; never provider proof',()=>assert.deepEqual(fixtures.examples,fixtureInventory()));
for(const f of fixtures.examples)test(`${f.operationId} ${f.kind} fixture`,async()=>{
 if(f.kind==='request'){const {request,params}=requestFor(f.operationId);assert.deepEqual((await validateRequest(f.operationId,request,params)).issues,[]);}
 else assert.deepEqual(await validateResponse(f.operationId,Response.json(f.value,{status:f.status,headers:{'X-Correlation-Id':uuid,'Cache-Control':'no-store',ETag:'draft-v3'}})),[]);
});
for(const [name,id,mutate,expected]of[
 ['full command body','submitTradeCommand',r=>r.body={commandRef:uuid,quantity:'1',symbol:'BTCUSDT'},422],
 ['forged tenant','submitTradeCommand',r=>r.body={commandRef:uuid,tenantId:uuid},422],
 ['forged actor','decideApproval',r=>r.body={...r.body,actorId:uuid},422],
 ['raw venue credential','submitTradeCommand',r=>r.body={commandRef:uuid,venueApiKey:'synthetic-not-a-key'},422],
 ['malformed reference','submitTradeCommand',r=>r.body={commandRef:'not-a-uuid'},422],
 ['missing reference','requestOrderCancel',r=>r.body={},422],
 ['wrong cancel reference type','requestOrderCancel',r=>r.body={commandRef:1},422],
 ['missing idempotency','submitTradeCommand',r=>delete r.headers['Idempotency-Key'],422],
 ['missing CSRF','decideApproval',r=>delete r.headers['X-CSRF-Token'],403],
 ['hostile origin','engageKillSwitch',r=>r.headers.Origin='https://attacker.invalid',403],
 ['bearer-only authentication','submitTradeCommand',r=>{delete r.headers.cookie;r.headers.Authorization='Bearer synthetic';},401],
 ['invalid decision enum','decideApproval',r=>r.body={...r.body,decision:'execute'},422],
])test(`contract rejects ${name}`,async()=>{const original=requestFor(id),r={body:original.op.requestBody.content['application/json'].example,headers:{...headers}};mutate(r);const request=new Request(original.request.url,{method:original.request.method,headers:r.headers,body:JSON.stringify(r.body)});assert.equal((await validateRequest(id,request,original.params)).status,expected);});
test('unsafe order sorting rejected',async()=>{const r=requestFor('listOrders'),url=new URL(r.request.url);url.searchParams.set('sort','password:asc');assert.equal((await validateRequest('listOrders',new Request(url,{headers}))).status,422);});
test('executable Proposal forbidden even in fixture',()=>assert(validateFixture({executable:true}).length));
test('accepted command is not filled success and correlation must match',async()=>{const f=fixtures.examples.find(f=>f.operationId==='submitTradeCommand'&&f.kind==='response');assert.equal(f.status,202);assert.equal(f.value.status,'accepted');assert((await validateResponse(f.operationId,Response.json(f.value,{status:202,headers:{'X-Correlation-Id':'22222222-2222-4222-8222-222222222222','Cache-Control':'no-store'}}))).some(i=>i.includes('correlation')));});
test('sensitive provider response rejected',()=>assert(validateFixture({venueApiKey:'synthetic-not-a-key'}).length));
test('preflight cannot grant local or A4 admission',()=>{const r=inspect();assert.equal(r.registration,'PROPOSED_NOT_REGISTERED');assert.equal(r.gate,'NOT_ASSESSED');assert.equal(r.closureNodes,64);assert.equal(r.unmapped.length,22);assert.equal(r.a4.nodes,66);assert.equal(r.formalAccepted,false);});
