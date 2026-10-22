// Development scheduling is independent of INTEGRATION/RELEASE admission.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import process from 'node:process';
import console from 'node:console';
import {nodesFromPlans} from './provider-a1-receipts.mjs';
export const policyPath='scripts/development-testing-policy.json',followupPath='docs/execution/development-followups.json';
export const readPolicy=()=>JSON.parse(readFileSync(policyPath));
export const readFollowups=()=>JSON.parse(readFileSync(followupPath));
export function executionDecision(nodeId,{phase='DEVELOPMENT',nodes=nodesFromPlans(),policy=readPolicy(),followups=readFollowups()}={}){
 assert(nodes.has(nodeId),'unknown original plan task');assert(['DEVELOPMENT','INTEGRATION','RELEASE'].includes(phase));
 assert.equal(policy.development.defaultScope,'FUNCTION_AND_IMPACT');assert.equal(policy.development.recursiveDependencyRevalidation,false);
 assert.deepEqual(policy.development.executionAdmission,{dependencyStageReadyRequiredToStart:false,historicalConfirmationRequiredToStart:false,auxiliaryActionsArePrerequisites:false,knownAffectedFunctionalDefectsBlock:true,stageReadinessUnchanged:true,followups:followupPath});
 assert.equal(followups.schema,'quantos-development-followups/v1');assert.equal(followups.historicalRecordsUnchanged,true);assert.equal(followups.mainPlanTaskIdsUnchanged,true);
 const kinds=['FUNCTIONAL_DEFECT','EVIDENCE_ACCOUNTING','CONFIRMATION','INTEGRATION_OBLIGATION','ENVIRONMENT_OBLIGATION','RELEASE_OBLIGATION'];
 for(const f of followups.items){assert(kinds.includes(f.kind),'unclassified finding');assert(Array.isArray(f.affectedNodes)&&f.affectedNodes.every(id=>nodes.has(id)),'finding affected scope required');assert(typeof f.summary==='string'&&f.summary.length>0);assert(typeof f.status==='string'&&f.status.length>0);assert.equal(f.developmentPrerequisite,false,'auxiliary tasks cannot become plan prerequisites');assert(f.evidence?.startsWith('docs/')&&!f.evidence.includes('..')&&existsSync(f.evidence),'finding evidence missing');}
 const n=nodes.get(nodeId),dependencies=n.dependencies.map(id=>{const d=nodes.get(id);assert(d,'missing normative dependency');return{nodeId:id,stage:d.stage_gate.stage,status:d.stage_gate.status,referenceOnly:true,admission:'NOT_CLAIMED'};});
 // A confirmed current correctness/security defect still blocks its affected work.
 const blockers=followups.items.filter(f=>f.kind==='FUNCTIONAL_DEFECT'&&f.affectedNodes.includes(nodeId)&&!['IMPLEMENTED_VERIFIED_LOCAL_REFERENCE','IMPLEMENTED_VERIFIED_LOCAL_WITH_EXPLICIT_PORT_SUBSTITUTIONS'].includes(f.status)).map(f=>f.id);
 let allowed=blockers.length===0,reason=allowed?'FUNCTION_AND_IMPACT_SCOPE':'KNOWN_AFFECTED_FUNCTIONAL_DEFECT';
 if(phase==='INTEGRATION'){allowed=n.stage_gate.status==='READY'&&dependencies.every(d=>d.status==='READY');reason=allowed?'EXISTING_STAGE_READY_ONLY':'STAGE_NOT_READY';}
 if(phase==='RELEASE'){allowed=false;reason='USE_FROZEN_RELEASE_ACCEPTANCE_GATE';}
 return{schema:'quantos-development-execution/v1',nodeId,phase,allowed,reason,blockers:phase==='DEVELOPMENT'?blockers:[],dependencies,auxiliaryPrerequisites:[],dependencyRevalidation:'NOT_RUN_NOT_REQUIRED_FOR_DEVELOPMENT',stageGate:n.stage_gate.status,stagePromotion:false,formalAccepted:false,runtimeAdmission:'DENIED'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{assert.equal(process.argv.length,4,'use --development|--integration|--release <original node ID>');const phase=({'--development':'DEVELOPMENT','--integration':'INTEGRATION','--release':'RELEASE'})[process.argv[2]];assert(phase);const result=executionDecision(process.argv[3],{phase});console.log(JSON.stringify(result));if(!result.allowed)process.exitCode=1;}catch(e){console.error(e.stack);process.exitCode=1;}}
