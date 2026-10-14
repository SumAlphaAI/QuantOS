import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {base,baseline,inspect,validateMapping,fixtureInventory} from './scope.mjs';
import {checks,resolveCommand,testCounts} from './checks.mjs';
import {digest,inventory,nodesFromPlans,planInput,validateLocalPrerequisites} from '../../../../scripts/provider-a1-receipts.mjs';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p));
export function validateResults(rows,out){
 assert.deepEqual(rows.map(r=>r.id),checks.map(c=>c.id),'complete command set required');
 for(const [i,r] of rows.entries()){
  const c=checks[i];assert.equal(r.status,'PASS',r.id+' failed');assert.equal(r.exitCode,c.expected);assert.equal(r.expectedExitCode,c.expected);assert.equal(r.timedOut,false);assert.equal(r.signal,null);assert.equal(r.executionErrorCode,null);assert.deepEqual(r.command,resolveCommand(c,out));
  assert.equal(r.log,out+'/'+r.id+'.log');const bytes=read(r.log),text=bytes.toString();assert.equal(digest(bytes),r.logSha256);assert.deepEqual(r.testCounts,testCounts(text));
  if(c.pattern)assert(text.includes(c.pattern));if(c.minTests)assert(r.testCounts?.passed>=c.minTests&&r.testCounts.failed===0);
  if(c.artifact){assert.equal(r.artifact,out+'/'+c.artifact);assert.equal(digest(read(r.artifact)),r.artifactSha256);}
 }
 return true;
}
export function validateReceipt(r){
 assert.equal(r.status,'PASS_WITH_LOCAL_GAPS');assert.equal(r.checks,19);assert.equal(r.closureNodes,39);assert.equal(r.tp01ClosureNodes,31);assert.equal(r.unmappedNodes,12);assert.equal(r.publicConsumerHandlersMissing,11);assert.equal(r.plannedConsumerOperations,1);
 assert.equal(r.gate,'NOT_ASSESSED');assert.equal(r.localAdmission,'PROPOSED_NOT_REGISTERED');assert.equal(r.formalAccepted,false);assert.equal(r.databaseExecution,false);assert.equal(r.externalExecution,false);assert.equal(r.performanceAccepted,false);assert.deepEqual(r.deferred,{supabase:'NOT_RUN',external:'NOT_RUN',performance:'NOT_RUN',release:'NOT_ASSESSED'});assert.deepEqual(r.stageCounts,{READY:0,NOT_ASSESSED:159,BLOCKED:0});
 return true;
}
export function verify(attempt='attempt-01'){
 assert(/^attempt-[0-9]{2}$/.test(attempt));const out=base+'/'+attempt,r=json(out+'/receipt.json');validateReceipt(r);const scope=json(out+'/inventory.json');validateMapping(scope.closure);assert.equal(scope.observedSourceCommit,r.sourceCommit);assert.equal(scope.gate,'NOT_ASSESSED');assert.deepEqual(scope.unmapped,inspect().unmapped);
 const tree=sha=>new Map(execFileSync('git',['ls-tree','-r','-z',sha],{maxBuffer:32*1024*1024}).toString().split('\0').filter(Boolean).map(l=>{const[m,path]=l.split('\t');return[path,m.split(' ')[2]];}));
 const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),frozen=tree(r.sourceCommit),snapshot=json(out+'/inputs.json');assert.equal(snapshot.sourceCommit,r.sourceCommit);assert.deepEqual(inventory(snapshot.selectors),snapshot.inputs);
 for(const i of snapshot.inputs){if(i.gitCommit)assert.equal(frozen.get(i.path),i.gitCommit);else assert.equal(blob(read(i.path)),frozen.get(i.path),i.path+' not frozen');}
 const plans=['docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'];const frozenNodes=nodesFromPlans(plans.map(p=>execFileSync('git',['show',r.sourceCommit+':'+p],{encoding:'utf8',maxBuffer:16*1024*1024})));
 for(const row of scope.closure)assert.deepEqual(row.normativeInput,planInput(frozenNodes.get(row.nodeId)));
 const fixed=json(base+'/mapping.json');assert.deepEqual({...fixed,observedSourceCommit:scope.observedSourceCommit},scope);assert.deepEqual(json(base+'/fixtures.json').examples,fixtureInventory());
 const proof=validateLocalPrerequisites(scope.prerequisiteProof,{profile:'R1_LOCAL'});assert.equal(proof.nodes.length,27);assert.equal(proof.observedSourceCommit,scope.prerequisiteExecutionCommit);assert.equal(r.prerequisiteProof.executionCommit,proof.observedSourceCommit);assert.equal(r.prerequisiteProof.mode,'REVALIDATED_INPUT_IDENTICAL_PRIOR_EXECUTION');assert.equal(r.prerequisiteProof.published,false);
 const rows=json(out+'/results.json');validateResults(rows,out);
 const routes=json(out+'/http/receipt.json');assert.equal(routes.observedOperations,11);assert.equal(routes.missingHandlers,11);assert.equal(routes.processTerminated,true);assert.deepEqual(routes.operations.map(o=>o.operationId),scope.operations.map(o=>o.operationId));for(const op of routes.operations){assert.equal(op.status,404);assert.equal(op.bodySha256,digest(op.body));}assert.deepEqual(routes.controls.map(c=>c.status),[200,401,422]);assert.equal(routes.databaseExecution,false);assert.equal(routes.externalExecution,false);
 assert.equal(json(out+'/rollout.json').status,'LOCAL_FUNCTIONAL_GAPS');assert.equal(json(out+'/evaluation.json').status,'LOCAL_EVALUATION_GAPS');assert.equal(json(out+'/evaluation.json').tp07.missing.length,2);
 let historical=0;for(const[path,sha]of tree(baseline))if(path.startsWith('docs/audit/evidence/')){assert(existsSync(path),path);assert.equal(blob(read(path)),sha,path+' historical bytes changed');historical++;}
 const raw=json(out+'/artifact-index.json'),walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(p+'/'+d.name):[p+'/'+d.name]);assert.deepEqual(raw.files.map(f=>f.path).sort(),walk(out).filter(p=>p!==out+'/artifact-index.json').sort());for(const f of raw.files)assert.equal(digest(read(f.path)),f.sha256);
 return {status:'PASS_WITH_LOCAL_GAPS',sourceCommit:r.sourceCommit,closureNodes:39,tp01ClosureNodes:31,revalidatedR1Nodes:27,revalidatedR1Checks:85,prerequisiteExecutionCommit:proof.observedSourceCommit,checks:rows.length,expectedLocalGapRefusals:rows.filter(r=>r.exitCode===2).length,frozenInputEntries:snapshot.inputs.length,preservedHistoricalFiles:historical,syntheticExamples:15,missingConsumerHandlers:11,unmappedNodes:12,testCounts:rows.filter(r=>r.testCounts).map(r=>({id:r.id,...r.testCounts})),stageCounts:r.stageCounts,gate:'NOT_ASSESSED',formalAccepted:false,deferred:r.deferred};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const r=verify(process.argv.find(s=>/^attempt-[0-9]{2}$/.test(s))??'attempt-01');if(process.argv.includes('--record')){assert(!existsSync(base+'/verification.json'),'preserve verification');writeFileSync(base+'/verification.json',JSON.stringify(r,null,2)+'\n');}console.log(JSON.stringify(r,null,2));}
