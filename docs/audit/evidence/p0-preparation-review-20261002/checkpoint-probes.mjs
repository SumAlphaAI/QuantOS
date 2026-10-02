import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {validatePlans} from '../../../../scripts/check-development-plans.mjs';
import {validateF06Acceptance} from '../../../../scripts/check-f06-acceptance.mjs';
const root=resolve(import.meta.dirname,'../../../..');
const core=readFileSync(resolve(root,'docs/SumAlpha-QuantOS-Development-Plan.md'),'utf8');
const frontend=readFileSync(resolve(root,'docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'),'utf8');
const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const evidence='./audit/evidence/p0-preparation-review-20261002/failed-receipt.json';
writeFileSync(resolve(root,'docs',evidence),JSON.stringify({schema:'synthetic-p0-review-probe',source_commit:sha,status:'FAIL',note:'Synthetic negative control; never acceptance evidence'},null,2)+'\n');
const checkpoint=[...frontend.matchAll(/```json\n([\s\S]*?)\n```/g)].map(m=>JSON.parse(m[1])).find(v=>v.checkpoint_id==='PREPARATION:P0');
const results=[];
for(const [name,source,evidenceRefs,incomplete] of [
 ['fabricated-sha-and-unrelated-document','a'.repeat(40),['./PRE-01-summary-and-risks.md'],false],
 ['nonexistent-https-receipt',sha,['https://example.invalid/p0-acceptance.json'],false],
 ['failed-local-receipt',sha,[evidence],false],
 ['unfinished-prerequisite',sha,[evidence],true]
]) {
 let changed=frontend.replace(/```json\n([\s\S]*?)\n```/g,(full,text)=>{const cp=JSON.parse(text);if(cp.checkpoint_id!=='PREPARATION:P0')return full;return '```json\n'+JSON.stringify({...cp,review_status:'ACCEPTED',source_commit:source,evidence:evidenceRefs},null,2)+'\n```';});
 if(incomplete)changed=changed.replace(/(<a id="task-pre-01"><\/a>[\s\S]*?- development_status: )`COMPLETED`/,'$1`UNSPECIFIED`');
 try{const report=validatePlans(core,changed,{root});results.push({name,expected_acceptance:'REJECT',structural_result:report.structure,actual_acceptance_checked:false});}catch(e){results.push({name,structural_result:'REJECT',error:e.message});}
}
let receipt=null;let noteState='PRESENT';
try{receipt=JSON.parse(execFileSync('git',['notes','--ref=refs/notes/f06-acceptance','show',sha],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}));}catch{noteState='MISSING_LOCAL_REF';}
const f06=validateF06Acceptance({plan:core,receipt,sourceCommit:sha,archivedFindings:readFileSync(resolve(root,'docs/audit/F06-closed-findings-2026-09-25.md'),'utf8')});
writeFileSync(resolve(import.meta.dirname,'checkpoint-probes.json'),JSON.stringify({source_commit:sha,current_checkpoint:checkpoint,scope:'Pure structural validator probes only. No checkpoint modified, no acceptance granted. Static validator documents no runtime acceptance guarantee.',results,f06:{noteState,...f06},database_execution:'NOT RUN'},null,2)+'\n');
console.log(JSON.stringify({results,f06,noteState},null,2));
