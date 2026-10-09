import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,writeFileSync,mkdtempSync,cpSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {verifyAbsorption,selectors,directory} from '../engines/vibe-adapter/check-absorption.mjs';
import {inventory,nodesFromPlans,planInput,validateArtifact,supportingArtifactPaths} from './provider-a1-receipts.mjs';
function fixture(fn){const temporary=mkdtempSync(resolve(tmpdir(),'tp01-d-artifact-'));try{cpSync(directory,temporary,{recursive:true});const r=JSON.parse(readFileSync(resolve(temporary,'receipt.json')));r.inputs=inventory(selectors);r.planInput=planInput(nodesFromPlans().get('CORE:TP01-D'));fn(r,temporary);}finally{rmSync(temporary,{recursive:true,force:true});}}
test('engineering-only validation never grants TP01-D admission',()=>fixture((r,logDirectory)=>assert.deepEqual(verifyAbsorption(r,{checkDependencies:false,logDirectory}),{engineeringStatus:'PASS',stageGate:'NOT_ASSESSED',formalAccepted:false})));
test('all copied supporting logs are required',()=>fixture(r=>assert.deepEqual(supportingArtifactPaths('tp01-d-absorption',r),['format.log','queue.log','replay.log','runtime.log'])));
for(const [name,change]of [
 ['omitted check',r=>r.checks.pop()],
 ['failed execution',r=>r.checks[0].exitCode=1],
 ['fake command',r=>r.checks[0].command=['true']],
 ['source inventory',r=>r.inputs[0].sha256='sha256:'+'0'.repeat(64)],
 ['log digest',r=>r.checks[0].logSha256='sha256:'+'0'.repeat(64)],
 ['fixture omission',r=>r.fixtures.pop()],
 ['queue drift',r=>r.queue.upstream='0'.repeat(40)],
 ['formal claim',r=>r.formalAccepted=true],
 ['future execution',r=>r.checks[0].executedAt='9999-01-01T00:00:00Z'],
])test('TP01-D artifact rejects '+name,()=>fixture((r,logDirectory)=>{change(r);assert.throws(()=>verifyAbsorption(r,{checkDependencies:false,logDirectory}));}));
test('source commit must match execution manifest',()=>fixture((r,d)=>{const p=resolve(d,'receipt.json');writeFileSync(p,JSON.stringify(r));assert.throws(()=>validateArtifact('tp01-d-absorption',p,'0'.repeat(40)),/source differs/);}));
test('copied logs are validated independently of mutable canonical logs',()=>fixture((r,d)=>{const p=resolve(d,'receipt.json');writeFileSync(p,JSON.stringify(r));validateArtifact('tp01-d-absorption',p,r.observedSourceCommit);writeFileSync(resolve(d,'replay.log'),'44 passed');assert.throws(()=>validateArtifact('tp01-d-absorption',p,r.observedSourceCommit),/log changed/);}));
