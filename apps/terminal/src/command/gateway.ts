import {bffZodSchemas,createBffClient,SseStreamReducer,type BffComponents,type SseEventEnvelope} from "@sumalpha/api-client";
export const commandClient=(origin:string,transport:typeof fetch=fetch)=>createBffClient({baseUrl:origin,fetch:transport,timeoutMs:10000});
export function commandView(raw:unknown,accountId:string,mode:BffComponents["schemas"]["RuntimeMode"],now=Date.now()){
 const v=bffZodSchemas.CommandSummary.parse(raw);
 if(v.accountId!==accountId||v.mode!==mode)throw Error("Command scope changed");
 if(Date.parse(v.sampledAt)>now+1000||Date.parse(v.expiresAt)<=now||Date.parse(v.expiresAt)<=Date.parse(v.sampledAt))throw Error("Command projection expired");
 if(new Set(v.sources.map(s=>s.domain)).size!==4)throw Error("Command source set changed");
 const execution=v.sources.find(s=>s.domain==="execution")!,operations=v.sources.find(s=>s.domain==="operations")!;
 if(execution.status!=="ready"&&(v.riskPosture!=="unknown"||v.orderSummary!==null))throw Error("Command risk source unavailable");
 if(operations.status!=="ready"&&(v.systemHealth!==null||v.openRiskAlerts!==null))throw Error("Command health source unavailable");
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
