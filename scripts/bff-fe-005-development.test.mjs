// Synthetic, temporary-only verifier fixtures; these are not provider execution receipts.
import test from 'node:test';import assert from 'node:assert/strict';
import YAML from 'yaml';import {readFileSync} from 'node:fs';
import {operations,validateMarketEvidence} from './bff-fe-005-development.mjs';
const source='a'.repeat(40),id='11111111-1111-4111-8111-111111111111';
function fixture(){
 const doc=YAML.parse(readFileSync('bff/openapi/quantos-bff.v1.yaml','utf8'));const ops=new Map(Object.values(doc.paths).flatMap(p=>Object.values(p)).map(o=>[o.operationId,o]));
 const records=operations.map(operationId=>{if(operationId.startsWith('subscribe')){const payload=JSON.parse(readFileSync('tests/contract/fixtures/market/'+(operationId==='subscribeQuotes'?'venue-quote':'candle-series')+'.json'));return {operationId,status:200,expectedStatus:200,responseValidation:'PASS',sse:true,frames:[{streamId:id,sequence:1,eventId:id,occurredAt:'2026-10-13T00:00:00Z',correlationId:id,payloadVersion:'v1',payload}]};}return {operationId,status:200,expectedStatus:200,responseValidation:'PASS',body:ops.get(operationId).responses['200'].content['application/json'].example};});
 for(let n=0;n<23;n++)records.push({operationId:'getWatchlist',name:'synthetic-negative-'+n,status:401,expectedStatus:401,responseValidation:'PASS',body:{code:'UNAUTHENTICATED',message:'fixture',correlationId:id}});
 return {schema:'quantos-bff005-http/v1',sourceCommit:source,status:'PASS',databaseExecution:false,externalExecution:false,performanceAccepted:false,formalAccepted:false,records,browser:{status:'PASS',dimensionSwitch:'PASS',nonExecutable:'PASS'},recovery:{dimensionMismatch:'REJECTED',futureSequence:'REJECTED',replacement:'PASS'},watchlist:{idempotency:'PASS',conflict:'REJECTED',staleVersion:'REJECTED'}};
}
test('complete verifier fixture validates without granting target acceptance',()=>assert.equal(validateMarketEvidence(fixture(),source).status,'PASS'));
for(const [name,change] of [
 ['missing operation',r=>r.records=r.records.filter(x=>x.operationId!=='getVenueQuotes')],['wrong source',r=>r.sourceCommit='b'.repeat(40)],['database claim',r=>r.databaseExecution=true],['external claim',r=>r.externalExecution=true],['performance claim',r=>r.performanceAccepted=true],['formal self approval',r=>r.formalAccepted=true],['failed request',r=>r.records[0].status=500],['missing stream frames',r=>r.records.find(x=>x.sse).frames=[]],['mislabeled stream',r=>r.records.find(x=>x.sse).sse=false],['corrupt quote',r=>r.records.find(x=>x.operationId==='getVenueQuotes').body.items[0].lastPrice=100],['missing license',r=>delete r.records.find(x=>x.operationId==='getVenueQuotes').body.items[0].provenance.license],['recovery failure',r=>r.recovery.replacement='FAIL'],['browser failure',r=>r.browser.dimensionSwitch='FAIL'],['incomplete denials',r=>r.records=r.records.filter(x=>x.status===200)]
])test('reject '+name,()=>{const r=fixture();change(r);assert.throws(()=>validateMarketEvidence(r,source));});
