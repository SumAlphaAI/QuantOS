import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {base} from './scope.mjs';
import {digest,staticEnvironment,executionOutcome} from '../../../../scripts/provider-a1-receipts.mjs';
const attempt=process.argv[2]??'attempt-01',final=process.argv[3]??'final-01';
assert(/^attempt-\d{2}$/.test(attempt)&&/^final-\d{2}$/.test(final));
const out=base+'/'+final;assert(!existsSync(out),'preserve prior checks');mkdirSync(out,{recursive:true});
const env=staticEnvironment(process.env);env.PATH='/Users/anray/Library/pnpm/.tools/pnpm/10.20.0/bin:'+env.PATH;env.TP01_D_PREFLIGHT_ATTEMPT=base+'/'+attempt;
const checks=[
 ['evidence',['node',base+'/verify-preflight.mjs',base+'/'+attempt],[0]],
 ['evidence-negative',['node','--test',base+'/verify-preflight.test.mjs'],[0]],
 ['prior-tp01-c-seal',['python3','docs/audit/evidence/tp01-c-local-20261012/seal-evidence.py','--verify'],[0]],
 ['release-rejected',['make','tp01-c-release-check'],[2]],
 ['plans',['node','scripts/check-development-plans.mjs'],[0]],
 ['handoff',['make','development-handoff-check'],[0]],
 ['diff',['git','diff','--check'],[0]],
 ['secrets',['artifacts/tools/gitleaks','dir','--config','.gitleaks.toml','--gitleaks-ignore-path','.gitleaksignore','--redact','--no-banner',base],[0]],
];
const results=[];
for(const [id,command,allowedExitCodes]of checks){
 const executedAt=new Date().toISOString(),r=spawnSync(command[0],command.slice(1),{env,encoding:'utf8',timeout:900000,maxBuffer:32*1024*1024}),output=(r.stdout??'')+(r.stderr??''),log=out+'/'+id+'.log',outcome=executionOutcome(r,900000);
 writeFileSync(log,output);const status=allowedExitCodes.includes(r.status)&&!outcome.timedOut&&!outcome.executionErrorCode&&!outcome.signal?'PASS':'FAIL';
 results.push({id,command,executedAt,completedAt:new Date().toISOString(),...outcome,allowedExitCodes,status,log,logSha256:digest(output)});
 writeFileSync(out+'/results.json',JSON.stringify(results,null,2)+'\n');if(id==='evidence'&&status==='PASS')writeFileSync(base+'/verification.json',output);console.log(id+': '+status+' exit='+r.status);
}
assert(results.every(r=>r.status==='PASS'),'final checks failed; preserve this result');
