import {bffZodSchemas,createBffClient,type BffRequestOptions} from "@sumalpha/api-client";
import type {RouteContext} from "../auth/route-access";
import {listDataSnapshots,getDataSnapshot,ResearchGatewayError,type SnapshotQuery} from "../research/gateway";
import {snapshotPolicy,type Snapshot} from "./policy";
const authority=(c:RouteContext)=>JSON.stringify([c.actorId,c.tenantId,c.workspaceId,c.accountId,c.mode,c.environment,c.mfaState,[...new Set(c.capabilities)].sort()]);
export function createSnapshotRuntime(config:{origin:string;authorize:()=>void;online:()=>boolean;fetchImpl?:typeof fetch;now?:()=>number;timeoutMs?:number}) {
 const lifetime=new AbortController(),transport=config.fetchImpl??fetch,now=config.now??Date.now,options:BffRequestOptions={signal:lifetime.signal,timeoutMs:config.timeoutMs??15000};
 let context:RouteContext|undefined,busy=false,query:SnapshotQuery|undefined,nextCursor:string|undefined,retryAt=0;
 const cursors=new Set<string>();
 const fail=(status:number)=>{throw new ResearchGatewayError("snapshotRuntime",status);};
 function guard(){config.authorize();if(lifetime.signal.aborted||!config.online()||!context)fail(403);if(!Number.isFinite(now())||now()>=Date.parse(context!.expiresAt))fail(401);if(!context!.capabilities.includes("snapshot.read"))fail(403);if(now()<retryAt)fail(429);}
 async function run<T>(action:()=>Promise<T>){if(busy)fail(409);busy=true;try{guard();return await action();}catch(e){if((e as {status?:number}).status===429)retryAt=now()+60000;throw e;}finally{busy=false;}}
 return {
  assertCurrent:guard,
  get retryAt(){return retryAt;},
  async load(){
   if(!config.origin||lifetime.signal.aborted)fail(503);config.authorize();
   const client=createBffClient({baseUrl:config.origin,fetch:transport,...options});
   const read=async(path:"/v1/session"|"/v1/context")=>{const r=await client.GET(path,{cache:"no-store"});config.authorize();if(!r.data)fail(r.response.status);return bffZodSchemas.SessionContext.parse(r.data);};
   const a=await read("/v1/session"),b=await read("/v1/context");
   if(authority(a)!==authority(b)||b.mfaState==="challenged"||!["research","paper","shadow"].includes(b.mode))fail(403);
   context={...b,expiresAt:new Date(Math.min(Date.parse(a.expiresAt),Date.parse(b.expiresAt))).toISOString()};guard();return structuredClone(context);
  },
  list(input:SnapshotQuery={},more=false){return run(async()=>{
   if(more&&(!query||!nextCursor||cursors.size>=49))fail(422);
   const selected=more?{...query,cursor:nextCursor}:{...input,cursor:undefined,pageSize:input.pageSize??25};
   if(!Number.isInteger(selected.pageSize)||selected.pageSize!<1||selected.pageSize!>200)fail(422);
   if(selected.quality&&!bffZodSchemas.DataQuality.safeParse(selected.quality).success)fail(422);
   if(selected.sort&&!/^(snapshotId|capturedAt):(asc|desc)$/.test(selected.sort))fail(422);
   if(selected.filter&&!/^snapshotId:eq:[0-9a-f-]{36}$/i.test(selected.filter))fail(422);
   if(selected.filter)bffZodSchemas.UUID.parse(selected.filter.slice(14));
   const result=await listDataSnapshots(config.origin,selected,transport,options);guard();
   if(!Array.isArray(result.items)||result.items.length>selected.pageSize!||new Set(result.items.map(s=>s.snapshotId)).size!==result.items.length)fail(502);
   if(result.nextCursor&&(result.nextCursor===selected.cursor||more&&cursors.has(result.nextCursor)))fail(502);
   if(more)cursors.add(selected.cursor!);else cursors.clear();query={...selected,cursor:undefined};nextCursor=result.nextCursor;
   return structuredClone({...result,items:result.items as Snapshot[]});
  });},
  detail(id:string){return run(async()=>{bffZodSchemas.UUID.parse(id);const s=await getDataSnapshot(config.origin,id,transport,options);guard();return structuredClone(s);});},
  checkUse(id:string,purpose:"strategy"|"trade"){return run(async()=>{
   bffZodSchemas.UUID.parse(id);if(!context!.capabilities.includes(purpose==="strategy"?"strategy.write":"execution.operate"))fail(403);
   const s=await getDataSnapshot(config.origin,id,transport,options);guard();if(!snapshotPolicy(s,now()).eligible)fail(409);
   return{snapshotId:s.snapshotId,contentHash:s.contentHash,purpose,scope:"SNAPSHOT_CHECK_ONLY_NOT_PURPOSE_AUTHORIZATION" as const};
  });},
  close(){lifetime.abort();context=undefined;query=undefined;nextCursor=undefined;cursors.clear();},
 };
}
export type SnapshotRuntime=ReturnType<typeof createSnapshotRuntime>;
