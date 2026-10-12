// Reproducible read-only DEVELOPMENT preflight, deliberately not an admission publisher.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync, existsSync, cpSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';

const root=process.cwd(), base='docs/audit/evidence/r1-service-preflight-20261012';
const attempt=process.argv[2];
assert(/^attempt-\d{2}$/.test(attempt??''),'supply a new attempt-NN');
const out=base+'/'+attempt;
assert(!existsSync(out),'never overwrite an attempt');
const {nodesFromPlans, planInput, policy, closure, inventory, digest, staticEnvironment, executionOutcome, localPolicy}=await import(root+'/scripts/provider-a1-receipts.mjs');
const {selectors:adapterSelectors}=await import(root+'/engines/vibe-adapter/check-development.mjs');
const {snapshot}=createRequire(import.meta.url)(root+'/scripts/lib/test-engine-processes.cjs');
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert.equal(execFileSync('git',['diff','HEAD','--name-only'],{encoding:'utf8'}).trim(),'','start with unchanged tracked files');
const nodes=nodesFromPlans(), p=policy(), gate=nodes.get('CORE-GATE:R1-SERVICE');
const necessary=closure(nodes,'CORE:TP01-C');
const selected=[...new Set(gate.dependencies.flatMap(id=>closure(nodes,id)))];
const selectors=[...new Set([...p.commonInputs,...selected.filter(id=>p.nodes[id]).flatMap(id=>p.nodes[id].inputs),...adapterSelectors])];
const inputs=inventory(selectors), plans=selected.map(id=>({nodeId:id,planInput:planInput(nodes.get(id))}));
mkdirSync(out+'/logs',{recursive:true});
const json=(path,value)=>writeFileSync(path,JSON.stringify(value,null,2)+'\n');
json(out+'/inputs.json',inputs);json(out+'/plans.json',plans);
json(out+'/initial-stages.json',[...nodes.values()].map(n=>({nodeId:n.id,stage_gate:n.stage_gate})));
json(out+'/inventory.json',{sourceCommit,checkpoint:gate.id,requiredScope:gate.required_scope,
  dependencies:gate.dependencies.map(id=>({nodeId:id,developmentStatus:nodes.get(id).development_status,stageGate:nodes.get(id).stage_gate,
    scopedProfile:['CORE:TP03','CORE:TP04','CORE:R04'].includes(id)?'R04_LOCAL':id==='CORE:R03'?'R03_LOCAL':null,
    r1Admission:'NOT_ASSESSED',reason:nodes.get(id).stage_gate.status==='READY'?'existing local consumer scope; no R1 aggregate proof':'fresh consumer-scoped local receipt required'})),
  necessaryClosure:necessary,coveredScope:'TP01-C component, TP01-B intake, F08 and F0 structural/current-local evidence preflight only',
  missing:['TP01-C/R1 local admission profile and consumer-bound receipts','fresh local admission for the ten NOT_ASSESSED direct dependencies','R1 aggregate same-candidate functional replay/lifecycle proof'],
  targetAcceptance:{status:'NOT_RUN',checkpoint:'RELEASE-GATE:BETA'},formalAccepted:false});
// Preserve hashes of old failed and successful receipts without rewriting their bytes.
const preserved=inventory(['docs/audit/evidence/tp01-c-20261009/',
  'docs/audit/evidence/provider-a1-remediation-20261004/tp01-c-admission-20261009/',
  'docs/audit/evidence/f0-target-diagnostics-20261012/',
  'docs/audit/evidence/provider-a1-remediation-20261004/r04-completion-20261012/',
  'docs/audit/evidence/r04-completion-20261012/',
  'docs/audit/evidence/local-development-20261012/',
  'docs/audit/evidence/r03-20261011/']);
json(out+'/preserved-evidence.json',preserved);
const baseline={...snapshot(root),scopeTag:randomBytes(4).toString('hex')};
json(out+'/process-baseline.json',baseline);
const env=staticEnvironment(process.env);
env.PATH='/Users/anray/Library/pnpm/.tools/pnpm/10.20.0/bin:'+env.PATH;
env.UV_OFFLINE='1';env.CARGO_NET_OFFLINE='true';
env.QUANTOS_TEST_ENGINE_SCOPE=baseline.scopeTag;
env.QUANTOS_R1_ENGINE_BASELINE=resolve(out+'/process-baseline.json');
const checks=[
 ['historical-tp01-c-rejected',['node','engines/vibe-adapter/check-development.mjs','--verify'],[1],/current functional inputs changed/],
 ['strict-tp01-c-rejected',['node','engines/vibe-adapter/check-development.mjs','--ready'],[1],/current functional inputs changed/],
 ['strict-f0-rejected',['node','scripts/provider-a1-receipts.mjs','--f0'],[1],/functional manifest must be under approved evidence directory/],
 ['capability',p.checks['tp01-capability'].command,[0],/11 complete capabilities/],
 ['intake',p.checks['tp-intake'].command,[0],/intake evidence is complete/],
 ['f0-structure',p.checks.plans.command,[0],/PASS/],
 ['f0-plan-negative',p.checks['plans-negative'].command,[0],/fail 0/],
 ['f0-receipt-negative',p.checks['fep0-negative'].command,[0],/fail 0/],
 ['f0-current-local',['make','f0-local-check'],[0],/READY/],
 ['f08-functional',p.checks['f08-functional'].command,[0],/fail 0/],
 ['f08-branches',p.checks['f08-branches'].command,[0],/fail 0/],
 ['f08-service',p.checks['f08-service'].command,[0],/"status": "PASS"/],
 ['python',['engines/.venv/bin/python','-m','pytest','engines/tests','-q'],[0],/1382 passed/],
 ['manager',['cargo','test','--locked','--offline','-p','quantos-engine-manager'],[0],/python_vibe_adapter_contracts_round_trip_over_uds \.\.\. ok/],
 ['ruff',['engines/.venv/bin/ruff','check','engines/vibe-adapter','engines/tests/test_vibe_adapter_skeleton.py'],[0],/All checks passed/],
 ['format',['engines/.venv/bin/ruff','format','--check',...['service','context','allowlist','artifact_api','server'].map(n=>'engines/vibe-adapter/src/vibe_adapter/'+n+'.py'),'engines/tests/test_vibe_adapter_skeleton.py'],[0],/6 files already formatted/],
 ['pyright',['engines/.venv/bin/pyright','--project','engines','--pythonpath','engines/.venv/bin/python','engines/vibe-adapter/src','engines/tests/test_vibe_adapter_skeleton.py'],[0],/0 errors, 0 warnings/],
 ['lock',['uv','lock','--check','--offline','--project','engines'],[0],/Resolved 52 packages/],
 ['plans',['node','scripts/check-development-plans.mjs'],[0],/PASS/],
 ['adapter-focused',['engines/.venv/bin/python','-m','pytest','engines/tests/test_vibe_adapter_contract.py','engines/tests/test_vibe_adapter_skeleton.py','-q'],[0],/passed/],
 ['receipt-negative',['node','--test','scripts/tp01-c-functional-artifacts.test.mjs','scripts/provider-a1-receipts.test.mjs','scripts/local-development-gate.test.mjs'],[0],/fail 0/],
 ['handoff',['make','development-handoff-check'],[0],/PASS/],
];
const results=[];
function run([id,command,allowedExitCodes,marker],timeoutMs=1800000){
 const executedAt=new Date().toISOString(),r=spawnSync(command[0],command.slice(1),{cwd:root,env,encoding:'utf8',timeout:timeoutMs,maxBuffer:64*1024*1024});
 const output=(r.stdout??'')+(r.stderr??''),log=out+'/logs/'+id+'.log';writeFileSync(log,output);
 const outcome=executionOutcome(r,timeoutMs);
 const result={id,command,executedAt,completedAt:new Date().toISOString(),...outcome,allowedExitCodes,expectedMarker:marker.source,
   status:allowedExitCodes.includes(r.status)&&!outcome.timedOut&&!outcome.executionErrorCode&&!outcome.signal&&marker.test(output)?'PASS':'FAIL',log,logSha256:digest(output)};
 results.push(result);json(out+'/execution-results.json',results);console.log(id+': '+result.status+' exit='+r.status);
}
try{for(const check of checks)run(check);}
finally{run(['process-cleanup',['node','scripts/r1-process-cleanup.cjs',out+'/process-cleanup.json'],[0],/R1_PROCESS_CLEANUP PASS/],30000);}
// Profile refusal is an explicit scope negative, never an excuse to execute target commands.
assert.throws(()=>localPolicy('TP01_C_LOCAL'),/unsupported local profile/);
json(out+'/scope-negative.json',{status:'PASS',unregisteredProfileRejected:true,r04ScopeTransferred:false,formalAccepted:false});
cpSync('artifacts/f08-target/receipt.json',out+'/f08-service.json');
assert.deepEqual(inputs,inventory(selectors),'functional inputs changed during preflight');
assert.deepEqual(plans,selected.map(id=>({nodeId:id,planInput:planInput(nodesFromPlans().get(id))})),'normative plan changed');
for(const entry of preserved)assert.equal(digest(readFileSync(entry.path)),entry.sha256,'historical evidence changed: '+entry.path);
assert.deepEqual(JSON.parse(readFileSync(out+'/initial-stages.json')),[...nodesFromPlans().values()].map(n=>({nodeId:n.id,stage_gate:n.stage_gate})),'preflight must not publish stages');
const passed=results.every(r=>r.status==='PASS');
json(out+'/receipt.json',{schema:'quantos-tp01-c-r1-preflight/v1',sourceCommit,executedAt:new Date().toISOString(),status:passed?'PASS':'FAIL',
  scope:'local interface/fixture and necessary prerequisite preflight, not full dependency admission',
  gate:{tp01C:'NOT_ASSESSED',r1Service:'NOT_ASSESSED',production:false,formalAccepted:false},
  target:{database:'NOT_RUN',external:'NOT_RUN',performance:'NOT_RUN',checkpoint:'RELEASE-GATE:BETA'},
  necessaryClosure:necessary,checks:results.map(r=>({id:r.id,status:r.status})),
  inputs:{path:out+'/inputs.json',sha256:digest(readFileSync(out+'/inputs.json'))},
  preservedEvidence:{path:out+'/preserved-evidence.json',files:preserved.length,sha256:digest(readFileSync(out+'/preserved-evidence.json'))},
  runner:{path:base+'/run-preflight.mjs',sha256:digest(readFileSync(base+'/run-preflight.mjs'))}});
assert(passed,'preflight failed; preserve this attempt and create a new one after remediation');
