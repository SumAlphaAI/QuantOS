// Explicit in-process transport model. No BFF, worker, database, IdP or durable replay runs here.
import {createSnapshotRuntime} from "../src/data-snapshots/runtime";
import {createResearchRuntime} from "../src/research/runtime";
import {createResearchDetailRuntime} from "../src/research/detail-runtime";
import {createArtifactRuntime} from "../src/artifacts/runtime";
import type {ResearchRun} from "../src/research/policy";
export const ids={snapshot:"11111111-1111-4111-8111-000000000001",actor:"22222222-2222-4222-8222-222222222222",run:"55555555-5555-4555-8555-555555555555",artifact:"44444444-4444-4444-8444-444444444444",evidence:"77777777-7777-4777-8777-777777777777",correlation:"aaaaaaaa-1111-4111-8111-111111111111"};
const start=Date.parse("2026-10-23T00:00:00Z"),iso=(n:number)=>new Date(n).toISOString();
export function closureModel(){
 let clock=start,authorized=true,online=true,csrf="fixture-csrf",created=false,createLost=false,cancelLost=false,createCommits=0,cancelCommits=0;
 const requests:Request[]=[],createBodies:string[]=[],streams=new Set<ReadableStreamDefaultController<Uint8Array>>(),invalidations:number[]=[],createKeys=new Map<string,string>(),cancelKeys=new Set<string>();
 const context={actorId:ids.actor,tenantId:ids.actor,workspaceId:ids.actor,accountId:ids.actor,mode:"paper",environment:"dev",capabilities:["research.read","research.write","snapshot.read","audit:read"],mfaState:"verified",expiresAt:iso(start+86400000)};
 const hash="sha256:"+"a".repeat(64),snapshot={snapshotId:ids.snapshot,schemaVersion:"v1",window:{start:iso(start-3600000),end:iso(start-60000)},sources:["explicit-transport-fixture"],quality:"verified",qualityBlocked:false,contentHash:hash,licenseLabel:"fixture-only",capturedAt:iso(start-30000),maxAgeSeconds:3600};
 const run:ResearchRun={runId:ids.run,capability:"research.hypothesis.v1",dataSnapshotId:ids.snapshot,budget:"10",deadlineAt:iso(start+3600000),status:"queued",inputHash:hash,engineVersion:"fixture-model",artifactRefs:[],evidenceRefs:[],correlationId:ids.correlation,auditRef:ids.actor,createdAt:iso(start)};
 const artifact={artifactId:ids.artifact,hypothesis:"Fixture hypothesis",summary:"Modeled result; no engine executed",engineVersion:"fixture-model",promptVersion:"fixture-p1",codeVersion:"fixture-c1",environmentHash:hash,inputHash:hash,dataSnapshotId:ids.snapshot,contentHash:hash,createdAt:iso(start),auditRef:ids.actor,correlationId:ids.correlation,evidence:[{evidenceId:ids.evidence,artifactId:ids.artifact,summary:"Modeled evidence"}]};
 const chain={correlationId:ids.correlation,items:[{eventId:ids.actor,sequence:1,kind:"research.create",objectRef:ids.run,occurredAt:iso(start),payloadHash:hash,route:"/untrusted?token=fixture",retentionUntil:iso(start+60000)},{eventId:ids.artifact,causationId:ids.actor,sequence:2,kind:"research.artifact.read",objectRef:ids.artifact,occurredAt:iso(start),payloadHash:hash,route:"/untrusted?token=fixture",retentionUntil:iso(start+60000)}],complete:true};
 const form={capability:run.capability,dataSnapshotId:ids.snapshot,question:"Fixed fixture input",budget:"10",deadlineAt:run.deadlineAt};
 const receipt=(status:string)=>({jobId:ids.run,status,statusRef:`/v1/research-runs/${ids.run}`,auditRef:ids.actor,correlationId:ids.correlation});
 const config={origin:"https://fixture.invalid",authorize:()=>{if(!authorized)throw Error("revoked fixture route");},online:()=>online,csrf:()=>csrf,now:()=>clock,timeoutMs:500,fetchImpl:(async(input,init)=>{
  const r=new Request(input,init);requests.push(r);const path=new URL(r.url).pathname;
  if(path==="/v1/session"||path==="/v1/context")return Response.json(context);
  if(path==="/v1/data-snapshots")return Response.json({items:[snapshot]});
  if(path==="/v1/data-snapshots/"+ids.snapshot)return Response.json(snapshot);
  if(path==="/v1/research-runs"&&r.method==="POST"){
   const body=await r.text(),key=r.headers.get("idempotency-key");createBodies.push(body);
   if(!key||!r.headers.get("x-csrf-token"))throw Error("fixture requires write headers");
   if(createKeys.has(key)&&createKeys.get(key)!==body)throw Error("fixture key/body conflict");
   if(!createKeys.has(key)){createKeys.set(key,body);created=true;createCommits++;}
   if(createLost){createLost=false;throw Error("fixture committed; response lost");}
   return Response.json(receipt("accepted"),{status:202});
  }
  if(path==="/v1/research-runs")return Response.json({items:created?[run]:[]});
  if(path===`/v1/research-runs/${ids.run}`)return Response.json(run);
  if(path===`/v1/research-runs/${ids.run}/cancel`){
   const key=r.headers.get("idempotency-key");if(!key||!r.headers.get("x-csrf-token"))throw Error("fixture requires write headers");
   if(!cancelKeys.has(key)){cancelKeys.add(key);cancelCommits++;} // Model receipt only; a separate C03 read supplies the terminal fact.
   if(cancelLost){cancelLost=false;throw Error("fixture cancel committed; response lost");}
   return Response.json(receipt("cancel_requested"),{status:202});
  }
  if(path===`/v1/research-runs/${ids.run}/stream`)return new Response(new ReadableStream<Uint8Array>({start(c){streams.add(c);r.signal.addEventListener("abort",()=>{if(streams.delete(c))c.close();},{once:true});},cancel(){/* Controller is removed by the request abort on route close. */}}),{headers:{"content-type":"text/event-stream"}});
  if(path===`/v1/artifacts/${ids.artifact}/attachment`)return Response.json({artifactId:ids.artifact,contentHash:artifact.contentHash,mediaType:"application/json",content:{summary:artifact.summary},auditRef:ids.actor,correlationId:ids.correlation});
  if(path===`/v1/artifacts/${ids.artifact}`)return Response.json(artifact);
  if(path===`/v1/audit/evidence-chains/${ids.correlation}`)return Response.json(chain);
  throw Error("Unexpected fixture request: "+r.method+" "+path);
 }) as typeof fetch};
 const snapshots=createSnapshotRuntime(config),research=createResearchRuntime(config),artifacts=createArtifactRuntime(config);
 const detail=createResearchDetailRuntime({...config,runId:ids.run,idleMs:100000,maxReconnects:0,invalidate:status=>{invalidations.push(status);detail.close();}});
 return{snapshots,research,artifacts,detail,form,requests,createBodies,context,snapshot,run,artifact,chain,invalidations,
  get activeStreams(){return streams.size;},get createCommits(){return createCommits;},get cancelCommits(){return cancelCommits;},
  loseCreate:()=>{createLost=true;},loseCancel:()=>{cancelLost=true;},advance:(ms:number)=>{clock+=ms;},offline:()=>{online=false;},revoke:()=>{authorized=false;},noCsrf:()=>{csrf="";},
  finish(){run.status="succeeded";run.artifactRefs=[ids.artifact];run.evidenceRefs=[ids.evidence];},
  emit(sequence:number,payload:Record<string,unknown>={type:"research.progress",runId:ids.run}){const event={streamId:ids.run,sequence,eventId:`99999999-9999-4999-8999-${String(sequence).padStart(12,"0")}`,occurredAt:iso(clock),correlationId:ids.correlation,payloadVersion:"v1",payload};for(const s of streams)s.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));},
  close(){snapshots.close();research.close();detail.close();artifacts.close();}
 };
}
