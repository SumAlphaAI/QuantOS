import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';
import {root,digest,nodesFromPlans} from './provider-a1-receipts.mjs';
import {snapshot,commands,environment} from './tp12-test-scope.mjs';
import {buildReceipt,verify,publish,releaseCheck,proofs,flags,handoff} from './tp12-local-gate.mjs';

// Synthetic gate unit fixture, never published as engineering evidence.
function fixture(){
 const inputs=snapshot(),attempt='docs/audit/evidence/tp12-local-20261017/function-attempt-99',source='a'.repeat(40),files=new Map();
 const byPath=new Map(inputs.inputs.map(i=>[i.path,i.sha256]));
 const review={schema:'quantos-tp12-current-review/v1',status:'PASS',observedSourceCommit:source,rules:7,interfaces:6,threats:8,runtimeDependency:'ABSENT_STATIC_CHECK',runtimeAdmission:'DENIED',agentVenueAuthority:'NOT_GRANTED',postTp07IntegrationFullReview:'NOT_RUN',formalAccepted:false,reference:{upstreamCommit:'8d79877380f8617b45dff2b8c8b3790c2f9d963a',sourceFiles:12,status:'PASS',runtimeAdmission:'DENIED',upstreamExecuted:false,formalAccepted:false,cveAudit:'NOT_RUN',securityAudit:'NOT_RUN'},reviewSha256:byPath.get('third_party/nautilus-agents/x3-boundary-review.json'),runtimeInputs:inputs.runtimeInputs.map(path=>({path,sha256:byPath.get(path)}))};
 for(const name of ['baseline.lock.json','no-coupling-rules.json','boundary-assessment.json'])review.reference[name]=byPath.get('third_party/nautilus-agents/'+name).slice(7);review.reference.tp07BaselineSha256=byPath.get('third_party/nautilus-trader/baseline.lock.json').slice(7);
 const rows=commands().map(c=>{const log=attempt+'/logs/'+c.id+'.log';let content='unit fixture';
  if(c.id==='review')content=JSON.stringify(review);
  if(c.id==='agent')content='TP12_NATIVE_AGENT=PASS EXECUTABLE=false REPLAY=STABLE AUTHORITY_SMUGGLING=REFUSED\n69 passed';
  if(c.id==='review-tests')content='Ran 19 tests\n\nOK\n';
  if(c.id==='gate-tests')content='tests 39\npass 39';if(c.id==='plan-policy')content='tests 44\npass 44';
  if(proofs[c.id]){const names=Array.isArray(proofs[c.id])?proofs[c.id]:[proofs[c.id]];content=names.map(n=>'test '+n+' ... ok').join('\n')+'\ntest result: ok. '+names.length+' passed; 0 failed';if(c.id==='sanitized')content+='\nTP12_SIGNED_KERNEL_FIELDS=12 AUTHORITY_MATERIAL=ABSENT AGENT_TRACE=REFUSED DOWNSTREAM_CALLS=2 DISTINCT_KEYS=2 REPLAY_DUPLICATES=0';}
  files.set(log,Buffer.from(content));return {...c,startedAt:'2026-10-17T00:00:00Z',completedAt:'2026-10-17T00:00:00Z',elapsedMs:0,status:'PASS',exitCode:0,signal:null,errorCode:null,timedOut:false,log,logSha256:digest(content)};
 });
 const receipt=buildReceipt(attempt,source,inputs,rows),nodes=nodesFromPlans();nodes.get('RELEASE-GATE:BETA').required_scope+=' '+handoff;
 return {receipt,options:{nodes,current:inputs,read:p=>{assert(files.has(p));return files.get(p);},sourceVerifier:()=>true},files};
}
const baseline=fixture();
function fresh(){return {receipt:structuredClone(baseline.receipt),options:baseline.options,files:new Map(baseline.files)};}
test('function scope passes with explicit test doubles and no target promotion',()=>{const f=fresh();assert.equal(verify(f.receipt,f.options).stageGate,'READY');});
for(const flag of flags)test('reject target flag '+flag,()=>{const f=fresh();f.receipt[flag]=true;assert.throws(()=>verify(f.receipt,f.options));});
for(const [name,change]of Object.entries({
 'different source snapshot':r=>r.inputs.inputDigest='changed',
 'full review promotion':r=>r.postTp07IntegrationFullReview='PASS',
 'business integration promotion':r=>r.phases.businessIntegration='PASS',
 'runtime adoption':r=>r.upstreamRuntimeAdmission='ALLOWED',
 'venue authority':r=>r.agentVenueAuthority='GRANTED',
 'dependency readiness splice':r=>r.dependencies[0].status='LOCAL_READY',
 'missing dependency':r=>r.dependencies.pop(),
 'missing actual check':r=>r.checks.pop(),
 'changed command':r=>r.checks[0].command.push('--runtime'),
 'failed check':r=>r.checks[0].exitCode=1,
 'timeout':r=>r.checks[0].timedOut=true,
 'interruption':r=>r.checks[0].signal='SIGTERM',
 'spawn error':r=>r.checks[0].errorCode='ENOENT',
 'missing input binding':r=>r.inputs.inputs.pop(),
 'unsafe attempt':r=>r.attempt='../outside',
 'different check order':r=>r.checks.reverse(),
 'target obligation removed':r=>r.release.functionalTargets.pop(),
 'release claimed':r=>r.release.status='PASS'
}))test('reject '+name,()=>{const f=fresh();change(f.receipt);assert.throws(()=>verify(f.receipt,f.options));});
test('changed raw log rejected even with unchanged summary',()=>{const f=fresh();f.files.set(f.receipt.checks[0].log,Buffer.from('{}'));assert.throws(()=>verify(f.receipt,{...f.options,read:p=>f.files.get(p)}));});
test('hash-correct zero-test log cannot substitute for actual behavior',()=>{const f=fresh();const row=f.receipt.checks.find(c=>c.id==='dispatch');const b=Buffer.from('test result: ok. 0 passed');f.files.set(row.log,b);row.logSha256=digest(b);assert.throws(()=>verify(f.receipt,{...f.options,read:p=>f.files.get(p)}));});
test('source commit binding is required',()=>{const f=fresh();assert.throws(()=>verify(f.receipt,{...f.options,sourceVerifier:()=>{throw Error('source mismatch');}}));});
test('publication rolls manifest and both plans back when final verification fails',()=>{const f=fresh(),disk=new Map([['docs/SumAlpha-QuantOS-Development-Plan.md',readFileSync(resolve(root,'docs/SumAlpha-QuantOS-Development-Plan.md'),'utf8')],['docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md',readFileSync(resolve(root,'docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'),'utf8')]]),before=new Map(disk);
 assert.throws(()=>publish(f.receipt,{validate:()=>{},getNodes:()=>nodesFromPlans(),read:p=>disk.get(p)??null,write:(p,b)=>{if(b===null)disk.delete(p);else disk.set(p,b);},verifyAfter:()=>{throw Error('post-publication refusal');}}));assert.deepEqual(disk,before);
});
test('function receipt cannot grant release',()=>assert.throws(()=>releaseCheck(),/NOT_RUN/));

test('recorder child environment has no credential or target opt-in inheritance',()=>{const e=environment({PATH:'/usr/bin',HOME:'/tmp',AWS_ACCESS_KEY_ID:'synthetic',AWS_SECRET_ACCESS_KEY:'synthetic',DATABASE_URL:'synthetic',SUPABASE_URL:'synthetic',RUSTFLAGS:'synthetic',QUANTOS_RUN_POSTGRES_TESTS:'1',github_token:'synthetic'});assert.equal(e.PATH,'/usr/bin');for(const k of ['AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','DATABASE_URL','SUPABASE_URL','RUSTFLAGS','QUANTOS_RUN_POSTGRES_TESTS','github_token'])assert.equal(e[k],undefined);assert.equal(e.CARGO_NET_OFFLINE,'true');});

test('runtime scan cannot omit paths even with a correct log hash',()=>{const f=fresh(),row=f.receipt.checks.find(c=>c.id==='review'),review=JSON.parse(f.files.get(row.log));review.runtimeInputs.pop();const b=Buffer.from(JSON.stringify(review));f.files.set(row.log,b);row.logSha256=digest(b);assert.throws(()=>verify(f.receipt,{...f.options,read:p=>f.files.get(p)}));});
test('reference hashes cannot be rebound',()=>{const f=fresh(),row=f.receipt.checks.find(c=>c.id==='review'),review=JSON.parse(f.files.get(row.log));review.reference['baseline.lock.json']='0'.repeat(64);const b=Buffer.from(JSON.stringify(review));f.files.set(row.log,b);row.logSha256=digest(b);assert.throws(()=>verify(f.receipt,{...f.options,read:p=>f.files.get(p)}));});
