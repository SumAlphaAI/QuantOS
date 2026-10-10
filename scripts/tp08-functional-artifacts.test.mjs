import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,writeFileSync,mkdtempSync,cpSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {verifyTp08,selectors,directory} from '../third_party/qlib/check-development.mjs';
import {digest,inventory,nodesFromPlans,planInput,validateArtifact,supportingArtifactPaths} from './provider-a1-receipts.mjs';
function fixture(fn){const temporary=mkdtempSync(resolve(tmpdir(),'tp08-artifact-'));try{cpSync(directory,temporary,{recursive:true});const r=JSON.parse(readFileSync(resolve(temporary,'receipt.json')));r.inputs=inventory(selectors);r.planInput=planInput(nodesFromPlans().get('CORE:TP08'));fn(r,temporary);}finally{rmSync(temporary,{recursive:true,force:true});}}
test('engineering-only evidence cannot admit TP08',()=>fixture((r,logDirectory)=>assert.deepEqual(verifyTp08(r,{checkDependencies:false,logDirectory}),{engineeringStatus:'PASS',stageGate:'NOT_ASSESSED',formalAccepted:false})));
test('copied receipt requires all nine logs and seven experiment files',()=>fixture(r=>assert.equal(supportingArtifactPaths('tp08-development',r).length,16)));
for(const [name,change]of [
 ['omitted check',r=>r.checks.pop()],['failed execution',r=>r.checks[0].exitCode=1],['fake command',r=>r.checks[0].command=['true']],['source inventory',r=>r.inputs[0].sha256='sha256:'+'0'.repeat(64)],['log digest',r=>r.checks[0].logSha256='sha256:'+'0'.repeat(64)],['formal claim',r=>r.formalAccepted=true],['future execution',r=>r.checks[0].executedAt='9999-01-01T00:00:00Z'],['omitted output',r=>r.outputs.pop()],['widened scope',r=>r.excluded=[]],
])test('TP08 receipt rejects '+name,()=>fixture((r,logDirectory)=>{change(r);assert.throws(()=>verifyTp08(r,{checkDependencies:false,logDirectory}));}));
test('execution source must match unified manifest',()=>fixture((r,d)=>{const p=resolve(d,'receipt.json');writeFileSync(p,JSON.stringify(r));assert.throws(()=>validateArtifact('tp08-development',p,'0'.repeat(40)),/source differs/);}));
test('copied logs validated independently',()=>fixture((r,d)=>{const p=resolve(d,'receipt.json');writeFileSync(p,JSON.stringify(r));validateArtifact('tp08-development',p,r.observedSourceCommit);writeFileSync(resolve(d,'contract.log'),'40 passed');assert.throws(()=>validateArtifact('tp08-development',p,r.observedSourceCommit),/log changed/);}));
test('tampered object bytes denied even after output digest update',()=>fixture((r,d)=>{const o=r.outputs.find(o=>o.file.includes('/objects/'));writeFileSync(resolve(d,o.file),'{}');o.sha256=digest('{}');assert.throws(()=>verifyTp08(r,{checkDependencies:false,logDirectory:d}));}));
test('forged upstream execution denied after output digest update',()=>fixture((r,d)=>{const o=r.outputs.find(o=>o.file==='experiments/receipt.json'),p=resolve(d,o.file),v=JSON.parse(readFileSync(p));v.upstreamRuntime=true;writeFileSync(p,JSON.stringify(v));o.sha256=digest(readFileSync(p));assert.throws(()=>verifyTp08(r,{checkDependencies:false,logDirectory:d}));}));
