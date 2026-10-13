import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {root,policy,nodesFromPlans,localChecks,localDeferred,digest} from '../../../../scripts/provider-a1-receipts.mjs';
import {verifyPublished,profile,nodeId,expectedNodes,manifest} from '../../../../scripts/tp02-local-gate.mjs';
const base='docs/audit/evidence/tp02-local-20261013',baseline='2c603df049c0c7842c24e98f2c8b372d2522557f',read=p=>readFileSync(root+'/'+p),json=p=>JSON.parse(read(p));
const gate=verifyPublished(),nodes=nodesFromPlans(),p=policy(),wrapper=json(manifest),source=gate.observedSourceCommit,index=json(wrapper.localPrerequisites.manifest),attempt=wrapper.localPrerequisites.manifest.slice(0,-'/local-prerequisites.json'.length);
assert.deepEqual(index.nodes.map(n=>n.nodeId),expectedNodes);assert.equal(index.deferred.length,13);
const executions=json(attempt+'/execution-results.json'),required=[...new Set(expectedNodes.flatMap(id=>localChecks(id,p,profile)))];assert.equal(required.length,44);assert.deepEqual(executions.map(c=>c.id).sort(),required.sort());
for(const c of executions){assert.equal(c.status,'PASS');assert.equal(c.exitCode,0);assert.equal(c.timedOut,false);assert.equal(c.signal,null);assert.equal(c.executionErrorCode,null);assert.equal(c.logSha256,digest(read(c.log)));assert.deepEqual(c.command,p.checks[c.id].command);assert(!p.checks[c.id].database&&!p.checks[c.id].target);}
assert.deepEqual(index.deferred,localDeferred(nodes,p,profile));
const tree=sha=>new Map(execFileSync('git',['ls-tree','-r','-z',sha],{cwd:root,maxBuffer:32*1024*1024}).toString().split('\0').filter(Boolean).map(line=>{const [meta,path]=line.split('\t');return[path,meta.split(' ')[2]];}));
const blob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),frozen=tree(source),inputs=new Map();
for(const n of index.nodes)for(const item of json(n.manifest).inputs){if(inputs.has(item.path))assert.deepEqual(inputs.get(item.path),item);inputs.set(item.path,item);}
let gitlinks=0;for(const [path,item]of inputs){if(item.gitCommit){gitlinks++;assert.equal(frozen.get(path),item.gitCommit);assert.equal(execFileSync('git',['-C',path,'rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),item.gitCommit);assert.equal(execFileSync('git',['-C',path,'status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),'');}else{const bytes=read(path);assert.equal(digest(bytes),item.sha256,path);assert.equal(blob(bytes),frozen.get(path),path+' differs from frozen candidate');}}
const preservation=json(attempt+'/canonical-preservation.json');assert.equal(preservation.sourceCommit,source);assert.equal(preservation.status,'PASS');assert.equal(preservation.restored,true);
for(const f of preservation.files){assert.equal(digest(read(f.path)),f.sha256);assert.equal(digest(read(attempt+'/original/'+f.path)),f.sha256);assert.equal(blob(read(f.path)),frozen.get(f.path),'canonical changed from frozen original');}
const old=tree(baseline);let preserved=0;for(const [path,id]of old){if(!path.startsWith('docs/audit/evidence/'))continue;assert(existsSync(root+'/'+path),path+' missing historical evidence');assert.equal(blob(read(path)),id,path+' historical evidence changed');preserved++;}
const prior=json(base+'/prior-stages.json');assert.equal(prior.baselineCommit,baseline);assert.equal(prior.stages.filter(n=>n.stage_gate.status==='READY').length,5);
const baselineTexts=['docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'].map(path=>execFileSync('git',['show',baseline+':'+path],{encoding:'utf8',maxBuffer:32*1024*1024}));assert.deepEqual(prior.stages,[...nodesFromPlans(baselineTexts)].map(([nodeId,n])=>({nodeId,stage_gate:n.stage_gate})));
let retainedFirstAttempt=0;for(const [path,id]of frozen){if(!path.startsWith('docs/audit/evidence/provider-a1-remediation-20261004/tp02-local-20261013/attempt-01/')&&!path.endsWith('03-publication-unregistered-plan-scope.log'))continue;assert.equal(blob(read(path)),id,'first failure evidence changed');retainedFirstAttempt++;}assert(retainedFirstAttempt>50);
const counts=Object.fromEntries(['READY','NOT_ASSESSED','BLOCKED'].map(s=>[s,[...nodes.values()].filter(n=>n.stage_gate.status===s).length]));assert.deepEqual(counts,{READY:1,NOT_ASSESSED:158,BLOCKED:0});assert.deepEqual([...nodes.values()].filter(n=>n.stage_gate.status==='READY').map(n=>n.id),[nodeId]);
const c=executions.find(c=>c.id==='tp02-development'),component=json(c.artifact),componentDir=c.artifact.replace(/[^/]+$/,''),replay=read(componentDir+'contract.log').toString(),runtime=read(componentDir+'runtime.log').toString();
assert.equal(component.observedSourceCommit,source);assert.equal(component.engineeringStatus,'PASS');assert.equal(component.fixtures.length,2);
for(const name of component.fixtures)assert(replay.includes('test_replay_contract_and_readable_artifact['+name+'] PASSED'));
assert.match(replay,/131 passed/);assert.match(runtime,/Python child cannot import vibe_adapter/);assert.match(runtime,/2 passed; 0 failed/);
assert.equal(component.package.installedIsolated,true);assert.equal(component.package.ownedChildReaped,true);assert.equal(component.package.realUpstreamRuntime,false);assert.equal(component.package.rpcCount,5);assert.equal(component.package.capabilities,2);
for(const w of component.package.wheels)assert.equal(digest(read(componentDir+'wheels/'+w.file)),'sha256:'+w.sha256);
const python=read(componentDir+'python.log').toString().trim().split(/\r?\n/).at(-1),pythonCount=Number(/^(\d+) passed/.exec(python)?.[1]);assert(pythonCount>=1382);
const cleanup=json(executions.find(c=>c.id==='tp02-process-cleanup').artifact);assert.equal(cleanup.status,'PASS');assert.deepEqual(cleanup.remaining,[]);
const result={status:'PASS',sourceCommit:source,necessaryNodes:13,localChecks:44,deferredChecks:13,fixtures:2,minimumFixtureRpcCalls:8,componentChecks:component.checks.length,pythonTests:pythonCount,installedWheels:2,rpcCount:5,inputEntries:inputs.size,inputFiles:inputs.size-gitlinks,gitlinks,preservedHistoricalFiles:preserved,restoredCanonicalFiles:preservation.files.length,retainedFirstAttemptFiles:retainedFirstAttempt,withdrawnPriorGates:5,stageCounts:counts,gate,target:{database:'NOT_RUN',external:'NOT_RUN',performance:'NOT_RUN',release:'NOT_ASSESSED',formalAccepted:false}};
if(process.argv.includes('--record'))writeFileSync(root+'/'+base+'/verification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
