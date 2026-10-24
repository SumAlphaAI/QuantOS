import {bffZodSchemas} from '@sumalpha/api-client';
import type {Alert} from '../alerts/policy';
import type {Health,Incident,Timeline,RunReceipt} from './policy';
export const serviceCatalog=[['runtime-gateway','Runtime gateway'],['engine-manager','Engine manager'],['market-ingestor','Market ingestor'],['risk-gateway','Risk gateway'],['execution-gateway','Execution gateway'],['event-consumer','Event consumer'],['audit-ledger','Audit ledger']] as const;
/** C11 component readiness cannot establish independent instance health. */
export function serviceViews(){return serviceCatalog.map(([id,label])=>({id,label,state:'not-provided' as const,health:'未提供独立来源',latency:'—',heartbeat:'—'}));}
export function observationState(h:Health|undefined,now:number){return!h?'unknown':now>=Date.parse(h.expiresAt)?'expired':h.ready?'ready':'degraded';}
export function visibleAlerts(rows:readonly Alert[],search:string,severity=''){const q=search.trim().toLowerCase();return rows.filter(a=>(!severity||a.severity===severity)&&(!q||[a.id,a.rule,a.correlationId].some(s=>s.toLowerCase().includes(q))));}
export function relatedAlert(i:Incident|undefined,rows:readonly Alert[]){return i?rows.find(a=>a.id===i.alertId&&a.accountId===i.accountId&&a.mode===i.mode):undefined;}
export function incidentAudit(i:Incident|undefined,t:Timeline|undefined,capabilities:readonly string[]){if(!i||!capabilities.includes('audit:read'))return undefined;const last=t?.items.at(-1);const linked=last?.payload.incidentId===i.id&&last.payload.accountId===i.accountId&&last.payload.mode===i.mode;const id=i.correlationId??(linked?last.correlationId:undefined);if(!id)return undefined;bffZodSchemas.UUID.parse(id);return'/audit/'+id;}
export function operationRecords(t:Timeline|undefined,r:RunReceipt|undefined){return[...(t?.items??[]).map(e=>({id:e.eventId,time:e.occurredAt,kind:'Incident · '+e.payload.status,status:'已观察',reference:e.payload.sourceRef,correlationId:e.correlationId})),...r?[{id:r.operationId,time:undefined,kind:'Runbook',status:r.status,reference:r.sourceOperationRef,correlationId:r.correlationId}]:[]];}
