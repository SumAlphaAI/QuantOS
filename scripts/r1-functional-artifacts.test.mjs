import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,readFileSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
const {retainedSourcePolicy}=createRequire(import.meta.url)('./r02-retained-source-policy.cjs');
import {validateR1Artifact,evidenceInventory,hash} from './r1-functional-artifacts.mjs';
import {policy,root,nodesFromPlans,captureInputs,closure} from './provider-a1-receipts.mjs';
const source='a'.repeat(40);
const syntheticBootstrap=()=>({schema:'quantos-postgres-bootstrap/v1',phase:'BEFORE_STATEMENTS',maxAttempts:3,status:'PASS',attempts:[{attempt:1,status:'PASS',transient:false,elapsedMs:1}],connectionClosed:true,transportErrors:[]});
function fixture(fn){const base=mkdtempSync(resolve(tmpdir(),'quantos-r1-artifact-'));try{
 cpSync(resolve(root,'docs/audit/evidence/r02-partial-remediation-20261008/coverage-attempt03'),resolve(base,'target'),{recursive:true});
 const json=n=>JSON.parse(readFileSync(resolve(base,'target',n)));
 const write=(n,r)=>writeFileSync(resolve(base,'target',n),JSON.stringify(r));
 // Synthetic receipt validation fixtures: current code hashes, historical target outcomes.
 for(const n of ['chain/receipt.json','boundaries/receipt.json']){const r=json(n);r.sourceFiles=r.sourceFiles.map(f=>({...f,sha256:hash(readFileSync(resolve(root,f.path))).slice(7)}));r.cleanupBootstrapConnection=syntheticBootstrap();if(n.startsWith('chain/'))r.bootstrapConnection=syntheticBootstrap();write(n,r);}
 const receipt={schema:'quantos-r1-development-target/v1',nodeId:'CORE:R02',sourceCommit:source,status:'PASS',target:'configured-supabase',formalAccepted:false,ingestionStarted:false,release:'NOT_RUN_RELEASE_STAGE',exitCode:0};
 const save=()=>{receipt.evidence=evidenceInventory(base);writeFileSync(resolve(base,'receipt.json'),JSON.stringify(receipt));};save();
 fn({base,json,write,receipt,save,validate:()=>validateR1Artifact('r02-target',resolve(base,'receipt.json'),source,{sourcePolicy:()=>retainedSourcePolicy({now:Date.parse('2026-10-08T00:00:00Z')})})});
}finally{rmSync(base,{recursive:true,force:true});}}
test('full target outcomes, cleanup and coverage bind development scope',()=>fixture(f=>assert.equal(f.validate().status,'PASS')));
for(const [name,mutate] of [
 ['missing initial bootstrap',f=>{const r=f.json('chain/receipt.json');delete r.bootstrapConnection;f.write('chain/receipt.json',r);}],
 ['unclosed preparation connection',f=>{const r=f.json('chain/receipt.json');r.bootstrapConnection.connectionClosed=false;f.write('chain/receipt.json',r);}],
 ['post-SQL transport reset',f=>{const r=f.json('chain/receipt.json');r.bootstrapConnection.transportErrors=[{afterStatements:true,code:'ECONNRESET'}];f.write('chain/receipt.json',r);}],
 ['unclosed actor cleanup connection',f=>{const r=f.json('chain/receipt.json');r.cleanupBootstrapConnection.connectionClosed=false;f.write('chain/receipt.json',r);}],
 ['missing boundary cleanup bootstrap',f=>{const r=f.json('boundaries/receipt.json');delete r.cleanupBootstrapConnection;f.write('boundaries/receipt.json',r);}],
 ['failed combined execution',f=>{const r=f.json('receipt.json');r.steps[1].exitCode=1;f.write('receipt.json',r);}],
 ['failed actor cleanup',f=>{const r=f.json('chain/receipt.json');r.cleanup.actor.is_active=true;f.write('chain/receipt.json',r);}],
 ['no boundary actors',f=>{const r=f.json('boundaries/receipt.json');r.cleanup.actors=[];f.write('boundaries/receipt.json',r);}],
 ['new provider run',f=>{const r=f.json('chain/receipt.json');r.ingestionStarted=true;f.write('chain/receipt.json',r);}],
 ['fresh quality claim',f=>{const r=f.json('chain/chain-result.json');r.quality='fresh';f.write('chain/chain-result.json',r);}],
 ['engine left running',f=>{const r=f.json('chain/chain-result.json');r.engineStopped=false;f.write('chain/chain-result.json',r);}],
 ['wrong target',f=>{const r=f.json('boundaries/receipt.json');r.target='local';f.write('boundaries/receipt.json',r);}],
 ['release claimed',f=>{f.receipt.release='PASS';}],
 ['wrong execution SHA',f=>{f.receipt.sourceCommit='b'.repeat(40);}],
 ['missing approval',f=>{const r=f.json('chain/source-policy.json');r.approvals=[];f.write('chain/source-policy.json',r);}],
 ['changed source',f=>{const r=f.json('chain/receipt.json');r.sourceFiles[0].sha256='b'.repeat(64);f.write('chain/receipt.json',r);}],
 ['skipped target test',f=>{const r=f.json('boundaries/receipt.json');r.tests[0].code=null;f.write('boundaries/receipt.json',r);}],
 ['under threshold coverage',f=>{const r=f.json('boundaries/coverage.json');r.data[0].files.find(f=>f.filename.endsWith('/crates/quantos-storage/src/pg.rs')).summary.lines.covered=0;f.write('boundaries/coverage.json',r);}],
])test('reject '+name,()=>fixture(f=>{mutate(f);f.save();assert.throws(f.validate);}));
test('tampered nested log rejected without changing outcome labels',()=>fixture(f=>{writeFileSync(resolve(f.base,'target/chain/target-chain.log'),'arbitrary');assert.throws(f.validate,/evidence/);}));
test('nested path escape rejected',()=>fixture(f=>{rmSync(resolve(f.base,'target/chain/target-chain.log'));symlinkSync('/etc/hosts',resolve(f.base,'target/chain/target-chain.log'));assert.throws(f.save,/escapes/);}));
test('R1 controlled policies cover the complete dependency closure',()=>{const nodes=nodesFromPlans(),p=policy();const selected=closure(nodes,'CORE:R02');assert(selected.includes('CORE:R01')&&selected.includes('CORE:F06')&&selected.includes('CORE-GATE:F0'));assert.equal(captureInputs(nodes,selected).size,selected.length);for(const [n,c]of [['CORE:R01','r01-target'],['CORE:R02','r02-target']]){assert(p.nodes[n].checks.includes(c));assert(p.checks[c].database&&p.checks[c].output);}assert(p.nodes['CORE:R02'].scope.includes('RELEASE-GATE:BETA'));});

function r01Fixture(fn){const base=mkdtempSync(resolve(tmpdir(),'quantos-r01-artifact-'));try{
 const historical=resolve(root,'docs/audit/evidence/r01-freshness-remediation-20261004/target-stable-attempt-06');cpSync(historical,resolve(base,'target'),{recursive:true});
 const json=n=>JSON.parse(readFileSync(resolve(base,'target',n))),write=(n,r)=>writeFileSync(resolve(base,'target',n),JSON.stringify(r));
 const t=json('target-receipt.json');t.sourceCommit=source;t.sourceHashes=Object.fromEntries(Object.keys(t.sourceHashes).map(p=>[p,hash(readFileSync(resolve(root,p))).slice(7)]));write('target-receipt.json',t);write('source-before.json',t.sourceHashes);
 const coverage=JSON.parse(gunzipSync(readFileSync(resolve(base,'target/coverage.json.gz'))));write('coverage.json',coverage);
 const receipt={schema:'quantos-r1-development-target/v1',nodeId:'CORE:R01',sourceCommit:source,status:'PASS',target:'configured-supabase',formalAccepted:false,ingestionStarted:false,release:'NOT_RUN_RELEASE_STAGE',exitCode:0};
 const save=()=>{receipt.evidence=evidenceInventory(base);writeFileSync(resolve(base,'receipt.json'),JSON.stringify(receipt));};save();fn({json,write,save,validate:()=>validateR1Artifact('r01-target',resolve(base,'receipt.json'),source)});
}finally{rmSync(base,{recursive:true,force:true});}}
test('R01 target and production coverage independently validate',()=>r01Fixture(f=>assert.equal(f.validate().status,'PASS')));
for(const [name,mutate] of [
 ['vacuous actor cleanup',f=>{const c=f.json('actor-cleanup.json');c.actors=[];f.write('actor-cleanup.json',c);}],
 ['uncommitted outbox',f=>{const t=f.json('target-receipt.json');t.counts.outbox=0;f.write('target-receipt.json',t);}],
 ['fixture claimed as real provider',f=>{const t=f.json('target-receipt.json');t.provider='binance';f.write('target-receipt.json',t);}],
 ['RLS failed',f=>{const t=f.json('target-receipt.json');t.rls='FAIL';f.write('target-receipt.json',t);}],
 ['migration mismatched',f=>{const t=f.json('target-receipt.json');t.migrationHash='b'.repeat(64);f.write('target-receipt.json',t);}],
])test('R01 reject '+name,()=>r01Fixture(f=>{mutate(f);f.save();assert.throws(f.validate);}));

function cleanupFixture(fn){const base=mkdtempSync(resolve(tmpdir(),'quantos-r1-process-artifact-'));try{const file=resolve(base,'receipt.json'),now=new Date().toISOString();const r={schema:'quantos-r1-process-cleanup/v1',sourceCommit:source,scopeTag:'1234abcd',baselineCapturedAt:now,checkedAt:now,platform:'linux',processCheckingExecuted:true,status:'PASS',formalAccepted:false,discovered:[],remaining:[]};fn(r,()=>{writeFileSync(file,JSON.stringify(r));return validateR1Artifact('r1-process-cleanup',file,source);});}finally{rmSync(base,{recursive:true,force:true});}}
test('real process inventory outcome is separately required by R02',()=>cleanupFixture((_,validate)=>assert.equal(validate().status,'PASS')));
for(const [name,mutate]of [
 ['leak cleaned after discovery',r=>{r.discovered=[{pid:1}];}],
 ['process inspection skipped',r=>{r.processCheckingExecuted=false;}],
 ['residual child left alive',r=>{r.remaining=[{pid:1}];}],
 ['failed cleanup relabeled',r=>{r.status='FAIL';}],
 ['unbounded ownership scope',r=>{r.scopeTag='';}],
 ['wrong source',r=>{r.sourceCommit='b'.repeat(40);}],
 ['missing baseline capture',r=>{delete r.baselineCapturedAt;}],
])test('process cleanup reject '+name,()=>cleanupFixture((r,validate)=>{mutate(r);assert.throws(validate);}));
