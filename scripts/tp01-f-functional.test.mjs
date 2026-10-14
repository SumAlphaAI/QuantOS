import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {mkdtempSync,cpSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {record,verifyFunctional,supportingPaths} from './tp01-f-functional.mjs';
import {digest,supportingArtifactPaths} from './provider-a1-receipts.mjs';
const root=mkdtempSync(resolve(tmpdir(),'quantos-tp01-f-negatives-')),seed=root+'/seed',receipt=record({outputDirectory:seed});after(()=>rmSync(root,{recursive:true,force:true}));
function fixture(fn){const dir=mkdtempSync(root+'/case-');cpSync(seed,dir,{recursive:true});const r=structuredClone(receipt),verify=()=>verifyFunctional(r,{logDirectory:dir,expectedOutputDirectory:seed});try{fn(r,dir,verify);}finally{rmSync(dir,{recursive:true,force:true});}}
test('actual signed UDS drill and Python/simulation tests never grant a stage',()=>fixture((r,d,verify)=>assert.deepEqual(verify(),{engineeringStatus:'PASS',stageGate:'NOT_ASSESSED',probes:19,pythonTests:47,regressionTests:15,formalAccepted:false})));
test('all supporting originals are registered',()=>assert.deepEqual(supportingArtifactPaths('tp01-f-functional',receipt),supportingPaths(receipt)));
for(const[label,mutate]of[
 ['missing execution',r=>r.checks.pop()],['duplicate execution',r=>r.checks[0]=r.checks[1]],['fake command',r=>r.checks[0].command=['true']],['failed exit',r=>r.checks[0].exitCode=1],['false status',r=>r.checks[0].status='FAIL'],['timeout',r=>r.checks[0].timedOut=true],['signal',r=>r.checks[0].signal='SIGTERM'],['process error',r=>r.checks[0].executionErrorCode='ENOENT'],['execution bound',r=>r.checks[0].timeoutMs=1],['future execution',r=>r.checks[0].executedAt='9999-01-01'],['wrong schema',r=>r.schema='fake'],['wrong consumer',r=>r.nodeId='CORE:TP01-G'],['ready artifact',r=>r.stageGate='READY'],['scope drift',r=>r.planInput={}],['code drift',r=>r.inputs[0].sha256=digest('different')],['duplicate file',r=>r.files[0]=r.files[1]],['missing file',r=>r.files.pop()],['unsafe file',r=>r.files[0].path='../outside'],['log digest',r=>r.checks[0].logSha256=digest('fake')],['file digest',r=>r.files[0].sha256=digest('fake')],
 ...['formalAccepted','databaseExecution','externalExecution','performanceAccepted','targetCanaryAccepted','targetRollbackAccepted'].map(key=>[key,r=>r[key]=true]),
])test('functional proof rejects '+label,()=>fixture((r,d,verify)=>{mutate(r);assert.throws(verify);}));
for(const[label,path,mutate]of[
 ['missing probe','drill/drill.json',s=>{const r=JSON.parse(s);r.probes.pop();return JSON.stringify(r);}],
 ['fake successful probe','drill/drill.json',s=>{const r=JSON.parse(s);r.probes[0].observed='UNEXPECTED_SUCCESS';return JSON.stringify(r);}],
 ['inflated target approval','drill/drill.json',s=>JSON.stringify({...JSON.parse(s),targetCanaryAccepted:true})],
 ['tampered artifact','drill/previous.artifact.json',s=>s+' '],
 ['forged signature','drill/candidate.signed-descriptor.json',s=>JSON.stringify({...JSON.parse(s),signature:'0'.repeat(64)})],
 ['lost audit event','drill/runtime-events.json',s=>{const r=JSON.parse(s);r.events=r.events.filter(e=>e.action!=='rollback');return JSON.stringify(r);}],
 ['target-like window','healthy-7d/canary-summary.json',s=>JSON.stringify({...JSON.parse(s),targetCanaryAccepted:true})],
 ['fake restored release','rollback-drill/rollout-state.json',s=>{const r=JSON.parse(s);r.activeRelease.releaseId='candidate-v2';return JSON.stringify(r);}],
])test('copied original rejects '+label+' even after recomputed hash',()=>fixture((r,d,verify)=>{const file=resolve(d,path);writeFileSync(file,mutate(readFileSync(file,'utf8')));r.files.find(f=>f.path===path).sha256=digest(readFileSync(file));assert.throws(verify);}));
test('a missing copied original cannot use the canonical directory',()=>fixture((r,d,verify)=>{rmSync(resolve(d,'drill/drill.json'));assert.throws(verify);}));
