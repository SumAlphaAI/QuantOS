import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';

const root=process.env.QUANTOS_REVIEW_ROOT??process.cwd();
const output=process.argv[2]??import.meta.dirname;
fs.mkdirSync(output,{recursive:true});
const {loadBffFe001Inputs,validateBffFe001}=await import(pathToFileURL(path.join(root,'scripts/check-bff-fe-001.mjs')));
const baseline=loadBffFe001Inputs();
const probes=[
 ['last-factor-disabled','provider','if state.factors.len() <= 1 {','if false {'],
 ['csrf-origin-session-guard-disabled','provider','if let Err(response) = mutation_guard(&headers, &data).await {','if let Err(response) = Ok::<(), Response>(()) {'],
 ['recent-auth-window-one-year','provider','Utc::now() + Duration::minutes(5)','Utc::now() + Duration::days(365)'],
 ['frontend-gate-comment-only','frontendWorkflow','run: pnpm check:bff-fe-001 && pnpm test:bff-fe-001','run: echo skipped\n      # pnpm check:bff-fe-001 && pnpm test:bff-fe-001'],
 ['main-provider-test-comment-only','ciWorkflow','run: make bff-provider-test','run: echo skipped\n      # make bff-provider-test'],
];
const observations=probes.map(([id,key,from,to])=>{
 const inputs=structuredClone(baseline);
 if(!inputs[key].includes(from))throw Error('probe target missing: '+id);
 inputs[key]=inputs[key].replaceAll(from,to);
 const result=validateBffFe001(inputs);
 return {id,mutationApplied:true,expected:'FAIL',actual:result.status,failures:result.failures};
});
const record={sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),scope:'in-memory sabotage of actual A2 Gate inputs; no repository edits or database',baseline:validateBffFe001(baseline),observations};
fs.writeFileSync(path.join(output,'gate-observations.json'),JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify(record,null,2));
