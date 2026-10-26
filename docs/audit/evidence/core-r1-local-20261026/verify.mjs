// Verify only; never starts hosts, engines, database checks or historical campaigns.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {verify,directory} from '../../../../scripts/core-r1-review.mjs';
import {hash} from '../../../../scripts/g1-download-review.mjs';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p));
const files=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(p+'/'+e.name):[p+'/'+e.name]).sort();
const result=verify(json(directory+'/receipt.json'));
const supplement=json(directory+'/supplement-01/executions.json');assert.equal(supplement.length,2);
for(const[i,e]of supplement.entries()){assert.equal(e.sourceCommit,result.sourceCommit);assert.deepEqual(e.command,['cargo','test','--locked','--offline','-p','quantos-engine-manager','--test','python_mock_engine',['durable_result_and_circuit_survive_manager_reconstruction','os_killed_manager_replays_pending_key_into_one_durable_result'][i],'--','--exact']);assert.equal(e.exitCode,0);assert.equal(e.signal,null);assert.equal(e.errorCode,null);assert.equal(hash(read(e.log)),e.sha256);assert.match(read(e.log).toString(),/test result: ok\. 1 passed; 0 failed; 0 ignored/);}
const manifest=json(directory+'/manifest.json');assert.equal(manifest.sourceCommit,result.sourceCommit);assert.equal(manifest.gate,result.gate);assert.equal(manifest.formalAccepted,false);assert.deepEqual(manifest.files.map(e=>e.path),files(directory).filter(p=>p!==directory+'/manifest.json'));for(const f of manifest.files)assert.equal(hash(read(f.path)),f.sha256,f.path);
assert.equal(execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),'main');console.log(JSON.stringify({...result,supplementaryManagerCases:2,rustCases:53,pythonCases:918,nodeCases:61,evidenceFiles:manifest.files.length+1}));
