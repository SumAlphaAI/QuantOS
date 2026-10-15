import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync,execFileSync} from 'node:child_process';
import {digest,inventory,nodesFromPlans,planInput,staticEnvironment,executionOutcome} from './provider-a1-receipts.mjs';
export const directory='docs/audit/evidence/tp06-local-20261015/functional';
export const selectors=['engines/strategy-lab/','engines/tests/test_strategy_lab_development.py','engines/tests/test_strategy_lab_contract.py','engines/tests/fixtures/tp06-attacks.json','scripts/tp06*','docs/operations/tp06-local-admission.md'];
export const testFile='engines/tests/test_strategy_lab_development.py';
export const command=['engines/.venv/bin/python','-m','pytest',testFile,'-vv'];
export function expectedCases(){
 const attacks=JSON.parse(readFileSync('engines/tests/fixtures/tp06-attacks.json'));assert.equal(attacks.length,100);assert.equal(new Set(attacks.map(c=>c.id)).size,100);assert.equal(new Set(attacks.map(c=>c.prompt)).size,100);
 return [...attacks.map(c=>testFile+'::test_owned_attack_corpus_cannot_write_or_escape['+c.id+']'),
 ...Array.from({length:100},(_,i)=>testFile+'::test_replacement_static_failures_always_block['+i+']'),
 ...['capability','mode','workspace','snapshot','tools','prompt','delay','unknown'].map(m=>testFile+'::test_request_shapes_fail_closed_without_artifacts['+m+']'),
 ...['test_replacement_artifacts_readback_hash_conflict_and_recovery','test_owner_cancel_blocks_stream_commit_and_other_actor_cannot_cancel'].map(t=>testFile+'::'+t)].sort();
}
export const supportingPaths=()=>['probe.log'];
export function verifyFunctional(r,{logDirectory=directory,expectedOutputDirectory=directory}={}){
 assert.equal(r.schema,'quantos-tp06-functional/v1');assert.equal(r.nodeId,'CORE:TP06');assert.equal(r.engineeringStatus,'PASS');assert.equal(r.stageGate,'NOT_ASSESSED');
 for(const k of ['formalAccepted','databaseExecution','externalExecution','performanceAccepted','externalPublished','upstreamAccepted'])assert.equal(r[k],false);
 assert.match(r.observedSourceCommit,/^[a-f0-9]{40}$/);assert.equal(r.outputDirectory,expectedOutputDirectory);assert.deepEqual(r.inputs,inventory(selectors));assert.deepEqual(r.planInput,planInput(nodesFromPlans().get(r.nodeId)));
 assert.equal(r.checks.length,1);const c=r.checks[0];assert.equal(c.id,'probe');assert.deepEqual(c.command,command);assert.equal(c.status,'PASS');assert.equal(c.exitCode,0);assert.equal(c.timedOut,false);assert.equal(c.signal,null);assert.equal(c.executionErrorCode,null);assert.equal(c.timeoutMs,60000);assert(Number.isFinite(Date.parse(c.executedAt))&&Date.parse(c.executedAt)<=Date.now());assert.equal(c.log,'probe.log');
 const bytes=readFileSync(resolve(logDirectory,'probe.log'));assert.equal(digest(bytes),c.logSha256);const log=bytes.toString(),cases=[...log.matchAll(/^(engines\/tests\/\S+) PASSED(?: |$)/gm)].map(m=>m[1]).sort();assert.deepEqual(cases,expectedCases(),'missing, duplicated, skipped or substituted service case');assert.match(log,/210 passed/);assert(!/FAILED|ERROR|SKIPPED/.test(log));
 assert.deepEqual(r.files,[{path:'probe.log',sha256:digest(bytes)}]);return {engineeringStatus:'PASS',stageGate:'NOT_ASSESSED',cases:210,securityNegativeFixtures:100,staticFailureFixtures:100,formalAccepted:false};
}
export function record({outputDirectory=directory}={}){
 mkdirSync(outputDirectory,{recursive:true});const env={...staticEnvironment(process.env),UV_OFFLINE:'1'};delete env.NODE_TEST_CONTEXT;const executedAt=new Date().toISOString(),run=spawnSync(command[0],command.slice(1),{env,encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024}),log=(run.stdout??'')+(run.stderr??'');writeFileSync(outputDirectory+'/probe.log',log);
 const r={schema:'quantos-tp06-functional/v1',nodeId:'CORE:TP06',engineeringStatus:run.status===0?'PASS':'FAIL',stageGate:'NOT_ASSESSED',formalAccepted:false,databaseExecution:false,externalExecution:false,performanceAccepted:false,externalPublished:false,upstreamAccepted:false,observedSourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),outputDirectory,inputs:inventory(selectors),planInput:planInput(nodesFromPlans().get('CORE:TP06')),checks:[{id:'probe',command,executedAt,...executionOutcome(run,60000),log:'probe.log',logSha256:digest(log)}],files:[{path:'probe.log',sha256:digest(log)}]};writeFileSync(outputDirectory+'/receipt.json',JSON.stringify(r,null,2)+'\n');verifyFunctional(r,{logDirectory:outputDirectory,expectedOutputDirectory:outputDirectory});return r;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{assert.deepEqual(process.argv.slice(2),['--record']);rmSync(directory,{recursive:true,force:true});console.log(JSON.stringify(verifyFunctional(record())));}catch(e){console.error(e.message);process.exitCode=1;}}
