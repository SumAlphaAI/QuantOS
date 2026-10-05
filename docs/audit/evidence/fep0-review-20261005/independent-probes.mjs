import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {nodesFromPlans,publishStages,closure} from '../../../../scripts/provider-a1-receipts.mjs';
import {validatePlans} from '../../../../scripts/check-development-plans.mjs';
const core=readFileSync('docs/SumAlpha-QuantOS-Development-Plan.md','utf8');const front=readFileSync('docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md','utf8');const record=[];
function probe(id,expected,action){let observed='ACCEPTED',error=null;try{action();}catch(e){observed='REJECTED';error=e.message;}assert.equal(observed,expected,id);record.push({id,expected,observed,error});}
const fabricated={stage:'DEVELOPMENT',status:'READY',input_digest:'sha256:'+'a'.repeat(64),evidence:['audit/F0-F05-F03-main-acceptance-2026-09-28.md']};
probe('structural-check-rejects-FEP0-ready-with-unready-F0','REJECTED',()=>{const nodes=nodesFromPlans();nodes.get('FE:FEP-0').stage_gate=fabricated;validatePlans(core,publishStages(front,new Map([['FE:FEP-0',nodes.get('FE:FEP-0')]]),'FE:'));});
probe('structural-check-only-does-not-verify-fabricated-complete-closure-receipt-content','ACCEPTED',()=>{const nodes=nodesFromPlans();const patched=new Map();for(const id of closure(nodes,'FE:FEP-0'))if(nodes.get(id).stage_gate.status!=='READY'){nodes.get(id).stage_gate=fabricated;patched.set(id,nodes.get(id));}validatePlans(publishStages(core,patched,'CORE:'),publishStages(front,patched,'FE:'));});
probe('structural-check-rejects-ready-without-evidence','REJECTED',()=>{const nodes=nodesFromPlans();nodes.get('FE:FEP-0').stage_gate={...fabricated,evidence:[]};validatePlans(core,publishStages(front,new Map([['FE:FEP-0',nodes.get('FE:FEP-0')]]),'FE:'));});
const output={schema:'quantos-fep0-independent-probes/v1',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),executedAt:new Date().toISOString(),scope:'In-memory plan mutations only. Static validator explicitly declares shape-only; ACCEPTED is evidence of scope, not a validator defect or an actual stage promotion.',record};writeFileSync(resolve(import.meta.dirname,'independent-probes.json'),JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(record,null,2));
