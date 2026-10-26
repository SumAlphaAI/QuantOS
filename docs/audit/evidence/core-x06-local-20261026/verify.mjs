// Read-only integrity and scoped behavior verification; no engine, database or external action.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verify,directory} from '../../../../scripts/core-x06-review.mjs';
import {files} from '../../../../scripts/core-s04-review.mjs';
import {hash,verifyInputs} from '../../../../scripts/g1-download-review.mjs';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p));
const receipt=json(directory+'/receipt.json'),result=verify(receipt);
assert.equal(result.rustCases,94);assert.equal(result.consumerCases,280);assert.equal(result.chromiumCases,21);
assert.match(read(receipt.attempt+'/gate-tests.log').toString(),/ℹ pass 83/);
const selected=name=>receipt.artifacts.filter(f=>f.path.endsWith('/'+name));
const networks=selected('core-x06.json');assert.equal(networks.length,3);
for(const f of networks){const n=json(f.path);assert.equal(n.sourceCommit,result.sourceCommit);assert.equal(n.status,'passed');assert.deepEqual(n.externalRequests,[]);assert.equal(n.identity,'EXPLICIT_REFERENCE_COOKIE_BRIDGE');assert(!n.rows.some(r=>/venue\.com|binance\.com|bybit\.com/.test(r.path)));}
const journey=json(selected('g8-journey.json')[0].path);assert.equal(journey.finalOrderStatus,'cancelled');assert.equal(journey.actualTestnetConnected,false);assert.equal(journey.pairs.length,3);
for(const pair of journey.pairs){assert.equal(pair.length,2);assert.equal(pair[0].source,'REFERENCE_COMMITTED_RESPONSE_DROPPED');assert.equal(pair[1].source,'REFERENCE_BYTES');for(const key of ['bodyHash','keyHash','version','responseHash']){assert.equal(pair[0][key],pair[1][key]);}assert(pair[0].keyHash);}
const refusal=networks.map(f=>json(f.path)).find(v=>v.scenario.includes('Audit transport 403'));assert(refusal.rows.some(r=>r.path==='/v1/audit/events'&&r.status===403&&r.source==='SYNTHETIC_NON_JSON_AUTHORITY_REFUSAL'));assert(!refusal.rows.some(r=>r.method==='POST'&&r.path==='/v1/exports'));
assert.match(read(directory+'/preflight-01/audit-boundary.log').toString(),/4 failed/);
assert.match(read(directory+'/preflight-02/audit-intermediate.log').toString(),/2 failed/);
const prior=json(directory+'/attempt-01/failure.json');assert.equal(prior.failed.id,'types');assert.equal(prior.failed.exitCode,2);assert(prior.notRun.includes('x06-browser'));assert.match(read(directory+'/attempt-01/operations-native.log').toString(),/0 passed; 0 failed/);
const second=json(directory+'/attempt-02/failure.json');assert.equal(second.failed.id,'risk-browser');assert.equal(second.failed.exitCode,1);const oldRisk=json(directory+'/attempt-02/risk-browser.json');assert.equal(oldRisk.stats.unexpected,2);assert.equal(oldRisk.stats.expected,0);
assert.match(read(directory+'/preflight-03/local-monitor-loss.log').toString(),/1 failed/);
const previous=json(directory+'/prior-attempt-03-receipt.json');assert.equal(previous.sourceCommit,'27319928daecb206e53a0d604abfa43a67734b1c');verifyInputs(previous.sourceCommit,previous.inputs);for(const f of previous.artifacts)assert.equal(hash(read(f.path)),f.sha256,f.path);
const manifest=json(directory+'/manifest.json');assert.equal(manifest.sourceCommit,result.sourceCommit);assert.equal(manifest.gate,result.gate);assert.equal(manifest.formalAccepted,false);assert.deepEqual(manifest.files.map(f=>f.path),files(directory).filter(p=>p!==directory+'/manifest.json'));
for(const f of manifest.files)assert.equal(hash(read(f.path)),f.sha256,f.path);
console.log(JSON.stringify({...result,nodeCases:83,exportedFiles:receipt.exportedFiles.length,evidenceFiles:manifest.files.length+1}));
