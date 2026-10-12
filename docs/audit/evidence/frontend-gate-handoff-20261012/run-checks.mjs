// Offline/local evidence collector; target runners are intentionally absent.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';import {execFileSync,spawnSync} from 'node:child_process';
import {digest,staticEnvironment} from '../../../../scripts/provider-a1-receipts.mjs';
const base='docs/audit/evidence/frontend-gate-handoff-20261012',dir=base+'/frozen-01';assert(!existsSync(dir),'fresh evidence directory required');mkdirSync(dir+'/logs',{recursive:true});
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const paths=['.github/workflows/frontend-baseline.yml','docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md','scripts/check-development-plans.mjs','scripts/check-frontend-gate-handoff.mjs','scripts/frontend-gate-handoff-policy.json','scripts/frontend-gate-handoff.test.mjs','scripts/reassess-a3-prerequisites.mjs'];
const sources=paths.map(path=>{const bytes=readFileSync(path);assert.equal(digest(bytes),digest(execFileSync('git',['show',sourceCommit+':'+path],{maxBuffer:8*1024*1024})),'uncommitted source input: '+path);return {path,sha256:digest(bytes)};});
const env=staticEnvironment(process.env);env.PATH='/Users/anray/Library/pnpm/.tools/pnpm/10.20.0/bin:'+env.PATH;
const checks=[
 ['plans',['node','scripts/check-development-plans.mjs'],0],
 ['frontend-handoff',['node','scripts/check-frontend-gate-handoff.mjs'],0],
 ['core-handoff',['node','scripts/check-development-gate-handoff.mjs'],0],
 ['plan-negatives',['node','--test','scripts/frontend-gate-handoff.test.mjs','scripts/development-gate-handoff.test.mjs','scripts/development-plan-order-negative.mjs'],0],
 ['receipt-negatives',['node','--test','scripts/provider-a2-development.test.mjs','scripts/bff-fe-001-development.test.mjs','scripts/bff-fe-007-development.test.mjs','scripts/r1-functional-artifacts.test.mjs','scripts/tp01-d-local-gate.test.mjs'],0],
 ['coverage',['node','scripts/check-bff-contract-coverage.mjs'],0],
 ['a2-strict-rejected',['node','scripts/provider-a2-development.mjs'],1],
 ['tp01-d-stale-rejected',['node','scripts/tp01-d-local-gate.mjs','--ready'],2],
 ['release-rejected',['node','scripts/tp01-d-local-gate.mjs','--release'],2],
 ['prerequisites',['node','scripts/reassess-a3-prerequisites.mjs'],2],
 ['diff',['git','diff','--check'],0],
];
const results=[];
for(const [id,command,expectedExit]of checks){const executedAt=new Date().toISOString(),r=spawnSync(command[0]==='node'?process.execPath:command[0],command.slice(1),{env,encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024});const bytes=Buffer.from((r.stdout??'')+(r.stderr??'')),log=dir+'/logs/'+id+'.log';writeFileSync(log,bytes);const row={id,command,executedAt,sourceCommit,exitCode:r.status,expectedExit,signal:r.signal,errorCode:r.error?.code??null,log,sha256:digest(bytes),status:r.status===expectedExit&&!r.error&&!r.signal?'PASS':'FAIL'};results.push(row);writeFileSync(base+'/execution-results.json',JSON.stringify(results,null,2)+'\n');console.log(id,row.status);assert.equal(row.status,'PASS',id);}
for(const f of sources)assert.equal(digest(readFileSync(f.path)),f.sha256,'source changed during run');
const prior='docs/audit/evidence/provider-a2-remediation-20261007/ci-47cb743-reassessment-20261007/provider-a2.json',a2=JSON.parse(readFileSync(prior));
const refs=[{path:prior,sha256:digest(readFileSync(prior))},...a2.checks.map(c=>({path:c.log,sha256:c.logSha256})),...a2.dependencies.map(d=>({path:d.manifest,sha256:d.inputDigest})),...a2.apiCoverage.map(c=>({path:c.targetReceipt,sha256:c.targetReceiptSha256}))];
const historicalIntegrity=[...new Map(refs.map(r=>[r.path,r])).values()].map(r=>({...r,actualSha256:digest(readFileSync(r.path)),valid:digest(readFileSync(r.path))===r.sha256}));assert(historicalIntegrity.every(x=>x.valid),'historical A2 bytes no longer match original receipt');
const m={schema:'quantos-frontend-handoff-evidence/v1',sourceCommit,sources,executedChecks:results.length,negativeTests:247,databaseExecution:false,externalExecution:false,targetAcceptance:'NOT_RUN',formalAccepted:false,historicalIntegrity};writeFileSync(base+'/manifest.json',JSON.stringify(m,null,2)+'\n');console.log('FROZEN_SOURCE_EVIDENCE_PASS',sourceCommit);
