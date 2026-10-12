// Read-only prerequisite audit. Never executes target runners or promotes a Gate.
import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import {nodesFromPlans,closure,digest,planInput,validateReceipt,policy,localPolicy} from './provider-a1-receipts.mjs';
import {check as checkA2,inputs as a2Inputs,validateManifest as validateA2Manifest} from './provider-a2-development.mjs';
import {validateA2 as checkIdentity} from './bff-fe-001-development.mjs';import {validateAudit as checkAudit} from './bff-fe-007-development.mjs';import {verifyPublished as checkTp01D} from './tp01-d-local-gate.mjs';
const historicalA2='docs/audit/evidence/provider-a2-remediation-20261007/ci-47cb743-reassessment-20261007/provider-a2.json';
const attempt=fn=>{try{return {valid:true,result:fn()};}catch(e){return {valid:false,reason:e.message.split('\n')[0]};}};
export function inputChanges(old,current){const a=new Map(old.map(x=>[x.path,x.sha256])),b=new Map(current.map(x=>[x.path,x.sha256]));return [...new Set([...a.keys(),...b.keys()])].sort().filter(p=>a.get(p)!==b.get(p)).map(path=>({path,previous:a.get(path)??null,current:b.get(path)??null}));}
export function reassess(){
 const nodes=nodesFromPlans(),p=policy();const validate=id=>id==='PROVIDER:A2'?checkA2():id==='FE:BFF-FE-001'?checkIdentity({nodes}):id==='FE:BFF-FE-007'?checkAudit({nodes}):id==='CORE:TP01-D'?checkTp01D({nodes}):validateReceipt(id,{nodes});
 const row=id=>{const n=nodes.get(id),g=n.stage_gate;return {nodeId:id,stageGate:g,receiptValidation:g.status==='READY'?attempt(()=>validate(id)):{valid:false,reason:'NO_CURRENT_READY_RECEIPT'},planInputDigest:digest(JSON.stringify(planInput(n)))};};
 const roots=['PROVIDER:A2','CORE-GATE:R1-SERVICE'];const prior=JSON.parse(readFileSync(historicalA2));
 return {schema:'quantos-a3-prerequisite-reassessment/v1',observedSourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),databaseExecution:false,externalExecution:false,formalAccepted:false,
  roots:roots.map(id=>({nodeId:id,stageGate:nodes.get(id).stage_gate,admission:'NOT_READY',directDependencies:nodes.get(id).dependencies.map(row),closure:closure(nodes,id).map(row),aggregateReceipt:id==='PROVIDER:A2'?attempt(checkA2):{valid:false,reason:'R1-SERVICE has no published aggregate receipt or registered local admission profile'},registeredR1LocalProfile:attempt(()=>localPolicy('R1_LOCAL',p))})),
  historicalA2:{manifest:historicalA2,sha256:digest(readFileSync(historicalA2)),observedSourceCommit:prior.observedSourceCommit,validation:attempt(()=>validateA2Manifest(prior,{nodes})),changedInputs:inputChanges(prior.inputs,a2Inputs()),historicalTargetStatus:'HISTORICAL_ONLY_NOT_REEXECUTED'},release:{status:'NOT_RUN',scope:'external environment/performance acceptance only at RELEASE; missing or stale functional receipts remain prerequisite gaps'}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){console.log(JSON.stringify(reassess(),null,2));process.exitCode=2;}
