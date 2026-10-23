import {createBffClient,bffZodSchemas,type BffComponents} from '@sumalpha/api-client';
import {MarketError} from './runtime';
import type {RouteContext} from '../auth/route-access';
type Preferences=BffComponents['schemas']['AlertSubscriptions'];
const parse=(raw:unknown)=>{const p=bffZodSchemas.AlertSubscriptions.parse(raw);if(!/^(0|[1-9]\d*)$/.test(p.objectVersion)||BigInt(p.objectVersion)>18446744073709551614n||!p.domains.length||!p.severities.length||new Set(p.domains).size!==p.domains.length||new Set(p.severities).size!==p.severities.length)throw new MarketError(502);return p;};
const choice=(p:Preferences,market:boolean)=>({...p,domains:market?(p.domains.includes('market')?[...p.domains]:[...p.domains,'market' as const]):p.domains.filter(d=>d!=='market')});
const content=(p:Preferences)=>JSON.stringify([p.domains,p.severities]);
export function createMarketAlerts(config:{origin:string;authorize:()=>void;identity:()=>Promise<RouteContext>;online:()=>boolean;csrf:()=>string;fetchImpl?:typeof fetch;now?:()=>number;timeoutMs?:number}){
 const life=new AbortController(),client=createBffClient({baseUrl:config.origin,fetch:config.fetchImpl,signal:life.signal,timeoutMs:config.timeoutMs??10000}),now=config.now??Date.now,listeners=new Set<()=>void>();
 let base:Preferences|undefined,head:Preferences|undefined,enabled=false,busy=false,retryAt=0,status:'empty'|'saved'|'dirty'|'uncertain'|'conflict'|'error'='empty',pending:{key:string;version:string;input:Pick<Preferences,'domains'|'severities'>}|undefined;
 const emit=()=>listeners.forEach(f=>f());
 function guard(){config.authorize();if(life.signal.aborted||!config.online())throw new MarketError(403);}
 async function identity(){guard();const c=await config.identity();guard();if(!c.capabilities.includes('alerts.read'))throw new MarketError(403);}
 async function exclusive(fn:()=>Promise<void>){guard();if(busy)throw new MarketError(409);busy=true;emit();try{await fn();}finally{busy=false;emit();}}
 async function read(){const r=await client.GET('/v1/alerts/subscriptions',{cache:'no-store'});guard();if(r.response.status!==200||!r.data)throw new MarketError(r.response.status);return parse(r.data);}
 return {subscribe(f:()=>void){listeners.add(f);return()=>{listeners.delete(f);};},get view(){return structuredClone({base,head,enabled,busy,retryAt,status,pending:Boolean(pending)});},
 load(){return exclusive(async()=>{if(pending||status==='dirty'||status==='conflict')throw new MarketError(409);base=undefined;head=undefined;status='empty';emit();try{await identity();base=await read();enabled=base.domains.includes('market');status='saved';}catch(e){status='error';throw e;}});},
 toggle(v:boolean){guard();if(!base||busy||pending||status==='conflict'||!choice(base,v).domains.length)throw new MarketError(409);enabled=v;status=enabled===base.domains.includes('market')?'saved':'dirty';emit();},
 refreshConflict(){return exclusive(async()=>{if(status!=='conflict')throw new MarketError(409);await identity();head=await read();});},
 resolve(keepLocal:boolean){guard();if(!head||busy||status!=='conflict')throw new MarketError(409);if(!keepLocal)enabled=head.domains.includes('market');if(!choice(head,enabled).domains.length)throw new MarketError(409);base=head;head=undefined;status=enabled===base.domains.includes('market')?'saved':'dirty';emit();},
 save(){return exclusive(async()=>{if(!base||!config.csrf()||now()<retryAt||!['dirty','uncertain'].includes(status))throw new MarketError(409);const recovering=Boolean(pending);let sent=false;try{await identity();if(!config.csrf())throw new MarketError(403);if(!pending){const p=choice(base,enabled);if(!p.domains.length)throw new MarketError(422);pending={key:crypto.randomUUID(),version:base.objectVersion,input:{domains:p.domains,severities:[...p.severities]}};}const p=pending;sent=true;
 const r=await client.PUT('/v1/alerts/subscriptions',{body:p.input,params:{header:{'If-Match':p.version,'Idempotency-Key':p.key,'X-CSRF-Token':config.csrf(),'X-Request-Id':crypto.randomUUID()}}});guard();if(r.response.status===200&&r.data){const next=parse(r.data);if(BigInt(next.objectVersion)!==BigInt(p.version)+1n||content(next)!==JSON.stringify([p.input.domains,p.input.severities])||!next.auditRef||!next.correlationId)throw new MarketError(502);base=next;enabled=next.domains.includes('market');pending=undefined;status='saved';return;}
 const e=bffZodSchemas.ErrorEnvelope.safeParse(r.error);if(e.success&&r.response.status===429)retryAt=now()+Math.min(Math.max(e.data.retryAfter??60,1),3600)*1000;
 if(!recovering&&e.success&&r.response.status===409&&e.data.code==='VERSION_CONFLICT'){pending=undefined;head=undefined;status='conflict';}else if(!recovering&&e.success&&[401,403,409,422,429].includes(r.response.status)){pending=undefined;status='dirty';}else status='uncertain';throw new MarketError(r.response.status,e.success?e.data.correlationId:undefined);
 }catch(e){if(!life.signal.aborted&&pending&&(sent||recovering))status='uncertain';throw e;}});},
 close(){life.abort();base=undefined;head=undefined;pending=undefined;enabled=false;status='empty';listeners.clear();}
 };
}
export type MarketAlerts=ReturnType<typeof createMarketAlerts>;
