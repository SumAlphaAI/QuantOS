// Read-only current-source/evidence verification. No SQL, engine or external actions.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verify,directory} from '../../../../scripts/core-x3-review.mjs';
import {files} from '../../../../scripts/core-s04-review.mjs';
import {hash} from '../../../../scripts/g1-download-review.mjs';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p));
const receipt=json(directory+'/receipt.json'),result=verify(receipt);
assert.equal(result.rustCases,64);assert.equal(result.consumerCases,114);assert.equal(result.chromiumCases,13);
assert.match(read(receipt.attempt+'/gate-tests.log').toString(),/ℹ pass 94/);
assert.match(read(receipt.attempt+'/tp12-python.log').toString(),/83 passed, 2 subtests passed/);
const xml=read(receipt.attempt+'/tp12-python.xml').toString();assert.match(xml,/<testsuite [^>]*errors="0"[^>]*failures="0"[^>]*skipped="0"[^>]*tests="85"/);
assert.equal(json(receipt.attempt+'/tp12-boundary.log').observedSourceCommit,result.sourceCommit);
assert.match(read(receipt.attempt+'/no-submit.log').toString(),/X05_NO_VENUE_SUBMIT_PATH=ABSENT/);
const native=read(receipt.attempt+'/native-c15.log').toString(),chain=JSON.parse([...native.matchAll(/^X3_SERVICE_EVIDENCE=(.+)$/gm)].find(m=>JSON.parse(m[1]).id==='chain')[1]).data;
assert.equal(chain.goldenSha256,hash(read('services/execution-gateway/tests/fixtures/x3-service-golden.json')));assert.equal(chain.fills,1);assert.equal(chain.cash,'999000');assert.equal(chain.recoveryIo,0);
assert.equal(receipt.artifacts.filter(f=>f.path.endsWith('/core-x06.json')).length,1);
const paper=json(receipt.artifacts.find(f=>f.path.endsWith('/g8-journey.json')).path);assert.equal(paper.finalOrderStatus,'cancelled');assert.equal(paper.actualTestnetConnected,false);
for(const pair of paper.pairs){assert.equal(pair.length,2);for(const key of ['bodyHash','keyHash','version','responseHash'])assert.equal(pair[0][key],pair[1][key]);}
assert.match(read(directory+'/preflight-01/reconciliation-boundary.log').toString(),/5 failed/);
assert.match(read(directory+'/preflight-02/reconciliation-fixed.log').toString(),/2 failed/);
assert.match(read(directory+'/preflight-03/reconciliation-fixed.log').toString(),/10 passed/);
assert.match(read(directory+'/preflight-04/current-ui506.log').toString(),/2 passed/);
const failed=json(directory+'/attempt-01/failure.json');assert.equal(failed.failed.id,'rust-lint');assert.equal(failed.failed.exitCode,101);assert(failed.notRun.includes('x3-browser'));
const second=json(directory+'/attempt-02/failure.json');assert.equal(second.failed.id,'reconciliation-browser');assert.equal(second.failed.exitCode,1);const old=json(directory+'/attempt-02/reconciliation-browser.json');assert.deepEqual([old.stats.expected,old.stats.unexpected],[8,2]);
const whitespace=json(directory+'/diff-check.json');assert.equal(whitespace.source.exitCode,0);assert.equal(whitespace.rawPacket.exitCode,2);assert.equal((whitespace.rawPacket.output.match(/trailing whitespace\./g)??[]).length,12);
const manifest=json(directory+'/manifest.json');assert.equal(manifest.sourceCommit,result.sourceCommit);assert.equal(manifest.gate,result.gate);assert.equal(manifest.formalAccepted,false);assert.deepEqual(manifest.files.map(f=>f.path),files(directory).filter(p=>p!==directory+'/manifest.json'));for(const f of manifest.files)assert.equal(hash(read(f.path)),f.sha256,f.path);
console.log(JSON.stringify({...result,nodeCases:94,pythonCases:83,pythonSubtests:2,exportedFiles:receipt.exportedFiles.length,evidenceFiles:manifest.files.length+1}));
