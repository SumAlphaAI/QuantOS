// Pure market evidence validation; no Gate CLI import or top-level asynchronous work.
import assert from 'node:assert/strict';
import {validateResponse} from '../tests/contract/http-contract.mjs';
import {validateFixture} from '../tests/contract/validate.mjs';
export const operations=['getMarketCatalog','getWatchlist','saveWatchlist','getVenueQuotes','getCandleSeries','subscribeQuotes','subscribeCandles'];
export async function validateMarketRecords(records){
 assert(records.length>=30);assert(operations.every(id=>records.some(r=>r.operationId===id&&r.status===200)),'all market operations must execute');
 assert(records.filter(r=>r.expectedStatus!==200).length>=20,'denial coverage missing');
 for(const r of records){assert.equal(r.status,r.expectedStatus);assert.equal(r.responseValidation,'PASS');
  if(r.sse){assert(r.frames.length>0);for(const frame of r.frames){assert.deepEqual(validateFixture(frame,{schema:'StreamEvent'}),[]);assert.deepEqual(validateFixture(frame.payload,{schema:r.operationId==='subscribeQuotes'?'VenueQuote':'CandleSeries'}),[]);}}
  else assert.deepEqual(await validateResponse(r.operationId,Response.json(r.body,{status:r.status,headers:{'Cache-Control':'no-store','X-Correlation-Id':r.correlationId}})),[]);
 }
 return true;
}
export function validateMarketEvidence(r,source){
 assert.equal(r.schema,'quantos-bff005-http/v1');assert.equal(r.sourceCommit,source);assert.equal(r.status,'PASS');
 for(const k of ['databaseExecution','externalExecution','performanceAccepted','formalAccepted'])assert.equal(r[k],false);
 assert(r.records.length>=30);assert(r.records.filter(x=>x.expectedStatus!==200).length>=20);assert(operations.every(id=>r.records.some(x=>x.operationId===id&&x.status===200)));
 assert(r.records.every(x=>x.status===x.expectedStatus&&x.responseValidation==='PASS'));
 assert.equal(r.browser.status,'PASS');assert.equal(r.browser.dimensionSwitch,'PASS');assert.equal(r.browser.nonExecutable,'PASS');
 assert.equal(r.recovery.dimensionMismatch,'REJECTED');assert.equal(r.recovery.futureSequence,'REJECTED');assert.equal(r.recovery.replacement,'PASS');
 assert.equal(r.watchlist.idempotency,'PASS');assert.equal(r.watchlist.conflict,'REJECTED');assert.equal(r.watchlist.staleVersion,'REJECTED');
 // Recompute the schema checks rather than trusting stored PASS labels.
 const failures=[]; for(const x of r.records){assert(operations.includes(x.operationId));if(x.status===200&&x.operationId.startsWith('subscribe'))assert(x.sse&&Array.isArray(x.frames)&&x.frames.length>0,'stream frames missing');if(x.sse){for(const e of x.frames){failures.push(...validateFixture(e,{schema:'StreamEvent'}),...validateFixture(e.payload,{schema:x.operationId==='subscribeQuotes'?'VenueQuote':'CandleSeries'}));}}else if(x.status===200){const schema={getMarketCatalog:'MarketCatalog',getWatchlist:'MarketWatchlist',saveWatchlist:'MarketWatchlist',getVenueQuotes:'VenueQuotes',getCandleSeries:'CandleSeries'}[x.operationId];assert(schema,'JSON operation missing');failures.push(...validateFixture(x.body,{schema}));}else failures.push(...validateFixture(x.body,{schema:'ErrorEnvelope'}));}assert.deepEqual(failures,[]);
 return {status:'PASS',operations:7,records:r.records.length};
}
