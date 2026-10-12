import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,cpSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {nodesFromPlans,planInput,closure,digest,localPolicy,localChecks,localDeferred,policy,staticEnvironment} from './provider-a1-receipts.mjs';
import {reassess} from './reassess-a3-prerequisites.mjs';
import {validateFunctionalRuns,validateRuns} from './f04-measurements.mjs';
import {normalizeDigest,verifyArtifact} from './research-local-products.mjs';
import {schema,registrations,handoff,verify,publish} from './research-local-gate.mjs';
function fixture(profile='R1_LOCAL'){
 const nodes=nodesFromPlans(),owner=registrations[profile].owner,entries=closure(nodes,owner).map((nodeId,i)=>({nodeId,manifest:'local/'+i+'.json',inputDigest:'sha256:'+String(i).padStart(64,'0')}));
 const local={status:'LOCAL_READY',owner,profile,inputDigest:'sha256:'+'b'.repeat(64),observedSourceCommit:'a'.repeat(40),nodes:entries};
 const own=entries.at(-1),r={schema,nodeId:owner,stage:'DEVELOPMENT',profile,status:'READY',engineeringStatus:'PASS',observedSourceCommit:local.observedSourceCommit,planInput:planInput(nodes.get(owner)),databaseExecution:false,externalExecution:false,performanceAccepted:false,production:false,formalAccepted:false,localPrerequisites:{manifest:'index.json',inputDigest:local.inputDigest},functionalManifest:own.manifest,functionalDigest:own.inputDigest,dependencies:nodes.get(owner).dependencies.map(nodeId=>({nodeId,status:'LOCAL_READY',owner,inputDigest:entries.find(x=>x.nodeId===nodeId).inputDigest})),release:{checkpoint:'RELEASE-GATE:BETA',status:'NOT_RUN',handoff,prerequisiteChecks:localDeferred(nodes,undefined,profile)}};
 return {nodes,local,r,run:()=>verify(r,{nodes,validateLocal:()=>local})};
}
for(const profile of Object.keys(registrations))test(profile+' admits only complete scoped functionality',()=>{const f=fixture(profile);assert.equal(f.run().necessaryNodes,registrations[profile].count);assert.equal(f.run().formalAccepted,false);});
for(const [name,change]of [
 ['another owner',f=>f.r.nodeId='CORE:R03'],['formal self approval',f=>f.r.formalAccepted=true],['production',f=>f.r.production=true],['target claim',f=>f.r.databaseExecution=true],['performance claim',f=>f.r.performanceAccepted=true],['external claim',f=>f.r.externalExecution=true],['failed status',f=>f.r.status='FAIL'],['unregistered profile',f=>f.r.profile='R1'],['altered scope',f=>f.r.planInput={}],['missing dependency',f=>f.r.dependencies.pop()],['published upstream instead of projection',f=>f.r.dependencies[0].status='READY'],['forged dependency',f=>f.r.dependencies[0].inputDigest='sha256:'+'f'.repeat(64)],['mixed SHA',f=>f.local.observedSourceCommit='c'.repeat(40)],['partial closure',f=>f.local.nodes.shift()],['wrong local owner',f=>f.local.owner='CORE:R04'],['failed local proof',f=>f.local.status='FAIL'],['changed index',f=>f.r.localPrerequisites.inputDigest='fake'],['swapped functional manifest',f=>f.r.functionalManifest='fake'],['lost release command',f=>f.r.release.prerequisiteChecks.pop()],['target passed',f=>f.r.release.status='PASS'],['lost handoff',f=>f.r.release.handoff='fake'],['release obligation removed',f=>f.nodes.get('RELEASE-GATE:BETA').required_scope='fake']
])test('reject '+name,()=>{const f=fixture();change(f);assert.throws(f.run);});
test('local profiles cannot execute target or network SCA checks',()=>{const p=policy(),nodes=nodesFromPlans();for(const profile of Object.keys(registrations)){
 const ids=[...new Set(closure(nodes,registrations[profile].owner).flatMap(id=>localChecks(id,p,profile)))];assert(ids.length>0);assert(!ids.includes('tp01-baseline'));assert(!ids.includes('f02-sca'));assert(ids.every(id=>!p.checks[id].database&&!p.checks[id].target));if(closure(nodes,registrations[profile].owner).some(id=>p.nodes[id].checks.includes('f02-sca')))assert(localDeferred(nodes,p,profile).some(x=>x.id==='f02-sca'));assert.deepEqual(localPolicy(profile,p).roots,[registrations[profile].owner]);
}});
test('local environment strips database and production credentials',()=>{const e=staticEnvironment({DATABASE_URL:'secret',SUPABASE_URL:'secret',AWS_SECRET_ACCESS_KEY:'secret',QUANTOS_RUN_F05_POSTGRES_TESTS:'1',PATH:'/bin'});assert.equal(e.DATABASE_URL,undefined);assert.equal(e.SUPABASE_URL,undefined);assert.equal(e.AWS_SECRET_ACCESS_KEY,undefined);assert.equal(e.QUANTOS_RUN_F05_POSTGRES_TESTS,undefined);assert.equal(e.QUANTOS_SKIP_ENV,'1');});
test('publication is transactional if post-write validation fails',()=>{
 const nodes=nodesFromPlans(),saved=new Map(['docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'].map(p=>[p,readFileSync(p,'utf8')])),before=new Map(saved);
 assert.throws(()=>publish(Object.fromEntries(Object.keys(registrations).map(p=>[p,p])),{getNodes:()=>nodes,validateLocal:(_,o)=>fixture(o.profile).local,validate:()=>{},read:p=>saved.get(p)??null,write:(p,b)=>b===null?saved.delete(p):saved.set(p,b),verifyAfter:()=>{throw Error('post-write failure');}}),/post-write failure/);assert.deepEqual(saved,before);
});
test('partial profile publication rejected before writing',()=>assert.throws(()=>publish({R1_LOCAL:'index.json'}),/all three/));

test('release performance thresholds retained and development CI diagnostic only',()=>{const rust=readFileSync('crates/quantos-market/src/tests.rs','utf8'),perf=readFileSync('scripts/check-perf-budget.mjs','utf8'),workflow=readFileSync('.github/workflows/frontend-baseline.yml','utf8'),make=readFileSync('Makefile','utf8');assert(rust.includes('#[ignore = "release performance; run make r01-release-performance"]'));assert(rust.includes('p95 < 50_000_000'));assert(perf.includes('sharedFirstLoadJs: 250 * 1024, singleChunk: 200 * 1024, totalCss: 60 * 1024'));assert(workflow.includes('apps/terminal/out --diagnostic'));assert(workflow.includes('apps/website/out --diagnostic'));assert(make.includes('frontend-release-performance:'));assert(make.includes('pure_domain_p95_under_fifty_milliseconds -- --ignored --nocapture'));});

for(const valid of [true,false])test('reassessment root and closure agree with consumer receipt '+valid,()=>{
 const nodes=nodesFromPlans();for(const r of Object.values(registrations))nodes.get(r.owner).stage_gate.status='READY';
 const r=reassess({nodes,checkLocalReceipt:profile=>{if(!valid)throw Error('functional proof missing');const f=fixture(profile);return {localPrerequisites:{nodes:f.local.nodes}};}});
 assert.equal(r.roots.length,3);for(const x of r.roots){assert.equal(x.admission,valid?'LOCAL_READY':'NOT_READY');assert.equal(x.aggregateReceipt.valid,valid);for(const d of x.closure){assert.equal(d.consumerLocalReceipt?.status??null,valid?'LOCAL_READY':null);if(!Object.values(registrations).some(a=>a.owner===d.nodeId))assert.notEqual(d.stageGate.status,'READY');}}
});
test('functional F04 proves corpus equality while release retains timing rejection',()=>{
 const a={digest:'sha256:'+'a'.repeat(64),fixtures:1000,p95Micros:1000000};assert.equal(validateFunctionalRuns(a,a).performanceAcceptance,'NOT_RUN');assert.throws(()=>validateRuns(a,a),/P95/);assert.throws(()=>validateFunctionalRuns(a,{...a,fixtures:999}),/1,000/);assert.throws(()=>validateFunctionalRuns(a,{...a,digest:'sha256:'+'b'.repeat(64)}),/digests/);
});
test('legacy digest normalization preserves checksum and rejects malformed data',()=>{const a='a'.repeat(64);assert.equal(normalizeDigest(a),'sha256:'+a);assert.equal(normalizeDigest('sha256:'+a),'sha256:'+a);assert.throws(()=>normalizeDigest('garbage'));});
test('all local profiles defer performance commands',()=>{const p=policy();for(const profile of Object.keys(registrations)){assert(localPolicy(profile,p).releaseChecks.length>=2);for(const c of localDeferred(undefined,p,profile).filter(c=>p.checks[c.id].performance))assert.equal(c.status,'NOT_RUN');assert(closure(nodesFromPlans(),registrations[profile].owner).flatMap(id=>localChecks(id,p,profile)).every(id=>!p.checks[id].performance));}});

for(const mutation of ['none','rehashed failed suite','rehashed incomplete product','changed log'])test('R04 artifact validates actual historical fixture: '+mutation,async()=>{
 const dir=mkdtempSync(resolve(tmpdir(),'research-artifact-test-'));try{
 cpSync('docs/audit/evidence/provider-a1-remediation-20261004/research-local-20261012/attempt-01/supporting/r04',dir,{recursive:true});const path=resolve(dir,'products.json'),r=JSON.parse(readFileSync(path));
 if(mutation==='rehashed failed suite'){const c=r.checks.at(-1),bytes=readFileSync(resolve(dir,c.log.file),'utf8')+'\nℹ fail 1\n';writeFileSync(resolve(dir,c.log.file),bytes);c.log.sha256=digest(bytes);}
 if(mutation==='changed log')writeFileSync(resolve(dir,r.checks[0].log.file),'PASS');
 if(mutation==='rehashed incomplete product'){const f=r.files[0],file=resolve(dir,f.file),matrix=JSON.parse(readFileSync(file));matrix.proposals.pop();const bytes=JSON.stringify(matrix);writeFileSync(file,bytes);f.sha256=digest(bytes);}
 writeFileSync(path,JSON.stringify(r));const run=()=>verifyArtifact('research-local-products',path,r.sourceCommit);if(mutation==='none')assert.equal((await run()).status,'PASS');else await assert.rejects(run);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
