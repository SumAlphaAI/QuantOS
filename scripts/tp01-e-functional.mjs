import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,rmSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {digest,inventory,nodesFromPlans,planInput,staticEnvironment,executionOutcome} from './provider-a1-receipts.mjs';
import {loadScenarios,classifyScenario,renderDecisionRecord,renderCandidateIssue,renderSummaryMarkdown} from './sync-vibe-lib.mjs';

export const directory='docs/audit/evidence/tp01-e-local-20261014/functional';
export const selectors=['scripts/sync-vibe.mjs','scripts/sync-vibe-lib.mjs','scripts/tp01-e-functional.mjs','scripts/tests/sync-vibe*.mjs','scripts/fixtures/tp01-vibe-sync/','scripts/fixtures/tp01-e-local/','.github/workflows/tp01_vibe_sync_gate.yml','third_party/vibe-trading/baseline.lock.json','forks/vibe-trading/patch-queue/queue.json','docs/operations/tp01-e-local-admission.md'];
const baselinePath='third_party/vibe-trading/baseline.lock.json',queuePath='forks/vibe-trading/patch-queue/queue.json',read=p=>readFileSync(p),json=p=>JSON.parse(read(p));
const scenarioCases=[['api-break','S1',true],['license-change','S1',true],['cve-high','S0',true],['patch-conflict','S1',true],['planned-sync','S2',false],['research-drift','S3',false]];
export const cases=[...scenarioCases.map(([id,severity,blocked])=>({id,kind:'scenario',input:'scripts/fixtures/tp01-vibe-sync/'+id+'.json',mode:'gate',expectedExit:blocked?2:0,severities:[severity],blocked})),
 {id:'monitor-blocked',kind:'report',variant:'normal',mode:'monitor',expectedExit:0,severities:['S3','S1'],blocked:true},
 {id:'gate-blocked',kind:'report',variant:'normal',mode:'gate',expectedExit:2,severities:['S3','S1'],blocked:true},
 {id:'s0-floor',kind:'report',variant:'s0',mode:'gate',expectedExit:2,severities:['S0'],blocked:true},
 {id:'clear-unapproved',kind:'report',variant:'empty',mode:'monitor',expectedExit:0,severities:[],blocked:false},
 {id:'stale-baseline',kind:'invalid',variant:'stale',mode:'monitor',expectedExit:1},
 {id:'malformed-report',kind:'invalid',variant:'malformed',mode:'monitor',expectedExit:1},
];
function inputFor(c){
 if(c.kind==='scenario')return read(c.input).toString();const r=json('scripts/fixtures/tp01-e-local/candidates.json');
 if(c.variant==='s0')r.candidates=[{...r.candidates[0],severity:'S0'}];
 if(c.variant==='empty')r.candidates=[];
 if(c.variant==='stale')r.baseline.upstream.commit='0'.repeat(40);
 if(c.variant==='malformed')return '{';
 return JSON.stringify(r,null,2)+'\n';
}
export function commandFor(c,out){
 if(c.id==='regressions')return ['node','--test','--test-reporter=tap','scripts/tests/sync-vibe.test.mjs','scripts/tests/sync-vibe-cli.test.mjs'];
 const d=out+'/'+c.id;return ['node','scripts/sync-vibe.mjs','--baseline',baselinePath,'--patch-queue',queuePath,c.kind==='scenario'?'--scenario':'--candidate-report',d+'/input.json','--json-output',d+'/summary.json','--markdown-output',d+'/summary.md','--decision-dir',d+'/decisions','--issue-dir',d+'/issues',...(c.mode==='monitor'?['--monitor-only']:['--fail-on-block']),...(c.kind==='scenario'?['--verify-expected']:[])];
}
const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(p+'/'+d.name):[p+'/'+d.name]);
export function supportingPaths(r){return r.files.map(f=>f.path).sort();}
export function verifyFunctional(r,{logDirectory=directory,expectedOutputDirectory=directory}={}){
 assert.equal(r.schema,'quantos-tp01-e-functional/v1');assert.equal(r.nodeId,'CORE:TP01-E');assert.equal(r.engineeringStatus,'PASS');assert.equal(r.stageGate,'NOT_ASSESSED');
 for(const key of ['formalAccepted','databaseExecution','externalExecution','performanceAccepted','syncApproved'])assert.equal(r[key],false);
 assert.match(r.observedSourceCommit,/^[a-f0-9]{40}$/);assert.equal(r.outputDirectory,expectedOutputDirectory);assert.deepEqual(r.planInput,planInput(nodesFromPlans().get(r.nodeId)));assert.deepEqual(r.inputs,inventory(selectors));
 const expected=[{id:'regressions',expectedExit:0},...cases];assert.deepEqual(r.checks.map(c=>c.id),expected.map(c=>c.id));
 assert.equal(new Set(r.files.map(f=>f.path)).size,r.files.length);const files=new Map(r.files.map(f=>[f.path,f]));
 const get=p=>{assert(typeof p==='string'&&!p.startsWith('/')&&!p.includes('\\')&&!p.split('/').includes('..'),'unsafe support path');assert(files.has(p),'unlisted support file');const bytes=read(resolve(logDirectory,p));assert.equal(digest(bytes),files.get(p).sha256,'supporting file changed');return bytes;};
 for(const f of r.files)get(f.path);
 const required=new Set();
 for(const [i,c]of r.checks.entries()){
  const e=expected[i];assert.deepEqual(c.command,commandFor(e,r.outputDirectory));assert.equal(c.exitCode,e.expectedExit);assert.equal(c.status,e.expectedExit===0?'PASS':'FAIL');assert.equal(c.expectedExitCode,e.expectedExit);assert.equal(c.timedOut,false);assert.equal(c.signal,null);assert.equal(c.executionErrorCode,null);assert.equal(c.timeoutMs,30000);assert.equal(c.expectationMet,true);assert(Number.isFinite(Date.parse(c.executedAt))&&Date.parse(c.executedAt)<=Date.now());
  assert.equal(c.log,c.id+'.log');required.add(c.log);const log=get(c.log).toString();assert.equal(digest(log),c.logSha256);
  if(c.id==='regressions'){assert.match(log,/# tests 23\n/);assert.match(log,/# pass 23\n/);assert.match(log,/# fail 0\n/);continue;}
  const input=c.id+'/input.json';required.add(input);assert.equal(get(input).toString(),inputFor(e),'synthetic input drift');
  if(e.kind==='invalid'){assert.equal(c.summary,null);assert.match(log,/invalid upstream candidate report|SyntaxError/);continue;}
  assert.equal(c.summary,c.id+'/summary.json');required.add(c.summary);const summary=JSON.parse(get(c.summary));assert.equal(summary.schemaVersion,1);assert.equal(summary.syncApproved,false);assert.equal(summary.executionMode,e.mode);assert.equal(summary.monitoringStatus,'COMPLETED');assert.equal(summary.syncGateStatus,e.blocked?'BLOCKED':'CLEAR');assert.deepEqual(summary.decisions.map(d=>d.severity),e.severities);assert.equal(summary.blockedCandidateCount,summary.decisions.filter(d=>d.blocked).length);assert.equal(summary.decisions.some(d=>d.blocked),e.blocked);
  const baseline=json(baselinePath),patchQueue=json(queuePath);assert.deepEqual(summary.baseline,baseline);assert.deepEqual(summary.patchQueue,patchQueue);
  const loaded=loadScenarios({baseline,...(e.kind==='scenario'?{scenarioPath:resolve(logDirectory,input)}:{candidateReportPath:resolve(logDirectory,input)})});
  const computed=loaded.map(scenario=>classifyScenario({baseline,patchQueue,scenario}));
  assert.deepEqual(summary.decisions.map(({generatedAt,...d})=>d),computed.map(({generatedAt,...d})=>d),'classification or blocking changed');
  const md=c.id+'/summary.md';required.add(md);assert.equal(get(md).toString(),renderSummaryMarkdown(summary));
  for(const d of summary.decisions){const decision=c.id+'/decisions/'+d.slug+'.md',issue=c.id+'/issues/'+d.slug+'.md';required.add(decision);required.add(issue);assert.equal(get(decision).toString(),renderDecisionRecord(d));assert.equal(get(issue).toString(),renderCandidateIssue(d));}
 }
 assert.deepEqual([...files.keys()].sort(),[...required].sort(),'complete supporting originals required');
 return {engineeringStatus:'PASS',stageGate:'NOT_ASSESSED',formalAccepted:false,cases:12,regressionTests:23,expectedNonzero:cases.filter(c=>c.expectedExit!==0).length};
}
export function record({outputDirectory=directory}={}){
 mkdirSync(outputDirectory,{recursive:true});const env=staticEnvironment(process.env);delete env.NODE_TEST_CONTEXT;Object.assign(env,{CARGO_NET_OFFLINE:'true',UV_OFFLINE:'1',npm_config_offline:'true',QUANTOS_RELEASE_PERFORMANCE:'0'});
 const checks=[];for(const c of [{id:'regressions',expectedExit:0},...cases]){
  if(c.id!=='regressions'){mkdirSync(outputDirectory+'/'+c.id,{recursive:true});writeFileSync(outputDirectory+'/'+c.id+'/input.json',inputFor(c));}
  const command=commandFor(c,outputDirectory),executedAt=new Date().toISOString(),run=spawnSync(command[0],command.slice(1),{encoding:'utf8',env,timeout:30000,maxBuffer:8*1024*1024}),bytes=(run.stdout??'')+(run.stderr??'');writeFileSync(outputDirectory+'/'+c.id+'.log',bytes);
  checks.push({id:c.id,command,executedAt,...executionOutcome(run,30000),expectedExitCode:c.expectedExit,expectationMet:run.status===c.expectedExit&&!run.error&&!run.signal,log:c.id+'.log',logSha256:digest(bytes),summary:c.id==='regressions'||c.kind==='invalid'?null:c.id+'/summary.json'});
 }
 const r={schema:'quantos-tp01-e-functional/v1',nodeId:'CORE:TP01-E',engineeringStatus:checks.every(c=>c.expectationMet)?'PASS':'FAIL',stageGate:'NOT_ASSESSED',formalAccepted:false,databaseExecution:false,externalExecution:false,performanceAccepted:false,syncApproved:false,observedSourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),outputDirectory,planInput:planInput(nodesFromPlans().get('CORE:TP01-E')),inputs:inventory(selectors),checks,files:walk(outputDirectory).filter(p=>!p.endsWith('/receipt.json')).map(p=>({path:relative(outputDirectory,p),sha256:digest(read(p))})).sort((a,b)=>a.path.localeCompare(b.path))};
 writeFileSync(outputDirectory+'/receipt.json',JSON.stringify(r,null,2)+'\n');verifyFunctional(r,{logDirectory:outputDirectory,expectedOutputDirectory:outputDirectory});return r;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{assert.deepEqual(process.argv.slice(2),['--record']);rmSync(directory,{recursive:true,force:true});const r=record();console.log(JSON.stringify({engineeringStatus:r.engineeringStatus,cases:cases.length,stageGate:r.stageGate,formalAccepted:false}));}catch(e){console.error(e.message);process.exitCode=1;}}
