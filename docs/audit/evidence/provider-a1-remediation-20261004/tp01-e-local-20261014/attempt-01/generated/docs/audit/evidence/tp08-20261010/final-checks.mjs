import assert from 'node:assert/strict';
import {spawnSync,execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../../../..'),base=root+'/docs/audit/evidence/tp08-20261010';
const commands=[
 ['TP08-ready',['node','third_party/qlib/check-development.mjs','--ready'],/"stageGate":"READY"/],
 ['full-strict',['node','--input-type=module','-e',"import {nodesFromPlans,closure,validateReceipt} from './scripts/provider-a1-receipts.mjs';const nodes=nodesFromPlans();const ids=closure(nodes,'CORE:TP08');for(const id of ids)validateReceipt(id);console.log(JSON.stringify({strictReady:ids.length,formalAccepted:false}));"],/"strictReady":13/],
 ['focused',['node','--test','scripts/provider-a1-receipts.test.mjs','scripts/tp01-c-functional-artifacts.test.mjs','scripts/tp01-d-functional-artifacts.test.mjs','scripts/tp02-functional-artifacts.test.mjs','scripts/tp03-functional-artifacts.test.mjs','scripts/tp04-functional-artifacts.test.mjs','scripts/tp05-functional-artifacts.test.mjs','scripts/tp08-functional-artifacts.test.mjs'],/tests\s+176/],
 ['license',['node','--test','scripts/tp08-evaluation.test.mjs','scripts/tp05-release-gate.test.mjs'],/tests\s+38/],
 ['plans',['node','scripts/check-development-plans.mjs'],/"READY": 13/],
 ['plan-negative',['pnpm','test:development-plans'],/tests\s+38/],
 ['p0-negative',['node','--test','scripts/p0-acceptance-negative.mjs'],/tests\s+16/],
 ['diff',['git','diff','--check']],
 ['secret-history',['bash','scripts/check-secrets.sh'],/no leaks found/],
 ['secret-TP08',['artifacts/tools/gitleaks','dir','--config','.gitleaks.toml','--gitleaks-ignore-path','.gitleaksignore','--redact','--no-banner','docs/audit/evidence/tp08-20261010'],/no leaks found/],
 ['secret-admission',['artifacts/tools/gitleaks','dir','--config','.gitleaks.toml','--gitleaks-ignore-path','.gitleaksignore','--redact','--no-banner','docs/audit/evidence/provider-a1-remediation-20261004/tp08-admission-20261010'],/no leaks found/],
];
let log='';const results=[];for(const [name,command,marker]of commands){const executedAt=new Date().toISOString();const r=spawnSync(command[0],command.slice(1),{cwd:root,encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024,env:{...process.env,GITLEAKS_BIN:root+'/artifacts/tools/gitleaks'}});const output=(r.stdout??'')+(r.stderr??'');log+='Command '+JSON.stringify(command)+'\nExit '+r.status+'\n'+output+'\n';results.push({name,command,executedAt,exitCode:r.status});writeFileSync(base+'/final-checks.log',log);writeFileSync(base+'/final-checks.json',JSON.stringify({schema:'quantos-tp08-final-checks/v1',observedSourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),formalAccepted:false,results},null,2)+'\n');assert.equal(r.status,0,name+' failed');if(marker)assert.match(output,marker);if(['focused','plan-negative','p0-negative'].includes(name))assert.match(output,/fail\s+0/);console.log(name+' PASS');}
