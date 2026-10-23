import {bffZodSchemas,createBffClient} from "@sumalpha/api-client";
import type {RouteContext} from "../auth/route-access";
import {catalog,quote,watchlist,sameIds,type MarketRow,type Watchlist} from "./policy";
export class MarketError extends Error {constructor(readonly status:number,readonly correlationId?:string){super("Market request could not be completed");}}
const authority=(c:RouteContext)=>JSON.stringify([c.actorId,c.tenantId,c.workspaceId,c.accountId,c.mode,c.environment,c.mfaState,[...new Set(c.capabilities)].sort()]);
export function createMarketRuntime(config:{origin:string;authorize:()=>void;online:()=>boolean;csrf:()=>string;invalidate?:(status:number)=>void;fetchImpl?:typeof fetch;now?:()=>number;timeoutMs?:number;partialQuotes?:boolean}){
 const now=config.now??Date.now,lifetime=new AbortController(),client=createBffClient({baseUrl:config.origin,fetch:config.fetchImpl,signal:lifetime.signal,timeoutMs:config.timeoutMs??10000}),listeners=new Set<()=>void>();
 let catalogItems:ReturnType<typeof catalog>=[],unavailable:{instrument:ReturnType<typeof catalog>[number];status:number;correlationId?:string}[]=[];
 let context:RouteContext|undefined,rows:MarketRow[]=[],base:Watchlist|undefined,local:string[]=[],head:Watchlist|undefined,busy=false,retryAt=0;
 let status:'empty'|'saved'|'dirty'|'conflict'|'uncertain'|'error'='empty';
 let pending:{key:string;version:string;ids:string[]}|undefined;
 const emit=()=>listeners.forEach(fn=>fn());
 const fail=(s:number):never=>{throw new MarketError(s);};
 function guard(write=false){config.authorize();if(lifetime.signal.aborted||!config.online()||!context)fail(403);if(!Number.isFinite(now())||now()>=Date.parse(context!.expiresAt))fail(401);if(!context!.capabilities.includes('market.read')||write&&(!context!.capabilities.includes('market.watchlist.write')||!config.csrf()))fail(403);}
 function checked<T>(r:{data?:T;error?:unknown;response:Response}):T{config.authorize();if(lifetime.signal.aborted)fail(403);if(r.response.status===200&&r.data)return r.data;const e=bffZodSchemas.ErrorEnvelope.safeParse(r.error);if([401,403].includes(r.response.status))config.invalidate?.(r.response.status);throw new MarketError(r.response.status,e.success?e.data.correlationId:undefined);}
 async function load(){if(!config.origin||lifetime.signal.aborted||!config.online())fail(503);const read=async(path:'/v1/session'|'/v1/context')=>bffZodSchemas.SessionContext.parse(checked(await client.GET(path,{cache:'no-store'})));const a=await read('/v1/session'),b=await read('/v1/context');if(authority(a)!==authority(b)||context&&authority(context)!==authority(b)||b.mfaState==='challenged'){config.invalidate?.(403);fail(403);}context={...b,expiresAt:new Date(Math.min(Date.parse(a.expiresAt),Date.parse(b.expiresAt),context?Date.parse(context.expiresAt):Infinity)).toISOString()};guard();return structuredClone(context);}
 async function exclusive(action:()=>Promise<void>){guard();if(busy)fail(409);busy=true;emit();try{await action();}finally{busy=false;emit();}}
 async function readWatch(){const w=watchlist(checked(await client.GET('/v1/markets/watchlist',{cache:'no-store'})));guard();return w;}
 return {
  load,assertCurrent:guard,subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},
  get view(){return structuredClone({rows,catalogItems,unavailable,base,local,head,busy,status,retryAt,pending:Boolean(pending)});},
  refresh(){return exclusive(async()=>{if(pending||status==='dirty'||status==='conflict')fail(409);rows=[];catalogItems=[];unavailable=[];base=undefined;local=[];status='empty';emit();try{await load();const items=catalog(checked(await client.GET('/v1/markets/catalog',{cache:'no-store'}))),w=await readWatch();const loaded:MarketRow[]=[],failures:typeof unavailable=[];
   // Bound requests; retain venue/product identity and never concatenate quotes.
   for(const i of items){guard();try{const r=await client.GET('/v1/markets/quotes',{params:{query:{symbol:i.canonicalSymbol,venue:i.venue,product:i.productType}},cache:'no-store'});guard();if(config.partialQuotes&&r.response.status!==200&&r.response.status!==401){const e=bffZodSchemas.ErrorEnvelope.safeParse(r.error);throw new MarketError(r.response.status,e.success?e.data.correlationId:undefined);}const raw=checked(r);loaded.push({instrument:i,quote:quote(raw,i,now())});}catch(e){if(!config.partialQuotes||lifetime.signal.aborted||(e as {status?:number}).status===401)throw e;guard();failures.push({instrument:i,status:(e as {status?:number}).status??502,correlationId:(e as {correlationId?:string}).correlationId});}}
   guard();catalogItems=items;unavailable=failures;rows=loaded;base=w;local=[...w.instrumentIds];status='saved';
  }catch(e){rows=[];catalogItems=[];unavailable=[];base=undefined;local=[];status='error';throw e;}});},
  toggle(id:string){guard(true);if(busy||pending||!base||status==='conflict'||!rows.some(r=>r.instrument.instrumentId===id))fail(409);const next=local.includes(id)?local.filter(v=>v!==id):[...local,id];if(next.length>100)fail(422);local=next;status=sameIds(local,base!.instrumentIds)?'saved':'dirty';emit();},
  removeUnavailable(id:string){guard(true);if(busy||pending||!base||status==='conflict'||!local.includes(id)||rows.some(r=>r.instrument.instrumentId===id))fail(409);local=local.filter(v=>v!==id);status=sameIds(local,base!.instrumentIds)?'saved':'dirty';emit();},
  discard(){guard();if(busy||pending||!base||status==='conflict')fail(409);local=[...base!.instrumentIds];status='saved';emit();},
  refreshConflict(){return exclusive(async()=>{if(status!=='conflict')fail(409);await load();head=await readWatch();});},
  resolveConflict(keepLocal:boolean){guard(true);if(busy||status!=='conflict'||!head)fail(409);base=head!;head=undefined;if(!keepLocal)local=[...base!.instrumentIds];status=sameIds(local,base!.instrumentIds)?'saved':'dirty';emit();},
  save(){return exclusive(async()=>{guard(true);if(!base||status==='conflict'||now()<retryAt||(!pending&&status!=='dirty'))fail(409);const recovering=Boolean(pending);let dispatched=false;try{await load();guard(true);pending??={key:crypto.randomUUID(),version:base!.objectVersion,ids:[...local]};const p=pending;dispatched=true;
   const r=await client.PUT('/v1/markets/watchlist',{params:{header:{'If-Match':p.version,'Idempotency-Key':p.key,'X-Request-Id':crypto.randomUUID(),'X-CSRF-Token':config.csrf()}},body:{instrumentIds:p.ids}});guard(true);
   if(r.response.status===200&&r.data){const w=watchlist(r.data);if(!sameIds(w.instrumentIds,p.ids)||w.objectVersion===p.version||!w.auditRef||!w.correlationId)fail(502);base=w;local=[...w.instrumentIds];head=undefined;pending=undefined;status='saved';return;}
   const e=bffZodSchemas.ErrorEnvelope.safeParse(r.error);if([401,403].includes(r.response.status))config.invalidate?.(r.response.status);if(r.response.status===429&&e.success)retryAt=now()+Math.min(Math.max(e.data.retryAfter??60,1),3600)*1000;
   if(!recovering&&e.success&&r.response.status===409&&e.data.code==='VERSION_CONFLICT'){pending=undefined;head=undefined;status='conflict';}
   else if(!recovering&&[401,403,409,422,429].includes(r.response.status)&&e.success){pending=undefined;status='dirty';}
   else status='uncertain';throw new MarketError(r.response.status,e.success?e.data.correlationId:undefined);
  }catch(e){if(!lifetime.signal.aborted&&pending&&(recovering||dispatched))status='uncertain';throw e;}});},
  close(){lifetime.abort();context=undefined;rows=[];catalogItems=[];unavailable=[];base=undefined;head=undefined;local=[];pending=undefined;status='empty';listeners.clear();}
 };
}
export type MarketRuntime=ReturnType<typeof createMarketRuntime>;
