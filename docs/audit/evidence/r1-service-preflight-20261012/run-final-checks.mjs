import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=process.cwd(),base='docs/audit/evidence/r1-service-preflight-20261012',attempt=base+'/attempt-01';
const {digest,staticEnvironment,executionOutcome}=await import(root+'/scripts/provider-a1-receipts.mjs');
assert(!existsSync(base+'/final-checks.json'),'preserve previous final run');
mkdirSync(base+'/final',{recursive:true});
const env=staticEnvironment(process.env);env.PATH='/Users/anray/Library/pnpm/.tools/pnpm/10.20.0/bin:'+env.PATH;env.UV_OFFLINE='1';env.CARGO_NET_OFFLINE='true';
const checks=[
 ['support',['node',base+'/collect-support.mjs',attempt]],
 ['verify',['node',base+'/verify-preflight.mjs',attempt]],
 ['negative',['node','--test',base+'/verify-preflight.test.mjs']],
 ['coverage',['node',base+'/verify-coverage.mjs',attempt]],
 ['plans',['node','scripts/check-development-plans.mjs']],
 ['handoff',['make','development-handoff-check']],
 ['diff',['git','diff','--check']],
 ['secrets',['artifacts/tools/gitleaks','dir','--config','.gitleaks.toml','--gitleaks-ignore-path','.gitleaksignore','--redact','--no-banner',base]],
];
const results=[];
for(const [id,command]of checks){const executedAt=new Date().toISOString(),r=spawnSync(command[0],command.slice(1),{cwd:root,env,encoding:'utf8',timeout:300000,maxBuffer:32*1024*1024});
 const output=(r.stdout??'')+(r.stderr??''),log=base+'/final/'+id+'.log';writeFileSync(log,output);
 const result={id,command,executedAt,...executionOutcome(r,300000),log,logSha256:digest(output)};results.push(result);
 writeFileSync(base+'/final-checks.json',JSON.stringify(results,null,2)+'\n');console.log(id+': '+result.status);
 if(id==='verify'&&result.status==='PASS')writeFileSync(base+'/verification.json',output);
 if(id==='negative')writeFileSync(base+'/verification-tests.log',output);
}
assert(results.every(r=>r.status==='PASS'),'final checks failed; keep the original results');
