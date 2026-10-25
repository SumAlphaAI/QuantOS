// Synthetic receiver fixtures. They cannot substitute actual recorder execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verify,buildReceipt,publish,directory,manifest,validateWiring,flags,blocker} from './provider-all-functional-gate.mjs';
import {commands,environment} from './provider-all-functional-scope.mjs';
import {digest} from './provider-a1-receipts.mjs';
import {operations,domains,contract} from './provider-all-contract.mjs';
import YAML from 'yaml';

function contractInputs(){
 const files=new Map(['bff/openapi/quantos-bff.v1.yaml','bff/page-operation-catalog.yaml','tests/contract/generated/quantos-bff.operations.json','tests/contract/generated/quantos-bff.components.schema.json'].map(p=>[p,readFileSync(p)]));
 return {files,read:p=>files.get(p)};
}
test('current contract permits a synchronized version and additive schema upgrade',()=>{
 const {files,read}=contractInputs(),api=YAML.parse(read('bff/openapi/quantos-bff.v1.yaml').toString()),generated=JSON.parse(read('tests/contract/generated/quantos-bff.operations.json')),schemas=JSON.parse(read('tests/contract/generated/quantos-bff.components.schema.json'));
 api.info.version='99.0.0';generated.version='99.0.0';schemas.$id='https://quantos.sumalpha.ai/schemas/bff/99.0.0/components.json';
 api.components.schemas.CiUpgradeProbe={type:'string'};schemas.$defs.CiUpgradeProbe={type:'string'};
 files.set('bff/openapi/quantos-bff.v1.yaml',Buffer.from(YAML.stringify(api)));files.set('tests/contract/generated/quantos-bff.operations.json',Buffer.from(JSON.stringify(generated)));files.set('tests/contract/generated/quantos-bff.components.schema.json',Buffer.from(JSON.stringify(schemas)));
 assert.deepEqual(contract(read),contract());
});
for(const [name,change] of [
 ['stale version',g=>g.version='0.0.0'],['omitted operation',g=>g.operations.pop()],['same-count route substitution',g=>g.operations[0].path='/v1/ci-substitution'],['same-count method substitution',g=>g.operations[0].method='TRACE'],['duplicate operation',g=>g.operations[1]=g.operations[0]],
])test('current contract refuses '+name,()=>{
 const {files,read}=contractInputs(),p='tests/contract/generated/quantos-bff.operations.json',generated=JSON.parse(read(p));change(generated);files.set(p,Buffer.from(JSON.stringify(generated)));assert.throws(()=>contract(read));
});
test('current contract refuses a same-count schema substitution and an extra catalog operation',()=>{
 const {files,read}=contractInputs(),p='tests/contract/generated/quantos-bff.components.schema.json',schemas=JSON.parse(read(p));delete schemas.$defs[Object.keys(schemas.$defs)[0]];schemas.$defs.CiSubstitution={};files.set(p,Buffer.from(JSON.stringify(schemas)));assert.throws(()=>contract(read),/schema names/);
 const next=contractInputs(),catalog=YAML.parse(next.read('bff/page-operation-catalog.yaml').toString());catalog.contracts.C01.publishedOperations.push('ciUnknown');next.files.set('bff/page-operation-catalog.yaml',Buffer.from(YAML.stringify(catalog)));assert.throws(()=>contract(next.read),/catalog operations/);
});
function fixture(){
 const source='a'.repeat(40),attempt=directory+'/function-attempt-99',files=new Map(),put=(p,v)=>files.set(p,Buffer.from(typeof v==='string'?v:JSON.stringify(v))),now=new Date(Date.now()-5000).toISOString();
 const slugs=['','bff-fe-003-local-20261018','bff-fe-005-local-20261018','bff-fe-006-local-20261019','bff-fe-004-local-20261019','bff-fe-009-local-20261020','bff-fe-008-local-20261020','bff-fe-010-local-20261020','bff-fe-002-local-20261020','bff-fe-011-local-20261020'];
 const children=domains.map(([,],i)=>{if(!i){const ids=contract().filter(r=>['BFF-FE-001','BFF-FE-007','BFF-FE-011'].includes(r.owner));return{schema:'quantos-bff-provider-contract/v1',status:'PASS',failure:null,records:ids.flatMap(r=>[200,401,403].map(status=>({operationId:r.operationId,status,requestValidation:'PASS',responseValidation:'PASS',issues:[]})))}}const r=JSON.parse(readFileSync('docs/audit/evidence/'+slugs[i]+'/manifest.json')),c=JSON.parse(readFileSync(r.artifacts[0].path));if(i>1)c.sourceCommit=source;else delete c.sourceCommit;return c;});
 const artifacts=domains.map(([id],i)=>{const path=attempt+'/'+id+'-http.json';put(path,children[i]);return{id,path,sha256:digest(files.get(path))}});
 const http={schema:'quantos-provider-all-http/v1',status:'PASS',failure:null,sourceCommit:source,operations,artifacts,executions:domains.map(([id,script,args],i)=>({id,command:['node',script,artifacts[i].path,...args],startedAt:now,completedAt:now,sourceCommit:source,elapsedMs:1,exitCode:0,signal:null,errorCode:null})),records:children.flatMap((c,i)=>c.records.map(r=>({...r,domain:domains[i][0]}))),databaseExecution:false,externalExecution:false,formalAccepted:false};put(attempt+'/aggregate-http.json',http);
 const names=[...readFileSync('services/bff-gateway/src/provider_all_tests.rs','utf8').matchAll(/#\[(?:tokio::)?test\]\s*(?:async )?fn ([a-z0-9_]+)/g)].map(m=>m[1]);
 const rows=commands(attempt).map(c=>{let s='SYNTHETIC RECEIVER UNIT FIXTURE\n# tests 1\n# pass 1\n# fail 0\n';if(c.id==='generated')s+='BFF generated artifacts match';if(c.id==='contract')s+='134 unique operations';if(c.id==='consumers')s+='Tests 1 passed\nprovider-all-aggregate-consumer.test.ts';if(['native','identity-audit'].includes(c.id))s+=Array.from({length:c.id==='native'?1:2},()=> '\ntest result: ok. 1 passed; 0 failed; 0 ignored').join('');if(c.id==='native')s+='\n'+names.map(n=>n+' ... ok').join('\n');if(c.id==='web-poc')s+='A1_WEB_POC='+JSON.stringify({status:'PASS',sourceCommit:source,oidc:'MOCK_ROUTE_INTERCEPTED',cases:11,staticBudget:'PASS',performanceAcceptance:'NOT_RUN'});const log=attempt+'/logs/'+c.id+'.log';put(log,s);return{...c,log,logSha256:digest(s),status:'PASS',exitCode:0,signal:null,errorCode:null,timedOut:false,elapsedMs:1,startedAt:now,completedAt:now};});
 const current={inputs:[],normative:[]},referenceProof={synthetic:true},currentFreeze={synthetic:true,g0:{request:{inputs:[]}}};
 const receipt=buildReceipt(attempt,source,current,rows,{readBytes:p=>files.get(p)??readFileSync(p),referenceProof,currentFreeze});
 return{receipt,files,options:{current,referenceProof,currentFreeze,readBytes:p=>files.get(p)??readFileSync(p),sourceVerifier:()=>{},wiring:()=>{}}};
}
const f=fixture();
function fresh(){const files=new Map(f.files);return{receipt:structuredClone(f.receipt),files,options:{...f.options,readBytes:p=>files.get(p)??readFileSync(p)}};}
function artifact(t,index,change){const a=t.receipt.artifacts[index],v=JSON.parse(t.files.get(a.path));change(v);const b=Buffer.from(JSON.stringify(v));t.files.set(a.path,b);a.sha256=digest(b);}
function child(t,index,change){artifact(t,index+1,change);artifact(t,0,v=>{v.artifacts[index].sha256=t.receipt.artifacts[index+1].sha256;v.records=v.artifacts.flatMap((a,i)=>JSON.parse(t.files.get(a.path)).records.map(r=>({...r,domain:domains[i][0]})));});}
test('explicit synthetic source stub validates engineering BLOCKED134 and denies admission',()=>{const r=verify(f.receipt,f.options);assert.equal(r.status,'BLOCKED');assert.equal(r.operations,134);assert.equal(r.admission,'DENIED');assert.equal(r.blocker,blocker)});
for(const[name,change]of [
 ['self READY',r=>r.status='READY'],['page admission',r=>r.admission='GRANTED'],['missing G0 blocker',r=>r.blocker=null],['self approval',r=>r.confirmation='CONFIRMED'],['source drift',r=>r.inputs={inputs:[1]}],['empty checks',r=>r.checks=[]],['duplicate command',r=>r.checks[1]=r.checks[0]],['command substitution',r=>r.checks[0].command=['true']],['exit',r=>r.checks[0].exitCode=1],['signal',r=>r.checks[0].signal='SIGTERM'],['spawn',r=>r.checks[0].errorCode='ENOENT'],['timeout',r=>r.checks[0].timedOut=true],['elapsed',r=>r.checks[0].elapsedMs=-1],['future time',r=>r.checks[0].completedAt='2099-01-01'],['log hash',r=>r.checks[0].logSha256='bad'],['path traversal',r=>r.checks[0].log='../bad'],['attempt traversal',r=>r.attempt='../bad'],['upstream ready',r=>r.dependencies[0].status='READY'],['reference change',r=>r.references={}],['freeze confirmation reuse',r=>r.freeze={confirmation:'CONFIRMED'}],['recursive',r=>r.scope.recursiveDependencyRevalidation=true],['integration',r=>r.phases.businessIntegration='PASS'],['release',r=>r.phases.releaseAcceptance='PASS'],['runtime',r=>r.runtimeAdmission='GRANTED'],['artifact hash',r=>r.artifacts[0].sha256='bad'],['missing coverage',r=>r.apiCoverage.pop()],['release handoff',r=>r.release.status='PASS'],...flags.map(k=>[k,r=>r[k]=true])
])test(name+' refused',()=>{const t=fresh();change(t.receipt);assert.throws(()=>verify(t.receipt,t.options));});
for(const[i,[id]]of domains.entries())test('rehashed missing success refused for '+id,()=>{const t=fresh();child(t,i,c=>c.records=c.records.filter(r=>r.status>=400));assert.throws(()=>verify(t.receipt,t.options));});
for(const[name,change]of [['child source',c=>c.sourceCommit='b'.repeat(40)],['child schema',c=>c.records[0].issues=['bad']],['missing browser',c=>c.browser.status='NOT_RUN']])test(name+' refused after nested rehash',()=>{const t=fresh();child(t,9,change);assert.throws(()=>verify(t.receipt,t.options));});
for(const[name,change]of [['child command',v=>v.executions[0].command=['true']],['child exit',v=>v.executions[0].exitCode=1],['child time',v=>v.executions[0].elapsedMs=600001],['child path',v=>v.artifacts[0].path='../escape'],['record substitution',v=>v.records=[]],['operation omission',v=>v.operations=[]]])test(name+' refused with parent rehashed',()=>{const t=fresh();artifact(t,0,change);assert.throws(()=>verify(t.receipt,t.options));});
for(const name of [...readFileSync('services/bff-gateway/src/provider_all_tests.rs','utf8').matchAll(/#\[(?:tokio::)?test\]\s*(?:async )?fn ([a-z0-9_]+)/g)].map(m=>m[1]))test('mandatory native proof '+name,()=>{const t=fresh(),c=t.receipt.checks.find(c=>c.id==='native'),b=Buffer.from(t.files.get(c.log).toString().replace(name+' ... ok','OMITTED'));t.files.set(c.log,b);c.logSha256=digest(b);assert.throws(()=>verify(t.receipt,t.options));});
test('actual default source verifier refuses synthetic inputs',()=>assert.throws(()=>verify(f.receipt,{...f.options,sourceVerifier:undefined})));
test('mandatory CI and strict alias wiring',()=>validateWiring());
test('environment omits target credentials and disables target tests',()=>{const e=environment({...process.env,DATABASE_URL:'synthetic',AWS_SECRET_ACCESS_KEY:'synthetic'});assert.equal(e.DATABASE_URL,undefined);assert.equal(e.AWS_SECRET_ACCESS_KEY,undefined);assert.equal(e.QUANTOS_RUN_F09_POSTGRES_TESTS,'0')});
test('BLOCKED publication rollback restores manifest and plan after entrypoint failure',()=>{const p='docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md',before=readFileSync(p,'utf8'),files=new Map([[p,before],[manifest,null]]);assert.throws(()=>publish(f.receipt,{validate:()=>{},readBytes:p=>files.get(p),write:(p,b)=>files.set(p,b),after:()=>{throw Error('entrypoint failure')}}));assert.equal(files.get(p),before);assert.equal(files.get(manifest),null)});

test('legacy Research source field cannot be invented with both artifacts rehashed',()=>{const t=fresh();child(t,1,c=>c.sourceCommit='a'.repeat(40));assert.throws(()=>verify(t.receipt,t.options));});
test('parent execution source drift cannot borrow another child source',()=>{const t=fresh();artifact(t,0,c=>c.executions[1].sourceCommit='b'.repeat(40));assert.throws(()=>verify(t.receipt,t.options));});

test('G0 annex inputs must be contained in the committed ALL source even with the annex recomputed',()=>{const t=fresh();const currentFreeze=structuredClone(t.receipt.freeze);currentFreeze.g0.request.inputs=[{path:'docs/gate-records/SYNTHETIC_UNBOUND.json',sha256:'sha256:'+'b'.repeat(64)}];t.receipt.freeze=currentFreeze;t.options.currentFreeze=currentFreeze;assert.throws(()=>verify(t.receipt,t.options),/outside committed ALL source/);});
