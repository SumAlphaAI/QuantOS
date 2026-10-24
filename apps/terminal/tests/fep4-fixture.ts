// Explicit in-process consumer model, not BFF/engine/market/ledger production evidence.
import {createMarketRuntime} from '../src/markets/runtime';
import {createChartRuntime} from '../src/markets/chart-runtime';
import {createPerformanceRuntime} from '../src/performance/runtime';
import {perfContext,perfNow,perfQuery,perfView,perfRun,perfEntry,perfReport,perfOther} from './fixtures/scenarios/performance';
import {marketInstrument,marketQuote} from './fixtures/scenarios/market';
import {p19Series} from './fixtures/scenarios/p19';
export function fep4Model(){
 let now=perfNow,allowed=true,online=true,lost=false,completed=false,commits=0;
 const context={...perfContext,capabilities:['market.read','market.watchlist.write','execution.operate','audit:read']},requests:Request[]=[],invalidations:number[]=[],intents=new Map<string,string>();
 const data=perfView(),items=[marketInstrument(),marketInstrument('coinbase')];
 const config={origin:'https://fixture.invalid',now:()=>now,online:()=>online,authorize:()=>{if(!allowed)throw Error('Test scope revoked');},csrf:()=> 'fixture-csrf',invalidate:(status:number)=>{invalidations.push(status);allowed=false;},fetchImpl:(async(i,n)=>{const req=new Request(i,n),u=new URL(req.url);if(u.origin!=='https://fixture.invalid')throw Error('Model cannot use network');requests.push(req.clone());
  if(['/v1/session','/v1/context'].includes(u.pathname))return Response.json(context);
  if(u.pathname==='/v1/markets/catalog')return Response.json({items,asOf:new Date(now).toISOString()});
  if(u.pathname==='/v1/markets/watchlist')return Response.json({instrumentIds:[],objectVersion:'watchlist-0'});
  if(u.pathname==='/v1/markets/quotes'){const instrument=items.find(x=>x.venue===u.searchParams.get('venue'))!;return Response.json({items:[{...marketQuote(instrument),provenance:{...marketQuote(instrument).provenance,asOf:new Date(perfNow).toISOString()}}]});}
  if(u.pathname==='/v1/markets/candles'||u.pathname==='/v1/markets/candles/stream'){const v=p19Series(perfNow),venue=u.searchParams.get('venue')!;Object.assign(v,{venue,instrumentId:venue+':spot:BTC/USDT'});Object.assign(v.provenance,{venue,source:'approved.'+venue+'.spot'});if(u.pathname.endsWith('/stream'))return new Response(`data: ${JSON.stringify({streamId:perfOther,eventId:perfOther,correlationId:perfOther,payloadVersion:'v1',sequence:v.sequence,occurredAt:v.provenance.asOf,payload:v})}\n\n`,{headers:{'content-type':'text/event-stream'}});return Response.json(v);}
  if(u.pathname==='/v1/orders')return Response.json({code:'FORBIDDEN',message:'Explicit model C09 scope denial',correlationId:context.actorId},{status:403});
  if(u.pathname.startsWith('/v1/reconciliation/runs/'))return Response.json(perfRun(u.pathname.split('/').at(-1)));
  if(u.pathname==='/v1/ledger/entries')return Response.json({items:[perfEntry(u.searchParams.get('runId')!)]});
  if(['/v1/performance/summary','/v1/performance/series','/v1/performance/attribution'].includes(u.pathname))return Response.json(data);
  if(u.pathname==='/v1/performance/reports'&&req.method==='POST'){const key=req.headers.get('idempotency-key')!,body=await req.text();if(!key||!req.headers.get('x-csrf-token'))throw Error('Missing model headers');if(intents.has(key)&&intents.get(key)!==body)throw Error('Model intent mismatch');if(!intents.has(key)){intents.set(key,body);commits++;}if(lost){lost=false;throw Error('Explicit model committed response loss');}return Response.json(perfReport(),{status:202});}
  const report=perfReport(completed?'succeeded':'queued'),document={metadata:report,performance:perfView()};
  if(u.pathname.endsWith('/status'))return Response.json(report);
  if(u.pathname.startsWith('/v1/performance/reports/'))return Response.json(document);
  throw Error('Unexpected model request '+req.method+' '+u.pathname);
 }) as typeof fetch};
 const market=createMarketRuntime({...config,partialQuotes:true}),chart=createChartRuntime({...config,retainOnRefreshError:true}),performance=createPerformanceRuntime(config);
 return {market,chart,performance,context,data,requests,invalidations,query:{...perfQuery},items,config,
 get commits(){return commits;},loseReport(){lost=true;},completeReport(){completed=true;},advance(ms:number){now+=ms;},offline(){online=false;},revoke(){allowed=false;},
 close(){market.close();chart.close();performance.close();}
 };
}
