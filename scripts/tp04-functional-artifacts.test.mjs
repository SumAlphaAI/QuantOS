import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,writeFileSync,mkdtempSync,cpSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {verifyTp04,verifyPythonSuiteSummary,selectors,directory} from '../engines/trading-agents/check-development.mjs';
import {digest,inventory,nodesFromPlans,planInput,validateArtifact,supportingArtifactPaths} from './provider-a1-receipts.mjs';
function fixture(fn){const temporary=mkdtempSync(resolve(tmpdir(),'tp04-artifact-'));try{cpSync(directory,temporary,{recursive:true});const r=JSON.parse(readFileSync(resolve(temporary,'receipt.json')));r.inputs=inventory(selectors);r.planInput=planInput(nodesFromPlans().get('CORE:TP04'));fn(r,temporary);}finally{rmSync(temporary,{recursive:true,force:true});}}
test('engineering-only evidence cannot admit TP04',()=>fixture((r,logDirectory)=>assert.deepEqual(verifyTp04(r,{checkDependencies:false,logDirectory}),{engineeringStatus:'PASS',stageGate:'NOT_ASSESSED',formalAccepted:false})));
test('all execution logs and installed wheels must travel with a copied receipt',()=>fixture(r=>{const paths=supportingArtifactPaths('tp04-development',r);assert.equal(paths.length,16);assert.equal(paths.filter(p=>p.startsWith('wheels/')).length,2);}));
for(const [name,change]of [
 ['omitted check',r=>r.checks.pop()],['failed execution',r=>r.checks[0].exitCode=1],['fake command',r=>r.checks[0].command=['true']],['source inventory',r=>r.inputs[0].sha256='sha256:'+'0'.repeat(64)],['log digest',r=>r.checks[0].logSha256='sha256:'+'0'.repeat(64)],['fixture omission',r=>r.fixtures.pop()],['formal claim',r=>r.formalAccepted=true],['future execution',r=>r.checks[0].executedAt='9999-01-01T00:00:00Z'],['unreaped package child',r=>r.package.ownedChildReaped=false],['editable package claim',r=>r.package.installedIsolated=false],['upstream claim',r=>r.package.realUpstreamRuntime=true],
])test('TP04 receipt rejects '+name,()=>fixture((r,logDirectory)=>{change(r);assert.throws(()=>verifyTp04(r,{checkDependencies:false,logDirectory}));}));
test('execution source must match unified manifest',()=>fixture((r,d)=>{const p=resolve(d,'receipt.json');writeFileSync(p,JSON.stringify(r));assert.throws(()=>validateArtifact('tp04-development',p,'0'.repeat(40)),/source differs/);}));
test('copied logs are independent of canonical logs',()=>fixture((r,d)=>{const p=resolve(d,'receipt.json');writeFileSync(p,JSON.stringify(r));validateArtifact('tp04-development',p,r.observedSourceCommit);writeFileSync(resolve(d,'contract.log'),'129 passed');assert.throws(()=>validateArtifact('tp04-development',p,r.observedSourceCommit),/log changed/);}));
test('tampered wheel bytes are rejected',()=>fixture((r,logDirectory)=>{writeFileSync(resolve(logDirectory,'wheels',r.package.wheels[0].file),'fake');assert.throws(()=>verifyTp04(r,{checkDependencies:false,logDirectory}),/wheel changed/);}));

for(const [name,mutate]of [
 ['URI collision',r=>r[0].artifacts[1].uri=r[0].artifacts[0].uri],['matrix sample omission',r=>r.pop()],['Proposal confidence',r=>r[0].output.confidence.value='2'],['Proposal time',r=>r[0].output.expires_at='invalid'],['Proposal executable claim',r=>r[0].output.executable=true],
])test('actual output evidence rejects '+name,()=>fixture((r,d)=>{const p=resolve(d,'proposal-matrix.json');const value=JSON.parse(readFileSync(p));mutate(value);const bytes=JSON.stringify(value);writeFileSync(p,bytes);r.outputs.find(x=>x.file==='proposal-matrix.json').sha256=digest(bytes);assert.throws(()=>verifyTp04(r,{checkDependencies:false,logDirectory:d}));}));
for(const [name,mutate]of [['cancel timeout',v=>v.elapsedMs=2000],['cancel side effect',v=>v.artifactDelta=1]])test('UI transcript rejects '+name,()=>fixture((r,d)=>{const p=resolve(d,'ui-cancel.json');const value=JSON.parse(readFileSync(p));mutate(value);const bytes=JSON.stringify(value);writeFileSync(p,bytes);r.outputs.find(x=>x.file==='ui-cancel.json').sha256=digest(bytes);assert.throws(()=>verifyTp04(r,{checkDependencies:false,logDirectory:d}));}));

for(const [name,summary,allowed]of [
 ['original baseline','1002 passed in 10.0s',true],
 ['expanded suite','1366 passed in 10.0s',true],
 ['expanded suite with warning','1367 passed, 1 warning in 10.0s',true],
 ['below baseline','1001 passed in 10.0s',false],
 ['failed suite','1002 passed, 1 failed in 10.0s',false],
 ['collection error','1002 passed, 1 error in 10.0s',false],
 ['skipped suite','1002 passed, 1 skipped in 10.0s',false],
 ['deselected suite','1002 passed, 1 deselected in 10.0s',false],
 ['interrupted trailer','1002 passed in 10.0s\nINTERRUPTED',false],
 ['earlier failure','1 failed in 1.0s\n1002 passed in 10.0s',false],
 ['empty suite','no tests ran',false],
])test('full Python regression '+name,()=>fixture((r,d)=>{
 const c=r.checks.find(c=>c.id==='python');writeFileSync(resolve(d,'python.log'),summary);c.logSha256=digest(summary);
 if(allowed)verifyTp04(r,{checkDependencies:false,logDirectory:d});
 else assert.throws(()=>verifyTp04(r,{checkDependencies:false,logDirectory:d}));
}));
test('full Python receipt rejects a narrowed suite command',()=>fixture((r,d)=>{
 r.checks.find(c=>c.id==='python').command=['engines/.venv/bin/python','-m','pytest','engines/tests/test_trading_agents_contract.py','-q'];
 assert.throws(()=>verifyTp04(r,{checkDependencies:false,logDirectory:d}));
}));
test('full Python summary retains baseline and permits real suite growth',()=>{
 assert.equal(verifyPythonSuiteSummary('...\n1002 passed in 1.00s\n'),1002);
 assert.equal(verifyPythonSuiteSummary('...\r\n1366 passed in 9.25s\r\n'),1366);
 assert.equal(verifyPythonSuiteSummary('1367 passed, 2 warnings in 60.00s (0:01:00)'),1367);
});
for(const summary of ['1002 passed','1002.5 passed in 1.0s','1002 passed, 1 xfailed in 1.0s','1002 passed, 1 xpassed in 1.0s','1002 passed in 1.0s\n1 failed','ERROR collecting tests\n0 passed in 1.0s'])
 test('full Python summary rejects incomplete output: '+summary,()=>assert.throws(()=>verifyPythonSuiteSummary(summary)));
