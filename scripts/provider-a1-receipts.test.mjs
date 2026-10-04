import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {validateReceipt,digest,directory,inventory,planInput,captureInputs,assertInputSnapshot,developmentEnvironment,runTargetAttempts,validateReproducibility,policy} from './provider-a1-receipts.mjs';
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

test('source drift during execution invalidates the original input snapshot',()=>fixture(f=>{
 const p=JSON.parse(readFileSync(resolve(f.base,'scripts/provider-a1-policy.json')));const before=captureInputs(f.nodes,['child','parent'],p,f.base);
 writeFileSync(resolve(f.base,'code.ts'),'changed while checks ran');assert.throws(()=>assertInputSnapshot(before,captureInputs(f.nodes,['child','parent'],p,f.base)),/changed during execution/);
}));
test('requirement drift during execution invalidates the original input snapshot',()=>fixture(f=>{
 const p=JSON.parse(readFileSync(resolve(f.base,'scripts/provider-a1-policy.json')));const before=captureInputs(f.nodes,['child','parent'],p,f.base);
 f.nodes.get('child').requirements=['new acceptance scope'];assert.throws(()=>assertInputSnapshot(before,captureInputs(f.nodes,['child','parent'],p,f.base)),/changed during execution/);
}));

test('controlled public development profile overrides stale values and preserves server inputs',()=>{
 const env=developmentEnvironment('NEXT_PUBLIC_QUANTOS_ENV=local-mock\nNEXT_PUBLIC_QUANTOS_TERMINAL_ORIGIN=http://localhost:3100',{NEXT_PUBLIC_QUANTOS_TERMINAL_ORIGIN:'http://localhost:3190'},{DATABASE_URL:'private-fixture',NEXT_PUBLIC_QUANTOS_ENV:'staging',NEXT_PUBLIC_UNDECLARED:'stale'});
 assert.equal(env.NEXT_PUBLIC_QUANTOS_ENV,'local-mock');assert.equal(env.NEXT_PUBLIC_QUANTOS_TERMINAL_ORIGIN,'http://localhost:3190');assert.equal(env.DATABASE_URL,'private-fixture');assert.equal(env.NEXT_PUBLIC_UNDECLARED,undefined);
});
test('private credentials cannot be injected through a public development profile',()=>{
 assert.throws(()=>developmentEnvironment('DATABASE_URL=private'),/public variables only/);assert.throws(()=>developmentEnvironment('NEXT_PUBLIC_QUANTOS_ENV=local-mock',{PRIVATE_TOKEN:'private'}),/public variables only/);
});

test('transient Auth 503 can retry only a complete target execution',()=>{let n=0;const runs=runTargetAttempts(()=>++n===1?{status:1,diagnostic:'session handshake returned HTTP 503'}:{status:0});assert.equal(runs.length,2);assert.equal(runs[0].status,1);assert.equal(runs[1].status,0);});
test('persistent target timeout never becomes PASS and stops at its budget',()=>{let n=0;const runs=runTargetAttempts(()=>{n++;return {status:1,diagnostic:'operation was aborted due to timeout'};});assert.equal(n,3);assert(runs.every(r=>r.status!==0));});
test('semantic target failures stop without retry or PASS',()=>{let n=0;const runs=runTargetAttempts(()=>{n++;return {status:1,diagnostic:'non-owner Runtime identity registered a tool'};});assert.equal(n,1);assert.equal(runs[0].status,1);});
test('target retry budget cannot be unbounded',()=>{for(const n of [0,4,Infinity,1.5])assert.throws(()=>runTargetAttempts(()=>({status:0}),n),/attempt budget/);});

test('configured target retries require explicit attempt outcomes in the receipt',()=>fixture(f=>{
 const path=resolve(f.base,'scripts/provider-a1-policy.json');const p=JSON.parse(readFileSync(path));p.checks.actual.target=true;p.checks.actual.maxAttempts=3;writeFileSync(path,JSON.stringify(p));
 const m=f.read('parent');m.inputs=inventory([...p.commonInputs,...p.nodes.parent.inputs],f.base);f.store('parent',m);assert.throws(f.validate,/attempt outcomes missing/);
}));

function reproducibleFixture(){
 const files=[{path:'built',sha256:'b'.repeat(64),sizeBytes:10}];const output={files,sha256:createHash('sha256').update(JSON.stringify(files)).digest('hex')};const outputs={rust:output,python:output,typescript:[output]};
 return {schemaVersion:2,mode:'reproducibility',status:'PASS',passed:true,reproducible:true,source:{commit:'a'.repeat(40),dirty:false},runs:[1,2,3].map(run=>({run,commands:[['make',['bootstrap']],['cargo',['build','--workspace','--release','--locked']],['pnpm',['build']],['make',['build-python']]].map(([binary,args])=>({binary,args,exitCode:0})),...outputs,combinedSha256:createHash('sha256').update(JSON.stringify(outputs)).digest('hex')}))};
}
test('three successful full builds bind output inventories',()=>validateReproducibility(reproducibleFixture(),'a'.repeat(40)));
for(const [name,mutate]of [
 ['only two builds',r=>r.runs.pop()],['missing Python build',r=>r.runs[1].commands.pop()],['failed command',r=>r.runs[2].commands[0].exitCode=1],['different output digest',r=>r.runs[1].combinedSha256='c'.repeat(64)],['substituted inventory',r=>r.runs[0].rust.files[0].sha256='d'.repeat(64)],['dirty source',r=>r.source.dirty=true],['old source',r=>r.source.commit='e'.repeat(40)]
])test('reproducibility rejects '+name,()=>{const r=reproducibleFixture();mutate(r);assert.throws(()=>validateReproducibility(r,'a'.repeat(40)));});
test('development policy retains explicit build, coverage, volume and target storage obligations',()=>{
 const p=policy();for(const [node,checks]of [['CORE:F01',['f01-reproducibility','f01-lint','f01-test']],['CORE:F04',['f04-branch-coverage']],['CORE:F05',['f05-volume','storage-database','storage-target','rls-target']]])for(const check of checks)assert(p.nodes[node].checks.includes(check),node+' missing '+check);
 assert(p.checks['f05-volume'].database);assert(p.checks['storage-target'].database);assert(!p.excluded.some(e=>/volume|10000|10,000|three.*build/i.test(e)));
});
