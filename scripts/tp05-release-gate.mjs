import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(import.meta.dirname,'..');
export function assertProductionArtifactsAllowed(paths){
 assert(Array.isArray(paths)&&paths.every(p=>typeof p==='string'&&p.length>0),'TP05_ARTIFACT_INVENTORY_REQUIRED');
 const lock=JSON.parse(readFileSync(resolve(root,'third_party/tp05-openbb/baseline.lock.json')));
 const policy=JSON.parse(readFileSync(resolve(root,'engines/openbb-adapter/src/openbb_adapter/policy/license_gate.json')));
 assert.equal(policy.upstream_ref,lock.upstream.commit,'TP05_PIN_MISMATCH');assert.equal(lock.productionApproved,false);assert.equal(policy.allow_production,false);assert.equal(policy.status,'evaluation_only');
 for(const p of paths){
  // Fail closed for both external OpenBB and this evaluation-only QuantOS artifact.
  if(/openbb/i.test(p))throw new Error('TP05_LICENSE_PRODUCTION_DENIED: evaluation-only OpenBB artifact '+p);
 }
 return {status:'PASS',scope:'TP05 artifact exclusion only',formalAccepted:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{
 assert.equal(process.argv.length,3);assert.equal(process.argv[2],'--workspace');
 console.log(JSON.stringify(assertProductionArtifactsAllowed(['quantos-openbb-adapter'])));
}catch(e){console.error(e.message);process.exitCode=1;}}
