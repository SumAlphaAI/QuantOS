import assert from 'node:assert/strict';
import {readFileSync,realpathSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {base,expectedScope,validateScope} from './scope.mjs';
import {checks,harnessFiles,preservedSelectors,selectors} from './run-preflight.mjs';
import {digest,inventory,nodesFromPlans,planInput,validateArtifact} from '../../../../scripts/provider-a1-receipts.mjs';
export function verify(attempt){
 const directory=realpathSync(attempt),read=name=>{const p=realpathSync(resolve(directory,name));assert(p.startsWith(directory+sep),'evidence escaped attempt');return readFileSync(p);},json=name=>JSON.parse(read(name));
 const r=json('receipt.json'),nodes=nodesFromPlans(),scope=JSON.parse(readFileSync(base+'/scope.json'));validateScope(scope);
 assert.equal(r.schema,'quantos-tp01-d-local-preflight/v1');assert.equal(r.status,'PASS');assert.match(r.sourceCommit,/^[a-f0-9]{40}$/);
 assert.equal(r.integrityError,null);assert.equal(r.registration,'PROPOSED_NOT_REGISTERED');
 assert.deepEqual(r.gate,scope.gate);assert.deepEqual(r.target,{database:'NOT_RUN',external:'NOT_RUN',performance:'NOT_RUN',checkpoint:'RELEASE-GATE:BETA'});
 assert.deepEqual(r.necessaryClosure,scope.necessaryClosure);assert.equal(r.mappedExistingChecks,53);assert.equal(r.deferredChecks,14);
 assert.deepEqual(r.harness,inventory(harnessFiles),'preflight verifier/harness changed');
 const inputs=json('inputs.json');assert.equal(digest(read('inputs.json')),r.inputsSha256);assert.deepEqual(inputs,inventory(selectors()),'functional inputs changed');
 assert.equal(digest(read('plans.json')),r.plansSha256);assert.deepEqual(json('plans.json'),scope.necessaryClosure.map(id=>({nodeId:id,planInput:planInput(nodes.get(id))})));
 const preserved=json('preserved-evidence.json');assert.equal(digest(read('preserved-evidence.json')),r.preservedEvidenceSha256);assert.deepEqual(preserved,inventory(preservedSelectors),'historical evidence changed');
 assert.deepEqual(json('initial-stages.json'),[...nodes.values()].map(n=>({nodeId:n.id,stage_gate:n.stage_gate})),'preflight must not publish stages');
 const executions=json('execution-results.json');assert.deepEqual(executions.map(c=>c.id),checks.map(c=>c[0]));assert.deepEqual(r.checks,executions.map(c=>({id:c.id,status:c.status})));
 const logical=executions[0].log.slice(0,-'/logs/scope.log'.length);assert.match(logical,new RegExp('^'+base+'/attempt-\\d{2}$'));
 for(const [i,c]of executions.entries()){
  const [id,spec,allowedExitCodes,marker]=checks[i],command=id==='process-cleanup'?[...spec,logical+'/process-cleanup.json']:spec;
  assert.deepEqual(c.command,command,'actual command differs');assert.deepEqual(c.allowedExitCodes,allowedExitCodes);assert.equal(c.expectedMarker,marker.source);
  assert.equal(c.status,'PASS');assert(allowedExitCodes.includes(c.exitCode));assert.equal(c.timedOut,false);assert.equal(c.executionErrorCode,null);assert.equal(c.signal,null);
  assert(Date.parse(c.executedAt)<=Date.parse(c.completedAt)&&Date.parse(c.completedAt)<=Date.now());assert.equal(c.log,logical+'/logs/'+id+'.log');
  const bytes=read('logs/'+id+'.log');assert.equal(digest(bytes),c.logSha256,'execution log changed');assert.match(bytes.toString(),marker);
 }
 const names=JSON.parse(readFileSync('engines/vibe-adapter/src/vibe_adapter/fixtures/catalog.json')).fixtures.map(f=>f.fixture_name),matrix=json('fixture-matrix.json');
 assert.equal(names.length,20);assert.equal(new Set(names).size,20);assert.equal(matrix.sourceCommit,r.sourceCommit);assert.equal(matrix.synthetic,true);assert.equal(matrix.formalAccepted,false);
 assert.deepEqual(matrix.fixtureNames,names);assert.equal(matrix.fixtureCount,20);assert.deepEqual(matrix.rpcs,['Execute','StreamExecute']);assert.equal(matrix.callsPerRpc,2);
 const replay=read('logs/tp01-d-replay.log').toString();for(const name of names)assert(replay.includes('test_twenty_deterministic_design_replays['+name+'] PASSED'),'fixture did not actually run');
 assert.equal(matrix.log,logical+'/logs/tp01-d-replay.log');assert.equal(matrix.logSha256,digest(replay));assert.match(replay,/44 passed/);
 const runtime=read('logs/tp01-d-runtime.log').toString();assert.match(runtime,/TP01-D: Python child cannot import vibe_adapter/);assert.match(runtime,/2 passed; 0 failed; 0 ignored/);assert(!runtime.includes('R02_CHAIN_NOT_RUN'));
 const synthetic=json('synthetic-inputs.json');assert.equal(synthetic.sourceCommit,r.sourceCommit);assert.equal(synthetic.kind,'synthetic_in_memory');assert.equal(synthetic.retiredHistoricalFactsConsumed,0);for(const k of ['newCollection','realSourceLicenseGranted','databaseExecution','formalAccepted'])assert.equal(synthetic[k],false);
 assert.deepEqual(synthetic.sources.map(s=>s.path),['crates/quantos-runtime/tests/research_orchestration.rs','crates/quantos-runtime/tests/signal_proposal_orchestration.rs']);
 assert.deepEqual(synthetic.evidenceChecks,['r01-functional','r02-functional','r02-engine-consumers','tp01-d-runtime']);
 for(const s of synthetic.sources){const bytes=readFileSync(s.path),text=bytes.toString();assert.equal(digest(bytes),s.sha256);assert.equal(s.catalog,'InMemoryDataSnapshotCatalog');const start=text.indexOf('fn snapshot_catalog('),end=text.indexOf('\nfn tool_registration',start);assert(start>=0&&end>start);const builder=text.slice(start,end);assert(builder.includes('InMemoryDataSnapshotCatalog::new()')&&builder.includes('DataSnapshotRecord::new(')&&builder.includes('snapshot'));
  assert(!/DATABASE_URL|PgDataSnapshot|PgClient|read_file|read_to_string|reqwest|include_bytes!/.test(builder),'synthetic catalog unexpectedly loads external facts');}
 const clean=json('process-cleanup.json');validateArtifact('r1-process-cleanup',resolve(directory,'process-cleanup.json'),r.sourceCommit);assert.equal(clean.scopeTag,json('process-baseline.json').scopeTag);
 // Every file (and the locked Git link) must exist unchanged in the observed candidate.
 const tree=new Map(execFileSync('git',['ls-tree','-r','-z',r.sourceCommit],{maxBuffer:32*1024*1024}).toString().split('\0').filter(Boolean).map(line=>{const [meta,path]=line.split('\t');return[path,meta.split(' ')[2]];}));
 for(const input of inputs){assert(tree.has(input.path),'input absent from frozen candidate');if(input.gitCommit)assert.equal(tree.get(input.path),input.gitCommit);else{const data=readFileSync(input.path),blob=createHash('sha1').update('blob '+data.length+'\0').update(data).digest('hex');assert.equal(tree.get(input.path),blob,'input differs from frozen candidate');}}
 const stageCounts=Object.fromEntries(['READY','NOT_ASSESSED','BLOCKED'].map(s=>[s,[...nodes.values()].filter(n=>n.stage_gate.status===s).length]));assert.deepEqual(stageCounts,{READY:1,NOT_ASSESSED:158,BLOCKED:0});
 return {status:'PASS',sourceCommit:r.sourceCommit,preflight:'PASS',checks:executions.length,necessaryNodes:16,mappedExistingLocalChecks:53,deferredChecks:14,fixtures:20,fixtureRpcCalls:80,pythonTests:1382,preservedFiles:preserved.length,inputEntries:inputs.length,stageCounts,gate:r.gate,target:r.target};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(verify(process.argv[2]),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
