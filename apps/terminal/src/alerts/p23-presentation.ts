import {bffZodSchemas,type BffComponents} from '@sumalpha/api-client';
import type {RouteContext} from '../auth/route-access';
import {version,type Alert} from './policy';
export const domainLabel={risk:'风险',order:'订单',market:'行情数据',reconciliation:'对账',report:'报表',system:'Operations'} as const;
export const severityLabel={critical:'Critical',warning:'Warning',info:'Info'} as const;
const ruleNames:Record<string,string>={outbox_oldest_age:'事件投递延迟升高',risk_limit:'风险限额告警',reconciliation_break:'对账差异待核对'};
export const alertTitle=(a:Alert)=>ruleNames[a.rule]??a.rule;
export type FeedSort='latest'|'severity'|'domain';
export function feedRows(items:readonly Alert[],search:string,sort:FeedSort){const q=search.trim().toLowerCase(),rank={critical:0,warning:1,info:2};return items.filter(a=>!q||[a.rule,a.id,a.correlationId,a.sourceRef,domainLabel[a.domain]].some(s=>s.toLowerCase().includes(q))).slice().sort((a,b)=>(sort==='severity'?rank[a.severity]-rank[b.severity]:sort==='domain'?a.domain.localeCompare(b.domain):Date.parse(b.occurredAt)-Date.parse(a.occurredAt))||a.id.localeCompare(b.id));}
export function loadedCounts(items:readonly Alert[]){return{all:items.length,unacked:items.filter(a=>a.status==='unacked').length,acked:items.filter(a=>a.status==='acked').length,resolved:items.filter(a=>a.resolved).length};}
export function alertDeepLink(origin:string,id:string){bffZodSchemas.UUID.parse(id);const u=new URL(origin);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.origin!==origin)throw Error('Invalid origin');return u.origin+'/alerts/'+id;}
export function responseDestinations(a:Alert,c:RouteContext){bffZodSchemas.UUID.parse(a.correlationId);return{audit:c.capabilities.includes('audit:read')?'/audit/'+a.correlationId:undefined,portfolio:c.capabilities.includes('execution.operate')?'/portfolio':undefined,health:c.capabilities.includes('ops.read')&&a.objectRef==='/operations/health'};}
export function checkedHealth(raw:unknown,c:RouteContext,now:number){const h=bffZodSchemas.OpsHealth.parse(raw);version(h.objectVersion);if(h.accountId!==c.accountId||h.mode!==c.mode||Date.parse(h.asOf)>now||Date.parse(h.expiresAt)<=now||Date.parse(h.expiresAt)<=Date.parse(h.asOf)||Date.parse(h.expiresAt)-Date.parse(h.asOf)>30000||new Set(h.components.map(x=>x.name)).size!==h.components.length||h.components.some(x=>Date.parse(x.asOf)>Date.parse(h.asOf)))throw Error('Health scope or freshness mismatch');return structuredClone(h);}
export type Health=BffComponents['schemas']['OpsHealth'];
export type Evidence=BffComponents['schemas']['EvidenceChainPage'];
