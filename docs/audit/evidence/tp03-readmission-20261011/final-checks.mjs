import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../../../..'),base=resolve(import.meta.dirname);
const commands=[
 ['ready',['node','engines/llmquant/check-development.mjs','--ready'],/"stageGate":"READY"/],
 ['strict',['node','--input-type=module','-e',"import {nodesFromPlans,closure,validateReceipt} from './scripts/provider-a1-receipts.mjs';const ids=closure(nodesFromPlans(),'CORE:TP03');for(const id of ids)validateReceipt(id);console.log('STRICT_READY',ids.length);"],/STRICT_READY 13/],
 ['negatives',['node','--test','scripts/tp03-functional-artifacts.test.mjs'],/tests\s+26/],
 ['plans',['node','scripts/check-development-plans.mjs'],/"READY": 13/],
 ['diff',['git','diff','--check']],
 ['secrets',['artifacts/tools/gitleaks','dir','--config','.gitleaks.toml','--gitleaks-ignore-path','.gitleaksignore','--redact','--no-banner','docs/audit/evidence/provider-a1-remediation-20261004/tp03-readmission-20261011'],/no leaks found/],
];
let log='';const results=[];for(const [name,command,marker]of commands){const r=spawnSync(command[0],command.slice(1),{cwd:root,encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024});const output=(r.stdout??'')+(r.stderr??'');log+=JSON.stringify(command)+'\n'+output+'\n';results.push({name,command,exitCode:r.status,executedAt:new Date().toISOString()});writeFileSync(base+'/final-checks.log',log);writeFileSync(base+'/final-checks.json',JSON.stringify({schema:'quantos-tp03-readmission-final/v1',formalAccepted:false,results},null,2)+'\n');assert.equal(r.status,0,name);if(marker)assert.match(output,marker);console.log(name+' PASS');}
