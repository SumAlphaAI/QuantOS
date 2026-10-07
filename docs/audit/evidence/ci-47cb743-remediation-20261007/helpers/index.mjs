import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base='docs/audit/evidence/ci-47cb743-remediation-20261007';
const directories=[base,
 'docs/audit/evidence/provider-a1-remediation-20261004/ci-47cb743-reassessment-20261007',
 'docs/audit/evidence/bff-fe-001-remediation-20261005/ci-47cb743-reassessment-20261007',
 'docs/audit/evidence/bff-fe-001-remediation-20261005/ci-47cb743-final-reassessment-20261007',
 'docs/audit/evidence/bff-fe-007-remediation-20261006/ci-47cb743-reassessment-20261007',
 'docs/audit/evidence/provider-a2-remediation-20261007/ci-47cb743-reassessment-20261007',
 'docs/audit/evidence/frontend-g0-fep0-remediation-20261005/ci-47cb743-reassessment-20261007',
 'docs/audit/evidence/fep0-remediation-20261005/ci-47cb743-reassessment-20261007',
 'docs/audit/evidence/fep0-remediation-20261005/ci-47cb743-user-confirmed-20261007'];
const additional=[
 'docs/audit/CI-47cb743-remediation-2026-10-07.md',
 'docs/audit/PROVIDER-A2-comprehensive-review-2026-10-07.md',
 'docs/audit/BFF-FE-001-comprehensive-review-2026-10-05.md',
 'docs/audit/BFF-FE-007-comprehensive-review-2026-10-06.md',
 'docs/SumAlpha-QuantOS-Development-Plan.md',
 'docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md',
 'docs/gate-records/G0-user-confirmation-draft-2026-10-07-52fee5f6e499.md',
 'docs/gate-records/G0-current-scope-confirmations.json',
 'docs/gate-records/G0-user-confirmation-2026-10-07-52fee5f6e499.json'];
const paths=new Set(additional);
function walk(path){for(const entry of fs.readdirSync(path,{withFileTypes:true})){const child=path+'/'+entry.name;assert(!entry.isSymbolicLink(),'evidence link not allowed');if(entry.isDirectory())walk(child);else if(child!==base+'/evidence-index.json')paths.add(child);}}
for(const dir of directories)walk(dir);
const files=[...paths].sort().map(path=>{const bytes=fs.readFileSync(path);return {path,sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};});
const index={schema:'quantos-ci-remediation-evidence-index/v1',sourceCommit:'d00041ee354701a08fa7483e948b74f374439b13',formalAccepted:false,hostedCandidateStatus:'NOT_RUN',files};
fs.writeFileSync(base+'/evidence-index.json',JSON.stringify(index,null,2)+'\n');
for(const file of files)assert.equal(createHash('sha256').update(fs.readFileSync(file.path)).digest('hex'),file.sha256);
console.log(JSON.stringify({status:'PASS',files:files.length,bytes:files.reduce((sum,file)=>sum+file.sizeBytes,0)}));
