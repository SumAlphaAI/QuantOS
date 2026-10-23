import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {directory,verify,validateRegistration} from '../../../../scripts/g3-integration-01-review.mjs';
import {files} from '../../../../scripts/frontend-g3-review.mjs';
import {hash} from '../../../../scripts/g1-download-review.mjs';
import {validateNetwork} from '../../../../scripts/ui303-review.mjs';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p)),r=json(directory+'/receipt.json'),s=json(directory+'/scope.json'),m=json(directory+'/manifest.json');
const result=verify(r);
assert.equal(m.sourceCommit,r.sourceCommit);
assert.equal(m.receiptSha256,hash(read(directory+'/receipt.json')));
const expected=[...files(directory).filter(p=>p!==directory+'/manifest.json'),...m.externalFiles].sort();
assert.deepEqual(m.files.map(f=>f.path),expected);
for(const f of m.files){assert.equal(hash(read(f.path)),f.sha256,f.path);if(process.argv.includes('--committed'))assert.equal(hash(execFileSync('git',['show','HEAD:'+f.path],{maxBuffer:96e6})),f.sha256,f.path);}
assert.equal(s.request.sourceCommit,r.sourceCommit);
assert.equal(s.request.inputsDigest,hash(JSON.stringify(r.inputs)));
assert.equal(s.confirmation,'PENDING');
assert.equal(s.formalAccepted,false);assert.equal(s.runtimeAdmission,'DENIED');assert.equal(s.stageGate,'NOT_ASSESSED');
assert.equal(s.incomplete.currentScanRecords,result.currentIncomplete);
assert.deepEqual(s.incomplete.historical,r.priorIncomplete);
assert.deepEqual(s.notRun,r.historicalNotRun);
assert.deepEqual(s.historicalAdditionalNotRun,r.historicalAdditionalNotRun);
const draft=JSON.parse(read(directory+'/confirmation-draft.md').toString().match(/```json\s*([\s\S]*?)\s*```/)[1]);assert.deepEqual(draft.request,s.request);assert.deepEqual(draft.reviewDimensions,s.request.reviewDimensions);
const network=json(directory+'/network-verification.json');assert.equal(network.sourceCommit,r.sourceCommit);assert.equal(network.receipts.length,44);let pairs=0;
for(const row of network.receipts){assert.equal(row.sha256,hash(read(row.path)));validateNetwork(json(row.path),r.sourceCommit,row.worker?network.hostBinary.sha256:network.normalBinarySha256);if(row.worker){const ready=read(row.path.replace('ui301.json','g3-host.log')).toString().split('\n').flatMap(line=>{try{return[JSON.parse(line)];}catch{return[];}}).find(v=>v.ready);assert.equal(ready.r03WorkerExecuted,true);assert.equal(ready.registrations.length,20);assert.equal(ready.sourceCommit,r.sourceCommit);for(const registration of ready.registrations)validateRegistration(registration);pairs+=ready.registrations.length;}}
assert.equal(pairs,480);assert.equal(network.ownedWorkerPairsExecutedBy24SeparateHosts,pairs);
const changed=json(directory+'/changed-files.json');assert(changed.allFiles.includes(directory+'/manifest.json'));for(const path of m.files.map(f=>f.path))assert(changed.allFiles.includes(path));
console.log(JSON.stringify({...result,packetFiles:m.files.length,packetMode:process.argv.includes('--committed')?'GIT_HEAD_BYTES_VERIFIED':'WORKING_FILES_VERIFIED',originalConfirmation:'CONFIRMED_9a463495_05c427f2',productionCredentialsUsed:false,pushed:false,deployed:false}));
