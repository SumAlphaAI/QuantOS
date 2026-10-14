import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,rmSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync,execFileSync} from 'node:child_process';
import {digest,inventory,nodesFromPlans,planInput,staticEnvironment,executionOutcome} from './provider-a1-receipts.mjs';
export const directory='docs/audit/evidence/tp01-g-local-20261015/functional';
export const patchDirectory='forks/vibe-trading/upstream-prs/20261015-atomic-replay-handoff';
export const selectors=['engines/vibe-adapter/','engines/engine-sdk/','engines/tests/test_vibe_adapter_replacement.py','engines/tests/test_vibe_adapter_contract.py','scripts/tp01-g*','scripts/check-tp01-g-style.mjs',patchDirectory+'/','docs/operations/tp01-g-local-admission.md','docs/operations/tp01_vibe_deprecation_plan.md'];
export const commands=out=>[
 ['module-replacement',['engines/.venv/bin/python','-m','pytest','engines/tests/test_vibe_adapter_replacement.py','-q']],
 ['upstream-patch',['engines/.venv/bin/python','scripts/tp01-g-upstream-patch.py','--output-dir',out+'/patch']],
];
const read=p=>readFileSync(p),walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(p+'/'+d.name):[p+'/'+d.name]);
export const supportingPaths=r=>r.files.map(f=>f.path).sort();
// Reconstruct both submitted files from the pinned source and exact patch hunks.
export function applyReviewPatch(patch,source){
 const lines=patch.split('\n');assert.equal(lines.pop(),'');const result=new Map();let i=0;
 while(i<lines.length){
  const old=lines[i++];assert(old.startsWith('--- '));const next=lines[i++];assert(next.startsWith('+++ b/'));const path=next.slice(6);assert(!result.has(path));
  const original=old==='--- /dev/null'?[]:source.split('\n').slice(0,-1),output=[];let cursor=0;
  if(old!=='--- /dev/null')assert.equal(old,'--- a/agent/src/session/events.py');
  while(i<lines.length&&lines[i].startsWith('@@ ')){
   const h=/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(lines[i++]);assert(h);const oldStart=Math.max(Number(h[1])-1,0),oldCount=Number(h[2]??1),newCount=Number(h[4]??1);assert(oldStart>=cursor&&oldStart<=original.length);output.push(...original.slice(cursor,oldStart));cursor=oldStart;let removed=0,added=0;
   while(removed<oldCount||added<newCount){const line=lines[i++];assert(typeof line==='string');const kind=line[0],value=line.slice(1);assert([' ','-','+'].includes(kind));if(kind!=='+'){assert.equal(original[cursor++],value);removed++;}if(kind!=='-'){output.push(value);added++;}}
   assert.equal(removed,oldCount);assert.equal(added,newCount);
  }
  output.push(...original.slice(cursor));result.set(path,output.join('\n')+'\n');
 }
 assert.deepEqual([...result.keys()],['agent/src/session/events.py','tests/test_event_bus_replay_handoff.py']);return result;
}
export function verifyFunctional(r,{logDirectory=directory,expectedOutputDirectory=directory}={}){
 assert.equal(r.schema,'quantos-tp01-g-functional/v1');assert.equal(r.nodeId,'CORE:TP01-G');assert.equal(r.engineeringStatus,'PASS');assert.equal(r.stageGate,'NOT_ASSESSED');
 for(const k of ['formalAccepted','databaseExecution','externalExecution','performanceAccepted','externalPublished','upstreamAccepted'])assert.equal(r[k],false);
 assert.match(r.observedSourceCommit,/^[a-f0-9]{40}$/);assert.equal(r.outputDirectory,expectedOutputDirectory);assert.deepEqual(r.inputs,inventory(selectors));assert.deepEqual(r.planInput,planInput(nodesFromPlans().get(r.nodeId)));
 assert.equal(new Set(r.files.map(f=>f.path)).size,r.files.length);const files=new Map(r.files.map(f=>[f.path,f])),used=new Set();
 const get=p=>{assert(typeof p==='string'&&!p.startsWith('/')&&!p.includes('\\')&&!p.split('/').includes('..'));assert(files.has(p),'support file missing');used.add(p);const b=read(resolve(logDirectory,p));assert.equal(digest(b),files.get(p).sha256,'support bytes changed');return b;};
 const specs=commands(r.outputDirectory);assert.deepEqual(r.checks.map(c=>c.id),specs.map(([id])=>id));
 for(const [i,c]of r.checks.entries()){
  assert.deepEqual(c.command,specs[i][1]);assert.equal(c.status,'PASS');assert.equal(c.exitCode,0);assert.equal(c.timedOut,false);assert.equal(c.signal,null);assert.equal(c.executionErrorCode,null);assert.equal(c.timeoutMs,60000);assert(Number.isFinite(Date.parse(c.executedAt))&&Date.parse(c.executedAt)<=Date.now());assert.equal(c.log,c.id+'.log');const log=get(c.log).toString();assert.equal(digest(log),c.logSha256);
  assert.match(log,c.id==='module-replacement'?/186 passed/:/TP01-G_UPSTREAM_PATCH PASS tests=4 baseline_expected_failures=2 externalPublished=false/);
 }
 const m=JSON.parse(read(patchDirectory+'/manifest.json')),p=JSON.parse(get('patch/patch-check.json'));
 assert.equal(p.schema,'quantos-upstream-patch-check/v1');assert.equal(p.status,'PASS');assert.equal(p.baselineCommit,'c33133f4fd5e978d21d2a61fdd8787fb352b4687');assert.equal(p.sourceSha256,m.sourceSha256);assert.equal(p.patchSha256,digest(read(patchDirectory+'/'+m.patch)).slice(7));assert.equal(p.patchSha256,m.patchSha256);
 assert.equal(m.status,'DRAFT_NOT_SUBMITTED');assert.equal(m.upstreamPrUrl,null);assert.equal(m.externalPublished,false);assert.equal(m.productionAuthorization,false);
 for(const k of ['externalPublished','productionAuthorization','formalAccepted'])assert.equal(p[k],false);assert.equal(p.upstreamPrUrl,null);assert.equal(p.regressionTests,4);assert.equal(p.baselineExpectedFailures,2);
 assert.deepEqual(p.records.map(c=>[c.id,c.exitCode,c.expectedExitCode,c.status]),[['apply-check',0,0,'PASS'],['apply',0,0,'PASS'],['baseline-regression',1,1,'PASS'],['patched-regression',0,0,'PASS']]);
 for(const c of p.records){assert.equal(c.log,c.id+'.log');const log=get('patch/'+c.log).toString();assert.equal(digest(log).slice(7),c.logSha256);if(c.id.endsWith('regression')){assert.match(log,/Ran 4 tests/);assert.match(log,c.id==='baseline-regression'?/FAILED \(failures=2\)/:/\nOK\n/);assert.deepEqual(c.command,[resolve('engines/.venv/bin/python'),'-B','-m','unittest','discover','-s','tests','-p','test_event_bus_replay_handoff.py','-v']);}else assert.deepEqual(c.command,['git','apply',...(c.id==='apply-check'?['--check']:[]),resolve(patchDirectory+'/'+m.patch)]);}
 assert.equal(digest(get('patch/pinned-source.py')).slice(7),m.sourceSha256);const applied=applyReviewPatch(read(patchDirectory+'/'+m.patch).toString(),get('patch/pinned-source.py').toString());assert.equal(get('patch/patched-source.py').toString(),applied.get('agent/src/session/events.py'));assert.equal(get('patch/regression.py').toString(),applied.get('tests/test_event_bus_replay_handoff.py'));
 assert.deepEqual([...files.keys()].sort(),[...used].sort(),'support inventory must be exact');
 return {engineeringStatus:'PASS',stageGate:'NOT_ASSESSED',moduleTests:186,patchTests:4,formalAccepted:false,externalPublished:false};
}
export function record({outputDirectory=directory}={}){
 mkdirSync(outputDirectory,{recursive:true});const env={...staticEnvironment(process.env),UV_OFFLINE:'1'};delete env.NODE_TEST_CONTEXT;
 const checks=commands(outputDirectory).map(([id,command])=>{const executedAt=new Date().toISOString(),run=spawnSync(command[0],command.slice(1),{env,encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024}),log=(run.stdout??'')+(run.stderr??'');writeFileSync(outputDirectory+'/'+id+'.log',log);return{id,command,executedAt,...executionOutcome(run,60000),log:id+'.log',logSha256:digest(log)};});
 const r={schema:'quantos-tp01-g-functional/v1',nodeId:'CORE:TP01-G',engineeringStatus:checks.every(c=>c.status==='PASS')?'PASS':'FAIL',stageGate:'NOT_ASSESSED',formalAccepted:false,databaseExecution:false,externalExecution:false,performanceAccepted:false,externalPublished:false,upstreamAccepted:false,observedSourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),outputDirectory,inputs:inventory(selectors),planInput:planInput(nodesFromPlans().get('CORE:TP01-G')),checks,files:walk(outputDirectory).filter(p=>!p.endsWith('/receipt.json')).map(p=>({path:relative(outputDirectory,p),sha256:digest(read(p))})).sort((a,b)=>a.path.localeCompare(b.path))};
 writeFileSync(outputDirectory+'/receipt.json',JSON.stringify(r,null,2)+'\n');verifyFunctional(r,{logDirectory:outputDirectory,expectedOutputDirectory:outputDirectory});return r;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{assert.deepEqual(process.argv.slice(2),['--record']);rmSync(directory,{recursive:true,force:true});console.log(JSON.stringify(verifyFunctional(record())));}catch(e){console.error(e.message);process.exitCode=1;}}
