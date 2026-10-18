import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';
import {root,digest,nodesFromPlans} from './provider-a1-receipts.mjs';
import {snapshot,commands,environment} from './x3-service-test-scope.mjs';
import {markers} from './x3-service-coverage.mjs';
import {buildReceipt,verify,publish,releaseCheck,proofs,flags,handoff} from './x3-service-local-gate.mjs';


function composition(inputs){
 const h='sha256:'+'a'.repeat(64),g=inputs.inputs.find(i=>i.path==='services/execution-gateway/tests/fixtures/x3-service-golden.json').sha256;
 const data={chain:{paperSubmits:1,shadowSubmitCalls:0,venueSubmitPath:'ABSENT',duplicates:0,fills:1,btcQuantity:'1010',cash:'999000',recoveryIo:0,report:h,expectedSource:h,actualSource:'sha256:'+'b'.repeat(64),auditHead:h,goldenSha256:g,command:'synthetic-unit-command'},'twenty-breaks':{classes:20,located:20,casesClosed:20,unprovenClose:'REFUSED',recurrence:'REOPENED',latencyScope:'CONTROLLED_CLOCK_NOT_TARGET_SLA'},refusals:{sourceOrAuthorityClasses:5,paperSubmits:0,shadowFills:0,sideEffects:0},'kill-recovery':{killRefusedBoth:true,sameUserApproval:'REFUSED',freshHealthRequired:true,resumeConsumptions:1,paperSubmitsAfterResume:1,shadowFillsAfterResume:1,venueSubmitPath:'ABSENT'},'source-binding':{zeroForeignFee:'ACCEPTED_WITHOUT_FX',nonzeroForeignFee:'REFUSED',wrongAnchor:'REFUSED',tamperedPortfolio:'REFUSED',venueSubmitPath:'ABSENT',sourceFacts:3}};
 return Object.entries(data).map(([id,data])=>'X3_SERVICE_EVIDENCE='+JSON.stringify({schema:'quantos-x3-service-behavior/v1',id,data})).join('\n');
}

// Synthetic test doubles exercise validators; never engineering receipts.
function fixture(){
 const inputs=snapshot(),attempt='docs/audit/evidence/x3-service-local-20261018/function-attempt-99',source='a'.repeat(40),files=new Map();
 const rows=commands(attempt).map(c=>{const log=attempt+'/logs/'+c.id+'.log';let content='unit fixture';
  if(proofs[c.id]){const names=proofs[c.id];content=names.map(n=>'test '+n+' ... ok').join('\n')+'\ntest result: ok. '+names.length+' passed; 0 failed';}
  if(c.id==='aggregate')content+='\n'+composition(inputs);
  if(c.id==='no-submit')content='X05_NO_VENUE_SUBMIT_PATH=ABSENT';
  if(c.id==='native')content+='\n'+['false','true'].map(v=>'SERVICE_X06_NATIVE_PAPER resting='+v+' SUBMITS=1 CANCELS=1 RECOVERY_IO=0').join('\n');
  if(c.id==='api-prohibitions')content='test result: ok. 1 passed; 0 failed';
  if(c.id==='gate-tests')content='tests 45\npass 45';if(c.id==='plan-policy')content='tests 44\npass 44';
  if(c.id==='runtime-exclusion')content=JSON.stringify({status:'PASS',observedSourceCommit:source,runtimeDependency:'ABSENT_STATIC_CHECK',runtimeAdmission:'DENIED',runtimeInputs:inputs.runtimeInputs.map(path=>({path,sha256:inputs.inputs.find(i=>i.path===path).sha256}))});
  files.set(log,Buffer.from(content));return {...c,startedAt:'2026-10-17T00:00:00Z',completedAt:'2026-10-17T00:00:00Z',elapsedMs:0,status:'PASS',exitCode:0,signal:null,errorCode:null,timedOut:false,log,logSha256:digest(content)};
 });
 const repair='crates/quantos-reconcile/src/reconciliation.rs',lines=readFileSync(resolve(root,repair),'utf8').split('\n');
 const repairedLines=markers.map(marker=>({marker,line:lines.findIndex(l=>l.includes(marker))+1,count:1}));
 const raw=Buffer.from(JSON.stringify({data:[{files:[{filename:root+'/'+repair,segments:repairedLines.map(r=>[r.line,1,1,true,true,false])}]}]})),base=root+'/'+attempt+'/coverage',log=Buffer.from('test result: ok. 5 passed; 0 failed');
 const coverage={schema:'quantos-x3-service-repair-coverage/v1',sourceCommit:source,status:'PASS',criterion:'REPAIR_LINES_EXECUTED_WITH_POSITIVE_NEGATIVE_BEHAVIORS',branchCoverage:'NOT_MEASURED',commands:[['cargo','llvm-cov','clean','--profraw-only','--offline','--locked'],['cargo','llvm-cov','--no-report','--offline','--locked','-p','execution-gateway','--test','x3_service','--','--nocapture'],['cargo','llvm-cov','report','--json','--output-path',base+'/coverage.raw.json']],raw:'coverage.raw.json',rawSha256:digest(raw),logSha256:digest(log),repairedLines,databaseExecution:false,performanceAccepted:false};
 files.set(attempt+'/coverage/coverage.raw.json',raw);files.set(attempt+'/coverage/coverage.log',log);files.set(attempt+'/coverage/receipt.json',Buffer.from(JSON.stringify(coverage)));
 const receipt=buildReceipt(attempt,source,inputs,rows),nodes=nodesFromPlans();nodes.get('RELEASE-GATE:BETA').required_scope+=' '+handoff;
 return {receipt,options:{nodes,current:inputs,read:p=>{assert(files.has(p),p);return files.get(p);},sourceVerifier:()=>true},files};
}
const baseline=fixture();
function fresh(){const files=new Map(baseline.files);return {receipt:structuredClone(baseline.receipt),options:{...baseline.options,read:p=>{assert(files.has(p),p);return files.get(p);}},files};}
test('exact functional scope with explicit test doubles passes',()=>{const f=fresh();assert.equal(verify(f.receipt,f.options).stageGate,'READY');});
for(const flag of flags)test('refuse target flag '+flag,()=>{const f=fresh();f.receipt[flag]=true;assert.throws(()=>verify(f.receipt,f.options));});
for(const [name,change]of Object.entries({
 'source input drift':r=>r.inputs.inputDigest='changed',
 'integration promotion':r=>r.phases.businessIntegration='PASS',
 'runtime authority':r=>r.runtimeAdmission='ALLOWED',
 'durable checkpoint promotion':r=>r.checkpointDurability='DURABLE',
 'venue authority':r=>r.venueAuthority='GRANTED',
 'historical READY splice':r=>r.dependencies[0].status='LOCAL_READY',
 'missing dependency':r=>r.dependencies.pop(),
 'missing check':r=>r.checks.pop(),
 'changed command':r=>r.checks[0].command.push('--workspace'),
 'nonzero exit':r=>r.checks[0].exitCode=1,
 'timeout':r=>r.checks[0].timedOut=true,
 'interruption':r=>r.checks[0].signal='SIGTERM',
 'spawn error':r=>r.checks[0].errorCode='ENOENT',
 'missing input':r=>r.inputs.inputs.pop(),
 'unsafe path':r=>r.attempt='../outside',
 'check order':r=>r.checks.reverse(),
 'target omitted':r=>r.release.functionalTargets.pop(),
 'release promotion':r=>r.release.status='PASS'
}))test('reject '+name,()=>{const f=fresh();change(f.receipt);assert.throws(()=>verify(f.receipt,f.options));});
test('changed raw logs refuse unchanged summary',()=>{const f=fresh();f.files.set(f.receipt.checks[0].log,Buffer.from('forged'));assert.throws(()=>verify(f.receipt,f.options));});
test('hash-correct zero tests cannot prove behavior',()=>{const f=fresh(),r=f.receipt.checks[0],b=Buffer.from('test result: ok. 0 passed');f.files.set(r.log,b);r.logSha256=digest(b);assert.throws(()=>verify(f.receipt,f.options));});
test('source commit verifier cannot be skipped',()=>{const f=fresh();assert.throws(()=>verify(f.receipt,{...f.options,sourceVerifier:()=>{throw Error('wrong commit');}}));});
test('raw coverage tampering is refused',()=>{const f=fresh();f.files.set(f.receipt.attempt+'/coverage/coverage.raw.json',Buffer.from('{}'));assert.throws(()=>verify(f.receipt,f.options));});
test('different instrumented source commit is refused',()=>{const f=fresh(),p=f.receipt.attempt+'/coverage/receipt.json',c=JSON.parse(f.files.get(p));c.sourceCommit='b'.repeat(40);f.files.set(p,Buffer.from(JSON.stringify(c)));assert.throws(()=>verify(f.receipt,f.options));});
test('publication restores manifest and both plans after verification failure',()=>{const f=fresh(),disk=new Map(['docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'].map(p=>[p,readFileSync(resolve(root,p),'utf8')])),before=new Map(disk);
 assert.throws(()=>publish(f.receipt,{validate:()=>{},getNodes:()=>nodesFromPlans(),read:p=>disk.get(p)??null,write:(p,b)=>{if(b===null)disk.delete(p);else disk.set(p,b);},verifyAfter:()=>{throw Error('refuse');}}));assert.deepEqual(disk,before);
});
test('local receipt cannot grant release',()=>assert.throws(()=>releaseCheck(),/NOT_RUN/));
test('recorder environment excludes secrets and target opt-ins',()=>{const e=environment({PATH:'/usr/bin',HOME:'/tmp',AWS_ACCESS_KEY_ID:'synthetic',AWS_SECRET_ACCESS_KEY:'synthetic',DATABASE_URL:'synthetic',SUPABASE_URL:'synthetic',RUSTFLAGS:'synthetic',QUANTOS_RUN_POSTGRES_TESTS:'1',github_token:'synthetic'});assert.equal(e.PATH,'/usr/bin');for(const k of ['AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','DATABASE_URL','SUPABASE_URL','RUSTFLAGS','QUANTOS_RUN_POSTGRES_TESTS','github_token'])assert.equal(e[k],undefined);assert.equal(e.CARGO_NET_OFFLINE,'true');});
test('hash-correct runtime scan cannot omit production inventory',()=>{const f=fresh(),r=f.receipt.checks.find(c=>c.id==='runtime-exclusion'),o=JSON.parse(f.files.get(r.log));o.runtimeInputs.pop();const b=Buffer.from(JSON.stringify(o));r.logSha256=digest(b);f.files.set(r.log,b);assert.throws(()=>verify(f.receipt,f.options));});

for(const [name,mutate]of Object.entries({
 'copied paper source':r=>r.find(x=>x.id==='chain').data.expectedSource=r.find(x=>x.id==='chain').data.actualSource,
 'wrong golden cash':r=>r.find(x=>x.id==='chain').data.cash='1000000',
 'missing difference class':r=>r.find(x=>x.id==='twenty-breaks').data.classes=19,
 'wrong golden fixture':r=>r.find(x=>x.id==='chain').data.goldenSha256='sha256:'+'c'.repeat(64)
}))test('composition refuses '+name+' with correct raw hash',()=>{const f=fresh(),row=f.receipt.checks.find(c=>c.id==='aggregate');const lines=f.files.get(row.log).toString().split('\n'),records=lines.filter(l=>l.startsWith('X3_SERVICE_EVIDENCE=')).map(l=>JSON.parse(l.slice('X3_SERVICE_EVIDENCE='.length)));mutate(records);const bytes=Buffer.from(lines.filter(l=>!l.startsWith('X3_SERVICE_EVIDENCE=')).join('\n')+'\n'+records.map(r=>'X3_SERVICE_EVIDENCE='+JSON.stringify(r)).join('\n'));row.logSha256=digest(bytes);f.files.set(row.log,bytes);assert.throws(()=>verify(f.receipt,f.options));});
test('hash-correct zero-execution repaired lines refuse',()=>{const f=fresh(),base=f.receipt.attempt+'/coverage/',p=base+'receipt.json',c=JSON.parse(f.files.get(p)),raw=JSON.parse(f.files.get(base+c.raw));raw.data[0].files[0].segments.forEach(s=>s[2]=0);c.repairedLines.forEach(r=>r.count=0);const bytes=Buffer.from(JSON.stringify(raw));c.rawSha256=digest(bytes);f.files.set(base+c.raw,bytes);f.files.set(p,Buffer.from(JSON.stringify(c)));assert.throws(()=>verify(f.receipt,f.options));});
