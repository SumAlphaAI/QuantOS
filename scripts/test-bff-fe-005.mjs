/** Real loopback Rust/R01/Axum/Chromium execution; static environment, no target credentials. */
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium} from '@playwright/test';
import {operations,validateRequest,validateResponse} from '../tests/contract/http-contract.mjs';
import {validateFixture} from '../tests/contract/validate.mjs';
import {validateMarketRecords,validateMarketEvidence,operations as marketOperations} from './bff-fe-005-evidence.mjs';
import {environment} from './bff-fe-005-functional-scope.mjs';
const output=process.argv[2]??'/tmp/quantos-bff005-http.json';
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const env={...environment(),QUANTOS_BFF_MODE:'reference'};
execFileSync('cargo',['build','-p','bff-gateway','--bin','bff-gateway','--locked','--offline'],{env,stdio:'inherit'});
const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
env.QUANTOS_BFF_BIND=`127.0.0.1:${port}`;const base=`http://127.0.0.1:${port}`;const child=spawn(resolve('target/debug/bff-gateway'),[],{env,stdio:['ignore','pipe','pipe']});
let browser;const records=[];const q='symbol=BTC%2FUSDT&venue=binance&product=spot';
const headers={cookie:'quantos_session=session-current; quantos_csrf=csrf-token-0000000000000001',origin:'http://localhost:3190','x-csrf-token':'csrf-token-0000000000000001','x-request-id':randomUUID(),'idempotency-key':randomUUID(),'if-match':'watchlist-0','content-type':'application/json'};
const viewerCookie='quantos_session=session-viewer; quantos_csrf=csrf-token-0000000000000001';
async function call(id,{query='',body,expected=200,override={},unsafe=false,name=id,pathParams={}}={}){
 const op=operations.get(id),h={...headers,...override};for(const k of Object.keys(h))if(h[k]===null)delete h[k];
 const request=new Request(base+op.path.replace(/\{([^}]+)\}/g,(_,k)=>pathParams[k])+(query?'?'+query:''),{method:op.method,headers:h,body:body===undefined?undefined:JSON.stringify(body)});
 const requestIssues=(await validateRequest(id,request.clone(),pathParams)).issues;if(!unsafe)assert.deepEqual(requestIssues,[],name+' request');
 const response=await fetch(request);assert.equal(response.headers.get('cache-control'),'no-store');let issues=await validateResponse(id,response);const correlationId=response.headers.get('x-correlation-id');
 const r={name,operationId:id,status:response.status,expectedStatus:expected,correlationId,requestValidation:unsafe?'EXPECTED_INVALID':'PASS',responseValidation:'PASS'};
 if(op.path.endsWith('/stream')&&response.ok){r.sse=true;r.frames=(await response.text()).split('\n').filter(l=>l.startsWith('data: ')).map(l=>JSON.parse(l.slice(6)));for(const e of r.frames)issues.push(...validateFixture(e,{schema:'StreamEvent'}),...validateFixture(e.payload,{schema:id==='subscribeQuotes'?'VenueQuote':'CandleSeries'}));}
 else r.body=await response.json();
 r.responseValidation=issues.length?'FAIL':'PASS';r.issues=issues;records.push(r);assert.equal(r.status,expected,name+': '+JSON.stringify(r.body));assert.deepEqual(issues,[],name);return r;
}
let failure=null,receipt;
try{
 await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Rust provider startup timeout')),30000);child.once('exit',()=>{clearTimeout(t);reject(Error('Rust provider stopped'));});child.stdout.on('data',v=>{if(v.toString().includes('"ready":true')){clearTimeout(t);resolve();}});child.stderr.on('data',()=>{});});
 await call('getMarketCatalog');await call('getWatchlist');const quotes=await call('getVenueQuotes',{query:q});assert.equal(quotes.body.items[0].lastPrice,'104');assert.equal(quotes.body.items[0].bid,'103.90');assert.equal(quotes.body.items[0].ask,'104.10');assert.equal(quotes.body.items[0].mid,'104.00');assert.equal(quotes.body.items[0].priceKind,'top_of_book');assert.equal(quotes.body.items[0].executable,false);
 const other=await call('getVenueQuotes',{query:q.replace('binance','coinbase')});assert.equal(other.body.items[0].lastPrice,'124');
 const candle=await call('getCandleSeries',{query:q});assert.equal(candle.body.ohlcv.length,5);assert.equal(candle.body.gaps.length,1);assert.equal(candle.body.replaceSeries,true);
 const stream=await call('subscribeCandles',{query:q});const frame=stream.frames[0];await call('subscribeQuotes',{query:q});
 const duplicate=await call('subscribeCandles',{query:q});assert.equal(duplicate.frames[0].sequence,frame.sequence);assert.deepEqual(duplicate.frames[0].payload.ohlcv,frame.payload.ohlcv);
 const ack=await call('subscribeCandles',{query:q+'&afterSequence='+frame.sequence+'&streamId='+frame.streamId,name:'acknowledged resume'});assert.deepEqual(ack.frames,[]);
 await call('subscribeCandles',{query:q+'&afterSequence=999999&streamId='+frame.streamId,expected:409,name:'future sequence'});
 await call('subscribeCandles',{query:q+'&interval=5m&afterSequence=1&streamId='+frame.streamId,expected:409,name:'dimension change'});
 await call('subscribeCandles',{query:q+'&afterSequence=1',expected:409,name:'missing stream binding'});
 const key=randomUUID(),body={instrumentIds:['binance:spot:BTC/USDT']};const saved=await call('saveWatchlist',{body,override:{'idempotency-key':key}});const replay=await call('saveWatchlist',{body,override:{'idempotency-key':key}});assert.deepEqual(saved.body,replay.body);
 const chain=await call('getEvidenceChain',{pathParams:{correlationId:saved.body.correlationId}});const fact=chain.body.items.find(e=>e.eventId===saved.body.auditRef);assert(fact);assert.equal(fact.kind,'market.watchlist.save');
 await call('saveWatchlist',{body:{instrumentIds:[]},override:{'idempotency-key':key},expected:409,name:'changed idempotent intent'});
 await call('saveWatchlist',{body,override:{'idempotency-key':randomUUID()},expected:409,name:'stale version'});
 for(const [name,query]of [['invalid timezone',q+'&timezone=Etc%2FInvalid'],['unsupported interval',q+'&interval=custom'],['unsupported product',q.replace('spot','perp')],['duplicate dimension',q+'&venue=coinbase'],['forged context',q+'&tenantId='+randomUUID()],['reversed range',q+'&start=2026-10-13T00:00:00Z&end=2026-10-12T00:00:00Z'],['oversized range',q+'&start=2025-01-01T00:00:00Z&end=2026-01-01T00:00:00Z']])await call('getCandleSeries',{query,unsafe:true,expected:422,name});
 await call('getCandleSeries',{query:'symbol=SOL%2FUSDT&venue=binance&product=spot',expected:404,name:'unknown instrument'});
 await call('getCandleSeries',{query:'symbol=BTC%2FUSDT',expected:422,name:'ambiguous venue'});
 // UI-401 permits viewer market reads, but the watchlist is actor-scoped and
 // viewer writes remain forbidden even with valid CSRF/origin/request headers.
 const viewer=await call('getWatchlist',{override:{cookie:viewerCookie},name:'viewer isolated read'});
 assert.deepEqual(viewer.body.instrumentIds,[]);assert.equal(viewer.body.objectVersion,'watchlist-0');
 for(const [name,override,expected]of [['anonymous',{cookie:null},401],['bearer-only',{cookie:null,authorization:'Bearer synthetic'},401],['bad csrf',{'x-csrf-token':'bad'},403],['missing origin',{origin:null},403],['missing key',{'idempotency-key':null},422],['missing version',{'if-match':null},422]])await call(name.includes('csrf')||name.includes('origin')||name.includes('key')||name.includes('version')?'saveWatchlist':'getWatchlist',{body:name.includes('csrf')||name.includes('origin')||name.includes('key')||name.includes('version')?body:undefined,override,unsafe:true,expected,name});
 await call('saveWatchlist',{body:{instrumentIds:[],actorId:randomUUID()},unsafe:true,expected:422,name:'forged actor body'});
 await call('saveWatchlist',{body:{instrumentIds:['binance:perp:BTC/USDT']},override:{'if-match':saved.body.objectVersion,'idempotency-key':randomUUID()},expected:422,name:'unlicensed watchlist instrument'});
 await call('subscribeCandles',{query:q,override:{'last-event-id':'999'},expected:422,name:'Last-Event-ID mismatch'});
 for(const operationId of marketOperations){
  const options={query:['getVenueQuotes','getCandleSeries','subscribeQuotes','subscribeCandles'].includes(operationId)?q:'',body:operationId==='saveWatchlist'?body:undefined};
  await call(operationId,{...options,unsafe:true,override:{cookie:null},expected:401,name:operationId+' anonymous'});
  await call(operationId,{...options,override:{cookie:'quantos_session=session-approver; quantos_csrf=csrf-token-0000000000000001'},expected:403,name:operationId+' unentitled role'});
  await call(operationId,{...options,override:{cookie:viewerCookie},expected:operationId==='saveWatchlist'?403:200,name:operationId+' viewer'});
 }
 const retained=await call('getWatchlist',{name:'writer state retained after viewer refusal'});
 assert.deepEqual(retained.body.instrumentIds,body.instrumentIds);assert.equal(retained.body.objectVersion,saved.body.objectVersion);
 const viewerRetained=await call('getWatchlist',{override:{cookie:viewerCookie},name:'viewer state retained after write refusal'});
 assert.deepEqual(viewerRetained.body.instrumentIds,[]);assert.equal(viewerRetained.body.objectVersion,'watchlist-0');
 browser=await chromium.launch({headless:true});const context=await browser.newContext();await context.addCookies([{name:'quantos_session',value:'session-current',url:base,httpOnly:true}]);const page=await context.newPage();await page.goto(base+'/v1/markets/catalog');
 const pageData=await page.evaluate(async q=>{const a=await(await fetch('/v1/markets/quotes?'+q,{credentials:'include',cache:'no-store'})).json();const b=await(await fetch('/v1/markets/quotes?'+q.replace('binance','coinbase'),{credentials:'include',cache:'no-store'})).json();return {a,b};},q);
 assert.equal(pageData.a.items[0].lastPrice,'104');assert.equal(pageData.b.items[0].lastPrice,'124');assert.equal(pageData.a.items[0].executable,false);await context.close();await browser.close();browser=null;
 await validateMarketRecords(records);
 receipt={schema:'quantos-bff005-http/v1',status:'PASS',sourceCommit:source,databaseExecution:false,externalExecution:false,performanceAccepted:false,formalAccepted:false,scope:'real loopback Axum + R01 fixture ingestion + generated OpenAPI + Chromium; no DB or external source execution',records,browser:{status:'PASS',dimensionSwitch:'PASS',nonExecutable:'PASS'},audit:{status:'PASS',auditRef:saved.body.auditRef,eventId:fact.eventId,correlationId:saved.body.correlationId},recovery:{dimensionMismatch:'REJECTED',futureSequence:'REJECTED',replacement:'PASS',duplicate:'IGNORED',resume:'EMPTY_AFTER_ACK'},watchlist:{idempotency:'PASS',conflict:'REJECTED',staleVersion:'REJECTED'}};validateMarketEvidence(receipt,source);
}catch(e){failure=e.message;receipt={schema:'quantos-bff005-http/v1',status:'FAIL',sourceCommit:source,records,failure};}
finally{await browser?.close();child.kill('SIGTERM');await new Promise(r=>child.exitCode!==null?r():child.once('close',r));}
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(receipt,null,2)+'\n');if(failure){console.error(failure);process.exitCode=1;}else console.log('BFF005_HTTP_PASS '+JSON.stringify({records:records.length,operations:7,browser:'PASS'}));
