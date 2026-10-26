// Read-only evidence verification; does not launch tests or external services.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verify,directory,files} from '../../../../scripts/core-s04-review.mjs';
import {hash,verifyInputs} from '../../../../scripts/g1-download-review.mjs';
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p));
const result=verify(json(directory+'/receipt.json'));
const visual=json(directory+'/visual-baseline-review-01/original-manifest.json');verifyInputs(visual.sourceCommit,visual.files.map(f=>({path:f.path,sha256:f.sha256})));assert.equal(visual.files.length,18);const changed=[];for(const f of visual.files){assert.equal(hash(read(f.original)),f.sha256);if(hash(read(f.path))!==f.sha256)changed.push(f.path);}
assert.deepEqual(changed.sort(),['tests/e2e/ui-p07.spec.ts-snapshots/p07-report-dark-1672-chromium-darwin.png','tests/e2e/ui-p07.spec.ts-snapshots/p07-report-light-1672-chromium-darwin.png']);
const manifest=json(directory+'/manifest.json');assert.equal(manifest.sourceCommit,result.sourceCommit);assert.equal(manifest.gate,result.gate);assert.equal(manifest.formalAccepted,false);assert.deepEqual(manifest.files.map(f=>f.path),files(directory).filter(p=>p!==directory+'/manifest.json'));for(const f of manifest.files)assert.equal(hash(read(f.path)),f.sha256,f.path);
console.log(JSON.stringify({...result,sourceFiles:16,visualBaselines:18,updatedBaselines:2,evidenceFiles:manifest.files.length+1}));
