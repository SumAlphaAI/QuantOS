import assert from 'node:assert/strict';
import {spawnSync,execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const root='/Users/anray/Documents/project/SumAlpha/QuantOS',base=root+'/docs/audit/evidence/tp01-d-20261009';
const commands=[
 ['C-ready',['node','engines/vibe-adapter/check-development.mjs','--ready'],/"stageGate":"READY"/],
 ['D-ready',['node','engines/vibe-adapter/check-absorption.mjs','--ready'],/"stageGate":"READY"/],
 ['full-strict',['node','--input-type=module','-e',"import {nodesFromPlans,closure,validateReceipt} from './scripts/provider-a1-receipts.mjs';const nodes=nodesFromPlans();const ids=closure(nodes,'CORE:TP01-D');for(const id of ids)validateReceipt(id);console.log(JSON.stringify({strictReady:ids.length,formalAccepted:false}));"],/"strictReady":16/],
 ['focused',['node','--test','scripts/provider-a1-receipts.test.mjs','scripts/tp01-c-functional-artifacts.test.mjs','scripts/tp01-d-patch-queue.test.mjs','scripts/tp01-d-functional-artifacts.test.mjs'],/tests\s+88/],
 ['plans',['node','scripts/check-development-plans.mjs'],/"READY": 16/],
 ['plan-negative',['pnpm','test:development-plans'],/tests\s+38/],
 ['diff',['git','diff','--check']],
 ['secret-history',['bash','scripts/check-secrets.sh'],/no leaks found/],
 ['secret-D',['artifacts/tools/gitleaks','dir','--config','.gitleaks.toml','--gitleaks-ignore-path','.gitleaksignore','--redact','--no-banner','docs/audit/evidence/tp01-d-20261009'],/no leaks found/],
 ['secret-admission',['artifacts/tools/gitleaks','dir','--config','.gitleaks.toml','--gitleaks-ignore-path','.gitleaksignore','--redact','--no-banner','docs/audit/evidence/provider-a1-remediation-20261004/tp01-d-admission-20261009'],/no leaks found/],
 ['secret-prerequisite',['artifacts/tools/gitleaks','dir','--config','.gitleaks.toml','--gitleaks-ignore-path','.gitleaksignore','--redact','--no-banner','docs/audit/evidence/provider-a1-remediation-20261004/tp01-d-prerequisites-20261009'],/no leaks found/],
];
let log='';const results=[];for(const [name,command,marker]of commands){const executedAt=new Date().toISOString();const r=spawnSync(command[0],command.slice(1),{cwd:root,encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024,env:{...process.env,GITLEAKS_BIN:root+'/artifacts/tools/gitleaks'}});const output=(r.stdout??'')+(r.stderr??'');log+='Command '+JSON.stringify(command)+'\nExit '+r.status+'\n'+output+'\n';results.push({name,command,executedAt,exitCode:r.status});writeFileSync(base+'/final-checks.log',log);writeFileSync(base+'/final-checks.json',JSON.stringify({schema:'quantos-tp01-d-final-checks/v1',observedSourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),formalAccepted:false,results},null,2)+'\n');assert.equal(r.status,0,name+' failed');if(marker)assert.match(output,marker);if(['focused','plan-negative'].includes(name))assert.match(output,/fail\s+0/);console.log(name+' PASS');}
