import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,writeFileSync,mkdtempSync,cpSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {verifyTp10,selectors,directory} from '../third_party/valuecell/check-development.mjs';
import {digest,inventory,nodesFromPlans,planInput,validateArtifact,supportingArtifactPaths} from './provider-a1-receipts.mjs';
function fixture(fn){const temporary=mkdtempSync(resolve(tmpdir(),'tp10-artifact-'));try{cpSync(directory,temporary,{recursive:true});const r=JSON.parse(readFileSync(resolve(temporary,'receipt.json')));r.inputs=inventory(selectors);r.planInput=planInput(nodesFromPlans().get('CORE:TP10'));fn(r,temporary);}finally{rmSync(temporary,{recursive:true,force:true});}}
test('engineering evidence cannot admit TP10 without the strict dependency closure',()=>fixture((r,logDirectory)=>assert.deepEqual(verifyTp10(r,{checkDependencies:false,logDirectory}),{engineeringStatus:'PASS',stageGate:'NOT_ASSESSED',formalAccepted:false})));
test('all eight raw logs must accompany a copied receipt',()=>fixture(r=>assert.equal(supportingArtifactPaths('tp10-development',r).length,8)));
for(const [name,change]of [
 ['omitted check',r=>r.checks.pop()],['failed execution',r=>r.checks[0].exitCode=1],['fake command',r=>r.checks[0].command=['true']],['source inventory',r=>r.inputs[0].sha256='sha256:'+'0'.repeat(64)],['log digest',r=>r.checks[0].logSha256='sha256:'+'0'.repeat(64)],['formal claim',r=>r.formalAccepted=true],['future execution',r=>r.checks[0].executedAt='9999-01-01T00:00:00Z'],['widened scope',r=>r.excluded=[]],['plan requirement',r=>r.planInput={fake:true}],['missing environment',r=>r.environment={}],
])test('TP10 receipt rejects '+name,()=>fixture((r,logDirectory)=>{change(r);assert.throws(()=>verifyTp10(r,{checkDependencies:false,logDirectory}));}));
test('execution source must match unified manifest',()=>fixture((r,d)=>{const p=resolve(d,'receipt.json');writeFileSync(p,JSON.stringify(r));assert.throws(()=>validateArtifact('tp10-development',p,'0'.repeat(40)),/source differs/);}));
test('copied public provenance log is independently byte-bound',()=>fixture((r,d)=>{const p=resolve(d,'receipt.json');writeFileSync(p,JSON.stringify(r));validateArtifact('tp10-development',p,r.observedSourceCommit);writeFileSync(resolve(d,'upstream.log'),'TP10_PINNED_PUBLIC_DIGESTS_PASS');assert.throws(()=>validateArtifact('tp10-development',p,r.observedSourceCommit),/log changed/);}));
test('engineering status cannot invent dependency readiness',()=>fixture((r,logDirectory)=>{r.status='READY';r.dependencies=[];assert.throws(()=>verifyTp10(r,{logDirectory}));}));

test('invented online metadata rejected even with a refreshed log digest',()=>fixture((r,d)=>{const p=resolve(d,'upstream.log');const log=readFileSync(p,'utf8').replace('2596189052e017732f3751a38e50145ba3895f0c37df6ba2a56d6068d44babbf','0'.repeat(64));writeFileSync(p,log);r.checks.find(c=>c.id==='upstream').logSha256=digest(log);assert.throws(()=>verifyTp10(r,{checkDependencies:false,logDirectory:d}),/public observations differ/);}));
