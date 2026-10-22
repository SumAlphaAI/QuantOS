import type {AuditEventPage, EvidenceChainPage, ExportJob} from "./gateway";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type AuditLocation={view:"audit";correlationId?:string}|{view:"exports";exportId?:string};
/** Canonical static aliases and legacy queries must never select different resources. */
export function auditLocation(pathname:string,search:string):AuditLocation {
  const query=new URLSearchParams(search),parts=pathname.split("/");
  if(!["audit","exports"].includes(parts[1])||parts.length>3||parts[0]!=="")throw Error("Invalid audit route");
  const view=parts[1] as "audit"|"exports",key=view==="audit"?"correlationId":"exportId",other=view==="audit"?"exportId":"correlationId";
  if(query.has(other)||query.getAll(key).length>1)throw Error("Conflicting resource reference");
  const pathId=parts[2],queryId=query.get(key);
  if(pathId!==undefined&&(!uuid.test(pathId)||query.has(key)))throw Error("Invalid canonical reference");
  if(queryId!==null&&!uuid.test(queryId))throw Error("Invalid query reference");
  const id=pathId??queryId??undefined;
  return view==="audit"?{view,correlationId:id}:{view,exportId:id};
}
export function auditResourcePath(kind:"audit"|"exports",id:string){if(!uuid.test(id))return undefined;return `/${kind}/${id}`;}
export const shortRef=(value:string,length=12)=>value.length>length?value.slice(0,length)+"…":value;
export function auditUtc(value:string){const time=Date.parse(value);return Number.isFinite(time)?new Date(time).toISOString().replace("T"," ").replace("Z"," UTC"):"时间未提供";}
export function auditSummary(page?:AuditEventPage,chain?:EvidenceChainPage){return{events:page?.items.length??0,objects:new Set(page?.items.map(i=>i.objectRef)).size,chainNodes:chain?.items.length??0,scopeComplete:Boolean(chain?.complete&&!chain.nextCursor),redacted:page?.items.every(i=>i.redactionApplied===true)??false};}
export function exportPresentation(job:ExportJob,now:number){const retentionExpired=Date.parse(job.retentionUntil)<=now;return{status:retentionExpired?"expired" as const:job.status,downloadable:job.status==="ready"&&!retentionExpired,cancellable:["queued","generating","ready"].includes(job.status)&&!retentionExpired,retentionExpired};}
export const exportLabels:Record<ExportJob["status"],string>={queued:"已受理，等待生成",generating:"正在生成",ready:"文件可用",cancel_requested:"取消已受理",cancelled:"已取消",expired:"已过期",failed:"生成失败"};
