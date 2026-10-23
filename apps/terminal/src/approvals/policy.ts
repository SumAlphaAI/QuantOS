import {bffZodSchemas,type BffComponents} from '@sumalpha/api-client';
import type {RouteContext} from '../auth/route-access';
export type Approval=BffComponents['schemas']['Approval'];
export type Decision='approve'|'reject'|'request_info';
export function approvalLocation(path:string,search=''){if(search)throw Error('Approval query is not supported');if(path==='/approvals')return;const match=/^\/approvals\/([a-f0-9-]{36})$/i.exec(path);if(!match)throw Error('Invalid approval route');return bffZodSchemas.UUID.parse(match[1]).toLowerCase();}
export const approvalHref=(id:string)=>'/approvals/'+bffZodSchemas.UUID.parse(id).toLowerCase();
export function approval(raw:unknown,id?:string){if(JSON.stringify(raw).length>262144)throw Error('Approval response too large');const a=bffZodSchemas.Approval.parse(raw);if(id&&a.approvalId!==id||!a.originator.trim()||a.originator.length>200||!a.objectVersion.trim()||a.objectVersion.length>200||!Number.isFinite(Date.parse(a.expiresAt)))throw Error('Invalid approval binding');return a;}
export const identity=(a:Approval)=>JSON.stringify([a.approvalId,a.originator,a.objectVersion,a.status,a.expiresAt,a.correlationId,a.kind,a.objectRef,a.issuanceState]);
export function refusal(a:Approval|undefined,c:RouteContext|undefined,now:number){if(!a||!c)return 'SELECT_APPROVAL';if(c.mode!=='paper'||!c.capabilities.includes('strategy.approve')||!c.capabilities.includes('execution.operate')||c.mfaState!=='verified')return 'FORBIDDEN';if(a.originator===c.actorId)return 'SELF_APPROVAL';if(now>=Date.parse(a.expiresAt))return 'EXPIRED';if(a.status!=='pending')return 'NOT_PENDING';return;}
export function reasonFor(decision:Decision,reason:string){const r=reason.trim();if(r.length>1000||decision!=='approve'&&!r)throw Error('Decision reason required, maximum 1000 characters');return r||undefined;}
