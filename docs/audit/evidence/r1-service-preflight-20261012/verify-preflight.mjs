import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync, realpathSync} from 'node:fs';
import {resolve, relative, sep} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.cwd();
const {digest, inventory, policy, nodesFromPlans, planInput, closure, localPolicy, validateArtifact}=await import(root+'/scripts/provider-a1-receipts.mjs');
const {selectors:adapterSelectors}=await import(root+'/engines/vibe-adapter/check-development.mjs');
export function verify(attempt){
 const base=realpathSync(attempt),read=name=>{const path=realpathSync(resolve(base,name));assert(path.startsWith(base+sep),'evidence escaped attempt');return readFileSync(path);};
 const json=name=>JSON.parse(read(name)),r=json('receipt.json'),p=policy(),nodes=nodesFromPlans(),r1=nodes.get('CORE-GATE:R1-SERVICE');
 assert.equal(r.schema,'quantos-tp01-c-r1-preflight/v1');assert.equal(r.status,'PASS');assert.match(r.sourceCommit,/^[a-f0-9]{40}$/);
 assert.deepEqual(r.gate,{tp01C:'NOT_ASSESSED',r1Service:'NOT_ASSESSED',production:false,formalAccepted:false});
 assert.deepEqual(r.target,{database:'NOT_RUN',external:'NOT_RUN',performance:'NOT_RUN',checkpoint:'RELEASE-GATE:BETA'});
 assert.equal(digest(readFileSync(r.runner.path)),r.runner.sha256,'execution harness changed');
 const selected=[...new Set(r1.dependencies.flatMap(id=>closure(nodes,id)))];
 const selectors=[...new Set([...p.commonInputs,...selected.filter(id=>p.nodes[id]).flatMap(id=>p.nodes[id].inputs),...adapterSelectors])];
 assert.equal(digest(read('inputs.json')),r.inputs.sha256);assert.deepEqual(json('inputs.json'),inventory(selectors),'functional inputs changed');
 assert.deepEqual(json('plans.json'),selected.map(id=>({nodeId:id,planInput:planInput(nodes.get(id))})),'normative plan changed');
 assert.deepEqual(r.necessaryClosure,closure(nodes,'CORE:TP01-C'));
 assert.equal(digest(read('preserved-evidence.json')),r.preservedEvidence.sha256);
 const preserved=json('preserved-evidence.json');assert.equal(preserved.length,r.preservedEvidence.files);
 for(const file of preserved)assert.equal(digest(readFileSync(file.path)),file.sha256,'historical evidence changed: '+file.path);
 const failures=json('retained-f0-failures.json');
 assert.deepEqual(failures.files,JSON.parse(readFileSync('docs/audit/evidence/f0-target-diagnostics-20261012/summary.json')).files);
 for(const file of failures.files)assert.equal(digest(readFileSync(file.path)),file.sha256,'F0 failure evidence changed: '+file.path);
 assert.deepEqual(json('initial-stages.json'),[...nodes.values()].map(n=>({nodeId:n.id,stage_gate:n.stage_gate})),'preflight published stages');
 const required=['historical-tp01-c-rejected','strict-tp01-c-rejected','strict-f0-rejected','capability','intake','f0-structure','f0-plan-negative','f0-receipt-negative','f0-current-local','f08-functional','f08-branches','f08-service','python','manager','ruff','format','pyright','lock','plans','adapter-focused','receipt-negative','handoff','process-cleanup'];
 const checks=json('execution-results.json');assert.deepEqual(checks.map(c=>c.id),required,'missing or duplicate check');
 const logicalDirectory=r.inputs.path.slice(0,r.inputs.path.lastIndexOf('/')+1);
 assert.deepEqual(r.checks,checks.map(c=>({id:c.id,status:c.status})));
 for(const c of checks){
  assert.equal(c.status,'PASS');assert(c.allowedExitCodes.includes(c.exitCode),'unexpected exit');
  assert.equal(c.timedOut,false);assert.equal(c.executionErrorCode,null);assert.equal(c.signal,null);
  assert(Date.parse(c.executedAt)<=Date.parse(c.completedAt)&&Date.parse(c.completedAt)<=Date.now());
  assert(c.log.startsWith(logicalDirectory+'logs/'),'execution log outside attempt');
  const log=read(c.log.slice(logicalDirectory.length));assert.equal(digest(log),c.logSha256,'execution log changed');assert.match(log.toString(),new RegExp(c.expectedMarker));
 }
 const inv=json('inventory.json');assert.equal(inv.sourceCommit,r.sourceCommit);assert.deepEqual(inv.dependencies.map(d=>d.nodeId),r1.dependencies);
 assert.equal(inv.dependencies.filter(d=>d.stageGate.status==='NOT_ASSESSED').length,10);
 assert(inv.dependencies.every(d=>d.r1Admission==='NOT_ASSESSED'));
 const clean=json('process-cleanup.json');validateArtifact('r1-process-cleanup',resolve(base,'process-cleanup.json'),r.sourceCommit);
 assert.equal(clean.scopeTag,json('process-baseline.json').scopeTag);
 assert.equal(json('scope-negative.json').unregisteredProfileRejected,true);assert.throws(()=>localPolicy('TP01_C_LOCAL'),/unsupported local profile/);
 const service=json('f08-service.json');assert.equal(service.sourceCommit,r.sourceCommit);assert.equal(service.status,'PASS');
 validateArtifact('f08-service',resolve(base,'supporting/f08-service/receipt.json'),r.sourceCommit);
 assert.deepEqual(service,json('supporting/f08-service/receipt.json'));
 const manifest=json('supporting-manifest.json');assert(manifest.length>=13);
 const walk=path=>statSync(path).isDirectory()?readdirSync(path).sort().flatMap(n=>walk(resolve(path,n))):[path];
 const actual=walk(resolve(base,'supporting')).map(path=>({path:relative(base,path).split(sep).join('/'),sha256:digest(readFileSync(path))})).sort((a,b)=>a.path.localeCompare(b.path));
 assert.deepEqual(manifest,actual,'supporting artifact inventory changed');
 const body={status:'PASS',sourceCommit:r.sourceCommit,checks:checks.length,preservedFiles:preserved.length,inputFiles:r.inputs?json('inputs.json').length:0,
   necessaryNodes:r.necessaryClosure.length,directDependencies:inv.dependencies.length,preflight:'PASS',tp01C:'NOT_ASSESSED',r1Service:'NOT_ASSESSED',database:'NOT_RUN',formalAccepted:false};
 return body;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(verify(process.argv[2]),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
