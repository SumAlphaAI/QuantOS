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
