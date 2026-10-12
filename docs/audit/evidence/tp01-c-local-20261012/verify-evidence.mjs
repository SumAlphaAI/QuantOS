// Read-only audit of the complete consumer-scoped assessment and retained history.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const root=process.cwd(),base='docs/audit/evidence/tp01-c-local-20261012';
const {digest,closure,nodesFromPlans,policy,localChecks,localDeferred,validateLocalPrerequisites}=await import(root+'/scripts/provider-a1-receipts.mjs');
const {verifyPublished,profile,nodeId}=await import(root+'/scripts/tp01-c-local-gate.mjs');
const verdict=verifyPublished(),nodes=nodesFromPlans(),p=policy();
const manifest=JSON.parse(readFileSync(base+'/manifest.json'));
const local=validateLocalPrerequisites(manifest.localPrerequisites.manifest,{nodes,profile});
assert.equal(local.observedSourceCommit,manifest.observedSourceCommit);
const inputFiles=new Map();for(const n of local.nodes)for(const f of JSON.parse(readFileSync(n.manifest)).inputs){if(inputFiles.has(f.path))assert.equal(inputFiles.get(f.path),f.sha256);inputFiles.set(f.path,f.sha256);}
const attempt=manifest.localPrerequisites.manifest.slice(0,-'/local-prerequisites.json'.length);
const required=[...new Set(closure(nodes,nodeId).flatMap(id=>localChecks(id,p,profile)))];
const checks=JSON.parse(readFileSync(attempt+'/execution-results.json'));
assert.equal(required.length,45);assert.deepEqual(checks.map(c=>c.id).sort(),required.sort());
for(const c of checks){assert.equal(c.status,'PASS');assert.equal(c.exitCode,0);assert.equal(c.timedOut,false);assert.equal(c.executionErrorCode,null);assert.equal(c.signal,null);assert.equal(digest(readFileSync(c.log)),c.logSha256);assert(!p.checks[c.id].database&&!p.checks[c.id].target);assert.notEqual(c.id,'tp01-baseline');}
assert.equal(localDeferred(nodes,p,profile).length,12);
const history=base+'/history/'+manifest.observedSourceCommit.slice(0,8),archived=JSON.parse(readFileSync(history+'/index.json'));
for(const file of archived.files)assert.equal(digest(readFileSync(file.path)),file.sha256,'retained canonical changed');
// The prior source commit preserves the original canonical bytes as an independent oracle.
for(const file of archived.files){const oldPath=file.path.slice(history.length+1);assert.equal(digest(execFileSync('git',['show',manifest.observedSourceCommit+':'+oldPath],{maxBuffer:16*1024*1024})),file.sha256,'history differs from frozen original');}
const target=JSON.parse(readFileSync('docs/audit/evidence/f0-target-diagnostics-20261012/summary.json'));
for(const file of target.files)assert.equal(digest(readFileSync(file.path)),file.sha256,'old target failure changed');
const projected=new Set(closure(nodes,nodeId).filter(id=>id!==nodeId));
for(const id of projected)assert.equal(nodes.get(id).stage_gate.status,'NOT_ASSESSED','upstream readiness leaked');
for(const id of ['CORE:R03','CORE:R04','CORE:TP03','CORE:TP04','CORE-GATE:R1-SERVICE'])assert.equal(nodes.get(id).stage_gate.status,'NOT_ASSESSED','old consumer admission migrated');
const statuses=Object.fromEntries(['READY','NOT_ASSESSED','BLOCKED'].map(status=>[status,[...nodes.values()].filter(n=>n.stage_gate.status===status).length]));
assert.deepEqual(statuses,{READY:1,NOT_ASSESSED:158,BLOCKED:0});
console.log(JSON.stringify({status:'PASS',...verdict,sourceCandidate:manifest.observedSourceCommit,checks:checks.length,inputFiles:inputFiles.size,necessaryNodes:local.nodes.length,deferred:12,retainedCanonicalFiles:archived.files.length,retainedTargetFiles:target.files.length,stageCounts:statuses},null,2));
