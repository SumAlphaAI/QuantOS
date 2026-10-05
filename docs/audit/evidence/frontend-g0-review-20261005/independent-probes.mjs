import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {loadG0Inputs,validateG0Records} from '../../../../scripts/check-g0-records.mjs';
import {loadPre01Inputs,validatePre01} from '../../../../scripts/check-pre01.mjs';
import {validatePlans} from '../../../../scripts/check-development-plans.mjs';
const root=resolve(import.meta.dirname,'../../../..'),records=[];
function probe(id,description,action){try{const result=action();records.push({id,description,observed:'ACCEPTED',result});}catch(e){records.push({id,description,observed:'REJECTED',error:e.message});}}
probe('g0-governance-baseline','Historical governance consistency only',()=>validateG0Records(loadG0Inputs()));
probe('g0-unsupported-stage-ready','G0 governance and plan structure accept an arbitrary G0 manifest digest/document while all actual prerequisites stay READY',()=>{
 const input=loadG0Inputs();input.plan=input.plan.replace(/```json\n([\s\S]*?)\n```/g,(block,raw)=>{const n=JSON.parse(raw);if(n.checkpoint_id!=='FRONTEND-GATE:G0')return block;n.stage_gate={stage:'DEVELOPMENT',status:'READY',input_digest:'sha256:'+'a'.repeat(64),evidence:['gate-records/G0-readiness-assessment.md']};return '```json\n'+JSON.stringify(n,null,2)+'\n```';});
 const g=validateG0Records(input),p=validatePlans(readFileSync(resolve(root,'docs/SumAlpha-QuantOS-Development-Plan.md'),'utf8'),input.plan);return {governance:g.status,plan:p.stage_contract??'PASS',inMemoryMutationOnly:true};
});
probe('g0-readiness-body-absent','Historical governance accepts readiness text without contract/PoC findings',()=>validateG0Records({...loadG0Inputs(),readiness:'历史记录；NOT_STARTED / NO CURRENT RECEIPT\n'}));
probe('g0-compatibility-empty','Historical governance accepts empty compatibility strategies in all ten ledger rows',()=>{
 const input=loadG0Inputs();input.review=input.review.replace(/^\| ([^|]+) \| ([^|]+) \| (\d{4}-\d{2}-\d{2}) \| [^\n]*\|$/gm,'| $1 | $2 | $3 |  |');
 assert.notEqual(input.review,loadG0Inputs().review);return validateG0Records(input);
});
probe('page-api-version-unbound','PRE-01 accepts all API/mock 1.4.0 labels replaced with nonexistent 99.99.0',()=>{
 const input=loadPre01Inputs();input.coverage=input.coverage.replaceAll('1.4.0','99.99.0');return validatePre01(input);
});
const producer=`import { InMemoryTerminalBackend } from '@sumalpha/api-client';\nexport const backend = new InMemoryTerminalBackend();\n`;
writeFileSync(resolve(import.meta.dirname,'production-import-probe.txt'),producer);
const run=spawnSync('pnpm',['exec','eslint','--stdin','--stdin-filename','apps/terminal/app/g0-import-probe.tsx'],{cwd:root,input:producer,encoding:'utf8'});
writeFileSync(resolve(import.meta.dirname,'production-import-probe.log'),(run.stdout??'')+(run.stderr??''));
records.push({id:'production-inmemory-import',description:'Lint of executable InMemory backend import under a production page path',observed:run.status===0?'ACCEPTED':'REJECTED',exitCode:run.status,temporaryPageWritten:false});
writeFileSync(resolve(import.meta.dirname,'independent-probes.json'),JSON.stringify({schema:'quantos-g0-independent-probes/v1',scope:'in-memory input mutations and ESLint stdin only; tracked inputs untouched',records},null,2)+'\n');
console.log(JSON.stringify(records.map(r=>({id:r.id,observed:r.observed})),null,2));
