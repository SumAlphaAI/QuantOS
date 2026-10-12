// Read-only source preflight. All outputs stay in a new attempt; no canonical receipt writes.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {createRequire} from 'node:module';
import {base,expectedScope,validateScope} from './scope.mjs';
import {nodesFromPlans,planInput,policy,inventory,digest,staticEnvironment,executionOutcome,supportingArtifactPaths} from '../../../../scripts/provider-a1-receipts.mjs';
import {checks as componentChecks,selectors as componentSelectors} from '../../../../engines/rd-agent/check-development.mjs';
import {materialize} from './component-proof.mjs';
const root=process.cwd(),p=policy();
export const harnessFiles=['scope.mjs','scope.json','scope.test.mjs','run-preflight.mjs','verify-preflight.mjs','verify-preflight.test.mjs','component-proof.mjs','inspect-wheel.py'].map(n=>base+'/'+n).concat('docs/audit/TP02-local-scope-2026-10-12.md');
export const preservedSelectors=['docs/audit/evidence/tp02-20261009/','docs/audit/evidence/provider-a1-remediation-20261004/tp02-admission-20261009/','docs/audit/evidence/r03-prerequisites-20261011/','docs/audit/evidence/tp01-d-local-20261012/','docs/audit/evidence/provider-a1-remediation-20261004/tp01-d-local-20261012/','docs/audit/evidence/tp01-d-preflight-20261012/','docs/audit/evidence/f0-target-diagnostics-20261012/'];
export function selectors(){const s=expectedScope();return [...new Set([...p.commonInputs,...s.necessaryClosure.flatMap(id=>p.nodes[id].inputs),...componentSelectors,...harnessFiles])];}
export const checks=[
 ['scope',['node',base+'/scope.mjs'],[0],/PROPOSED_NOT_REGISTERED/],
 ['scope-negative',['node','--test',base+'/scope.test.mjs'],[0],/fail 0/],
 ['tp01-d-current-local',['make','tp01-d-local-check'],[0],/"stageGate": "READY"/],
 ['historical-tp02-rejected',['node','engines/rd-agent/check-development.mjs','--ready'],[1],/TP02 functional inputs changed/],
 ['strict-f0-rejected',['node','scripts/provider-a1-receipts.mjs','--f0'],[1],/dependency is not READY/],
 ['tp01-local-baseline',p.checks['tp01-local-baseline'].command,[0],/fork=verified/],
 ['capability',p.checks['tp01-capability'].command,[0],/11 complete capabilities/],
 ['intake',p.checks['tp-intake'].command,[0],/intake evidence is complete/],
 ['f08-functional',p.checks['f08-functional'].command,[0],/1382 passed/],
 ['f08-branches',p.checks['f08-branches'].command,[0],/fail 0/],
 ['f08-service',p.checks['f08-service'].command,[0],/PASS/],
 ['f0-negative',p.checks['fep0-negative'].command,[0],/fail 0/],
 ...componentChecks.map(c=>['tp02-'+c.id,c.command,[0],c.marker]),
 ['wheel-inspection',['engines/.venv/bin/python',base+'/inspect-wheel.py'],[0],/"status": "PASS"/],
 ['component-proof',['node',base+'/component-proof.mjs'],[0],/"engineeringStatus": "PASS"/],
 ['tp02-negative',p.checks['tp02-negatives'].command,[0],/fail 0/],
 ['r1-receipt-negative',p.checks['r1-receipt-negative'].command,[0],/fail 0/],
 ['plans',['node','scripts/check-development-plans.mjs'],[0],/PASS/],
 ['plans-negative',p.checks['plans-negative'].command,[0],/fail 0/],
 ['handoff',['make','development-handoff-check'],[0],/PASS/],
 ['process-cleanup',['node','scripts/r1-process-cleanup.cjs'],[0],/R1_PROCESS_CLEANUP PASS/],
];
export const actualCommand=(id,spec,out)=>id==='process-cleanup'?[...spec,out+'/process-cleanup.json']:id==='wheel-inspection'?[...spec,out+'/wheel-inspection.json']:id==='component-proof'?[...spec,out]:spec;
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
  if(id==='component-proof'){try{materialize(out,sourceCommit,results);}catch(e){json('component-materialization-failure.json',{status:'FAIL',message:e.message});}}
  const command=actualCommand(id,spec,out);
  const timeoutMs=id==='process-cleanup'?30000:1800000,executedAt=new Date().toISOString();
  const childEnv={...env,...(id==='r1-receipt-negative'?{QUANTOS_R1_PROCESS_PROBE:'1'}:{})};
  const r=spawnSync(command[0],command.slice(1),{cwd:root,env:childEnv,encoding:'utf8',timeout:timeoutMs,maxBuffer:64*1024*1024});
  const output=(r.stdout??'')+(r.stderr??''),log=out+'/logs/'+id+'.log';writeFileSync(log,output);const outcome=executionOutcome(r,timeoutMs);
  results.push({id,command,executedAt,completedAt:new Date().toISOString(),...outcome,allowedExitCodes,expectedMarker:marker.source,status:allowedExitCodes.includes(r.status)&&!outcome.timedOut&&!outcome.executionErrorCode&&!outcome.signal&&marker.test(output)?'PASS':'FAIL',log,logSha256:digest(output)});
  const result=results.at(-1);result.supporting=[];
  try{if(r.status===0){
   if(id==='f08-service'){const spec=p.checks[id],raw=JSON.parse(readFileSync(spec.artifact)),dir=out+'/supporting/f08-service';mkdirSync(dir,{recursive:true});for(const name of ['receipt.json',...supportingArtifactPaths(spec.artifactKind,raw)]){const from='artifacts/f08-target/'+name,to=dir+'/'+name;mkdirSync(resolve(to,'..'),{recursive:true});copyFileSync(from,to);result.supporting.push({path:to,sha256:digest(readFileSync(to))});}}
   for(const path of id==='f08-functional'?['target/f08-python-coverage.json','target/f08-rust-coverage.json']:id==='f08-branches'?['target/f08-rust-nightly-coverage.json']:[]){const bytes=readFileSync(path);JSON.parse(bytes);const to=out+'/supporting/'+path.split('/').at(-1)+'.gz';mkdirSync(out+'/supporting',{recursive:true});writeFileSync(to,gzipSync(bytes,{level:9}));result.supporting.push({path:to,sha256:digest(readFileSync(to)),uncompressedSha256:digest(bytes)});}
  }
  }catch(e){result.status='FAIL';result.supportingError=e.message;}
  json('execution-results.json',results);console.log(id+': '+results.at(-1).status+' exit='+r.status);
 }
 try{for(const c of checks.filter(c=>c[0]!=='process-cleanup'))execute(c);}finally{execute(checks.at(-1));}
 json('fixture-matrix.json',{schema:'quantos-tp02-fixture-preflight/v1',sourceCommit,fixtureNames:scope.fixture.names,fixtureCount:2,rpcs:scope.fixture.rpcs,callsPerRpc:2,minimumDeterministicCalls:8,log:out+'/logs/tp02-contract.log',logSha256:results.find(c=>c.id==='tp02-contract').logSha256,synthetic:true,snapshotBytesResolved:false,toolsExecuted:false,formalAccepted:false});
 let integrityError=null;
 try{assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceCommit,'candidate changed during preflight');assert.deepEqual(inputs,inventory(selectors()));assert.deepEqual(plans,scope.necessaryClosure.map(id=>({nodeId:id,planInput:planInput(nodesFromPlans().get(id))})));assert.deepEqual(stages,[...nodesFromPlans().values()].map(n=>({nodeId:n.id,stage_gate:n.stage_gate})));assert.deepEqual(preserved,inventory(preservedSelectors));}catch(e){integrityError=e.message;}
 const passed=results.every(c=>c.status==='PASS')&&!integrityError;
 json('receipt.json',{schema:'quantos-tp02-local-preflight/v1',sourceCommit,status:passed?'PASS':'FAIL',scope:'TP02 interface, two fixture replay, installed wheels and necessary prerequisite preflight; not complete closure admission',
  gate:{tp02:'NOT_ASSESSED',r1Service:'NOT_ASSESSED',databaseExecution:false,production:false,formalAccepted:false},target:{database:'NOT_RUN',external:'NOT_RUN',performance:'NOT_RUN',checkpoint:'RELEASE-GATE:BETA'},
  registration:'PROPOSED_NOT_REGISTERED',necessaryClosure:scope.necessaryClosure,mappedExistingChecks:44,deferredChecks:12,checks:results.map(c=>({id:c.id,status:c.status})),integrityError,
  inputsSha256:digest(readFileSync(out+'/inputs.json')),plansSha256:digest(readFileSync(out+'/plans.json')),preservedEvidenceSha256:digest(readFileSync(out+'/preserved-evidence.json')),harness:inventory(harnessFiles)});
 assert(passed,'preflight failed; retain this attempt, correct the cause and use a new complete attempt');
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(base+'/run-preflight.mjs'))await run();
