import {bffZodSchemas,createBffClient,type BffRequestOptions} from "@sumalpha/api-client";
import type {RouteContext} from "../auth/route-access";
import {createSnapshotRuntime} from "../data-snapshots/runtime";
import {snapshotPolicy} from "../data-snapshots/policy";
import {createResearchRun,listResearchRuns,getDataSnapshot,ResearchGatewayError,type ResearchInput,type ResearchQuery} from "./gateway";
import {validateResearchForm,validateResearchQuery,type ResearchForm} from "./policy";
const authority=(c:RouteContext)=>JSON.stringify([c.actorId,c.tenantId,c.workspaceId,c.accountId,c.mode,c.environment,c.mfaState,[...new Set(c.capabilities)].sort()]);
export function createResearchRuntime(config:{origin:string;authorize:()=>void;csrf:()=>string;online:()=>boolean;operationsAllowed?:()=>boolean;fetchImpl?:typeof fetch;now?:()=>number;timeoutMs?:number}){
 const transport=config.fetchImpl??fetch,now=config.now??Date.now,lifetime=new AbortController(),options:BffRequestOptions={signal:lifetime.signal,timeoutMs:config.timeoutMs??15000};
 let context:RouteContext|undefined,busy=false,retryAt=0,query:ResearchQuery|undefined,nextCursor:string|undefined;
 let pending:{body:ResearchInput;key:string}|undefined,uncertain=false;
 const cursors=new Set<string>();
 const fail=(status:number,fields:Record<string,string>={})=>{throw new ResearchGatewayError("researchRuntime",status,fields);};
 function guard(write=false){config.authorize();if(lifetime.signal.aborted||!config.online()||!context)fail(403);if(!Number.isFinite(now())||now()>=Date.parse(context!.expiresAt))fail(401);if(write&&config.operationsAllowed&&!config.operationsAllowed())fail(403);if(!context!.capabilities.includes("research.read")||write&&(!context!.capabilities.includes("research.write")||!context!.capabilities.includes("snapshot.read")||!config.csrf()))fail(403);if(now()<retryAt)fail(429);}
 const snapshots=createSnapshotRuntime({...config,authorize:()=>guard(),fetchImpl:transport});
 async function readContext(){const client=createBffClient({baseUrl:config.origin,fetch:transport,...options});const read=async(path:"/v1/session"|"/v1/context")=>{const r=await client.GET(path,{cache:"no-store"});config.authorize();if(!r.data)fail(r.response.status);return bffZodSchemas.SessionContext.parse(r.data);};const a=await read("/v1/session"),b=await read("/v1/context");if(authority(a)!==authority(b)||context&&authority(context)!==authority(b)||b.mfaState==="challenged"||!["research","paper","shadow"].includes(b.mode))fail(403);context={...b,expiresAt:new Date(Math.min(Date.parse(a.expiresAt),Date.parse(b.expiresAt),context?Date.parse(context.expiresAt):Infinity)).toISOString()};guard();return structuredClone(context);}
 async function exclusive<T>(action:()=>Promise<T>){if(busy)fail(409);busy=true;try{guard();return await action();}catch(e){const error=e as {status?:number;retryAfter?:number};if(error.status===429&&retryAt<=now())retryAt=now()+Math.min(Math.max(error.retryAfter??60,1),3600)*1000;throw e;}finally{busy=false;}}
 return{
  assertCurrent:guard,
  get retryAt(){return retryAt;},get uncertain(){return uncertain;},
  async load(){if(!config.origin)fail(503);return readContext();},
  list(input:ResearchQuery={},more=false){return exclusive(async()=>{if(more&&(!query||!nextCursor||cursors.size>=49))fail(422);const q=more?{...query,cursor:nextCursor}:{...input,cursor:undefined,pageSize:input.pageSize??25};validateResearchQuery(q);const result=await listResearchRuns(config.origin,q,transport,options);guard();if(!Array.isArray(result.items)||result.items.length>q.pageSize!||new Set(result.items.map(r=>r.runId)).size!==result.items.length||result.nextCursor&&(result.nextCursor===q.cursor||more&&cursors.has(result.nextCursor)))fail(502);if(more)cursors.add(q.cursor!);else cursors.clear();query={...q,cursor:undefined};nextCursor=result.nextCursor;return structuredClone(result);});},
  snapshots(more=false){return exclusive(async()=>{if(!context!.capabilities.includes("snapshot.read"))fail(403);if(!more)await snapshots.load();const page=await snapshots.list({quality:"verified",sort:"capturedAt:desc",pageSize:25},more);guard();return page;});},
  create(form:ResearchForm){return exclusive(async()=>{
   guard(true);const validated=validateResearchForm(form,now());if(!validated.valid)fail(422,validated.errors);
   const body=validated.body;if(pending&&JSON.stringify(body)!==JSON.stringify(pending.body))fail(409);
   await readContext();guard(true);
   const snapshot=await getDataSnapshot(config.origin,body.dataSnapshotId,transport,options);guard(true);
   if(!snapshotPolicy(snapshot,now()).eligible)fail(422,{dataSnapshotId:"快照质量、许可或时效受限，请重新选择。"});
   if(!validateResearchForm(form,now()).valid)fail(422,{deadlineAt:"截止时间已失效，请核对。"});
   pending??={body:structuredClone(body),key:crypto.randomUUID()};
   try{const accepted=await createResearchRun(config.origin,pending.body,pending.key,config.csrf(),transport,options);guard();if(accepted.status!=="accepted"||!accepted.auditRef)throw new ResearchGatewayError("createResearchRun",202);pending=undefined;uncertain=false;return structuredClone(accepted);}
   catch(e){const error=e as {outcomeUnknown?:boolean;status?:number};if(uncertain||error.outcomeUnknown||error.status===undefined||error.status===409){uncertain=true;}else{pending=undefined;uncertain=false;}throw e;}
  });},
  close(){lifetime.abort();snapshots.close();context=undefined;pending=undefined;uncertain=false;query=undefined;nextCursor=undefined;cursors.clear();},
 };
}
export type ResearchRuntime=ReturnType<typeof createResearchRuntime>;
