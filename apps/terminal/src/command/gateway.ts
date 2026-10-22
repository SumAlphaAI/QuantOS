import {bffZodSchemas,createBffClient,SseStreamReducer,type BffComponents,type SseEventEnvelope} from "@sumalpha/api-client";
import {commandItemPath} from "./presentation";
export const commandClient=(origin:string,transport:typeof fetch=fetch)=>createBffClient({baseUrl:origin,fetch:transport,timeoutMs:10000});
export function commandView(raw:unknown,accountId:string,mode:BffComponents["schemas"]["RuntimeMode"],now=Date.now()){
 const v=bffZodSchemas.CommandSummary.parse(raw);
 if(v.accountId!==accountId||v.mode!==mode)throw Error("Command scope changed");
 if(Date.parse(v.sampledAt)>now+1000||Date.parse(v.expiresAt)<=now||Date.parse(v.expiresAt)<=Date.parse(v.sampledAt))throw Error("Command projection expired");
 if(new Set(v.sources.map(s=>s.domain)).size!==4)throw Error("Command source set changed");
 const execution=v.sources.find(s=>s.domain==="execution")!,operations=v.sources.find(s=>s.domain==="operations")!;
 if(execution.status!=="ready"&&(v.riskPosture!=="unknown"||v.orderSummary!==null))throw Error("Command risk source unavailable");
 if(operations.status!=="ready"&&(v.systemHealth!==null||v.openRiskAlerts!==null))throw Error("Command health source unavailable");
 const research=v.sources.find(s=>s.domain==="research")!,strategy=v.sources.find(s=>s.domain==="strategy")!;
 if(research.status!=="ready"&&(v.runningRuns!==null||v.failedRuns!==null))throw Error("Command research source unavailable");
 if((execution.status!=="ready"||strategy.status!=="ready")&&v.pendingApprovals!==null)throw Error("Command approval source unavailable");
 if(v.orderSummary&&v.orderSummary.mode!==mode)throw Error("Command order mode changed");
 for(const source of v.sources)if(source.status==="ready"&&(!source.asOf||!source.sourceHash||Date.parse(source.asOf)>now+1000||Date.parse(source.asOf)>Date.parse(v.sampledAt)+1000||Date.parse(v.sampledAt)-Date.parse(source.asOf)>=(source.domain==="execution"?60000:30000)))throw Error("Command source metadata unavailable");
 if(v.asOf&&(Date.parse(v.asOf)>now+1000||Date.parse(v.asOf)>Date.parse(v.sampledAt)+1000))throw Error("Command asOf invalid");
 if([...v.priority,...v.recentActivity].some(row=>!commandItemPath(row)))throw Error("Command item resource changed");
 if(Date.parse(v.expiresAt)>Date.parse(v.sampledAt)+30000||v.sources.some(source=>source.status==="ready"&&Date.parse(v.expiresAt)>Date.parse(source.asOf!)+(source.domain==="execution"?60000:30000)))throw Error("Command lease exceeds source deadline");
 if(v.partial!==v.sources.some(source=>source.status!=="ready"))throw Error("Command partial state changed");
 return structuredClone(v);
}
export class CommandFacts {
 private reducer=new SseStreamReducer();private stream?:string;private value?:BffComponents["schemas"]["CommandSummary"];
 constructor(readonly accountId:string,readonly mode:BffComponents["schemas"]["RuntimeMode"]){bffZodSchemas.UUID.parse(accountId);}
 get snapshot(){return this.value?structuredClone(this.value):undefined;}
 get afterSequence(){return this.reducer.resumeAfter;}
 revoke(){this.reducer.close();this.value=undefined;}
 refused(status:number){if(status===401||status===403){this.revoke();return;}throw Error("Command resnapshot required");}
 apply(raw:SseEventEnvelope,now=Date.now()):"applied"|"ignored"|"revoked"{
  if(this.reducer.isClosed)throw Error("Command permission revoked");
  const e=bffZodSchemas.StreamEvent.parse(raw);
  if(this.stream&&e.streamId!==this.stream)throw Error("Command stream changed");
  if(e.payload.type==="permission_revoked"){this.revoke();return"revoked";}
  const value=commandView(e.payload,this.accountId,this.mode,now),action=this.reducer.accept(raw);
  if(action.type==="gap")throw Error("Command event gap");
  if(action.type!=="apply")return"ignored";
  this.stream=e.streamId;this.value=value;return"applied";
 }
 url(base:string){const u=new URL('/v1/command/stream',base);u.searchParams.set('accountId',this.accountId);u.searchParams.set('afterSequence',String(this.afterSequence));if(this.stream)u.searchParams.set('streamId',this.stream);return u.toString();}
}
