// Actual manifest mutation probes; no mutation of live evidence or databases.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {verify,inventory,hash} from '../../../../../scripts/r03-stage-check.mjs';
const root=resolve(import.meta.dirname,'../../../../..');
const manifest=JSON.parse(readFileSync(resolve(root,'docs/audit/evidence/r03-20261011/manifest.json')));
const results=[];
for(const [id,mutate,options] of [
 ['source-drift',r=>r.inputs[0].sha256='sha256:changed'],
 ['formal-upgrade',r=>r.formalAccepted=true],
 ['unready-prerequisites',r=>r.status='READY'],
 ['forged-command',r=>r.checks[0].command=['true']],
 ['failed-check',r=>r.checks[0].exitCode=1],
 ['changed-log',r=>r.checks[0].logSha256='sha256:changed'],
 ['changed-target',r=>r.targetFiles[0].sha256='sha256:changed'],
 ['evidence-path-escape',r=>r.checks[0].log='../outside.log'],
 ['dependency-substitution',r=>r.dependencies[0].reason='different'],
 ['target-source-substitution',()=>{}, {read:p=>{const bytes=readFileSync(p);if(p.endsWith('/receipt.json')){const r=JSON.parse(bytes);r.sourceInputs=[];return Buffer.from(JSON.stringify(r));}return bytes;}}],
]){
 const r=structuredClone(manifest);mutate(r);
 assert.throws(()=>verify(r,options||{}),undefined,id);
 results.push({id,rejected:true});
}
writeFileSync(resolve(root,'docs/audit/evidence/r03-20261011/final/manifest-probes.json'),JSON.stringify({schema:'quantos-r03-manifest-probes/v1',status:'PASS',results},null,2)+'\n');
console.log('R03_MANIFEST_PROBES_PASS '+results.length);
