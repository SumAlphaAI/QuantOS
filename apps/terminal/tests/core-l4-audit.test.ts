import {bffZodSchemas} from '@sumalpha/api-client';
import {describe,it,expect} from 'vitest';
import {createAuditRuntime} from '../src/audit/runtime';
import type {RouteContext} from '../src/auth/route-access';
import {ordersLocation} from '../src/orders/policy';
const id='11111111-1111-4111-8111-111111111111',now=Date.parse('2026-10-28T01:00:00Z');
const context:RouteContext={actorId:id,tenantId:id,workspaceId:id,accountId:id,mode:'assisted_live',environment:'dev',capabilities:['audit:read'],mfaState:'verified',expiresAt:new Date(now+60000).toISOString()};
const node={eventId:id,sequence:1,kind:'assisted.command_reserved',objectRef:'assisted-request:'+id,occurredAt:new Date(now).toISOString(),payloadHash:'sha256:'+'a'.repeat(64),route:'/orders?approvalId='+id,retentionUntil:new Date(now+86400000).toISOString()};
function setup(c:RouteContext=context){const requests:Request[]=[];let current=c,time=now;
 const fetchImpl:typeof fetch=async(input,init)=>{const request=new Request(input,init);requests.push(request);const path=new URL(request.url).pathname;const body=path==='/v1/session'||path==='/v1/context'?current:path==='/v1/audit/events'?{items:[]}:{correlationId:id,items:[node],complete:true};return new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}});};
 const runtime=createAuditRuntime({origin:'https://bff.example',fetchImpl,authorize:()=>{},csrf:()=> 'owned-csrf',online:()=>true,width:()=>1440,now:()=>time});
 return{runtime,requests,setContext:(c:RouteContext)=>{current=c;},expire:()=>{time+=60000;}};
}
describe('CORE L4 current common C10 read consumption',()=>{
 it('reads assisted audit and resolves the actual Orders reference contract',async()=>{const s=setup();expect((await s.runtime.load()).mode).toBe('assisted_live');await s.runtime.search({correlationId:id});const chain=await s.runtime.evidence(id);const href=new URL(chain.items[0].route,'https://terminal.example');expect(ordersLocation(href.pathname,href.search)).toEqual({approvalId:id});expect(s.requests.every(r=>r.method==='GET')).toBe(true);s.runtime.close();});
 it.each(['create','cancel','download','status'] as const)('refuses assisted %s before any export or MFA IO even with export capability',async action=>{const s=setup({...context,capabilities:['audit:read','audit:export']});await s.runtime.load();await expect(action==='create'?s.runtime.create({scope:{correlationIds:[id]},format:'jsonl',reason:'Owned scope review',watermark:'restricted',retentionDays:1},'123456'):action==='cancel'?s.runtime.cancel(id,'123456'):action==='status'?s.runtime.status(id):s.runtime.download(id,()=>{throw Error('delivery forbidden');})).rejects.toMatchObject({status:403});expect(s.requests).toHaveLength(2);expect((await s.runtime.evidence(id)).items).toHaveLength(1);s.runtime.close();});
 it('does not turn guarded live into an admitted audit mode',async()=>{const s=setup({...context,mode:'guarded_live'} as unknown as RouteContext);await expect(s.runtime.load()).rejects.toThrow();s.runtime.close();});
 it('refuses missing audit permission',async()=>{const s=setup({...context,capabilities:[]});await expect(s.runtime.load()).rejects.toMatchObject({status:403});s.runtime.close();});
 it('clears an admitted audit context when current C01 becomes malformed',async()=>{const s=setup();await s.runtime.load();s.setContext({...context,mode:'guarded_live'} as unknown as RouteContext);await expect(s.runtime.load()).rejects.toMatchObject({status:403});const count=s.requests.length;await expect(s.runtime.evidence(id)).rejects.toMatchObject({status:403});expect(s.requests).toHaveLength(count);s.runtime.close();});
 it('does not renew the original audit deadline',async()=>{const s=setup();await s.runtime.load();s.expire();await expect(s.runtime.evidence(id)).rejects.toMatchObject({status:401});expect(s.requests).toHaveLength(2);s.runtime.close();});
 it('rejects the pre-fix digest UUID that lacked valid version bits',()=>{expect(bffZodSchemas.UUID.safeParse('e81ad9f2-70ca-df81-b387-d977e7a4e89e').success).toBe(false);});
 it('refuses old misspelled and injected order queries',()=>{for(const query of ['?approval='+id,'?approvalId='+id+'&mode=paper','?approvalId='+id+'&approvalId='+id])expect(()=>ordersLocation('/orders',query)).toThrow();});
});
