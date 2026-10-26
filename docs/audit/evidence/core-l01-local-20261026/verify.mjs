// Read-only: exact original source and local evidence, no external/SQL actions.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {verify,directory} from '../../../../scripts/core-l01-review.mjs';
import {hash} from '../../../../scripts/g1-download-review.mjs';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p));
const files=dir=>readdirSync(dir).sort().flatMap(name=>{const p=dir+'/'+name;return statSync(p).isDirectory()?files(p):[p];});
const receipt=json(directory+'/receipt.json'),result=verify(receipt),compat=json(directory+'/compat-report.json');
assert.equal(result.sourceCommit,'decf787ff12e1caa2917ad2fd9fcfa8b9496d0b9');assert.equal(result.rustCases,57);assert.match(read(receipt.attempt+'/gate-tests.log').toString(),/# pass 63/);
assert.match(read(directory+'/preflight-01/legacy-boundary.log').toString(),/0 passed; 3 failed/);assert.match(read(directory+'/preflight-02/l01-tests.log').toString(),/15 passed; 0 failed/);
assert.equal(compat.sourceCommit,result.sourceCommit);assert.deepEqual(compat.boundary,receipt.boundary);assert.equal(compat.fixtureHash,hash(read('crates/quantos-execution/tests/fixtures/l01-corpus.json')));assert.equal(compat.uniqueOwnedCases,200);assert.equal(compat.independentCases,200);assert.equal(compat.mapped,200);assert.equal(compat.mappingRate,1);assert.equal(compat.processDuplicateWrites,0);assert.equal(compat.actualTestnetConnected,false);assert.equal(compat.original200TestnetTarget,'NOT_RUN');
const direct=json(receipt.attempt+'/direct-matrix.json'),process=json(receipt.attempt+'/process-matrix.json');assert.equal(compat.cases.length,200);for(const [i,c]of compat.cases.entries()){assert.equal(c.id,direct.cases[i].id);assert.equal(c.directStatus,direct.cases[i].status);assert.equal(c.expectedStatus,c.directStatus);assert.equal(c.processStatus,process.cases[i].status);assert.deepEqual(c.processAnchor,process.cases[i].anchor);}
const manifest=json(directory+'/manifest.json');assert.equal(manifest.sourceCommit,result.sourceCommit);assert.deepEqual(manifest.boundary,receipt.boundary);assert.deepEqual(manifest.files.map(f=>f.path),files(directory).filter(p=>p!==directory+'/manifest.json'));for(const f of manifest.files)assert.equal(hash(read(f.path)),f.sha256,f.path);
console.log(JSON.stringify({...result,nodeCases:63,evidenceFiles:manifest.files.length+1,outerIntegrity:'PASS_ORIGINAL_SOURCE_ONLY'}));
