import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

import {nodesFromPlans,planInput,localPolicy,localChecks,localDeferred,policy,digest,staticEnvironment} from './provider-a1-receipts.mjs';
import {profile,nodeId,expectedNodes,manifest,handoff,deferredTargets,verify,publish,releaseCheck,coverage,selectedNodes} from './s2-service-local-gate.mjs';
const nodes=nodesFromPlans(),p=policy(),selected=selectedNodes(nodes);
function fixture(){
 const local={status:'LOCAL_READY',owner:nodeId,profile,inputDigest:digest('index'),observedSourceCommit:'a'.repeat(40),nodes:selected.map(nodeId=>({nodeId,manifest:nodeId,inputDigest:digest(nodeId)}))};
 const own=local.nodes.at(-1),result={coverage:{unitOnly:true},dependencyResultsDigest:digest('results')};
 const readFunctional=path=>path==='artifact'?result:{checks:[{id:'s2-service-functional',artifact:'artifact'}]};
 const options={nodes,validateLocal:()=>local,readFunctional,readLog:()=>'',components:()=>({unitOnly:true}),validateEvidence:()=>({status:'PASS'})};
 const r={schema:'quantos-s2-service-local-development/v1',nodeId,stage:'DEVELOPMENT',profile,status:'READY',engineeringStatus:'PASS',databaseExecution:false,production:false,formalAccepted:false,externalExecution:false,performanceAccepted:false,syncApproved:false,targetCanaryAccepted:false,targetRollbackAccepted:false,externalPublished:false,upstreamAccepted:false,observedSourceCommit:local.observedSourceCommit,planInput:planInput(nodes.get(nodeId)),localPrerequisites:{manifest:'unit-index',inputDigest:local.inputDigest},functionalManifest:own.manifest,functionalDigest:own.inputDigest,dependencies:nodes.get(nodeId).dependencies.map(id=>({nodeId:id,status:'LOCAL_READY',owner:nodeId,inputDigest:digest(id)})),release:{checkpoint:'RELEASE-GATE:BETA',status:'NOT_RUN',handoff,prerequisiteChecks:localDeferred(nodes,p,profile),functionalTargets:structuredClone(deferredTargets)}};
 r.coverage=coverage(local,{read:readFunctional,readLog:options.readLog,components:options.components,validateEvidence:options.validateEvidence});return {r,local,result,options,run:()=>verify(r,options)};
}
test('exact 39 nodes and 124 dependency groups before 3 own checks',()=>{assert.deepEqual(selected,expectedNodes);const all=[...new Set(selected.flatMap(id=>localChecks(id,p,profile)))];assert.equal(all.length,127);assert.deepEqual(all.slice(-3),['s2-service-functional','s2-service-negatives','s2-service-local-policy']);assert.equal(localDeferred(nodes,p,profile).length,22);assert.deepEqual(localPolicy(profile).roots,[nodeId]);for(const id of all)assert(!p.checks[id].external&&!p.checks[id].database&&!p.checks[id].target&&!p.checks[id].performance);});
test('valid evaluation admits no runtime or target',()=>{const f=fixture();assert.equal(f.run().stageGate,'READY');assert.equal(f.r.coverage.runtimeAdmission,'DENIED');assert.throws(releaseCheck,/NOT_RUN/);});
test('environment strips all credentials',()=>assert.deepEqual(staticEnvironment({DATABASE_URL:'private',SUPABASE_URL:'private',GH_TOKEN:'private'}),{QUANTOS_SKIP_ENV:'1'}));
for(const key of ['databaseExecution','production','formalAccepted','externalExecution','performanceAccepted','syncApproved','targetCanaryAccepted','targetRollbackAccepted','externalPublished','upstreamAccepted'])test('rejects promoted '+key,()=>{const f=fixture();f.r[key]=true;assert.throws(f.run);});
for(const id of expectedNodes)test('cannot omit '+id,()=>{const f=fixture();f.local.nodes=f.local.nodes.filter(n=>n.nodeId!==id);assert.throws(f.run);});
for(const key of ['inputDigest','observedSourceCommit','owner','profile','status'])test('rejects index substitution '+key,()=>{const f=fixture();f.local[key]='wrong';assert.throws(f.run);});
for(const key of ['schema','profile','nodeId','functionalManifest','functionalDigest','engineeringStatus'])test('rejects receipt substitution '+key,()=>{const f=fixture();f.r[key]='wrong';assert.throws(f.run);});
test('failed evidence validation rejects admission',()=>{const f=fixture();f.options.validateEvidence=()=>{throw Error('bad actual bytes');};assert.throws(f.run);});
test('component coverage cannot be rewritten',()=>{const f=fixture();f.result.coverage={wrong:true};assert.throws(f.run);});
test('cannot remove deferred targets',()=>{const f=fixture();f.r.release.prerequisiteChecks.pop();assert.throws(f.run);});
test('cannot waive direct dependency',()=>{const f=fixture(),modified=new Map(nodes);modified.set(nodeId,{...nodes.get(nodeId),dependencies:['CORE:F07']});assert.throws(()=>verify(f.r,{...f.options,nodes:modified}));});
function publication(){const f=fixture(),live=new Map([...nodes].map(([id,n])=>[id,structuredClone(n)])),files=new Map([[manifest,'old'],...['docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'].map(p=>[p,readFileSync(p,'utf8')])]),before=new Map(files),writes=[];
 const options={getNodes:()=>live,validateLocal:()=>f.local,readFunctional:f.options.readFunctional,readLog:f.options.readLog,components:f.options.components,validateEvidence:f.options.validateEvidence,read:p=>files.get(p)??null,write:(p,b)=>{writes.push(p);if(b===null)files.delete(p);else files.set(p,b);},validate:(r,{nodes})=>verify(r,{...f.options,nodes}),verifyAfter:()=>({stageGate:'READY'})};return{files,before,writes,options};}
test('publication writes exactly receipt and two plans',()=>{const f=publication();publish('unit',f.options);assert.equal(f.writes.length,3);});
test('invalid index cannot mutate canonical files',()=>{const f=publication();f.options.validateLocal=()=>{throw Error('invalid');};assert.throws(()=>publish('unit',f.options));assert.deepEqual(f.files,f.before);});
test('write failure rolls all files back',()=>{const f=publication(),write=f.options.write;let calls=0;f.options.write=(p,b)=>{if(++calls===2)throw Error('write');write(p,b);};assert.throws(()=>publish('unit',f.options));assert.deepEqual(f.files,f.before);});
test('postverification failure rolls all files back',()=>{const f=publication();f.options.verifyAfter=()=>{throw Error('verify');};assert.throws(()=>publish('unit',f.options));assert.deepEqual(f.files,f.before);});
test('first publication failure removes new manifest',()=>{const f=publication();f.files.delete(manifest);f.before.delete(manifest);f.options.verifyAfter=()=>{throw Error('verify');};assert.throws(()=>publish('unit',f.options));assert.deepEqual(f.files,f.before);});


test('expanded roots cannot grant another admission',()=>{const modified=structuredClone(p);modified.s2ServiceLocal.roots.push('CORE:TP12');assert.throws(()=>localPolicy(profile,modified));});
