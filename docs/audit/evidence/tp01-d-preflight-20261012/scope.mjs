// Proposed admission contract only. This module never registers or publishes a Gate.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {nodesFromPlans,policy,closure,localPolicy} from '../../../../scripts/provider-a1-receipts.mjs';
export const base='docs/audit/evidence/tp01-d-preflight-20261012';
export const owner='CORE:TP01-D',profile='TP01-D_LOCAL';
export const expectedNodes=['CORE:F01','CORE:F02','CORE:TP01-A','CORE:F03','CORE:F04','CORE:F05','CORE:F06','CORE:F07','CORE:TP01-B','CORE:F08','CORE:F09','CORE-GATE:F0','CORE:TP01-C','CORE:R01','CORE:R02',owner];
export function expectedScope(){
 const nodes=nodesFromPlans(),p=policy(),template=localPolicy('TP01-C_LOCAL'),selected=closure(nodes,owner);
 assert.deepEqual(selected,expectedNodes,'TP01-D dependency closure changed');
 const checksByNode=selected.map(nodeId=>({nodeId,checks:[...new Set([...p.nodes[nodeId].checks,...(template.nodeChecks[nodeId]??[])])].filter(id=>!p.checks[id].database&&!p.checks[id].target&&!(template.deferredChecks??[]).includes(id))}));
 const checks=[...new Set(checksByNode.flatMap(n=>n.checks))];
 const deferred=[...new Set(selected.flatMap(id=>p.nodes[id].checks))].filter(id=>p.checks[id].database||p.checks[id].target||(template.deferredChecks??[]).includes(id));
 assert.equal(checks.length,53);assert.equal(deferred.length,14);
 return {schema:'quantos-tp01-d-local-scope/v1',profile,owner,registration:'PROPOSED_NOT_REGISTERED',stage:'DEVELOPMENT',
  roots:[owner],directDependencies:nodes.get(owner).dependencies,necessaryClosure:selected,checksByNode,
  existingLocalChecks:checks.map(id=>({id,command:p.checks[id].command})),
  requiredNewChecks:['dedicated TP01-D_LOCAL scope, same-candidate, receipt, publication rollback and release-refusal negative tests'],
  admissionRequirements:{sameFrozenSource:true,completeClosure:true,actualInputsAndArtifacts:true,abnormalExecutionRejected:true,consumerBoundDependencies:true,publishOnlyOwner:true,priorConsumerReceiptsCannotBeSpliced:true},
  fixture:{count:20,rpcs:['Execute','StreamExecute'],callsPerRpc:2,stableOutputAndArtifacts:true,malformedContractCases:18,rejectBeforeSideEffects:true,adapterRemovedRuntimeRequired:true},
  researchInput:{owner:'CORE:R02',kind:'synthetic_in_memory',catalog:'InMemoryDataSnapshotCatalog',retiredHistoricalFactsConsumed:0,newCollection:false,realSourceLicenseGranted:false,qualityHashTenantTimePurposeDenialsRequired:true},
  release:{checkpoint:'RELEASE-GATE:BETA',status:'NOT_RUN',checks:deferred.map(id=>({id,command:p.checks[id].command,status:'NOT_RUN'})),
   obligations:['Supabase writability, PostgreSQL migration/RLS/transactions/Auth/Storage','persistent Artifact/audit/cancellation and independent-process recovery','deployed BFF/Runtime/JWT and real provider integration','GitHub branch protection and remote fork governance','OS egress isolation','representative performance/capacity/soak and platform matrix','authorized data purposes and same-SHA hosted CI and ProjectUser release confirmation']},
  gate:{tp01D:'NOT_ASSESSED',r1Service:'NOT_ASSESSED',databaseExecution:false,production:false,formalAccepted:false},
  implementationNext:'Register TP01-D_LOCAL, add dedicated negative checks, recompute the final check count, freeze a new source commit and rerun the complete closure; do not reuse this preflight as admission.'};
}
export function validateScope(record){assert.deepEqual(record,expectedScope(),'TP01-D_LOCAL proposed scope changed');assert.throws(()=>localPolicy(profile),/unsupported local profile/);return {status:'PASS',profile,registration:record.registration,necessaryNodes:16,existingLocalChecks:53,deferredChecks:14,stageGate:'NOT_ASSESSED'};}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(validateScope(JSON.parse(readFileSync(base+'/scope.json'))),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
