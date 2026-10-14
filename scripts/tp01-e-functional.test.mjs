import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {mkdtempSync,cpSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {record,verifyFunctional,cases,supportingPaths} from './tp01-e-functional.mjs';
import {digest,supportingArtifactPaths} from './provider-a1-receipts.mjs';
const root=mkdtempSync(resolve(tmpdir(),'quantos-tp01-e-negative-')),seed=root+'/seed',receipt=record({outputDirectory:seed});after(()=>rmSync(root,{recursive:true,force:true}));
function fixture(fn){const dir=mkdtempSync(root+'/case-');cpSync(seed,dir,{recursive:true});const r=structuredClone(receipt),verify=()=>verifyFunctional(r,{logDirectory:dir,expectedOutputDirectory:seed});try{fn(r,dir,verify);}finally{rmSync(dir,{recursive:true,force:true});}}
test('twelve real CLI probes and 23 original regressions validate without granting admission',()=>fixture((r,d,verify)=>{assert.deepEqual(verify(),{engineeringStatus:'PASS',stageGate:'NOT_ASSESSED',formalAccepted:false,cases:12,regressionTests:23,expectedNonzero:8});assert.equal(r.checks.length,13);}));
test('six original scenario classes retained, including S0 through S3',()=>assert.deepEqual(cases.slice(0,6).map(c=>[c.id,...c.severities,c.expectedExit]),[['api-break','S1',2],['license-change','S1',2],['cve-high','S0',2],['patch-conflict','S1',2],['planned-sync','S2',0],['research-drift','S3',0]]));
test('supporting artifact mapping includes every raw input/decision/issue/log',()=>assert.deepEqual(supportingArtifactPaths('tp01-e-functional',receipt),supportingPaths(receipt)));
for(const[label,mutate]of[
 ['omit execution',r=>r.checks.pop()],['duplicate execution',r=>r.checks[0]=r.checks[1]],['fake command',r=>r.checks[0].command=['true']],['rename blocked execution PASS',r=>r.checks[1].status='PASS'],['ignore blocked exit',r=>r.checks[1].exitCode=0],['change expected exit',r=>r.checks[1].expectedExitCode=0],['hide timeout',r=>r.checks[0].timedOut=true],['hide signal',r=>r.checks[0].signal='SIGTERM'],['hide execution error',r=>r.checks[0].executionErrorCode='ENOENT'],['change timeout bound',r=>r.checks[0].timeoutMs=1],['future execution',r=>r.checks[0].executedAt='9999-01-01T00:00:00Z'],['failed expectation',r=>r.checks[1].expectationMet=false],['log digest',r=>r.checks[0].logSha256=digest('tampered')],['missing raw file',r=>r.files.pop()],['duplicate raw file',r=>r.files[0]=r.files[1]],['raw file digest',r=>r.files[0].sha256=digest('tampered')],['path traversal',r=>r.files[0].path='../outside.log'],['scope drift',r=>r.planInput={}],['input drift',r=>r.inputs[0].sha256=digest('tampered')],['formal claim',r=>r.formalAccepted=true],['target claim',r=>r.databaseExecution=true],['external claim',r=>r.externalExecution=true],['performance claim',r=>r.performanceAccepted=true],['sync adoption',r=>r.syncApproved=true],['local Gate in artifact',r=>r.stageGate='READY'],['wrong producer node',r=>r.nodeId='CORE:TP01-F'],['forged output directory',r=>r.outputDirectory='historical'],['wrong schema',r=>r.schema='quantos-tp01-d-absorption/v1'],
])test('functional receipt rejects '+label,()=>fixture((r,d,verify)=>{mutate(r);assert.throws(verify);}));
for(const[label,path,mutate]of[
 ['tampered log','regressions.log',()=> '23 passed\n'],
 ['inflated regression count with recomputed file hash','regressions.log',s=>s.replace('# tests 23','# tests 230').replace('# pass 23','# pass 230')],
 ['approved monitor with recomputed hash','monitor-blocked/summary.json',s=>JSON.stringify({...JSON.parse(s),syncApproved:true})],
 ['downgraded S0 with recomputed hash','s0-floor/summary.json',s=>{const r=JSON.parse(s);r.decisions[0].severity='S3';return JSON.stringify(r);}],
 ['missing expected input','api-break/input.json',s=>s.replace('apiBreak','ignoredBreak')],
 ['tampered issue','api-break/issues/api-break-s1.md',()=> '# approved'],
])test('copied originals reject '+label,()=>fixture((r,d,verify)=>{const p=resolve(d,path);assert(readFileSync(p).length);writeFileSync(p,mutate(readFileSync(p,'utf8')));const f=r.files.find(f=>f.path===path);f.sha256=digest(readFileSync(p));if(path==='regressions.log')r.checks[0].logSha256=f.sha256;assert.throws(verify);}));
test('missing supporting file cannot use canonical fallback',()=>fixture((r,d,verify)=>{rmSync(resolve(d,'api-break/summary.json'));assert.throws(verify);}));
