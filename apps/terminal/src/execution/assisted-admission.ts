import {bffZodSchemas} from '@sumalpha/api-client';
import {assistedLiveGate} from '@sumalpha/domain-ui';
import type {RouteContext} from '../auth/route-access';
export type AssistedAdmissionView={state:'closed'|'unavailable';reachable:false;message:string;policyVersion?:string;expiresAt?:string};
export function assistedAdmission(raw:unknown,context:RouteContext|undefined,now:number):AssistedAdmissionView{
 const closed=assistedLiveGate(false,[]);
 const unavailable:AssistedAdmissionView={state:'unavailable',reachable:false,message:'尚未核实 Assisted Live（testnet）开放条件；当前不可进入。'};
 const p=bffZodSchemas.AssistedTestnetAdmission.safeParse(raw);
 if(!context||!p.success||!Number.isFinite(now)||!Number.isFinite(Date.parse(context.expiresAt)))return unavailable;
 const d=p.data;if(['actorId','tenantId','workspaceId','accountId'].some(k=>d[k as keyof typeof d]==='00000000-0000-0000-0000-000000000000'))return unavailable;
 const issued=Date.parse(d.checkedAt),expires=Date.parse(d.expiresAt);
 if(['actorId','tenantId','workspaceId','accountId','mode'].some(k=>d[k as keyof typeof d]!==context[k as keyof RouteContext])||issued>now||expires<=now||expires<=issued||expires-issued>8000||now>=Date.parse(context.expiresAt))return unavailable;
 // v1 is a server-owned closed declaration, never a native approval/token.
 if(closed.reachable)return unavailable;
 return{state:'closed',reachable:false,message:'Assisted Live（testnet）暂未开放；请按当前权限使用 Paper / Shadow。',policyVersion:d.policyVersion,expiresAt:d.expiresAt};
}
