import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {mkdtempSync,cpSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {record,verifyFunctional,supportingPaths} from './tp01-g-functional.mjs';
import {digest,supportingArtifactPaths} from './provider-a1-receipts.mjs';
const root=mkdtempSync(resolve(tmpdir(),'quantos-tp01-g-negatives-')),seed=root+'/seed',receipt=record({outputDirectory:seed});after(()=>rmSync(root,{recursive:true,force:true}));
function fixture(fn){const dir=mkdtempSync(root+'/case-');cpSync(seed,dir,{recursive:true});const r=structuredClone(receipt),verify=()=>verifyFunctional(r,{logDirectory:dir,expectedOutputDirectory:seed});try{fn(r,dir,verify);}finally{rmSync(dir,{recursive:true,force:true});}}
test('actual replacement UDS replay and offline patch tests never grant a stage',()=>fixture((r,d,verify)=>assert.deepEqual(verify(),{engineeringStatus:'PASS',stageGate:'NOT_ASSESSED',moduleTests:198,patchTests:4,formalAccepted:false,externalPublished:false})));
test('all supporting originals are registered',()=>assert.deepEqual(supportingArtifactPaths('tp01-g-functional',receipt),supportingPaths(receipt)));
for(const[label,mutate]of[
 ['missing execution',r=>r.checks.pop()],['duplicate execution',r=>r.checks[0]=r.checks[1]],['fake command',r=>r.checks[0].command=['true']],['failed exit',r=>r.checks[0].exitCode=1],['false status',r=>r.checks[0].status='FAIL'],['timeout',r=>r.checks[0].timedOut=true],['signal',r=>r.checks[0].signal='SIGTERM'],['process error',r=>r.checks[0].executionErrorCode='ENOENT'],['execution bound',r=>r.checks[0].timeoutMs=1],['future execution',r=>r.checks[0].executedAt='9999-01-01'],['wrong schema',r=>r.schema='fake'],['wrong consumer',r=>r.nodeId='CORE:TP01-F'],['ready artifact',r=>r.stageGate='READY'],['scope drift',r=>r.planInput={}],['code drift',r=>r.inputs[0].sha256=digest('different')],['duplicate file',r=>r.files[0]=r.files[1]],['missing file',r=>r.files.pop()],['unsafe file',r=>r.files[0].path='../outside'],['log digest',r=>r.checks[0].logSha256=digest('fake')],['file digest',r=>r.files[0].sha256=digest('fake')],
 ...['formalAccepted','databaseExecution','externalExecution','performanceAccepted','externalPublished','upstreamAccepted'].map(key=>[key,r=>r[key]=true]),
])test('functional proof rejects '+label,()=>fixture((r,d,verify)=>{mutate(r);assert.throws(verify);}));

for(const[label,path,mutate]of[
 ['baseline accepted','patch/patch-check.json',r=>r.baselineExpectedFailures=0],
 ['wrong baseline','patch/patch-check.json',r=>r.baselineCommit='a'.repeat(40)],
 ['upstream published','patch/patch-check.json',r=>r.externalPublished=true],
 ['formal approved','patch/patch-check.json',r=>r.formalAccepted=true],
 ['fabricated PR','patch/patch-check.json',r=>r.upstreamPrUrl='https://example.com/pr'],
 ['missing actual command','patch/patch-check.json',r=>r.records.pop()],
 ['fake command','patch/patch-check.json',r=>r.records[0].command=['true']],
 ['patched tests failed','patch/patch-check.json',r=>r.records[3].exitCode=1],
])test('support receipt rejects '+label+' after rehash',()=>fixture((r,d,verify)=>{const file=resolve(d,path),value=JSON.parse(readFileSync(file));mutate(value);writeFileSync(file,JSON.stringify(value));r.files.find(f=>f.path===path).sha256=digest(readFileSync(file));assert.throws(verify);}));
test('missing copied source cannot fall back to canonical bytes',()=>fixture((r,d,verify)=>{rmSync(resolve(d,'patch/pinned-source.py'));assert.throws(verify);}));

for(const path of ['patch/patched-source.py','patch/pinned-source.py','patch/regression.py'])test('rehashed '+path+' cannot replace applied patch bytes',()=>fixture((r,d,verify)=>{const file=resolve(d,path);writeFileSync(file,readFileSync(file,'utf8')+'# forged\n');r.files.find(f=>f.path===path).sha256=digest(readFileSync(file));assert.throws(verify);}));
