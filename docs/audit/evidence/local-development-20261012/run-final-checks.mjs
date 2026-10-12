import {resolve} from 'node:path';
import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'../../../..');process.chdir(root);const {staticEnvironment,digest}=await import(root+'/scripts/provider-a1-receipts.mjs');
const env=staticEnvironment(process.env);env.PATH='/Users/anray/Library/pnpm/.tools/pnpm/10.20.0/bin:'+env.PATH;
const base='docs/audit/evidence/local-development-20261012';mkdirSync(base+'/final',{recursive:true});
const checks=[
 ['local-gates',['make','f0-local-check','tp03-local-check','tp04-local-check','r03-admission-check','r04-admission-check'],[0]],
 ['release-rejected',['make','local-release-check'],[2]],
 ['r03-release-rejected',['make','r03-release-check'],[2]],
 ['strict-f0-rejected',['node','scripts/provider-a1-receipts.mjs','--f0'],[1]],
 ['strict-tp03-rejected',['node','engines/llmquant/check-development.mjs','--ready'],[1,2]],
 ['strict-tp04-rejected',['node','engines/trading-agents/check-development.mjs','--ready'],[1,2]],
 ['negative-regression',['node','--test','scripts/local-development-gate.test.mjs','scripts/development-gate-handoff.test.mjs','scripts/provider-a1-receipts.test.mjs','scripts/r03-stage-check.test.mjs','scripts/development-plan-order-negative.mjs','scripts/tp03-functional-artifacts.test.mjs','scripts/tp04-functional-artifacts.test.mjs'],[0]],
 ['plan-check',['node','scripts/check-development-plans.mjs'],[0]],
 ['handoff-check',['make','development-handoff-check'],[0]],
 ['future-target-preservation',['node','docs/audit/evidence/local-development-20261012/verify-future-targets.mjs'],[0]],
 ['r04-public-runtime-probe',['engines/.venv/bin/python','docs/audit/evidence/r04-preflight-20261012/probe-runtime-contract.py','docs/audit/evidence/r04-preflight-20261012/runtime-contract-local-admission-20261012'],[0]],
 ['diff-check',['git','diff','--check'],[0]],
];const results=[];
for(const [id,command,allowedExitCodes]of checks){const executedAt=new Date().toISOString(),run=spawnSync(command[0],command.slice(1),{cwd:root,env,encoding:'utf8',timeout:900000,maxBuffer:32*1024*1024}),output=(run.stdout??'')+(run.stderr??''),log=base+'/final/'+id+'.log';writeFileSync(log,output);const r={id,command,executedAt,exitCode:run.status,allowedExitCodes,status:allowedExitCodes.includes(run.status)?'PASS':'FAIL',log,logSha256:digest(output)};if(id==='r04-public-runtime-probe'){const probe=JSON.parse(readFileSync('docs/audit/evidence/r04-preflight-20261012/runtime-contract-local-admission-20261012/result.json'));assert.equal(probe.status,'GAPS_FOUND');assert.equal(probe.cases.filter(c=>c.runtimeAccepted).length,7);r.requirementStatus='GAPS_FOUND';r.note='Probe execution succeeded; R04 completion remains blocked by 7 malformed inputs accepted';}results.push(r);writeFileSync(base+'/final-checks.json',JSON.stringify(results,null,2)+'\n');console.log(id,run.status);}
assert(results.every(r=>r.status==='PASS'),'final checks failed');
