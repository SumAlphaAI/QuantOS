import {bffZodSchemas,type BffComponents} from "@sumalpha/api-client";
import type {RouteContext} from "../auth/route-access";
import {createResearchRuntime} from "../research/runtime";
import {getResearchRun,getResearchArtifact,getResearchAttachment,ResearchGatewayError} from "../research/gateway";
import {loadEvidenceChain,type EvidenceChainPage} from "../audit/gateway";
import {parseArtifact,type ArtifactDetail,type ArtifactLocation,type ArtifactEvidence} from "./policy";
export type ArtifactView={artifact:ArtifactDetail;run?:BffComponents["schemas"]["ResearchRun"];evidence?:ArtifactEvidence;inputHash?:string;inputHashSource:"C03"|"C04"|"NOT_PROVIDED"};
export function createArtifactRuntime(config:{origin:string;authorize:()=>void;csrf:()=>string;online:()=>boolean;fetchImpl?:typeof fetch;now?:()=>number;timeoutMs?:number}){
 const identity=createResearchRuntime(config),now=config.now??Date.now,life=new AbortController(),transport:typeof fetch=(input,init)=>(config.fetchImpl??fetch)(input,{...init,cache:"no-store"}),options={signal:life.signal,timeoutMs:config.timeoutMs??15000};
 let context:RouteContext|undefined,current:ArtifactView|undefined,chain:EvidenceChainPage|undefined,busy=false,retryAt=0;
 const snapshots=new Map<string,ArtifactDetail>(),cursors=new Set<string>();
 const fail=(status:number)=>{throw new ResearchGatewayError("artifactRuntime",status);};
 function guard(audit=false){identity.assertCurrent();if(!context||life.signal.aborted||!config.online())fail(403);if(audit&&!context!.capabilities.includes("audit:read"))fail(403);if(now()>=Math.min(Date.parse(context!.expiresAt),...(chain?.items??[]).map(i=>Date.parse(i.retentionUntil))))fail(410);}
 async function exclusive<T>(action:()=>Promise<T>){if(busy)fail(409);busy=true;try{guard();if(now()<retryAt)fail(429);await identity.load();guard();return await action();}catch(e){const r=e as {status?:number;retryAfter?:number};if(r.status===429&&retryAt<=now())retryAt=now()+Math.min(Math.max(r.retryAfter??60,1),3600)*1000;current=undefined;chain=undefined;cursors.clear();throw e;}finally{busy=false;}}
 async function metadata(id:string){const raw=await getResearchArtifact(config.origin,id,transport,options);guard();let a:ArtifactDetail;try{a=parseArtifact(raw);}catch{fail(502);}const prior=snapshots.get(id);if(prior&&(prior.contentHash!==a!.contentHash||prior.inputHash!==a!.inputHash||prior.dataSnapshotId!==a!.dataSnapshotId||prior.environmentHash!==a!.environmentHash||prior.engineVersion!==a!.engineVersion||prior.promptVersion!==a!.promptVersion||prior.codeVersion!==a!.codeVersion||prior.hypothesis!==a!.hypothesis||prior.summary!==a!.summary||prior.createdAt!==a!.createdAt||JSON.stringify(prior.evidence)!==JSON.stringify(a!.evidence)||JSON.stringify(prior.lineageRefs)!==JSON.stringify(a!.lineageRefs)))fail(502);if(snapshots.size>=20&&!snapshots.has(id))fail(422);snapshots.set(id,structuredClone(a!));return a!;}
 const canonical=(id:string)=>bffZodSchemas.UUID.parse(id).toLowerCase();
 return{
  assertCurrent:guard,
  get retryAt(){return retryAt;},get deadline(){return Math.min(context?Date.parse(context.expiresAt):Infinity,...(chain?.items??[]).map(i=>Date.parse(i.retentionUntil)));},
  async load(){context=await identity.load();guard();return structuredClone(context);},
  detail(location:ArtifactLocation){return exclusive(async()=>{
   chain=undefined;cursors.clear();const id=location.artifactId?canonical(location.artifactId):undefined,runId=location.runId?canonical(location.runId):undefined,evidenceId=location.evidenceId?canonical(location.evidenceId):undefined;
   if(!id&&!(runId&&evidenceId))fail(422);
   const run=runId?await getResearchRun(config.origin,runId,transport,options):undefined;guard();
   const refs=run?.artifactRefs??[];if(refs.length>20||new Set(refs).size!==refs.length)fail(502);
   if(run&&(id&&!refs.includes(id)||evidenceId&&!run.evidenceRefs.includes(evidenceId)))fail(404);
   let artifact:ArtifactDetail|undefined;
   if(id)artifact=await metadata(id);else for(const ref of refs){const a=await metadata(canonical(ref));if(a.evidence.some(e=>e.evidenceId===evidenceId)){if(artifact)fail(502);artifact=a;}}
   if(!artifact)fail(404);const a=artifact!;const evidence=evidenceId?a.evidence.find(e=>e.evidenceId===evidenceId):undefined;if(evidenceId&&!evidence)fail(404);
   if(run&&(run.dataSnapshotId!==a.dataSnapshotId||a.inputHash&&a.inputHash!==run.inputHash||a.evidence.some(e=>!run.evidenceRefs.includes(e.evidenceId))))fail(502);
   current={artifact:a,run,evidence,inputHash:run?.inputHash??a.inputHash,inputHashSource:run?"C03":a.inputHash?"C04":"NOT_PROVIDED"};guard();return structuredClone(current);
  });},
  attachment(){return exclusive(async()=>{if(!current)fail(422);const selected=current!,a=await metadata(selected.artifact.artifactId);if(a.contentHash!==selected.artifact.contentHash)fail(502);const data=await getResearchAttachment(config.origin,a.artifactId,a.contentHash,transport,options);guard();if(data.mediaType!=="application/json")fail(422);const text=JSON.stringify(data.content,null,2);if(text.length>262144)fail(422);return{artifactId:data.artifactId,contentHash:data.contentHash,mediaType:data.mediaType,text,auditRef:data.auditRef,correlationId:data.correlationId};});},
  evidenceChain(correlationId:string,more=false){return exclusive(async()=>{
   guard(true);if(!current)fail(422);const id=canonical(correlationId);if(![current!.artifact.correlationId,current!.run?.correlationId].includes(id))fail(422);
   if(more&&(!chain||chain.correlationId!==id||!chain.nextCursor||cursors.size>=19))fail(422);const cursor=more?chain!.nextCursor:undefined;
   const result=await loadEvidenceChain(config.origin,id,{pageSize:100,cursor},transport,options);guard(true);
   if(result.items.length>100||result.complete&&result.nextCursor||result.nextCursor&&(result.nextCursor===cursor||cursors.has(result.nextCursor)))fail(502);
   const items=more?[...chain!.items,...result.items]:result.items;if(items.length>2000||new Set(items.map(i=>i.eventId)).size!==items.length||items.some((v,i)=>i>0&&v.sequence<=items[i-1].sequence))fail(502);
   if(items.some(i=>Date.parse(i.retentionUntil)<=now()))fail(410);if(more)cursors.add(cursor!);else cursors.clear();chain={...result,items};guard(true);return structuredClone(chain);
  });},
  close(){life.abort();identity.close();context=undefined;current=undefined;chain=undefined;snapshots.clear();cursors.clear();},
 };
}
export type ArtifactRuntime=ReturnType<typeof createArtifactRuntime>;
