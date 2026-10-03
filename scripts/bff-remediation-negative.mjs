import test from 'node:test';import assert from 'node:assert/strict';
import{loadBffFe000Inputs,validateBffFe000}from'./check-bff-fe-000.mjs';
import{validateCompatibility}from'./bff-compatibility.mjs';import{readFileSync}from'node:fs';
import{validateA1Receipt}from'./check-bff-a1-acceptance.mjs';
import{createHash}from'node:crypto';
const current=loadBffFe000Inputs();
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
test('receipt checker binds actual evidence bytes and each role to source and contract inputs',()=>{
 const sha='a'.repeat(40),inputs='b'.repeat(64),hash=raw=>createHash('sha256').update(raw).digest('hex');
 const files=new Map([['check.log','synthetic unit-test evidence']]);
 const roles=['Product','Frontend','BFF','QA','Security','Risk','Domain'];
 const signatures=roles.map(role=>{
  const sign={role,sourceCommit:sha,identity:'unit-test signer',signedAt:'2026-10-02T00:00:00Z',receipt:role+'.json'};
  const raw=JSON.stringify({...sign,schema:'quantos-g0-role-signoff/v1',approved:true,inputsDigest:inputs});files.set(sign.receipt,raw);
  return {...sign,receiptSha256:hash(raw)};
 });
 const receipt={schema:'quantos-bff-a1-acceptance/v1',sourceCommit:sha,status:'PASS',environment:'staging',inputsDigest:inputs,baseUrl:'https://staging.sumalpha.ai',signatures,
 checks:['cookie-session','request-response-schema','csrf-origin','idempotency-version','correlation-audit','sse-recovery-revocation','sensitive-fields'].map(name=>({name,status:'PASS',requestId:'unit-test',evidence:'check.log',logSha256:hash(files.get('check.log'))}))};
 const reader=path=>files.get(path);
 assert.equal(validateA1Receipt(receipt,sha,inputs,reader).status,'PASS');
 files.set('check.log','tampered');assert.equal(validateA1Receipt(receipt,sha,inputs,reader).status,'NOT_ACCEPTED');
 files.set('check.log','synthetic unit-test evidence');files.set('QA.json',files.get('QA.json').replace(sha,'c'.repeat(40)));
 assert.equal(validateA1Receipt(receipt,sha,inputs,reader).status,'NOT_ACCEPTED');
});
