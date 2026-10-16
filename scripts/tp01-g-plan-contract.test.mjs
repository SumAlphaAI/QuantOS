import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,symlinkSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,dirname} from 'node:path';
import {nodesFromPlans,digest} from './provider-a1-receipts.mjs';
import {validatePlanOrder} from './check-development-plan-order.mjs';
import {profile,nodeId,manifest,handoff} from './tp01-g-local-gate.mjs';
const texts=['docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'].map(p=>readFileSync(p,'utf8'));
function fixture(mutate=()=>{}){
 const root=mkdtempSync(resolve(tmpdir(),'tp01-g-plan-')),nodes=nodesFromPlans(),own=nodes.get(nodeId),r={schema:'quantos-tp01-g-local-development/v1',nodeId,profile,status:'READY',databaseExecution:false,formalAccepted:false,targetCanaryAccepted:false,targetRollbackAccepted:false,externalPublished:false,upstreamAccepted:false,production:false,externalExecution:false,performanceAccepted:false,syncApproved:false,dependencies:own.dependencies.map(id=>({nodeId:id,status:'LOCAL_READY',owner:nodeId,inputDigest:digest(id)})),release:{checkpoint:'RELEASE-GATE:BETA',status:'NOT_RUN',handoff,prerequisiteChecks:[{id:'target',status:'NOT_RUN'}]}};
 for(const n of nodes.values())for(const ref of [...(n.checkpoint_id?n.evidence:[]),...n.stage_gate.evidence])if(!ref.startsWith('https://')&&ref!==manifest.slice(5)){const target=resolve(root,'docs',ref);mkdirSync(dirname(target),{recursive:true});if(!existsSync(target))symlinkSync(resolve('docs',ref),target);}
 mutate(r);const bytes=JSON.stringify(r),path=resolve(root,manifest);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,bytes);own.stage_gate={stage:'DEVELOPMENT',status:'READY',input_digest:digest(bytes),evidence:[manifest.slice(5)]};
 const marker='<a id="task-tp01-g"></a>',start=texts[0].indexOf(marker),end=texts[0].indexOf('<a id=',start+marker.length);const block=texts[0].slice(start,end).replace(/^- stage_gate: .*$/m,'- stage_gate: '+JSON.stringify(own.stage_gate)),core=texts[0].slice(0,start)+block+texts[0].slice(end);
 const tasks=[...nodes.values()].filter(n=>n.task_id),run=()=>validatePlanOrder(core,texts[1],tasks.filter(n=>n.task_type==='CORE'),tasks.filter(n=>n.task_type!=='CORE'),{root});
 try{return run();}finally{rmSync(root,{recursive:true,force:true});}
}
test('registered G receipt shape can close its stage with scoped LOCAL_READY dependencies',()=>{const r=fixture();assert.equal(r.cross_plan_order,'PASS');});
for(const[label,mutate]of [['formal approval',r=>r.formalAccepted=true],['external publication',r=>r.externalPublished=true],['upstream acceptance',r=>r.upstreamAccepted=true],['database proof',r=>r.databaseExecution=true],['wrong local dependency status',r=>r.dependencies[0].status='READY'],['wrong dependency owner',r=>r.dependencies[0].owner='SERVICE:TP01']])test('plan-layer scoped admission rejects '+label,()=>assert.throws(()=>fixture(mutate)));

test('temporary plan fixture preserves published stage receipt bytes',()=>{const refs=[...new Set([...nodesFromPlans().values()].flatMap(n=>n.stage_gate.evidence))].filter(ref=>!ref.startsWith('https://'));const before=refs.map(ref=>digest(readFileSync(resolve('docs',ref))));fixture();assert.deepEqual(refs.map(ref=>digest(readFileSync(resolve('docs',ref)))),before);});
