// Read-only source preflight. All outputs stay in a new attempt; no canonical receipt writes.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {base,expectedScope,validateScope} from './scope.mjs';
import {nodesFromPlans,planInput,policy,inventory,digest,staticEnvironment,executionOutcome} from '../../../../scripts/provider-a1-receipts.mjs';
import {checks as componentChecks,selectors as componentSelectors} from '../../../../engines/vibe-adapter/check-absorption.mjs';
const root=process.cwd(),p=policy();
export const harnessFiles=['scope.mjs','scope.json','scope.test.mjs','run-preflight.mjs','verify-preflight.mjs','verify-preflight.test.mjs'].map(n=>base+'/'+n).concat('docs/audit/TP01-D-local-scope-2026-10-12.md');
export const preservedSelectors=['docs/audit/evidence/tp01-d-20261009/','docs/audit/evidence/provider-a1-remediation-20261004/tp01-d-prerequisites-20261009/','docs/audit/evidence/provider-a1-remediation-20261004/tp01-d-admission-20261009/','docs/audit/evidence/tp01-c-20261009/','docs/audit/evidence/tp01-c-local-20261012/','docs/audit/evidence/f0-target-diagnostics-20261012/'];
export function selectors(){const s=expectedScope();return [...new Set([...p.commonInputs,...s.necessaryClosure.flatMap(id=>p.nodes[id].inputs),...componentSelectors,...harnessFiles])];}
export const checks=[
 ['scope',['node',base+'/scope.mjs'],[0],/PROPOSED_NOT_REGISTERED/],
 ['scope-negative',['node','--test',base+'/scope.test.mjs'],[0],/fail 0/],
 ['tp01-c-current-local',['make','tp01-c-local-check'],[0],/"stageGate": "READY"/],
 ['historical-tp01-d-rejected',['node','engines/vibe-adapter/check-absorption.mjs','--ready'],[1],/TP01-D functional inputs changed/],
 ['strict-r02-admission-rejected',['make','r02-admission-check'],[2],/CORE:R01: current dependency admission missing/],
 ['strict-f0-rejected',['node','scripts/provider-a1-receipts.mjs','--f0'],[1],/dependency is not READY/],
 ['tp01-local-baseline',p.checks['tp01-local-baseline'].command,[0],/fork=verified/],
 ['capability',p.checks['tp01-capability'].command,[0],/11 complete capabilities/],
 ['intake',p.checks['tp-intake'].command,[0],/intake evidence is complete/],
 ...componentChecks.map(c=>['tp01-d-'+c.id,c.command,[0],c.marker]),
 ['tp01-d-negative',p.checks['tp01-d-negatives'].command,[0],/fail 0/],
 ['python',['engines/.venv/bin/python','-m','pytest','engines/tests','-q'],[0],/1382 passed/],
 ['manager',['cargo','test','--locked','--offline','-p','quantos-engine-manager'],[0],/python_vibe_adapter_contracts_round_trip_over_uds \.\.\. ok/],
 ['r01-functional',p.checks['r01-functional'].command,[0],/R01 assembly Gate PASS/],
 ['r02-functional',p.checks['r02-functional'].command,[0],/"liveDatabase":false/],
 ['r02-engine-consumers',p.checks['r02-engine-consumers'].command,[0],/R02_ENGINE_CONSUMERS PASS/],
 ['r1-receipt-negative',p.checks['r1-receipt-negative'].command,[0],/fail 0/],
 ['ruff',['engines/.venv/bin/ruff','check','engines/vibe-adapter','engines/tests/test_vibe_adapter_absorption.py'],[0],/All checks passed/],
 ['lock',['uv','lock','--check','--offline','--project','engines'],[0],/Resolved 52 packages/],
 ['plans',['node','scripts/check-development-plans.mjs'],[0],/PASS/],
 ['handoff',['make','development-handoff-check'],[0],/PASS/],
 ['process-cleanup',['node','scripts/r1-process-cleanup.cjs'],[0],/R1_PROCESS_CLEANUP PASS/],
];
async function run(){
 const attempt=process.argv[2];assert(/^attempt-\d{2}$/.test(attempt??''),'supply a new attempt-NN');
 const out=base+'/'+attempt;assert(!existsSync(out),'preserve every prior attempt');
 assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'','freeze the preflight harness first');
 const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),nodes=nodesFromPlans(),scope=JSON.parse(readFileSync(base+'/scope.json'));
 validateScope(scope);const inputs=inventory(selectors()),plans=scope.necessaryClosure.map(id=>({nodeId:id,planInput:planInput(nodes.get(id))}));
 const stages=[...nodes.values()].map(n=>({nodeId:n.id,stage_gate:n.stage_gate})),preserved=inventory(preservedSelectors);
 mkdirSync(out+'/logs',{recursive:true});const json=(n,v)=>writeFileSync(out+'/'+n,JSON.stringify(v,null,2)+'\n');
 json('inputs.json',inputs);json('plans.json',plans);json('initial-stages.json',stages);json('preserved-evidence.json',preserved);
 const {snapshot}=createRequire(import.meta.url)(root+'/scripts/lib/test-engine-processes.cjs');
 const baseline={...snapshot(root),scopeTag:randomBytes(4).toString('hex')};json('process-baseline.json',baseline);
 const env=staticEnvironment(process.env);env.PATH='/Users/anray/Library/pnpm/.tools/pnpm/10.20.0/bin:'+env.PATH;env.UV_OFFLINE='1';env.CARGO_NET_OFFLINE='true';
 env.QUANTOS_TEST_ENGINE_SCOPE=baseline.scopeTag;env.QUANTOS_R1_ENGINE_BASELINE=resolve(out+'/process-baseline.json');
 const results=[];
 function execute([id,spec,allowedExitCodes,marker]){
  const command=id==='process-cleanup'?[...spec,out+'/process-cleanup.json']:spec;
  const timeoutMs=id==='process-cleanup'?30000:1800000,executedAt=new Date().toISOString();
  const childEnv={...env,...(id==='r1-receipt-negative'?{QUANTOS_R1_PROCESS_PROBE:'1'}:{})};
  const r=spawnSync(command[0],command.slice(1),{cwd:root,env:childEnv,encoding:'utf8',timeout:timeoutMs,maxBuffer:64*1024*1024});
  const output=(r.stdout??'')+(r.stderr??''),log=out+'/logs/'+id+'.log';writeFileSync(log,output);const outcome=executionOutcome(r,timeoutMs);
  results.push({id,command,executedAt,completedAt:new Date().toISOString(),...outcome,allowedExitCodes,expectedMarker:marker.source,status:allowedExitCodes.includes(r.status)&&!outcome.timedOut&&!outcome.executionErrorCode&&!outcome.signal&&marker.test(output)?'PASS':'FAIL',log,logSha256:digest(output)});
  json('execution-results.json',results);console.log(id+': '+results.at(-1).status+' exit='+r.status);
 }
 try{for(const c of checks.filter(c=>c[0]!=='process-cleanup'))execute(c);}finally{execute(checks.at(-1));}
 const names=JSON.parse(readFileSync('engines/vibe-adapter/src/vibe_adapter/fixtures/catalog.json')).fixtures.map(f=>f.fixture_name);
 json('fixture-matrix.json',{schema:'quantos-tp01-d-fixture-preflight/v1',sourceCommit,fixtureNames:names,fixtureCount:20,rpcs:scope.fixture.rpcs,callsPerRpc:2,log:out+'/logs/tp01-d-replay.log',logSha256:results.find(c=>c.id==='tp01-d-replay').logSha256,synthetic:true,formalAccepted:false});
 json('synthetic-inputs.json',{schema:'quantos-tp01-d-r02-synthetic-preflight/v1',sourceCommit,kind:'synthetic_in_memory',retiredHistoricalFactsConsumed:0,newCollection:false,realSourceLicenseGranted:false,
  sources:['crates/quantos-runtime/tests/research_orchestration.rs','crates/quantos-runtime/tests/signal_proposal_orchestration.rs'].map(path=>({path,sha256:digest(readFileSync(path)),catalog:'InMemoryDataSnapshotCatalog',artifactPayload:'synthetic snapshot marker only; no market records loaded'})),
  evidenceChecks:['r01-functional','r02-functional','r02-engine-consumers','tp01-d-runtime'],databaseExecution:false,formalAccepted:false});
 let integrityError=null;
 try{assert.deepEqual(inputs,inventory(selectors()));assert.deepEqual(plans,scope.necessaryClosure.map(id=>({nodeId:id,planInput:planInput(nodesFromPlans().get(id))})));assert.deepEqual(stages,[...nodesFromPlans().values()].map(n=>({nodeId:n.id,stage_gate:n.stage_gate})));assert.deepEqual(preserved,inventory(preservedSelectors));}catch(e){integrityError=e.message;}
 const passed=results.every(c=>c.status==='PASS')&&!integrityError;
 json('receipt.json',{schema:'quantos-tp01-d-local-preflight/v1',sourceCommit,status:passed?'PASS':'FAIL',scope:'interface, twenty double-RPC fixtures and synthetic R02 necessary prerequisite preflight; not complete closure admission',
  gate:{tp01D:'NOT_ASSESSED',r1Service:'NOT_ASSESSED',databaseExecution:false,production:false,formalAccepted:false},target:{database:'NOT_RUN',external:'NOT_RUN',performance:'NOT_RUN',checkpoint:'RELEASE-GATE:BETA'},
  registration:'PROPOSED_NOT_REGISTERED',necessaryClosure:scope.necessaryClosure,mappedExistingChecks:53,deferredChecks:14,checks:results.map(c=>({id:c.id,status:c.status})),integrityError,
  inputsSha256:digest(readFileSync(out+'/inputs.json')),plansSha256:digest(readFileSync(out+'/plans.json')),preservedEvidenceSha256:digest(readFileSync(out+'/preserved-evidence.json')),harness:inventory(harnessFiles)});
 assert(passed,'preflight failed; retain this attempt, correct the cause and use a new complete attempt');
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(base+'/run-preflight.mjs'))await run();
