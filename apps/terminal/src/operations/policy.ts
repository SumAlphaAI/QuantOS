import {bffZodSchemas,type BffComponents} from '@sumalpha/api-client';
import type {RouteContext} from '../auth/route-access';
import {version,same,type Alert} from '../alerts/policy';
import {checkedHealth} from '../alerts/p23-presentation';
export {checkedHealth};
export type Incident=BffComponents['schemas']['OpsIncident'];
export type Timeline=BffComponents['schemas']['OpsIncidentTimeline'];
export type Catalog=BffComponents['schemas']['OpsRunbookActions']['items'];
export type Precheck=BffComponents['schemas']['OpsPrecheck'];
export type RunReceipt=BffComponents['schemas']['OpsRunbookReceipt'];
export type Health=BffComponents['schemas']['OpsHealth'];
export type Action='inspect-health'|'inspect-evidence';
export type Check=Precheck&{commandId?:string};
export const actions=['inspect-health','inspect-evidence'] as const;
export function operationsLocation(path:string,search=''){if(search)throw Error('Unexpected query');if(path==='/operations'||path==='/operations/health')return undefined;const m=/^\/operations\/incidents\/([^/]+)$/.exec(path);if(!m)throw Error('Invalid operations route');return bffZodSchemas.UUID.parse(m[1]);}
export function incident(raw:unknown,c:RouteContext,now:number,id?:string){const i=bffZodSchemas.OpsIncident.parse(raw);version(i.objectVersion);version(i.openedSource);if(i.id!==i.incidentId||id&&i.id!==id||i.accountId!==c.accountId||i.mode!==c.mode||Date.parse(i.asOf)>now)throw Error('Incident scope mismatch');return structuredClone(i);}
export function incidentCore(i:Incident){const {auditRef,correlationId,...core}=i;void auditRef;void correlationId;return core;}
export function timeline(raw:unknown,i:Incident,c:RouteContext,now:number){const t=bffZodSchemas.OpsIncidentTimeline.parse(raw),ids=new Set<string>();let at=-Infinity,v=-1n;for(const e of t.items){const p=incident(e.payload,c,now,i.id);if(ids.has(e.eventId)||Date.parse(e.occurredAt)<at||Date.parse(e.occurredAt)>now||version(p.objectVersion)<v||p.sourceRef!==i.sourceRef||p.alertId!==i.alertId||version(p.openedSource)>version(i.openedSource))throw Error('Timeline mismatch');ids.add(e.eventId);at=Date.parse(e.occurredAt);v=version(p.objectVersion);}if(!t.items.length||!same(incidentCore(t.items.at(-1)!.payload),incidentCore(i)))throw Error('Timeline head mismatch');return t;}
export function catalog(raw:unknown):Catalog{const rows=bffZodSchemas.OpsRunbookActions.parse(raw).items;if(new Set(rows.map(a=>a.actionId)).size!==rows.length||rows.some(a=>!same(a.parameters,a.actionId==='inspect-health'?[]:['commandId'])))throw Error('Invalid approved catalog');return structuredClone(rows);}
export function parameters(action:Action,command?:string){if(!actions.includes(action))throw Error('Unapproved action');if(action==='inspect-evidence')return{commandId:bffZodSchemas.UUID.parse(command)};if(command)throw Error('Unexpected parameter');return{};}
export function precheck(raw:unknown,action:Action,health:Health,now:number,command?:string):Check{const p=bffZodSchemas.OpsPrecheck.parse(raw);parameters(action,command);version(p.sourceVersion);if(p.actionId!==action||p.sourceVersion!==health.objectVersion||p.allowed!==(p.reason==='allowed')||Date.parse(p.expiresAt)<=now||Date.parse(p.expiresAt)>Date.parse(health.expiresAt))throw Error('Precheck mismatch');return{...p,...parameters(action,command)};}
export function receiptIncident(raw:unknown,kind:'open'|'ack'|'resolve',c:RouteContext,now:number,before:Incident|Alert){const i=incident(raw,c,now);if(!i.auditRef||!i.correlationId)throw Error('Missing incident audit');if(kind==='open'){const a=before as Alert;if(i.alertId!==a.id||i.openedSource!==a.sourceVersion||i.status!=='open'||i.objectVersion!=='0')throw Error('Open source mismatch');}else{const b=before as Incident;for(const k of ['id','incidentId','sourceRef','alertId','openedSource','asOf'] as const)if(i[k]!==b[k])throw Error('Incident receipt source changed');if(version(i.objectVersion)!==version(b.objectVersion)+1n||i.status!==(kind==='ack'?'acknowledged':'resolved'))throw Error('Incident receipt mismatch');}return i;}
export function receiptRun(raw:unknown){const r=bffZodSchemas.OpsRunbookReceipt.parse(raw);return r;}
