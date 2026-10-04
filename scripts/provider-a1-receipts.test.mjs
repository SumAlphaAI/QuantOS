import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {validateReceipt,digest,directory,inventory,planInput} from './provider-a1-receipts.mjs';
function fixture(fn){const base=mkdtempSync(resolve(tmpdir(),'quantos-stage-receipt-'));try{
 execFileSync('git',['init','-q'],{cwd:base});mkdirSync(resolve(base,'scripts'));mkdirSync(resolve(base,directory,'logs'),{recursive:true});writeFileSync(resolve(base,'code.ts'),'trusted code');
 const spec={scope:'implemented functionality only',inputs:['code.ts'],checks:['actual']};const p={commonInputs:['scripts/provider-a1-policy.json'],excluded:['release'],nodes:{child:spec,parent:spec},checks:{actual:{command:['node','run.mjs'],marker:'ACTUAL_PASS'}}};writeFileSync(resolve(base,'scripts/provider-a1-policy.json'),JSON.stringify(p));const nodes=new Map([['child',{id:'child',dependencies:[]}],['parent',{id:'parent',dependencies:['child']}]]);
 function store(id,m){const path=directory+'/'+id+'.json';const bytes=JSON.stringify(m);writeFileSync(resolve(base,path),bytes);nodes.get(id).stage_gate={stage:'DEVELOPMENT',status:'READY',input_digest:digest(bytes),evidence:[path.slice(5)]};return m;}
 for(const [id,n]of nodes){const log=directory+'/logs/'+id+'.log';writeFileSync(resolve(base,log),'ACTUAL_PASS');store(id,{schema:'quantos-stage-functional-manifest/v1',nodeId:id,stage:'DEVELOPMENT',status:'PASS',scope:spec.scope,formalAccepted:false,observedSourceCommit:'a'.repeat(40),environment:{node:'24',pnpm:'10',rust:'1.91',platform:'test'},planInput:planInput(n),inputs:inventory([...p.commonInputs,...spec.inputs],base),checks:[{id:'actual',command:['node','run.mjs'],exitCode:0,status:'PASS',executedAt:new Date().toISOString(),log,logSha256:digest('ACTUAL_PASS')}],dependencies:n.dependencies.map(dep=>({nodeId:dep,inputDigest:nodes.get(dep).stage_gate.input_digest,manifest:'docs/'+nodes.get(dep).stage_gate.evidence[0]})),excluded:['release'],residuals:[]});}
 const read=id=>JSON.parse(readFileSync(resolve(base,directory,id+'.json')));fn({base,nodes,read,store,validate:()=>validateReceipt('parent',{base,nodes})});
}finally{rmSync(base,{recursive:true,force:true});}}
test('valid source and execution-bound dependency chain is READY without release signatures',()=>fixture(f=>assert.equal(f.validate().status,'READY')));
for(const [name,change,pattern]of [
 ['missing required execution',m=>m.checks=[],/required functional checks/],['failed execution',m=>m.checks[0].exitCode=1,/failed or unexecuted/],['wrong actual command',m=>m.checks[0].command=['true'],/actual command/],['unresolved issue',m=>m.residuals=['open'],/unresolved/],['wrong node',m=>m.nodeId='other',/other/],['missing source inventory',m=>m.inputs=[],/inventory/],['plan scope changed',m=>m.planInput={fake:true},/plan inputs/],['outside log path',m=>m.checks[0].log='code.ts',/log outside/],['wrong log digest',m=>m.checks[0].logSha256=digest('fake'),/log content/],['missing dependency',m=>m.dependencies=[],/dependency receipt inventory/],['dependency digest substituted',m=>m.dependencies[0].inputDigest=digest('fake'),/dependency receipt changed/],
])test(name,()=>fixture(f=>{const m=f.read('parent');change(m);f.store('parent',m);assert.throws(f.validate,pattern);}));
test('tampered manifest bytes are rejected',()=>fixture(f=>{writeFileSync(resolve(f.base,directory,'parent.json'),'{}');assert.throws(f.validate,/manifest digest/);}));
test('changed source content is rejected despite unchanged gate digest',()=>fixture(f=>{writeFileSync(resolve(f.base,'code.ts'),'tampered');assert.throws(f.validate,/content changed/);}));
test('dependency must independently be READY',()=>fixture(f=>{f.nodes.get('child').stage_gate.status='NOT_ASSESSED';assert.throws(f.validate,/unready dependency/);}));
test('arbitrary log cannot masquerade as successful execution',()=>fixture(f=>{const m=f.read('parent');writeFileSync(resolve(f.base,m.checks[0].log),'arbitrary audit prose');m.checks[0].logSha256=digest('arbitrary audit prose');f.store('parent',m);assert.throws(f.validate,/execution marker/);}));
test('input file symlink cannot escape the repository',()=>fixture(f=>{rmSync(resolve(f.base,'code.ts'));symlinkSync('/etc/hosts',resolve(f.base,'code.ts'));assert.throws(f.validate,/escapes repository/);}));

test('database execution cannot be inferred from a normal local PASS',()=>fixture(f=>{
 const path=resolve(f.base,'scripts/provider-a1-policy.json');const p=JSON.parse(readFileSync(path));p.checks.actual.database=true;writeFileSync(path,JSON.stringify(p));
 const m=f.read('parent');m.inputs=inventory([...p.commonInputs,...p.nodes.parent.inputs],f.base);f.store('parent',m);assert.throws(f.validate,/actual database execution missing/);
}));
test('Supabase target receipt verifies each compressed execution log',()=>fixture(f=>{
 const path=resolve(f.base,'scripts/provider-a1-policy.json');const p=JSON.parse(readFileSync(path));p.checks.actual.target=true;writeFileSync(path,JSON.stringify(p));
 const m=f.read('parent');m.inputs=inventory([...p.commonInputs,...p.nodes.parent.inputs],f.base);
 const receipt={schema:'quantos-f06-target-acceptance/v2',status:'PASS',targetClass:'configured-test-supabase-local-services',sourceCommit:m.observedSourceCommit,failures:[],realOidcBff:{status:'PASS'},executionRoleAndVault:{status:'PASS'},denialMatrix:{status:'PASS'},evidence:['build','preflight','auth-bff','auth-runtime','execution','vault','database'].map(name=>({name,exit_code:0,logGzipBase64:gzipSync('executed').toString('base64'),logSha256:createHash('sha256').update('executed').digest('hex')}))};receipt.evidence[0].logSha256='0'.repeat(64);
 const target=directory+'/target.json';writeFileSync(resolve(f.base,target),JSON.stringify(receipt));Object.assign(m.checks[0],{target:'configured-supabase',targetEvidence:target,targetEvidenceSha256:digest(readFileSync(resolve(f.base,target)))});f.store('parent',m);assert.throws(f.validate,/target execution log digest mismatch/);
}));
