import test from 'node:test';import assert from 'node:assert/strict';
import{loadBffFe000Inputs,validateBffFe000}from'./check-bff-fe-000.mjs';
import{validateCompatibility}from'./bff-compatibility.mjs';import{readFileSync}from'node:fs';
import{validateA1Receipt,validateA1Stage}from'./check-bff-a1-acceptance.mjs';
import{createHash}from'node:crypto';
import {bytesDigest,confirmationMode,reviewDimensions} from './user-acceptance-confirmation.mjs';
const current=loadBffFe000Inputs();
const reviewPolicy=JSON.parse(readFileSync(new URL('../bff/a1-review-policy.json',import.meta.url)));
test('missing staging permits development readiness and never claims formal acceptance',()=>{
 const result=validateA1Stage('development',{policy:reviewPolicy,development:{status:'PASS'}});
 assert.equal(result.status,'PASS');assert.equal(result.stagingStatus,'DEFERRED_TO_FINAL_REVIEW');assert.equal(result.formalAccepted,false);
 assert.equal(validateA1Stage('final-review',{policy:reviewPolicy}).status,'NOT_ACCEPTED');
});
test('stage deferral cannot bypass engineering failures, final receipt requirements or unknown stages',()=>{
 assert.equal(validateA1Stage('development',{policy:reviewPolicy,development:{status:'FAIL',failures:['schema drift']}}).status,'FAIL');
 assert.equal(validateA1Stage('release',{policy:reviewPolicy}).status,'FAIL');
 assert.equal(validateA1Stage('final-review',{policy:{...reviewPolicy,missingStagingBlocksFinalAcceptance:false}}).status,'FAIL');
 assert.equal(validateA1Stage('development',{policy:{...reviewPolicy,stagingRequiredAt:'development'},development:{status:'PASS'}}).status,'FAIL');
});
test('final review command cannot be rewired to the development stage',()=>{
 const input=structuredClone(current);input.packageJson.scripts['check:bff-a1-final-review']=input.packageJson.scripts['check:bff-a1-development'];
 assert.equal(validateBffFe000(input).status,'FAIL');
});
test('current semantic A1 gate passes',()=>assert.equal(validateBffFe000(current).status,'PASS',JSON.stringify(validateBffFe000(current).failures)));
const mutants={cookie:i=>{i.openapi.security=[];},idempotency:i=>{i.openapi.components.parameters.IdempotencyKey.required=false;},sort:i=>{i.openapi.components.parameters.Sort.schema.type='integer';},page:i=>{i.catalog.contracts.C03.pages=['P23'];},ci:i=>{i.workflow=i.workflow.replace('run: pnpm check:bff-fe-000 && pnpm test:bff-fe-000','if: false\n        run: pnpm check:bff-fe-000 && pnpm test:bff-fe-000');},decimal:i=>{i.openapi.components.schemas.DecimalValue.type='number';},version:i=>{i.openapi.components.schemas.StreamEvent.properties.payloadVersion={};},csrf:i=>{i.openapi.paths['/v1/commands'].post.parameters=i.openapi.paths['/v1/commands'].post.parameters.filter(p=>!p.$ref.endsWith('/CsrfToken'));}};
for(const[name,mutate]of Object.entries(mutants))test('rejects '+name+' semantic regression',()=>{const input=structuredClone(current);mutate(input);assert.equal(validateBffFe000(input).status,'FAIL');});
const before=JSON.parse(readFileSync(new URL('../bff/compatibility/1.3.0.json',import.meta.url)));
const decision=JSON.parse(readFileSync(new URL('../bff/compatibility/a1-security-correction.json',import.meta.url)));
test('exact registered security correction is accepted only within its window',()=>{
 assert.equal(validateCompatibility(before,current.openapi,decision,'2026-10-03').status,'PASS');
 assert.equal(validateCompatibility(before,current.openapi,decision,'2026-11-04').status,'FAIL');
});
test('unregistered breaking type, enum or missing baseline fails closed',()=>{
 for(const mutate of [doc=>{doc.components.schemas.DecimalValue.type='number';},doc=>{doc.components.schemas.RuntimeMode.enum.pop();},doc=>{delete doc.paths['/v1/session'];}]) {
  const doc=structuredClone(current.openapi);mutate(doc);assert.equal(validateCompatibility(before,doc,decision,'2026-10-03').status,'FAIL');
 }
 assert.equal(validateCompatibility(before,current.openapi,null,'2026-10-03').status,'FAIL');
});
test('new required parameters and constraints cannot silently bypass compatibility',()=>{
 const base={info:{version:'1.0.0'},paths:{'/x':{get:{responses:{200:{}}}}}};
 for(const addition of [{parameters:[{in:'header',name:'X-New',required:true,schema:{type:'string'}}]},{minimum:1},{enum:['restricted']}]) {
  const next=structuredClone(base);next.info.version='1.1.0';Object.assign(next.paths['/x'].get,addition);
  assert.equal(validateCompatibility(base,next,null).status,'FAIL');
 }
});
test('absent, invented and reference-only staging receipts never close A1',()=>{
 const sha='a'.repeat(40),inputs='b'.repeat(64);
 for(const receipt of [undefined,{schema:'quantos-bff-a1-acceptance/v1',sourceCommit:sha,status:'PASS',environment:'reference',inputsDigest:inputs,baseUrl:'http://localhost:4010'}, {schema:'quantos-bff-a1-acceptance/v1',sourceCommit:sha,status:'PASS',environment:'staging',inputsDigest:inputs,baseUrl:'https://staging.example.com',checks:[],signatures:[]}])assert.equal(validateA1Receipt(receipt,sha,inputs).status,'NOT_ACCEPTED');
});
test('final receipt requires technical evidence plus one input-bound user confirmation',()=>{
 const sha='a'.repeat(40),inputs='b'.repeat(64),hash=raw=>createHash('sha256').update(raw).digest('hex');
 const request={nodeId:'BFF-FE-000',stage:'RELEASE',sourceCommit:sha,inputsDigest:'sha256:'+inputs,reviewDimensions:[...reviewDimensions,'Domain']};
 const document='docs/gate-records/unit-final-draft.md',record='docs/gate-records/unit-final-approval.json';
 const draft='```json\n'+JSON.stringify({schema:'quantos-acceptance-draft/v1',mode:confirmationMode,draftedBy:'Codex',request,reviewDimensions:request.reviewDimensions})+'\n```';
 const raw=JSON.stringify({schema:'quantos-user-acceptance-confirmation/v1',mode:confirmationMode,request,decision:'CONFIRMED',approver:'ProjectUser',identity:'unit-test only',confirmedAt:new Date().toISOString(),document,documentSha256:bytesDigest(draft),confirmationSource:{kind:'USER_MESSAGE',text:'Unit-test confirmation only'}});
 const files=new Map([['check.log','synthetic unit-test evidence'],[document,draft],[record,raw]]);
 const receipt={schema:'quantos-bff-a1-acceptance/v2',sourceCommit:sha,status:'PASS',environment:'staging',inputsDigest:inputs,baseUrl:'https://staging.sumalpha.ai',confirmation:{record,recordSha256:bytesDigest(raw)},checks:['cookie-session','request-response-schema','csrf-origin','idempotency-version','correlation-audit','sse-recovery-revocation','sensitive-fields'].map(name=>({name,status:'PASS',requestId:'unit-test',evidence:'check.log',logSha256:hash(files.get('check.log'))}))};
 const reader=path=>files.get(path);assert.equal(validateA1Receipt(receipt,sha,inputs,reader).status,'PASS');assert.equal(validateA1Stage('final-review',{policy:reviewPolicy,receipt,sha,inputsDigest:inputs,evidenceReader:reader}).formalAccepted,true);
 files.set('check.log','tampered');assert.equal(validateA1Receipt(receipt,sha,inputs,reader).status,'NOT_ACCEPTED');files.set('check.log','synthetic unit-test evidence');
 files.set(record,raw.replace(sha,'c'.repeat(40)));receipt.confirmation.recordSha256=bytesDigest(files.get(record));assert.equal(validateA1Receipt(receipt,sha,inputs,reader).status,'NOT_ACCEPTED');
 files.set(record,raw);receipt.confirmation.recordSha256=bytesDigest(raw);files.set(document,draft+'changed');assert.equal(validateA1Receipt(receipt,sha,inputs,reader).status,'NOT_ACCEPTED');
 files.set(document,draft);delete receipt.confirmation;receipt.signatures=[];assert.equal(validateA1Receipt(receipt,sha,inputs,reader).status,'NOT_ACCEPTED');
});

test('optional property within an existing allOf is additive, required changes are rejected', () => {
 const before={info:{version:'1.4.0'},components:{schemas:{Accepted:{allOf:[{$ref:'#/components/schemas/Base'},{type:'object',required:['auditRef'],properties:{auditRef:{type:'string'}}}]}}}};
 const after=structuredClone(before);after.info.version='1.5.0';after.components.schemas.Accepted.allOf[1].properties.enrollment={type:'object'};
 assert.equal(validateCompatibility(before,after).status,'PASS');
 after.components.schemas.Accepted.allOf[1].required.push('enrollment');
 assert.equal(validateCompatibility(before,after).status,'FAIL');
});
