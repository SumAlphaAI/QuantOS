import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync,execFileSync} from 'node:child_process';
import {digest,inventory,nodesFromPlans,planInput,staticEnvironment,executionOutcome} from './provider-a1-receipts.mjs';
export const directory='docs/audit/evidence/service-tp01-local-20261015/functional';
export const selectors=['engines/vibe-adapter/','engines/engine-sdk/','engines/tests/test_vibe_adapter_skeleton.py','engines/tests/test_vibe_adapter_absorption.py','engines/tests/test_vibe_adapter_contract.py','engines/tests/test_vibe_adapter_rollout.py','scripts/service-tp01*','docs/operations/service-tp01-local-admission.md'];
const skeleton='engines/tests/test_vibe_adapter_skeleton.py',absorption='engines/tests/test_vibe_adapter_absorption.py',rollout='engines/tests/test_vibe_adapter_rollout.py';
export const tests=[skeleton+'::test_100_boundary_fixtures_rejected_and_audited',skeleton+'::test_mock_artifacts_have_integrity_tenant_scope_and_stable_replay',skeleton+'::test_cancel_is_owner_scoped_and_interrupts_before_artifact',absorption+'::test_twenty_deterministic_design_replays','engines/tests/test_vibe_adapter_contract.py::test_vibe_adapter_contract_all_rpcs',skeleton+'::test_other_engine_boots_with_vibe_imports_blocked',rollout+'::test_live_action_revokes_inflight_and_prevents_late_artifact',rollout+'::test_rollback_restores_immutable_bytes_and_is_repeatable',rollout+'::test_disable_at_commit_boundary_rejects_write'];
export const command=['engines/.venv/bin/python','-m','pytest',tests[3],...tests.filter((_,i)=>i!==3),'-vv'];
export function expectedCases(){
 const fields=['secret_ref','venue','broker_connection','shell','file_write','network_access','tenant_id','workspace_id','actor_id','capabilities','api_key','authorization','session','memory','trading_order','egress_url','path','command','credential','token'];
 const fixtures=JSON.parse(readFileSync('engines/vibe-adapter/src/vibe_adapter/fixtures/catalog.json')).fixtures.map(f=>f.fixture_name);assert.equal(fixtures.length,20);assert.equal(new Set(fixtures).size,20);
 return [...Array.from({length:5},(_,shape)=>fields.map(field=>tests[0]+'['+shape+'-'+field+']')).flat(),...fixtures.map(f=>tests[3]+'['+f+']'),...[false,true].flatMap(stream=>['disable','rollback','critical-alert'].map(a=>tests[6]+'['+(stream?'True':'False')+'-'+a+']')),...[1,2,4,5,7,8].map(i=>tests[i])].sort();
}
export const supportingPaths=()=>['probe.log'];
export function verifyFunctional(r,{logDirectory=directory,expectedOutputDirectory=directory}={}){
 assert.equal(r.schema,'quantos-service-tp01-functional/v1');assert.equal(r.nodeId,'SERVICE:TP01');assert.equal(r.engineeringStatus,'PASS');assert.equal(r.stageGate,'NOT_ASSESSED');
 for(const k of ['formalAccepted','databaseExecution','externalExecution','performanceAccepted','externalPublished','upstreamAccepted'])assert.equal(r[k],false);
 assert.match(r.observedSourceCommit,/^[a-f0-9]{40}$/);assert.equal(r.outputDirectory,expectedOutputDirectory);assert.deepEqual(r.inputs,inventory(selectors));assert.deepEqual(r.planInput,planInput(nodesFromPlans().get(r.nodeId)));
 assert.equal(r.checks.length,1);const c=r.checks[0];assert.equal(c.id,'probe');assert.deepEqual(c.command,command);assert.equal(c.status,'PASS');assert.equal(c.exitCode,0);assert.equal(c.timedOut,false);assert.equal(c.signal,null);assert.equal(c.executionErrorCode,null);assert.equal(c.timeoutMs,60000);assert(Number.isFinite(Date.parse(c.executedAt))&&Date.parse(c.executedAt)<=Date.now());assert.equal(c.log,'probe.log');
 const bytes=readFileSync(resolve(logDirectory,'probe.log'));assert.equal(digest(bytes),c.logSha256);const log=bytes.toString(),cases=[...log.matchAll(/^(engines\/tests\/\S+) PASSED(?: |$)/gm)].map(m=>m[1]).sort();assert.deepEqual(cases,expectedCases(),'missing, duplicated, skipped or substituted service case');assert.match(log,/132 passed/);assert(!/FAILED|ERROR|SKIPPED/.test(log));
 assert.deepEqual(r.files,[{path:'probe.log',sha256:digest(bytes)}]);return {engineeringStatus:'PASS',stageGate:'NOT_ASSESSED',cases:132,securityNegativeFixtures:100,workflowReplays:20,formalAccepted:false};
}
export function record({outputDirectory=directory}={}){
 mkdirSync(outputDirectory,{recursive:true});const env={...staticEnvironment(process.env),UV_OFFLINE:'1'};delete env.NODE_TEST_CONTEXT;const executedAt=new Date().toISOString(),run=spawnSync(command[0],command.slice(1),{env,encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024}),log=(run.stdout??'')+(run.stderr??'');writeFileSync(outputDirectory+'/probe.log',log);
 const r={schema:'quantos-service-tp01-functional/v1',nodeId:'SERVICE:TP01',engineeringStatus:run.status===0?'PASS':'FAIL',stageGate:'NOT_ASSESSED',formalAccepted:false,databaseExecution:false,externalExecution:false,performanceAccepted:false,externalPublished:false,upstreamAccepted:false,observedSourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),outputDirectory,inputs:inventory(selectors),planInput:planInput(nodesFromPlans().get('SERVICE:TP01')),checks:[{id:'probe',command,executedAt,...executionOutcome(run,60000),log:'probe.log',logSha256:digest(log)}],files:[{path:'probe.log',sha256:digest(log)}]};writeFileSync(outputDirectory+'/receipt.json',JSON.stringify(r,null,2)+'\n');verifyFunctional(r,{logDirectory:outputDirectory,expectedOutputDirectory:outputDirectory});return r;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{assert.deepEqual(process.argv.slice(2),['--record']);rmSync(directory,{recursive:true,force:true});console.log(JSON.stringify(verifyFunctional(record())));}catch(e){console.error(e.message);process.exitCode=1;}}
