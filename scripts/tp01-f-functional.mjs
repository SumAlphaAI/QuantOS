import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,rmSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync,execFileSync} from 'node:child_process';
import {createHmac} from 'node:crypto';
import {digest,inventory,nodesFromPlans,planInput,staticEnvironment,executionOutcome} from './provider-a1-receipts.mjs';
import {evaluateRollout,buildReleaseManifest,buildRolloutState,renderCanarySummaryMarkdown,renderDrillReportMarkdown} from './tp01-vibe-rollout-lib.mjs';

export const directory='docs/audit/evidence/tp01-f-local-20261014/functional';
const policyPath='third_party/vibe-trading/canary-policy.json',catalogPath='engines/vibe-adapter/src/vibe_adapter/fixtures/catalog.json';
export const selectors=['engines/vibe-adapter/','engines/engine-sdk/','engines/tests/test_vibe_adapter_rollout.py','engines/tests/test_vibe_adapter_contract.py','engines/tests/test_vibe_adapter_skeleton.py','scripts/tp01-f-functional.mjs','scripts/tp01-vibe-*.mjs','scripts/tests/tp01-vibe-rollout.test.mjs','scripts/fixtures/tp01-vibe-canary/',policyPath,'docs/operations/tp01_vibe_canary_dashboards.json','docs/operations/tp01_vibe_canary_alert_rules.yaml','docs/runbooks/tp01_vibe_adapter_rollback.md','docs/operations/tp01-f-local-admission.md','.github/workflows/tp01_vibe_canary_gate.yml'];
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p));
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export const commands=out=>[
 ['python-rollout',['engines/.venv/bin/python','-m','pytest','engines/tests/test_vibe_adapter_rollout.py','-q']],
 ['local-drill',['engines/.venv/bin/python','-m','vibe_adapter.local_drill','--output-dir',out+'/drill','--policy',policyPath,'--catalog',catalogPath]],
 ['rollout-regressions',['node','--test','--test-reporter=tap','scripts/tests/tp01-vibe-rollout.test.mjs']],
 ...['healthy-7d','alert-breach','rollback-drill'].map(id=>[id,['node','scripts/tp01-vibe-canary.mjs','--policy',policyPath,'--scenario','scripts/fixtures/tp01-vibe-canary/'+id+'.json','--output-dir',out+'/'+id,'--verify-expected']]),
];
const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(p+'/'+d.name):[p+'/'+d.name]);
export const supportingPaths=r=>r.files.map(f=>f.path).sort();
export function verifyFunctional(r,{logDirectory=directory,expectedOutputDirectory=directory}={}){
 assert.equal(r.schema,'quantos-tp01-f-functional/v1');assert.equal(r.nodeId,'CORE:TP01-F');assert.equal(r.engineeringStatus,'PASS');assert.equal(r.stageGate,'NOT_ASSESSED');
 for(const key of ['formalAccepted','databaseExecution','externalExecution','performanceAccepted','targetCanaryAccepted','targetRollbackAccepted'])assert.equal(r[key],false);
 assert.match(r.observedSourceCommit,/^[a-f0-9]{40}$/);assert.equal(r.outputDirectory,expectedOutputDirectory);
 assert.deepEqual(r.planInput,planInput(nodesFromPlans().get(r.nodeId)));assert.deepEqual(r.inputs,inventory(selectors));
 assert.equal(new Set(r.files.map(f=>f.path)).size,r.files.length);const files=new Map(r.files.map(f=>[f.path,f])),required=new Set();
 const get=p=>{assert(typeof p==='string'&&!p.startsWith('/')&&!p.includes('\\')&&!p.split('/').includes('..'));assert(files.has(p),'support file missing');required.add(p);const bytes=read(resolve(logDirectory,p));assert.equal(digest(bytes),files.get(p).sha256,'support file changed');return bytes;};
 const specs=commands(r.outputDirectory);assert.deepEqual(r.checks.map(c=>c.id),specs.map(([id])=>id));
 for(const [i,c]of r.checks.entries()){
  assert.deepEqual(c.command,specs[i][1]);assert.equal(c.exitCode,0);assert.equal(c.status,'PASS');assert.equal(c.timedOut,false);assert.equal(c.signal,null);assert.equal(c.executionErrorCode,null);assert.equal(c.timeoutMs,60000);assert(Number.isFinite(Date.parse(c.executedAt))&&Date.parse(c.executedAt)<=Date.now());assert.equal(c.log,c.id+'.log');const log=get(c.log).toString();assert.equal(digest(log),c.logSha256);
  if(c.id==='python-rollout')assert.match(log,/47 passed/);
  if(c.id==='local-drill')assert.match(log,/TP01-F_LOCAL_DRILL PASS probes=19/);
  if(c.id==='rollout-regressions'){for(const marker of ['# tests 15\n','# pass 15\n','# fail 0\n','# skipped 0\n'])assert(log.includes(marker));}
 }
 const drill=JSON.parse(get('drill/drill.json'));assert.equal(drill.schema,'quantos-tp01-f-local-drill/v1');assert.equal(drill.status,'PASS');assert.equal(drill.evidenceMode,'LOCAL_UDS_SIGNED_SYNTHETIC_RESEARCH');assert.equal(drill.signingAuthority,'PUBLIC_LOCAL_FIXTURE_ONLY');
 for(const key of ['formalAccepted','targetCanaryAccepted','targetRollbackAccepted','databaseExecution','externalExecution','performanceAccepted'])assert.equal(drill[key],false);
 const previous=read(catalogPath),candidate=json(catalogPath);candidate.fixtures[0].summary+=' local candidate-v2';
 const artifacts={previous, candidate:Buffer.from(canonical(candidate))};
 for(const [name,bytes]of Object.entries(artifacts)){
  assert.equal(get('drill/'+name+'.artifact.json').toString(),bytes.toString());const signed=JSON.parse(get('drill/'+name+'.signed-descriptor.json'));
  const expected={schema:'quantos-vibe-local-release/v1',releaseId:name==='candidate'?'candidate-v2':'previous-v1',artifactSha256:digest(bytes).slice(7),policySha256:digest(canonical(json(policyPath))).slice(7),scope:'LOCAL_RESEARCH_ONLY'};
  assert.deepEqual(signed.descriptor,expected);assert.equal(signed.signature,createHmac('sha256','tp01-f-public-local-fixture-authority').update(canonical(expected)).digest('hex'));
 }
 const expected=[['default-disabled','ENGINE_ROLLOUT_DISABLED'],['signature-rejected','ENGINE_ROLLOUT_SIGNATURE_INVALID'],['artifact-tamper-rejected','ENGINE_ROLLOUT_SIGNATURE_INVALID'],['previous-signature-rejected','ENGINE_ROLLOUT_SIGNATURE_INVALID'],['signed-candidate-dispatch','candidate-v2'],['replay-artifact-stable',true],['canary-excluded','ENGINE_ROLLOUT_NOT_SELECTED'],['shadow-isolated',true],['shadow-comparison',[1,1]],...['disable','rollback'].flatMap(a=>['unary','stream'].map(s=>[a+'-'+s,'ENGINE_ROLLOUT_REVOKED'])),['rollback-restored-provider','previous-v1'],['rollback-restored-digest',digest(previous).slice(7)],['healthy-thresholds',[]],['critical-alert-disabled',['critical','disabled']],['disabled-new-request','ENGINE_ROLLOUT_DISABLED'],['audit-sequence',true]];
 assert.deepEqual(drill.probes.map(p=>[p.id,p.expected]),expected);for(const probe of drill.probes){assert.equal(probe.passed,true);assert.deepEqual(probe.observed,probe.expected);}
 const events=JSON.parse(get('drill/runtime-events.json'));assert.equal(events.state,'disabled');assert.equal(events.formalAccepted,false);assert.equal(events.targetCanaryAccepted,false);assert.equal(events.databaseExecution,false);assert.equal(events.shadowCompleted,1);assert.equal(events.shadowMismatches,1);assert.equal(events.candidateTrafficPercent,0);assert.deepEqual(events.events.map(e=>e.sequence),events.events.map((_,i)=>i+1));
 for(const action of ['initialized','activation_rejected','canary_activated','dispatch_admitted','dispatch_excluded','artifact_committed','shadow_compared','rollback','metrics_observed','disable'])assert(events.events.some(e=>e.action===action),'missing runtime action '+action);
 for(const id of ['healthy-7d','alert-breach','rollback-drill']){
  const result=JSON.parse(get(id+'/canary-summary.json'));const computed=evaluateRollout({policyDocument:json(policyPath),scenario:json('scripts/fixtures/tp01-vibe-canary/'+id+'.json')});assert(Number.isFinite(Date.parse(result.generatedAt))&&Date.parse(result.generatedAt)<=Date.now());computed.generatedAt=result.generatedAt;assert.deepEqual(result,computed);
  assert.deepEqual(JSON.parse(get(id+'/release-manifest.json')),buildReleaseManifest(result));assert.deepEqual(JSON.parse(get(id+'/rollout-state.json')),buildRolloutState(result));assert.equal(get(id+'/canary-summary.md').toString(),renderCanarySummaryMarkdown(result));assert.equal(get(id+'/drill-report.md').toString(),renderDrillReportMarkdown(result));
 }
 assert.deepEqual([...files.keys()].sort(),[...required].sort(),'support files must be complete and exact');
 return {engineeringStatus:'PASS',stageGate:'NOT_ASSESSED',probes:19,pythonTests:47,regressionTests:15,formalAccepted:false};
}
export function record({outputDirectory=directory}={}){
 mkdirSync(outputDirectory,{recursive:true});const env={...staticEnvironment(process.env),CARGO_NET_OFFLINE:'true',UV_OFFLINE:'1',npm_config_offline:'true',QUANTOS_RELEASE_PERFORMANCE:'0'};delete env.NODE_TEST_CONTEXT;
 const checks=commands(outputDirectory).map(([id,command])=>{const executedAt=new Date().toISOString(),run=spawnSync(command[0],command.slice(1),{env,encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024}),bytes=(run.stdout??'')+(run.stderr??'');writeFileSync(outputDirectory+'/'+id+'.log',bytes);return{id,command,executedAt,...executionOutcome(run,60000),log:id+'.log',logSha256:digest(bytes)};});
 const r={schema:'quantos-tp01-f-functional/v1',nodeId:'CORE:TP01-F',engineeringStatus:checks.every(c=>c.status==='PASS')?'PASS':'FAIL',stageGate:'NOT_ASSESSED',formalAccepted:false,databaseExecution:false,externalExecution:false,performanceAccepted:false,targetCanaryAccepted:false,targetRollbackAccepted:false,observedSourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),outputDirectory,planInput:planInput(nodesFromPlans().get('CORE:TP01-F')),inputs:inventory(selectors),checks,files:walk(outputDirectory).filter(p=>!p.endsWith('/receipt.json')).map(p=>({path:relative(outputDirectory,p),sha256:digest(read(p))})).sort((a,b)=>a.path.localeCompare(b.path))};writeFileSync(outputDirectory+'/receipt.json',JSON.stringify(r,null,2)+'\n');verifyFunctional(r,{logDirectory:outputDirectory,expectedOutputDirectory:outputDirectory});return r;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{assert.deepEqual(process.argv.slice(2),['--record']);rmSync(directory,{recursive:true,force:true});console.log(JSON.stringify(verifyFunctional(record())));}catch(e){console.error(e.message);process.exitCode=1;}}
