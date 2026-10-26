import {SseContractError,type SseEventEnvelope} from "@sumalpha/api-client";
import {createResearchRuntime} from "./runtime";
import {getResearchRun,cancelResearchRun,subscribeResearchRun,ResearchStreamReducer,ResearchGatewayError} from "./gateway";
import {assertSameResearch,terminalResearch,researchPath} from "./detail-policy";
import type {ResearchRun} from "./policy";
import type {RouteContext} from "../auth/route-access";
export type ResearchNotice={sequence:number;eventId:string;kind:string;occurredAt:string;correlationId:string};
export type ResearchDetailView={run?:ResearchRun;events:ResearchNotice[];sequence:number;stream:"idle"|"connecting"|"live"|"recovering"|"paused"|"complete"|"unavailable";gap?:{expected:number;got:number};busy:boolean;uncertain:boolean;retryAt:number;receipt?:Awaited<ReturnType<typeof cancelResearchRun>>;error?:number};
// A terminal revocation is honored even if its event ID was seen before.
class DetailReducer extends ResearchStreamReducer {
 override accept(event:SseEventEnvelope){if(event.payload?.type==="permission_revoked"){new ResearchStreamReducer(this.runId).accept(event);return this.close();}if(this.resumeAfter>=2000&&event.sequence>this.resumeAfter)throw new SseContractError("Research session event limit");return super.accept(event);}
}
const empty=():ResearchDetailView=>({events:[],sequence:0,stream:"idle",busy:false,uncertain:false,retryAt:0});
export function createResearchDetailRuntime(config:{origin:string;runId:string;authorize:()=>void;online:()=>boolean;operationsAllowed?:()=>boolean;csrf:()=>string;invalidate:(status:number)=>void;fetchImpl?:typeof fetch;now?:()=>number;timeoutMs?:number;idleMs?:number;maxReconnects?:number;retryDelayMs?:number}){
 const runId=config.runId.toLowerCase();researchPath(runId);
 const identity=createResearchRuntime(config),transport:typeof fetch=(input,init)=>(config.fetchImpl??fetch)(input,{...init,cache:"no-store"}),now=config.now??Date.now,life=new AbortController(),reducer=new DetailReducer(runId),listeners=new Set<(v:ResearchDetailView)=>void>();
 let context:RouteContext|undefined,state=empty(),streamAbort:AbortController|undefined,closed=false,key:string|undefined,readVersion=0,baseline:ResearchRun|undefined;
 const fail=(status:number)=>{throw new ResearchGatewayError("researchDetail",status);};
 function guard(write=false){config.authorize();identity.assertCurrent();if(closed||!context||!config.online())fail(403);if(write&&config.operationsAllowed&&!config.operationsAllowed())fail(403);if(write&&(!context!.capabilities.includes("research.write")||!config.csrf()))fail(403);}
 const notify=()=>{for(const listener of listeners)listener(structuredClone(state));};
 function stop(){streamAbort?.abort();streamAbort=undefined;}
 function error(e:unknown){const r=e as {status?:number;retryAfter?:number};if(r.status===401||r.status===403){config.invalidate(r.status);return;}if(r.status===429)state.retryAt=now()+Math.min(Math.max(r.retryAfter??60,1),3600)*1000;state.error=r.status??503;}
 async function readRun(){guard();const version=++readVersion;const run=await getResearchRun(config.origin,runId,transport,{signal:life.signal,timeoutMs:config.timeoutMs??15000});guard();assertSameResearch(baseline,run);if(version===readVersion){baseline=structuredClone(run);state.run=run;if(terminalResearch(run))state.stream="complete";notify();}return run;}
 async function exclusive(action:()=>Promise<void>){guard();if(state.busy)fail(409);if(now()<state.retryAt)fail(429);state.busy=true;state.error=undefined;notify();try{await action();}catch(e){if(!closed){error(e);if(!state.uncertain)state.run=undefined;}throw e;}finally{if(!closed){state.busy=false;notify();}}}
 function notice(event:SseEventEnvelope):ResearchNotice{return{sequence:event.sequence,eventId:event.eventId,kind:typeof event.payload.type==="string"&&/^[a-zA-Z0-9_.:-]{1,80}$/.test(event.payload.type)?event.payload.type:"领域通知",occurredAt:event.occurredAt,correlationId:event.correlationId};}
 async function watch(){
  if(closed||state.uncertain||!state.run||terminalResearch(state.run)||streamAbort)return;guard();
  const controller=new AbortController();streamAbort=controller;const signal=AbortSignal.any([life.signal,controller.signal]);state.stream="connecting";notify();
  // Only a validated, applied notice acknowledges a cursor. Domain facts always come from GET.
  let idle:ReturnType<typeof setTimeout>|undefined;const arm=()=>{clearTimeout(idle);idle=setTimeout(()=>controller.abort(Error("No confirmed event within idle window")),config.idleMs??30000);};arm();
  const bounded:typeof fetch=async(input,init)=>{guard();if(streamAbort===controller){state.stream=reducer.resumeAfter?"recovering":"connecting";notify();}const response=await transport(input,init);guard();if(response.ok&&!response.headers.get("content-type")?.includes("text/event-stream")){await response.body?.cancel();throw new ResearchGatewayError("researchStream",502);}if(!response.ok||!response.body)return response;
   let buffer="";const decoder=new TextDecoder("utf-8",{fatal:true});const body=response.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({transform(chunk,output){buffer+=decoder.decode(chunk,{stream:true});let index;while((index=buffer.search(/\r?\n\r?\n/))>=0){if(index>65536)throw new SseContractError("Oversized research frame");buffer=buffer.slice(index+(buffer[index]==="\r"?4:2));}if(buffer.length>65536)throw new SseContractError("Oversized research frame");output.enqueue(chunk);}}));return new Response(body,{status:response.status,headers:response.headers});};
  try{
   for await(const action of subscribeResearchRun(config.origin,runId,{fetchImpl:bounded,reducer,signal,maxReconnects:config.maxReconnects??5,retryDelayMs:config.retryDelayMs??250})){
    guard();if(streamAbort!==controller)return;
    if(action.type==="closed"){config.invalidate(403);return;}
    if(action.type==="gap"){state.gap={expected:action.expected,got:action.got};state.stream="recovering";notify();continue;}
    if(action.type!=="apply")continue;
    arm();state.sequence=reducer.resumeAfter;state.events=[...state.events,notice(action.event)].slice(-200);state.gap=undefined;state.stream="live";notify();
    await readRun();if(state.run&&terminalResearch(state.run)){controller.abort();state.stream="complete";notify();return;}
   }
  }catch(e){if(!closed&&streamAbort===controller){state.stream="unavailable";error(e);notify();}}
  finally{clearTimeout(idle);if(streamAbort===controller)streamAbort=undefined;}
 }
 return{
  get view(){return structuredClone(state);},
  subscribe(listener:(v:ResearchDetailView)=>void){listeners.add(listener);listener(structuredClone(state));return()=>{listeners.delete(listener);};},
  async load(){context=await identity.load();guard();return structuredClone(context);},
  async refresh(){stop();await exclusive(async()=>{await identity.load();guard();await readRun();});void watch();},
  async cancel(){
   stop();await exclusive(async()=>{
    guard(true);await identity.load();guard(true);const run=await readRun();guard(true);
    if(!state.uncertain&&(terminalResearch(run)||run.status==="cancel_requested"||state.receipt))fail(409);
    key??=crypto.randomUUID();let dispatched=false;
    try{dispatched=true;const receipt=await cancelResearchRun(config.origin,runId,key,config.csrf(),transport,{signal:life.signal,timeoutMs:config.timeoutMs??15000});guard();if(receipt.status!=="cancel_requested")throw new ResearchGatewayError("cancelResearchRun",202);state.receipt=receipt;state.uncertain=false;key=undefined;state.stream="paused";}
    catch(e){const status=(e as {status?:number}).status;if(dispatched&&(state.uncertain||status===undefined||status>=500||status<400))state.uncertain=true;else key=undefined;throw e;}
   });
   void watch();
  },
  close(){if(closed)return;closed=true;stop();life.abort();identity.close();context=undefined;baseline=undefined;key=undefined;readVersion++;state=empty();notify();listeners.clear();},
 };
}
export type ResearchDetailRuntime=ReturnType<typeof createResearchDetailRuntime>;
