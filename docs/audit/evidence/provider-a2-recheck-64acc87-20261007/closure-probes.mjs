import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {nodesFromPlans,inventory,planInput,digest,validateReceipt} from '../../../../scripts/provider-a1-receipts.mjs';
import * as identity from '../../../../scripts/bff-fe-001-development.mjs';
import * as audit from '../../../../scripts/bff-fe-007-development.mjs';
const nodes=nodesFromPlans(),out='docs/audit/evidence/provider-a2-recheck-64acc87-20261007',records=[];
for(const [nodeId,mod]of [['FE:BFF-FE-001',identity],['FE:BFF-FE-007',audit]]){
 const node=nodes.get(nodeId),manifestPath='docs/'+node.stage_gate.evidence[0],m=JSON.parse(fs.readFileSync(manifestPath)),check=m.checks.find(c=>c.id==='live'),live=JSON.parse(fs.readFileSync(check.path));
 const common={read:p=>fs.readFileSync(p),dependencies:new Map(node.dependencies.map(id=>[id,nodes.get(id).stage_gate])),validateDependency:id=>id==='FE:BFF-FE-001'?identity.validateA2({nodes}):validateReceipt(id,{nodes})};
 const options=nodeId==='FE:BFF-FE-001'?{...common,currentInputs:inventory(mod.selectors),currentPlan:planInput(node)}:{...common,inputs:inventory(mod.selectors),plan:planInput(node)};
 const baseline=mod.validateEvidence(m,options);const blob=execFileSync('git',['rev-parse',live.sourceCommit+':'+Object.keys(live.sourceHashes)[0]],{encoding:'utf8'}).trim();
 for(const [id,change]of [['all-status-500',r=>r.records.forEach(c=>c.status=500)],['all-status-401',r=>r.records.forEach(c=>c.status=401)],['missing-source-commit',r=>{delete r.sourceCommit}],['unknown-source-commit',r=>r.sourceCommit='f'.repeat(40)],['blob-impersonates-commit',r=>r.sourceCommit=blob],...(nodeId==='FE:BFF-FE-001'?[['sse-status-500',r=>r.records.forEach(c=>{if(c.operationId==='subscribeSessionRevocations')c.status=500})]]:[])]){
  const mutated=structuredClone(live);change(mutated);const bytes=Buffer.from(JSON.stringify(mutated,null,2)+'\n'),wrapper=structuredClone(m);wrapper.checks.find(c=>c.id==='live').sha256=digest(bytes);let accepted=false,error=null;try{mod.validateEvidence(wrapper,{...options,read:p=>p===check.path?bytes:fs.readFileSync(p)});accepted=true}catch(e){error=e.message};records.push({nodeId,id,accepted,error,baseline:baseline.status,manifest:manifestPath,synthetic:true,noExternalEffects:true});if(accepted)throw Error(nodeId+' '+id+' wrongly admitted');
 }
}
fs.writeFileSync(out+'/actual-receipt-negative-probes.json',JSON.stringify({schema:'quantos-provider-a2-closure-probes/v1',scope:'Current real manifests validated before each set; only malformed live metadata and its wrapper digest changed in memory. No target execution or external side effects.',records},null,2)+'\n');console.log(JSON.stringify({rejected:records.length,unexpectedAcceptance:0}));
