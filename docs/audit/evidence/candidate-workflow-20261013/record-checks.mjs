import {spawnSync,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {staticEnvironment} from '../../../../scripts/provider-a1-receipts.mjs';
const base='docs/audit/evidence/candidate-workflow-20261013',sha=b=>'sha256:'+createHash('sha256').update(b).digest('hex'),source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const env=staticEnvironment({...process.env,GITLEAKS_BIN:resolve('artifacts/tools/gitleaks')});env.QUANTOS_RELEASE_PERFORMANCE='0';
const checks=[
 ['candidate-formal-regressions',['node','--test','scripts/acceptance-candidate.test.mjs','scripts/f02-a11-gate-negative.mjs','scripts/f06-acceptance-gate-negative.mjs','scripts/p0-acceptance-negative.mjs','scripts/bff-remediation-negative.mjs']],
 ['f02-check',['make','f02-check']],
 ['user-confirmation',['node','--test','scripts/user-acceptance-confirmation.test.mjs']],
 ['plans-negative',['node','--test','scripts/development-plan-order-negative.mjs','scripts/frontend-gate-handoff.test.mjs']],
 ['ci-disposition',['node','--test','scripts/ci-stage-disposition.test.mjs']],
 ['plans',['node','scripts/check-development-plans.mjs']],
 ['f09-static',['node','scripts/check-f09-observability-config.mjs']],
 ['f06-missing-candidate-reject',['node','scripts/check-f06-acceptance.mjs'],1],
 ['p0-missing-candidate-reject',['node','scripts/check-p0-acceptance.mjs'],1],
 ['a1-missing-candidate-reject',['node','scripts/check-bff-a1-acceptance.mjs'],1],
 ['f06-no-real-receipt-reject',['node','scripts/check-f06-acceptance.mjs','--candidate',source],1],
 ['p0-no-real-receipt-reject',['node','scripts/check-p0-acceptance.mjs','--candidate',source],1],
 ['a1-no-real-receipt-reject',['node','scripts/check-bff-a1-acceptance.mjs','--candidate',source],1],
 ['diff-format',['git','diff','--check']]
];
const results=[];
for(const [id,command,expectedExitCode=0]of checks){const startedAt=new Date().toISOString(),r=spawnSync(command[0],command.slice(1),{env,encoding:'utf8',timeout:180000,maxBuffer:32*1024*1024}),bytes=Buffer.from((r.stdout??'')+(r.stderr??'')),log=base+'/'+id+'.log';writeFileSync(log,bytes);const item={id,command,startedAt,exitCode:r.status,expectedExitCode,expectationMet:r.status===expectedExitCode&&!r.error,log,sha256:sha(bytes)};results.push(item);console.log(id,item.exitCode,item.expectationMet);}
const report={schema:'quantos-candidate-workflow-local-verification/v1',status:results.every(x=>x.expectationMet)?'PASS':'FAIL',observedHead:source,sourceCommitFrozen:false,testedInputScope:'worktree byte hashes captured in inputs.json; not a formal or business Gate receipt',databaseExecution:false,externalExecution:false,signingExecution:false,deploymentPerformed:false,formalAccepted:false,checks:results};
writeFileSync(base+'/results.json',JSON.stringify(report,null,2)+'\n');if(report.status!=='PASS')process.exitCode=1;
