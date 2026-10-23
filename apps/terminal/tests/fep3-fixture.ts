// Explicit in-process response model. Hashes, completion and approval are set by
// the model; this is not a BFF/worker, cryptographic check or database transaction.
import {createStrategyRuntime} from "../src/strategy/runtime";
import {createBacktestRuntime} from "../src/strategy/backtest-runtime";
import {createReleaseRuntime} from "../src/strategy/release-runtime";
export const ids={strategy:"11111111-1111-4111-8111-111111111111",run:"22222222-2222-4222-8222-222222222222",release:"33333333-3333-4333-8333-333333333333",approval:"44444444-4444-4444-8444-444444444444",artifact:"55555555-5555-4555-8555-555555555555",snapshot:"66666666-6666-4666-8666-666666666666"};
export const hash="sha256:"+"a".repeat(64),otherHash="sha256:"+"b".repeat(64);
export function fixture(){
 let now=Date.parse("2026-10-23T00:00:00Z"),online=true,allowed=true,capabilities=["strategy.write"],corruptSave=false,loseCheck=false,loseBacktest=false,loseCreate=false;
 const at=new Date(now).toISOString(),expires=new Date(now+60000).toISOString();
 const requests:Request[]=[],replays=new Map<string,Response>(),effects={save:0,check:0,backtest:0,create:0,submit:0};
 const parameters={lookback:6,cash:"100.000000000000000001",nested:{a:1,b:2},sequence:[1,2]};
 let draft={strategyId:ids.strategy,objectVersion:"1",files:{"strategy.rule":"momentum(close, lookback=6)"},parameters,artifactRefs:[{artifact_id:ids.artifact,content_hash:hash}],dataSnapshotId:ids.snapshot,updatedAt:at};
 function buildReport(){return{runId:ids.run,strategyId:ids.strategy,objectVersion:draft.objectVersion,dataSnapshotId:ids.snapshot,status:"succeeded",metrics:{net_pnl:"100.000000000000000001"},leakViolations:[],reportArtifactId:ids.artifact,reportHash:hash,parameters:structuredClone(draft.parameters),executionInputs:{costModel:{fee_bps:8,slippage_bps:12}},report:{snapshot_id:ids.snapshot,candidate:{source_commit:"a".repeat(40),image_digest:hash,runtime_digest:hash,clock:at},draft:{draft_id:ids.strategy,version:Number(draft.objectVersion),version_hash:hash,parameter_hash:hash},parameter_hash:hash,input_hash:hash,environment_hash:hash,report_hash:hash,costs:{fees_total:1,slippage_total:2},leak_check:{decisions:12,violations:0}}};}
 let report=buildReport();
 function buildRelease(){return{releaseId:ids.release,strategyId:ids.strategy,contentHash:hash,objectVersion:hash,draftObjectVersion:report.objectVersion,sourceDigest:report.report.candidate.source_commit,imageDigest:hash,parameterHash:hash,parameters:structuredClone(report.parameters),snapshotId:ids.snapshot,backtestRunId:ids.run,backtestReportArtifactId:ids.artifact,backtestReportHash:hash,evidenceRefs:structuredClone(draft.artifactRefs),allowedTargets:["paper","shadow"],approvalState:"none",createdAt:at,expiresAt:expires,approvalRef:undefined as string|undefined,approvalTimeline:[] as {action:string;actorId:string;occurredAt:string;correlationId:string}[]};}
 let release=buildRelease();
 const context=()=>({actorId:ids.strategy,tenantId:ids.strategy,workspaceId:ids.strategy,accountId:ids.strategy,mode:"paper",environment:"dev",capabilities,mfaState:"verified",expiresAt:"2099-01-01T00:00:00Z"});
 const ack=(id:string)=>({jobId:id,status:"accepted",correlationId:ids.strategy});
 const fetchImpl:typeof fetch=async(input,init)=>{
  const request=new Request(input,init),url=new URL(request.url),path=url.pathname;requests.push(request.clone());if(url.origin!=="https://fixture.invalid")throw Error("model does not access network");
  if(path==="/v1/session"||path==="/v1/context")return Response.json(context());
  if(request.method==="GET"){
   if(path==="/v1/strategies")return Response.json({items:[{strategyId:ids.strategy,name:"Explicit model",updatedAt:at}]});
   if(path.endsWith("/draft"))return Response.json(draft);
   if(path===`/v1/backtests/${ids.run}`)return Response.json(report);
   if(path.endsWith("/stream"))return new Response('data: '+JSON.stringify({streamId:ids.run,sequence:1,eventId:ids.artifact,correlationId:ids.strategy,occurredAt:at,payloadVersion:"v1",payload:report})+'\n\n',{headers:{"content-type":"text/event-stream"}});
   if(path===`/v1/artifacts/${ids.artifact}`)return Response.json({artifactId:ids.artifact,payloadHash:hash,contentHash:hash,dataSnapshotId:ids.snapshot,environmentHash:hash,backtestReport:report.report,executionInputs:report.executionInputs});
   if(path==="/v1/releases")return Response.json({items:[release]});
   if(path===`/v1/releases/${ids.release}`)return Response.json(release);
   if(path===`/v1/approvals/${ids.approval}`)return Response.json({approvalId:ids.approval,originator:ids.strategy,objectVersion:"0",status:release.approvalState,kind:"strategy_release",objectRef:ids.release,expiresAt:expires,correlationId:ids.strategy});
  }
  const key=request.headers.get("idempotency-key")??"",replay=replays.get(key);if(replay)return replay.clone();
  let response:Response;
  if(request.method==="PUT"){
   const body=await request.json();draft={...draft,...body,objectVersion:String(Number(draft.objectVersion)+1)};effects.save++;response=Response.json(draft);replays.set(key,response.clone());
   if(corruptSave){corruptSave=false;return Response.json({...draft,files:{"strategy.rule":"wrong echoed body"}});}return response;
  }
  if(path.endsWith("/static-checks")){effects.check++;response=Response.json({...ack(ids.strategy),strategyId:ids.strategy,objectVersion:draft.objectVersion,dataSnapshotId:ids.snapshot,result:{passed:true,version:Number(draft.objectVersion),version_hash:hash}},{status:202});}
  else if(path==="/v1/backtests"){effects.backtest++;report=buildReport();response=Response.json(ack(ids.run),{status:202});}
  else if(path==="/v1/releases"){effects.create++;release=buildRelease();response=Response.json(release,{status:201});}
  else if(path.endsWith("/approval-submissions")){effects.submit++;release={...release,approvalState:"pending",approvalRef:ids.approval,approvalTimeline:[{action:"submitted",actorId:ids.strategy,occurredAt:at,correlationId:ids.strategy}]};response=Response.json(ack(ids.approval),{status:202});}
  else return Response.json({},{status:404});
  replays.set(key,response.clone());if(path.endsWith("/static-checks")&&loseCheck){loseCheck=false;throw Error("modeled response loss");}if(path==="/v1/backtests"&&loseBacktest){loseBacktest=false;throw Error("modeled response loss");}if(path==="/v1/releases"&&loseCreate){loseCreate=false;throw Error("modeled response loss");}return response;
 };
 const config={origin:"https://fixture.invalid",authorize:()=>{if(!allowed)throw Error("revoked");},online:()=>online,csrf:()=>"csrf",fetchImpl,now:()=>now,timeoutMs:100, invalidate:()=>{}};
 return{strategy:()=>createStrategyRuntime(config),backtest:()=>createBacktestRuntime({...config,runId:ids.run,retryDelayMs:1,idleMs:100,maxReconnects:0}),releases:()=>createReleaseRuntime(config),requests,effects,
  get draft(){return structuredClone(draft);},get report(){return structuredClone(report);},get release(){return structuredClone(release);},
  corruptSave:()=>{corruptSave=true;},lose:(kind:"check"|"backtest"|"create")=>{if(kind==="check")loseCheck=true;if(kind==="backtest")loseBacktest=true;if(kind==="create")loseCreate=true;},
  reportParameters:(value:typeof parameters)=>{report={...report,parameters:structuredClone(value)};},
  leakage:()=>{report={...report,report:{...report.report,leak_check:{decisions:12,violations:1}}};},
  decision:(value:"approved"|"rejected")=>{release={...release,approvalState:value,approvalRef:ids.approval,approvalTimeline:[...release.approvalTimeline,{action:value==="approved"?"approve":"reject",actorId:ids.approval,occurredAt:at,correlationId:ids.strategy}]};},
  role:(caps:string[])=>{capabilities=caps;},revoke:()=>{allowed=false;},offline:()=>{online=false;},advance:(ms:number)=>{now+=ms;}};
}
