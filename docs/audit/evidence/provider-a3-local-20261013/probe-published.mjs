import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import {verifyPublished,registrations,evidenceBase as base} from '../../../../scripts/research-local-gate.mjs';
const published=JSON.parse(readFileSync(base+'/a3-local.json'));
const index=JSON.parse(readFileSync(published.localPrerequisites.manifest));
const market=JSON.parse(readFileSync(index.nodes.find(n=>n.nodeId==='FE:BFF-FE-005').manifest));
const research=JSON.parse(readFileSync(base+'/bff003-local.json'));
const researchProof=JSON.parse(readFileSync(research.functionalManifest));
const cases=[['bound source','services/bff-gateway/src/market.rs'],['aggregate execution log',market.checks.find(r=>r.id==='bff005-rust').log],['product receipt',market.checks.find(r=>r.id==='bff005-http').artifact],['dependency manifest',index.nodes[0].manifest],['published consumer receipt',base+'/bff003-local.json'],['consumer execution log',researchProof.checks.find(r=>r.id==='bff003-local-rust').log]];
const report=[];for(const [name,path]of cases){const bytes=readFileSync(path);try{writeFileSync(path,Buffer.concat([bytes,Buffer.from('\nTAMPER_PROBE\n')]));let rejected=false,reason;try{verifyPublished('A3_LOCAL');}catch(e){rejected=true;reason=e.message.split('\n')[0];}assert(rejected,name+' accepted');report.push({name,path,status:'REJECTED',reason});}finally{writeFileSync(path,bytes);}assert.deepEqual(readFileSync(path),bytes);console.log(name+' REJECTED and restored');}
for(const profile of Object.keys(registrations)){const r=verifyPublished(profile);assert.equal(r.status,'READY');console.log(profile+' RESTORED_READY');}
writeFileSync(base+'/tamper-probes.json',JSON.stringify({status:'PASS',scope:'published A3 aggregate and consumer content integrity; no target execution',formalAccepted:false,probes:report,restored:true},null,2)+'\n');
