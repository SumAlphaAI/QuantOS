import {bffZodSchemas,type BffComponents} from '@sumalpha/api-client';
import type {RouteContext} from '../auth/route-access';
export type Alert=BffComponents['schemas']['OpsAlert'];
export type Subscriptions=BffComponents['schemas']['AlertSubscriptions'];
export const domains=['risk','order','market','reconciliation','report','system'] as const;
export const severities=['critical','warning','info'] as const;
export type Filter={status?:Alert['status'];severity?:Alert['severity'];domain?:Alert['domain'];active?:'true'|'false';sort:'id:asc'|'id:desc'};
export const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function version(v:string){if(!/^(0|[1-9][0-9]*)$/.test(v)||BigInt(v)>18446744073709551614n)throw Error('Invalid version');return BigInt(v);}
export function fact(raw:unknown,c:RouteContext,now:number):Alert{
 const a=bffZodSchemas.OpsAlert.parse(raw);
 if(a.id!==a.alertId||a.accountId!==c.accountId||a.mode!==c.mode||a.active===a.resolved||!a.rule.trim())throw Error('Alert scope mismatch');
 version(a.objectVersion);version(a.sourceVersion);
 if(Date.parse(a.occurredAt)>Date.parse(a.asOf)||Date.parse(a.asOf)>now||a.ackAt&&Date.parse(a.ackAt)>now)throw Error('Invalid alert time');
 if(a.status==='acked'?(!a.ackActor||!a.ackAt):(a.ackActor!==null||a.ackAt!==null))throw Error('Invalid acknowledgement');
 return structuredClone(a);
}
export function subscriptions(raw:unknown):Subscriptions{const s=bffZodSchemas.AlertSubscriptions.parse(raw);version(s.objectVersion);if(!s.domains.length||!s.severities.length||new Set(s.domains).size!==s.domains.length||new Set(s.severities).size!==s.severities.length)throw Error('Invalid subscription');return structuredClone(s);}
export function receipt(raw:unknown,before:Alert,action:'ack'|'unack',c:RouteContext,now:number){const a=fact(raw,c,now);for(const k of ['id','alertId','sourceRef','rule','severity','domain','accountId','mode','active','resolved','sourceVersion','occurredAt','asOf','objectRef'] as const)if(a[k]!==before[k])throw Error('Receipt source changed');if(version(a.objectVersion)!==version(before.objectVersion)+1n||a.status!==(action==='ack'?'acked':'unacked')||!a.auditRef||action==='ack'&&a.ackActor!==c.actorId)throw Error('Receipt mismatch');return a;}
export function alertLocation(path:string,search:string){if(search)throw Error('Unexpected query');if(path==='/alerts')return undefined;const match=/^\/alerts\/([^/]+)$/.exec(path);if(!match)throw Error('Invalid route');return bffZodSchemas.UUID.parse(match[1]);}
export class AlertJournal{
 stream?:string;sequence=0;private ids=new Map<number,string>();private rows=new Map<string,Alert>();private eventIds=new Set<string>();
 constructor(private context:RouteContext){}
 opened(id:string){bffZodSchemas.UUID.parse(id);if(this.stream&&this.stream!==id)throw Error('Stream binding changed');this.stream=id;}
 apply(raw:unknown,now:number){const e=bffZodSchemas.StreamEvent.parse(raw);if(e.payload.type==='permission_revoked')return 'revoked';if(!this.stream||e.streamId!==this.stream)throw Error('Stream binding mismatch');const row=fact(e.payload,this.context,now);
 if(e.sequence<=this.sequence){if(this.ids.get(e.sequence)!==JSON.stringify(e))throw Error('Duplicate changed');return 'duplicate';}
 if(this.eventIds.has(e.eventId))throw Error('Event identity reused');
 if(e.sequence!==this.sequence+1||this.ids.size>=1000)throw Error('Stream gap or capacity');
 const old=this.rows.get(row.id);if(old&&(version(row.objectVersion)<version(old.objectVersion)||version(row.sourceVersion)<version(old.sourceVersion)||row.objectVersion===old.objectVersion&&!same(old,row)))throw Error('Alert regressed');
 this.eventIds.add(e.eventId);this.ids.set(e.sequence,JSON.stringify(e));this.rows.set(row.id,row);this.sequence=e.sequence;return 'changed';
 }
}
