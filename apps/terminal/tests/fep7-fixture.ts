// Explicit in-process consumer model: no BFF, F06, signature, worker, database or durable proof.
import {createHash} from 'node:crypto';
import {createPerformanceRuntime} from '../src/performance/runtime';
import {perfContext,perfNow,perfView,perfRun,perfEntry,perfReport,perfId,perfOther} from './fixtures/scenarios/performance';
export function fep7Model(){
 let now=perfNow,online=true,csrf='explicit-model-csrf',lose=false,commits=0,refusal=0,expiredContent=false,foreignLedger=false;
 const context=structuredClone(perfContext),requests:Request[]=[],invalidations:number[]=[],replays=new Map<string,Response>();
 const document={metadata:perfReport('succeeded'),performance:perfView()},bytes=new TextEncoder().encode(JSON.stringify(document));
 const runtime=createPerformanceRuntime({origin:'https://fixture.invalid',authorize:()=>{},online:()=>online,csrf:()=>csrf,now:()=>now,invalidate:s=>invalidations.push(s),fetchImpl:async(i,n)=>{
  const req=new Request(i,n),u=new URL(req.url);if(u.origin!=='https://fixture.invalid')throw Error('Model cannot access network');requests.push(req.clone());
  if(['/v1/session','/v1/context'].includes(u.pathname))return refusal?new Response('<html>private gateway refusal</html>',{status:refusal,headers:{'content-type':'text/html'}}):Response.json(context);
  if(req.method==='POST'&&u.pathname==='/v1/performance/reports'){
   const key=req.headers.get('idempotency-key')!,old=replays.get(key);if(old)return old.clone();commits++;const response=Response.json(perfReport(),{status:202});replays.set(key,response.clone());if(lose){lose=false;throw Error('EXPLICIT_MODEL_COMMITTED_RESPONSE_LOSS');}return response;
  }
  if(['/v1/performance/summary','/v1/performance/series','/v1/performance/attribution'].includes(u.pathname))return Response.json(perfView());
  if(u.pathname.startsWith('/v1/reconciliation/runs/'))return Response.json(perfRun(u.pathname.split('/').at(-1)));
  if(u.pathname==='/v1/ledger/entries'){const entry=perfEntry(u.searchParams.get('runId')!);return Response.json({items:[foreignLedger?{...entry,sourceHash:'sha256:'+'f'.repeat(64)}:entry]});}
  if(u.pathname.endsWith('/status'))return Response.json(document.metadata);
  if(u.pathname.endsWith('/download'))return Response.json({...document.metadata,downloadPath:`/v1/performance/reports/${perfId}/content?ticket=${perfOther}`,sha256:'sha256:'+createHash('sha256').update(bytes).digest('hex'),sizeBytes:bytes.length,mediaType:'application/json',downloadExpiresAt:new Date(now+30000).toISOString()});
  if(u.pathname.endsWith('/content')){if(!expiredContent)return new Response(bytes,{headers:{'content-type':'application/json'}});return new Response(new ReadableStream<Uint8Array>({pull(controller){now+=30000;controller.enqueue(bytes);controller.close();}}),{headers:{'content-type':'application/json'}});}
  if(u.pathname===`/v1/performance/reports/${perfId}`)return Response.json(document);
  throw Error('Unexpected model request '+req.method+' '+u.pathname);
 }});
 return{runtime,context,requests,invalidations,get commits(){return commits;},loseNext(){lose=true;},refuse(status:number){refusal=status;},offline(){online=false;},replaceCsrf(){csrf='replacement-model-csrf';},advance(ms:number){now+=ms;},expireContent(){expiredContent=true;},foreignLedger(){foreignLedger=true;},close(){runtime.close();}};
}
