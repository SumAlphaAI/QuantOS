import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import YAML from 'yaml';
import {nodesFromPlans,closure,policy,planInput,digest} from '../../../../scripts/provider-a1-receipts.mjs';
export const base='docs/audit/evidence/bff-fe-006-preflight-20261014';
export const owner='FE:BFF-FE-006';
export const baseline='45bde37547419f85db56f39b5c90475e7165e3a9';
export const doc=YAML.parse(readFileSync('bff/openapi/quantos-bff.v1.yaml','utf8'));
const catalog=YAML.parse(readFileSync('bff/page-operation-catalog.yaml','utf8'));
export const contracts=Object.entries(catalog.contracts).filter(([,c])=>c.ownerTask==='BFF-FE-006');
export const published=contracts.flatMap(([,c])=>c.publishedOperations);
export const planned=contracts.flatMap(([,c])=>c.plannedOperations);
export const resolve=o=>o?.$ref?o.$ref.split('/').slice(1).reduce((v,k)=>v[k],doc):o;
export const operations=Object.entries(doc.paths).flatMap(([path,item])=>Object.entries(item).filter(([,op])=>op.operationId&&published.includes(op.operationId)).map(([method,op])=>({...op,path,method})));
export const uuid='11111111-1111-4111-8111-111111111111';
export const headers={cookie:'quantos_session=session-current; quantos_csrf=csrf-token-0000000000000001',Origin:'http://localhost:3190','X-CSRF-Token':'csrf-token-0000000000000001','X-Request-Id':uuid,'Idempotency-Key':uuid,'If-Match':'draft-v3','Content-Type':'application/json'};
export function requestFor(id,overrides={}) {
 const op=operations.find(o=>o.operationId===id);assert(op,id);
 const params=Object.fromEntries((op.parameters??[]).map(resolve).filter(p=>p.in==='path').map(p=>[p.name,uuid]));
 const path=op.path.replace(/\{[^}]+\}/g,uuid),url=new URL(path,'http://127.0.0.1:4010');
 for(const p of (op.parameters??[]).map(resolve).filter(p=>p.in==='query'&&p.required))url.searchParams.set(p.name,p.schema.enum?.[0]??(p.schema.format==='uuid'?uuid:p.schema.type==='integer'?'1':'fixture'));
 const body=op.requestBody?structuredClone(op.requestBody.content['application/json'].example):undefined;
 return {op,params,request:new Request(url,{method:op.method.toUpperCase(),headers:{...headers,...overrides.headers},...(body!==undefined?{body:JSON.stringify(overrides.body??body)}:{})})};
}
export function fixtureInventory() {
 return operations.flatMap(op=>[
  ...(op.requestBody?[{operationId:op.operationId,kind:'request',value:op.requestBody.content['application/json'].example}]:[]),
  ...Object.entries(op.responses).filter(([status,r])=>/^2/.test(status)&&resolve(r).content?.['application/json']).map(([status,r])=>({operationId:op.operationId,kind:'response',status:Number(status),value:resolve(r).content['application/json'].example})),
 ]);
}
export function inspect() {
 const nodes=nodesFromPlans(),p=policy(),ids=closure(nodes,owner),a3=closure(nodes,'PROVIDER:A3');
 assert.equal(ids.length,64);assert.equal(closure(nodes,'PROVIDER:A4').length,66);assert.equal(published.length,17);assert.equal(planned.length,3);assert.equal(fixtureInventory().length,20);
 const matrix=operations.map(op=>{assert.equal(op['x-quantos-policy'].owner,'BFF-FE-006');const refs=(op.parameters??[]).map(p=>p.$ref);if(op.method==='post'){assert(refs.includes('#/components/parameters/IdempotencyKey'));assert(refs.includes('#/components/parameters/CsrfToken'));}const sse=Object.values(op.responses).some(r=>resolve(r).content?.['text/event-stream']);if(sse)assert(refs.includes('#/components/parameters/AfterSequence'));return {operationId:op.operationId,method:op.method.toUpperCase(),path:op.path,sse,policy:op['x-quantos-policy'],contract:contracts.find(([,c])=>c.publishedOperations.includes(op.operationId))[0]};});
 const unmapped=ids.filter(id=>!p.nodes[id]);assert.equal(unmapped.length,22);
 const result={schema:'quantos-bff006-local-preflight/v1',status:'PREFLIGHT_COMPLETE_WITH_LOCAL_GAPS',observedSourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),baselineCommit:baseline,owner,profile:'BFF006_LOCAL',registration:'PROPOSED_NOT_REGISTERED',formalAccepted:false,databaseExecution:false,closure:ids.map(id=>({nodeId:id,dependencies:nodes.get(id).dependencies,stageGate:nodes.get(id).stage_gate.status,policyMapped:!!p.nodes[id],normativeInput:planInput(nodes.get(id))})),a4:{owner:'PROVIDER:A4',nodes:66,additional:['FE:BFF-FE-004','PROVIDER:A4']},directDependencies:nodes.get(owner).dependencies,closureNodes:64,existingA3Nodes:a3.length,newNodes:ids.filter(id=>!a3.includes(id)),unmapped,contracts:contracts.map(([id,c])=>({id,...c})),operations:matrix,plannedOperations:planned,examples:fixtureInventory().length,openapiSha256:digest(readFileSync('bff/openapi/quantos-bff.v1.yaml')),gate:'NOT_ASSESSED',stageCounts:Object.fromEntries(['READY','NOT_ASSESSED','BLOCKED'].map(s=>[s,[...nodes.values()].filter(n=>n.stage_gate.status===s).length])),deferred:{supabase:'NOT_RUN',external:'NOT_RUN',performance:'NOT_RUN',release:'NOT_ASSESSED'},findings:[{id:'G01',status:'OPEN',detail:'17 declared operations need actual provider success/rejection/recovery proof; contract guards are insufficient'},{id:'G02',status:'OPEN',operations:planned,detail:'C13 capabilities/preflight/SSE remain planned without path/schema/provider'},{id:'G03',status:'OPEN',nodes:unmapped,detail:'22 recursive nodes lack local policy and strict receipt mapping'},{id:'G04',status:'OPEN',detail:'X03 mixed P95/TTL test skipped locally; split functional TTL and release performance'},{id:'G05',status:'OPEN',detail:'risk 95% branch coverage and X3 composite consumer proof require dedicated fresh execution'}]};
 assert.deepEqual(result.stageCounts,{READY:6,NOT_ASSESSED:153,BLOCKED:0});return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const r=inspect();if(process.argv.includes('--record'))writeFileSync(base+'/inventory.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r,null,2));if(process.argv.includes('--admission')){console.error('LOCAL_ADMISSION_BLOCKED: unregistered BFF006_LOCAL, C13 and recursive policy gaps; no Gate granted');process.exitCode=2;}}
