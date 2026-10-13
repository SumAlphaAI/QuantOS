import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import {verifyPublished} from '../../../../scripts/research-local-gate.mjs';
const attempt='docs/audit/evidence/provider-a1-remediation-20261004/research-local-20261013/attempt-05';
const published=JSON.parse(readFileSync('docs/audit/evidence/research-local-20261013/bff005-local.json'));
const index=JSON.parse(readFileSync(published.localPrerequisites.manifest));
const own=JSON.parse(readFileSync(published.functionalManifest));
const cases=[['bound source','services/bff-gateway/src/market.rs'],['execution log',own.checks.find(r=>r.id==='bff005-rust').log],['product receipt',own.checks.find(r=>r.id==='bff005-http').artifact],['dependency manifest',index.nodes[0].manifest]];
const report=[];for(const [name,path]of cases){const bytes=readFileSync(path);try{writeFileSync(path,Buffer.concat([bytes,Buffer.from('\nTAMPER_PROBE\n')]));let rejected=false,reason;try{verifyPublished('BFF005_LOCAL');}catch(e){rejected=true;reason=e.message.split('\n')[0];}assert(rejected,name+' accepted');report.push({name,path,status:'REJECTED',reason});}finally{writeFileSync(path,bytes);}assert.deepEqual(readFileSync(path),bytes);console.log(name+' REJECTED and restored');}
for(const profile of ['A2_LOCAL','R1_LOCAL','BFF003_LOCAL','BFF005_LOCAL']){const r=verifyPublished(profile);assert.equal(r.status,'READY');console.log(profile+' RESTORED_READY');}
writeFileSync('docs/audit/evidence/research-local-20261013/tamper-probes.json',JSON.stringify({status:'PASS',scope:'published local content integrity; no target execution',formalAccepted:false,probes:report,restored:true},null,2)+'\n');
