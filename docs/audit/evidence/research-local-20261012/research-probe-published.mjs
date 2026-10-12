import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import {verifyPublished} from '../../../../scripts/research-local-gate.mjs';
const attempt='docs/audit/evidence/provider-a1-remediation-20261004/research-local-20261012/attempt-03';
const results=JSON.parse(readFileSync(attempt+'/execution-results.json'));
const published=JSON.parse(readFileSync('docs/audit/evidence/research-local-20261012/bff003-local.json'));
const index=JSON.parse(readFileSync(published.localPrerequisites.manifest));
const cases=[['bound source','services/bff-gateway/src/research.rs'],['execution log',results.find(r=>r.id==='a2-local-positive').log],['product receipt',results.find(r=>r.id==='r04-local-products').artifact],['dependency manifest',index.nodes[0].manifest]];
const report=[];for(const [name,path]of cases){const bytes=readFileSync(path);try{writeFileSync(path,Buffer.concat([bytes,Buffer.from('\nTAMPER_PROBE\n')]));let rejected=false,reason;try{verifyPublished('BFF003_LOCAL');}catch(e){rejected=true;reason=e.message.split('\n')[0];}assert(rejected,name+' accepted');report.push({name,path,status:'REJECTED',reason});}finally{writeFileSync(path,bytes);}assert.deepEqual(readFileSync(path),bytes);console.log(name+' REJECTED and restored');}
for(const profile of ['A2_LOCAL','R1_LOCAL','BFF003_LOCAL']){const r=verifyPublished(profile);assert.equal(r.status,'READY');console.log(profile+' RESTORED_READY');}
writeFileSync('docs/audit/evidence/research-local-20261012/tamper-probes.json',JSON.stringify({status:'PASS',scope:'published local content integrity; no target execution',formalAccepted:false,probes:report,restored:true},null,2)+'\n');
