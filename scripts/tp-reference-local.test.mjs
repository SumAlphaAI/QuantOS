import assert from 'node:assert/strict';
import {test} from 'node:test';
import {metadataProof,verifyLocalReferenceLog} from './tp-reference-local.mjs';
for(const id of ['TP09','TP10','TP11']){
 test(id+' metadata validation performs no network call',()=>{const fetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('NETWORK_FORBIDDEN');};try{const p=metadataProof(id);assert.equal(p.upstreamVerification,'NOT_RUN');assert.equal(p.currentPublicBytesVerified,false);assert.equal(p.currentCveCleared,false);assert.equal(p.productionApproved,false);assert.equal(p.externalExecution,false);assert(verifyLocalReferenceLog(JSON.stringify(p)+'\nLOCAL_REFERENCE_METADATA_PASS\n',id));}finally{globalThis.fetch=fetch;}});
 for(const[label,mutate]of [['current bytes',p=>p.currentPublicBytesVerified=true],['current CVE',p=>p.currentCveCleared=true],['runtime approval',p=>p.productionApproved=true],['changed provenance digest',p=>p.files[0].sha256='sha256:'+'0'.repeat(64)]])test(id+' rejects '+label,()=>{const p=metadataProof(id);mutate(p);assert.throws(()=>verifyLocalReferenceLog(JSON.stringify(p)+'\nLOCAL_REFERENCE_METADATA_PASS\n',id));});
}
test('unknown reference cannot pass',()=>assert.throws(()=>metadataProof('TP01')));
test('duplicate metadata rows cannot pass',()=>{const p=JSON.stringify(metadataProof('TP09'));assert.throws(()=>verifyLocalReferenceLog(p+'\n'+p+'\nLOCAL_REFERENCE_METADATA_PASS\n','TP09'));});
