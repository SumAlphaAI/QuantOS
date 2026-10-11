import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.cwd(),out='docs/audit/evidence/r03-local-gate-policy-20261011';
const {nodesFromPlans,validateReceipt,staticEnvironment}=await import(pathToFileURL(resolve('scripts/provider-a1-receipts.mjs')));
const {verify,prerequisites}=await import(pathToFileURL(resolve('scripts/r03-stage-check.mjs')));
const env=staticEnvironment(process.env);delete env.QUANTOS_R03_RELEASE_TARGET_DIR;
const specs=[['r03-verify',['node','scripts/r03-stage-check.mjs','--verify'],0],['r03-admission',['make','r03-admission-check'],0],['r03-release-denied',['make','r03-release-check'],2],['plans',['node','scripts/check-development-plans.mjs'],0],['gate-tests',['node','--test','scripts/provider-a1-receipts.test.mjs','scripts/r03-stage-check.test.mjs','scripts/development-plan-order-negative.mjs'],0]];
const results=[];
for(const [id,command,expected]of specs){const startedAt=new Date().toISOString(),r=spawnSync(command[0],command.slice(1),{cwd:root,env,encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024});writeFileSync(out+'/'+id+'.log',(r.stdout??'')+(r.stderr??''));results.push({id,command,startedAt,exitCode:r.status,expectedExitCode:expected,status:r.status===expected?'PASS':'FAIL',log:out+'/'+id+'.log'});}
const nodes=nodesFromPlans(),strict=prerequisites.map(nodeId=>{try{validateReceipt(nodeId,{nodes});return {nodeId,status:'UNEXPECTED_READY'};}catch(e){return {nodeId,status:'REJECTED',reason:e.message};}});
const gate=verify(JSON.parse(readFileSync('docs/audit/evidence/r03-20261011/manifest.json')));
const summary={schema:'quantos-r03-local-final-checks/v1',status:results.every(r=>r.status==='PASS')&&strict.every(r=>r.status==='REJECTED')?'PASS':'FAIL',commands:results,strictUpstreamGuards:strict,gate,databaseExecution:false,formalAccepted:false};writeFileSync(out+'/final-checks.json',JSON.stringify(summary,null,2)+'\n');assert.equal(summary.status,'PASS');console.log(JSON.stringify(summary,null,2));
