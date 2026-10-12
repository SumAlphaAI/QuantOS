import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=process.cwd(),base='docs/audit/evidence/tp01-c-local-20261012';
const {staticEnvironment,executionOutcome,digest}=await import(root+'/scripts/provider-a1-receipts.mjs');
const env=staticEnvironment(process.env);env.PATH='/Users/anray/Library/pnpm/.tools/pnpm/10.20.0/bin:'+env.PATH;
const out=process.argv[2]??base+'/final-01';assert(!existsSync(out),'preserve prior final results');mkdirSync(out,{recursive:true});
const checks=[
 ['local-ready',['make','tp01-c-local-check'],[0]],
 ['evidence',['node',base+'/verify-evidence.mjs'],[0]],
 ['release-rejected',['make','tp01-c-release-check'],[2]],
 ['strict-rejected',['node','engines/vibe-adapter/check-development.mjs','--ready'],[2]],
 ['upstream-f0-rejected',['make','f0-local-check'],[2]],
 ['r04-rejected',['make','r04-gate-check'],[2]],
 ['negative',['node','--test','scripts/tp01-c-local-gate.test.mjs','scripts/provider-a1-receipts.test.mjs','scripts/local-development-gate.test.mjs','scripts/r03-stage-check.test.mjs','scripts/r04-stage-check.test.mjs','scripts/tp01-c-functional-artifacts.test.mjs','scripts/development-plan-order-negative.mjs','scripts/development-gate-handoff.test.mjs'],[0]],
 ['plans',['node','scripts/check-development-plans.mjs'],[0]],
 ['handoff',['make','development-handoff-check'],[0]],
 ['diff',['git','diff','--check'],[0]],
 ['secrets',['artifacts/tools/gitleaks','dir','--config','.gitleaks.toml','--gitleaks-ignore-path','.gitleaksignore','--redact','--no-banner',base],[0]],
];const results=[];
for(const [id,command,allowedExitCodes]of checks){const executedAt=new Date().toISOString(),r=spawnSync(command[0],command.slice(1),{env,encoding:'utf8',timeout:900000,maxBuffer:32*1024*1024}),output=(r.stdout??'')+(r.stderr??''),log=out+'/'+id+'.log';writeFileSync(log,output);const outcome=executionOutcome(r,900000);const status=allowedExitCodes.includes(r.status)&&!outcome.timedOut&&!outcome.executionErrorCode&&!outcome.signal?'PASS':'FAIL';results.push({id,command,executedAt,...outcome,status,allowedExitCodes,log,logSha256:digest(output)});writeFileSync(out+'/results.json',JSON.stringify(results,null,2)+'\n');if(id==='evidence'&&status==='PASS')writeFileSync(base+'/verification.json',output);console.log(id+': '+status+' exit='+r.status);}
assert(results.every(r=>r.status==='PASS'),'final checks failed; retain originals');
