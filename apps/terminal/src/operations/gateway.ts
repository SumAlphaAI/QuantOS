import {createBffClient,bffZodSchemas,parseBffResponse,SseStreamReducer,type BffComponents,type SseEventEnvelope} from "@sumalpha/api-client";
export const operationsClient=(origin:string,transport:typeof fetch=fetch)=>createBffClient({baseUrl:origin,fetch:transport,timeoutMs:10000});
/** Accept the server's versioned result; do not infer successful governance from 202. */
export function governanceFact(raw:unknown,status:number,kind:BffComponents["schemas"]["AdminResource"]["kind"]){
 if(status!==200&&status!==201)throw Error("Governance was not committed");
 const row=bffZodSchemas.AdminResource.parse(raw);
 if(row.kind!==kind||!row.auditRef||!row.correlationId)throw Error("Governance receipt mismatch");
 return structuredClone(row);
}
export function alertFact(raw:unknown,accountId:string){
 const row=bffZodSchemas.OpsAlert.parse(raw);
 if(row.accountId!==accountId||row.active===row.resolved)throw Error("Alert source mismatch");
 if(row.status==="acked"&&(!row.ackActor||!row.ackAt))throw Error("Acknowledgement evidence missing");
 if(row.status==="unacked"&&(row.ackActor!==null||row.ackAt!==null))throw Error("Unacknowledged alert carries acknowledgement");
 return structuredClone(row);
}
/** Poll/resume with the server's subscriber lease; a receipt never resolves a fault. */
export class AlertFacts {
 private reducer=new SseStreamReducer();private stream?:string;private rows=new Map<string,BffComponents["schemas"]["OpsAlert"]>();
 constructor(readonly accountId:string){bffZodSchemas.UUID.parse(accountId);}
 get snapshots(){return [...this.rows.values()].map(row=>structuredClone(row));}
 get afterSequence(){return this.reducer.resumeAfter;}
 opened(stream:string){bffZodSchemas.UUID.parse(stream);if(this.stream&&this.stream!==stream)throw Error("Alert stream lease changed");this.stream=stream;}
 accepted(raw:unknown,status:number){parseBffResponse("ackAlert",status,raw);}
 revoke(){this.reducer.close();this.rows.clear();}
 refused(status:number){if(status===401||status===403){this.revoke();return;}throw Error("Alert stream recovery required");}
 apply(raw:SseEventEnvelope):"applied"|"ignored"|"revoked"{
  if(this.reducer.isClosed)throw Error("Alert permission revoked");
  const e=bffZodSchemas.StreamEvent.parse(raw);
  if(e.payload.type==="permission_revoked"){this.revoke();return"revoked";}
  if(this.stream&&this.stream!==e.streamId)throw Error("Alert stream lease changed");
  const row=alertFact(e.payload,this.accountId);const action=this.reducer.accept(raw);
  if(action.type==="gap")throw Error("Alert stream gap");
  if(action.type!=="apply")return"ignored";
  this.stream=e.streamId;this.rows.set(row.alertId,row);return"applied";
 }
 url(base:string){const u=new URL('/v1/alerts/stream',base);u.searchParams.set('afterSequence',String(this.afterSequence));if(this.stream)u.searchParams.set('streamId',this.stream);return u.toString();}
}
