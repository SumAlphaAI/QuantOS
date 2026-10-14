import assert from'node:assert/strict';import{spawnSync}from'node:child_process';import{existsSync,mkdirSync,writeFileSync}from'node:fs';import{staticEnvironment,digest,executionOutcome}from'../../../../scripts/provider-a1-receipts.mjs';
const base='docs/audit/evidence/provider-a3-readmission-20261014',dir=base+'/'+(process.argv[2]??'final-01');assert(!existsSync(dir),'preserve final attempt');mkdirSync(dir,{recursive:true});const env=staticEnvironment({...process.env,PATH:'/Users/anray/Library/pnpm/.tools/pnpm/10.20.0/bin:'+process.env.PATH}),rows=[];
for(const[id,command,expected,marker]of[
 ['evidence',['node',base+'/verify-evidence.mjs','--record'],0,/"status": "PASS"/],
 ['aggregate-and-consumers',['make','research-local-check'],0,/"profile": "A3_LOCAL"/],
 ['aggregate-public',['make','provider-a3-local-check'],0,/"stageGate": "READY"/],
 ['tp02',['make','tp02-local-check'],0,/"stageGate": "READY"/],
 ['a3-reassessment',['node','scripts/reassess-a3-prerequisites.mjs'],0,/"admission": "LOCAL_READY"/],
 ['a2-public',['node','scripts/provider-a2-development.mjs'],0,/READY/],
 ['bff003-public',['node','scripts/bff-fe-003-development.mjs','--ready'],0,/READY/],
 ['bff005-public',['node','scripts/bff-fe-005-development.mjs','--ready'],0,/READY/],
 ['gate-negatives',['node','--test','scripts/research-local-gate.test.mjs','scripts/tp02-local-gate.test.mjs','scripts/provider-a1-receipts.test.mjs'],0,/fail 0/],
 ['actual-probes',['node',base+'/probe-published.mjs',dir+'/tamper-probes.json'],0,/"status":"PASS"/],
 ['release-refusal',['make','tp02-release-check'],2,/NOT_RUN/],
 ['execution-only-refusal',['node','scripts/research-local-gate.mjs','A3_EXECUTION'],2,/assertion|registrations|falsy/i],
 ['strict-f0-refusal',['node','scripts/provider-a1-receipts.mjs','--f0'],1,/dependency is not READY/],
 ['plans',['pnpm','check:development-plans'],0,/"cross_plan_order": "PASS"/],
 ['plans-negative',['pnpm','test:development-plans'],0,/fail 0/],
 ['handoff',['make','development-handoff-check'],0,/PASS/],
 ['frontend-handoff',['node','scripts/check-frontend-gate-handoff.mjs'],0,/PASS/],
 ['format',['cargo','fmt','--all','--','--check'],0,/^$/],
 ['diff',['git','diff','--check'],0,/^$/],
 ['secrets',['artifacts/tools/gitleaks','dir','--config','.gitleaks.toml','--gitleaks-ignore-path','.gitleaksignore','--redact','--no-banner',base],0,/no leaks found/],
 ['attempt-secrets',['artifacts/tools/gitleaks','dir','--config','.gitleaks.toml','--gitleaks-ignore-path','.gitleaksignore','--redact','--no-banner','docs/audit/evidence/provider-a1-remediation-20261004/provider-a3-readmission-20261014'],0,/no leaks found/],
]){const executedAt=new Date().toISOString(),r=spawnSync(command[0],command.slice(1),{env,encoding:'utf8',timeout:900000,maxBuffer:32*1024*1024}),bytes=(r.stdout??'')+(r.stderr??''),log=dir+'/'+id+'.log',outcome=executionOutcome(r,900000);writeFileSync(log,bytes);rows.push({id,command,executedAt,completedAt:new Date().toISOString(),...outcome,expectedExitCode:expected,expectedMarker:marker.source,status:r.status===expected&&!r.error&&!r.signal&&marker.test(bytes)?'PASS':'FAIL',log,logSha256:digest(bytes)});writeFileSync(dir+'/results.json',JSON.stringify(rows,null,2)+'\n');console.log(id,rows.at(-1).status,r.status);}
if(rows.some(r=>r.status!=='PASS'))process.exitCode=1;
