import test from 'node:test';
import assert from 'node:assert/strict';
import {prerequisites,dependencies,verifyTarget} from './r03-stage-check.mjs';
function target(){const output={trade_executable:false};return {t:{schema:'quantos-r03-target/v1',status:'PASS',target:'configured-supabase',fixture:true,formalAccepted:false,providerIngestion:false,production:false,exitCode:0,timedOut:false,cleanup:{status:'PASS',pending:0,active:0},persistence:{succeeded:11,cancelled:2,artifactBindings:11,costUnits:11,recoveryDuplicateCost:0}},l:{status:'PASS',formalAccepted:false,fixture:true,uniqueInputHashes:1,runs:Array.from({length:10},(_,i)=>({workflow_run_id:String(i),input_hash:'same',evidence_refs:[{}],stream_events:[{},{},{}],output,artifact_manifest:{content_hash:'sha256:96c55da3a9dd0501b197f67f71d1e53a8e53369e68f39c403c9ecaa3ef81b6ae'}})),queuedCancellationMs:5,runningCancellationMs:8,recovery:'independent-process-without-engine',crossTenantAndActor:'REJECTED',staleLease:'REJECTED'}};}
// Derive the byte hash here; assertions below exercise acceptance semantics.
import {hash} from './r03-stage-check.mjs';
function fixture(){const f=target();for(const r of f.l.runs)r.artifact_manifest.content_hash=hash(Buffer.from(JSON.stringify(r.output)));return f;}
test('scoped target accepts actual facts without granting prerequisites',()=>{const f=fixture();assert(verifyTarget(f.t,f.l));const deps=dependencies({nodes:new Map(),validate:()=>{throw Error('stale input');}});assert.equal(deps.length,5);assert(deps.every(d=>d.status==='BLOCKED'));assert.deepEqual(deps.map(d=>d.nodeId),prerequisites);});
for(const [name,mutate]of [
 ['no database execution',f=>f.t.target='local-static'],['production claim',f=>f.t.production=true],['formal claim',f=>f.t.formalAccepted=true],
 ['cleanup missing',f=>f.t.cleanup.status='FAIL'],['leaked run',f=>f.t.cleanup.pending=1],['fake ten runs',f=>f.l.runs.pop()],
 ['duplicate run',f=>f.l.runs[1].workflow_run_id=f.l.runs[0].workflow_run_id],['unstable hash',f=>f.l.runs[1].input_hash='different'],
 ['missing evidence',f=>f.l.runs[0].evidence_refs=[]],['cancel too slow',f=>f.l.runningCancellationMs=2001],['fake restart',f=>f.l.recovery='in-memory-clone'],
 ['cross tenant accepted',f=>f.l.crossTenantAndActor='PASS'],['stale worker accepted',f=>f.l.staleLease='PASS'],['duplicate cost',f=>f.t.persistence.recoveryDuplicateCost=1],['wrong artifact bytes',f=>f.l.runs[0].artifact_manifest.content_hash='sha256:fake'],
])test(name+' is rejected',()=>{const f=fixture();mutate(f);assert.throws(()=>verifyTarget(f.t,f.l));});

import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {checks,verifyLocal,releaseHandoff,requireRelease} from './r03-stage-check.mjs';
import {nodesFromPlans,planInput,localDeferred} from './provider-a1-receipts.mjs';
function localFixture(fn){const base=mkdtempSync(resolve(tmpdir(),'quantos-r03-local-unit-'));try {
 const nodes=nodesFromPlans();for(const id of prerequisites)nodes.get(id).stage_gate={stage:'DEVELOPMENT',status:'NOT_ASSESSED',input_digest:null,evidence:[]};const source='a'.repeat(40),projection={observedSourceCommit:source,inputDigest:hash('index'),nodes:prerequisites.map(nodeId=>({nodeId,inputDigest:hash(nodeId)}))};
 const r={schema:'quantos-r03-development/v2',nodeId:'CORE:R03',stage:'DEVELOPMENT',profile:'R03_LOCAL',status:'READY',engineeringStatus:'PASS',formalAccepted:false,databaseExecution:false,production:false,observedSourceCommit:source,inputs:[],planInput:planInput(nodes.get('CORE:R03')),localPrerequisites:{manifest:'unit-index.json',inputDigest:projection.inputDigest},dependencies:projection.nodes.map(n=>({...n,status:'LOCAL_READY',owner:'CORE:R03'})),release:{checkpoint:'RELEASE-GATE:BETA',status:'NOT_RUN',handoff:releaseHandoff,prerequisiteChecks:localDeferred(nodes)}};
 r.checks=checks.map(c=>{const output=c.id==='tp02'?'131 passed':c.id==='engines'?'2 passed; 0 failed':c.id==='clippy'?'Finished `dev` profile':c.id==='plans'?'"stage_contract": "PASS"':c.id==='gate-negatives'?'ℹ fail 0':'test result: ok';const log=c.id+'.log';writeFileSync(resolve(base,log),output);return {id:c.id,command:c.command,status:'PASS',exitCode:0,executedAt:new Date().toISOString(),log,logSha256:hash(output)};});
 const cleanup=JSON.stringify({schema:'quantos-r1-process-cleanup/v1',status:'PASS',sourceCommit:source,discovered:[],remaining:[],processCheckingExecuted:true,formalAccepted:false});writeFileSync(resolve(base,'cleanup.json'),cleanup);r.cleanup={manifest:'cleanup.json',inputDigest:hash(cleanup)};
 fn({r,nodes,projection,base,verify:()=>verifyLocal(r,{base,nodes,currentInputs:[],validateLocal:()=>projection})});
}finally{rmSync(base,{recursive:true,force:true});}}
test('R03 local functionality is READY while upstream Supabase gates remain unassessed',()=>localFixture(f=>{assert(f.r.dependencies.every(d=>f.nodes.get(d.nodeId).stage_gate.status!=='READY'));const v=f.verify();assert.equal(v.stageGate,'READY');assert.equal(v.databaseAcceptance,'NOT_RUN');assert.equal(v.formalAccepted,false);assert.throws(()=>requireRelease(f.r,{nodes:f.nodes}),/target evidence NOT RUN/);}));
for(const [name,mutate]of [
 ['missing functional command',f=>f.r.checks.pop()],['failed functional execution',f=>f.r.checks[0].exitCode=1],
 ['changed source',f=>f.r.inputs=[{path:'tampered'}]],['changed policy scope',f=>f.r.planInput={}],
 ['database PASS inferred',f=>f.r.databaseExecution=true],['release accepted from local',f=>f.r.release.status='PASS'],
 ['formal acceptance inferred',f=>f.r.formalAccepted=true],['production inferred',f=>f.r.production=true],
 ['missing deferred target check',f=>f.r.release.prerequisiteChecks.pop()],['target obligation silently waived',f=>f.r.release.handoff='optional'],
 ['local dependency missing',f=>f.r.dependencies.pop()],['global readiness substituted',f=>f.r.dependencies[0].status='READY'],
 ['prerequisite source differs',f=>f.projection.observedSourceCommit='b'.repeat(40)],['prerequisite digest changed',f=>f.projection.inputDigest=hash('changed')],['cleanup bytes changed',f=>writeFileSync(resolve(f.base,'cleanup.json'),'{}')],
 ['local log tampered',f=>writeFileSync(resolve(f.base,f.r.checks[0].log),'tampered')],['release handoff removed from plan',f=>f.nodes.get('RELEASE-GATE:BETA').required_scope='missing'],
])test('local profile rejects '+name,()=>localFixture(f=>{mutate(f);assert.throws(f.verify);}));
