import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {verifyEvaluation as tp09,assertTrendRadarProductionExcluded} from './tp09-evaluation.mjs';
import {verifyEvaluation as tp10,assertValueCellProductionExcluded} from './tp10-evaluation.mjs';
import {verifyEvaluation as tp11,assertOpenStockProductionExcluded} from './tp11-evaluation.mjs';
const definitions={TP09:['trendradar',tp09,assertTrendRadarProductionExcluded],TP10:['valuecell',tp10,assertValueCellProductionExcluded],TP11:['openstock',tp11,assertOpenStockProductionExcluded]};
export function metadataProof(id){
 const d=definitions[id];assert(d,'unsupported local reference');const [name,verify,exclude]=d,result=verify(),boundary=exclude([]),paths=['baseline.lock.json','provenance.json'].map(p=>'third_party/'+name+'/'+p);
 const baseline=JSON.parse(readFileSync(paths[0])),provenance=JSON.parse(readFileSync(paths[1]));
 return {schema:'quantos-local-reference-metadata/v1',nodeId:'CORE:'+id,sourceCommit:baseline.upstream.commit,referenceObservedAt:provenance.observedAt,referenceClass:'HISTORICAL_METADATA_ONLY_NOT_CURRENT_PUBLIC_BYTES',files:paths.map(path=>({path,sha256:'sha256:'+createHash('sha256').update(readFileSync(path)).digest('hex')})),evaluation:result,workspaceBoundary:boundary,upstreamVerification:'NOT_RUN',checkpoint:'RELEASE-GATE:BETA',externalExecution:false,currentPublicBytesVerified:false,currentCveCleared:false,productionApproved:false,formalAccepted:false};
}
export function verifyLocalReferenceLog(text,id){const rows=text.split('\n').filter(l=>l.startsWith('{'));assert.equal(rows.length,1);assert.deepEqual(JSON.parse(rows[0]),metadataProof(id),'local reference metadata changed');assert(text.includes('LOCAL_REFERENCE_METADATA_PASS'));return true;}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{assert.equal(process.argv.length,3);console.log(JSON.stringify(metadataProof(process.argv[2])));console.log('LOCAL_REFERENCE_METADATA_PASS');}catch(e){console.error(e.message);process.exitCode=1;}}
