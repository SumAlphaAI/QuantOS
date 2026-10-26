import {it,expect} from 'vitest';
import {reference,csrf} from './helpers/fep5-reference';
import {createReconciliationRuntime} from '../src/reconciliation/runtime';
async function prepared(){
 const source=await reference('shadow'),invalidations:number[]=[];let failure:401|403|503|undefined,lose=false,changed=false,valid=true,token=csrf;
 const wire=source.transport();
 const transport:typeof fetch=async(input,init)=>{const req=new Request(input,init),path=new URL(req.url).pathname;
  if(failure&&path==='/v1/session')return new Response('owned gateway refusal',{status:failure,headers:{'content-type':'text/html'}});
  const response=await wire(req);
  if(changed&&['/v1/session','/v1/context'].includes(path))return new Response(JSON.stringify({...await response.json(),workspaceId:'aaaaaaaa-1111-4111-8111-111111111111'}),{headers:{'content-type':'application/json'}});
  if(lose&&path.endsWith('/reruns')){lose=false;await response.body?.cancel();throw Error('owned committed response lost');}return response;
 };
 const rt=createReconciliationRuntime({origin:source.origin,fetchImpl:transport,authorize:()=>{if(!valid)throw Error('owned local authority invalidated');},online:()=>true,csrf:()=>token,invalidate:s=>{invalidations.push(s);}});
 await rt.load();await rt.list();await rt.open(rt.view.rows.find(r=>r.result==='differences')!.runId);
 lose=true;await expect(rt.rerun('X3 immutable source review','RERUN RECONCILIATION')).rejects.toMatchObject({outcomeUnknown:true});expect(rt.view.pending).toBeDefined();expect(rt.view.entries.length).toBeGreaterThan(0);
 return {source,rt,invalidations,fail:(s:401|403|503)=>{failure=s;},recover:()=>{failure=undefined;},change:()=>{changed=true;},invalidate:()=>{valid=false;},rotate:()=>{token='rotated-owned-csrf';},async close(){rt.close();await source.close();}};
}
function cleared(s:Awaited<ReturnType<typeof prepared>>){expect(s.rt.view.context).toBeUndefined();expect(s.rt.view.rows).toEqual([]);expect(s.rt.view.selected).toBeUndefined();expect(s.rt.view.breaks).toEqual([]);expect(s.rt.view.entries).toEqual([]);expect(s.rt.view.pending).toBeUndefined();expect(s.rt.view.receipt).toBeUndefined();expect(s.rt.view.canRerun).toBe(false);}
for(const status of [401,403]as const)it(`X3 non-JSON C01 ${status} clears unknown reconciliation intent before parsing`,async()=>{const s=await prepared();try{s.fail(status);const count=s.source.rows.length;await expect(s.rt.retry()).rejects.toMatchObject({status});cleared(s);expect(s.invalidations).toContain(status);expect(s.source.rows).toHaveLength(count);}finally{await s.close();}},20000);
it('X3 changed reconciliation workspace clears private facts and pending intent without a callback-owned close',async()=>{const s=await prepared();try{s.change();await expect(s.rt.load()).rejects.toMatchObject({status:403});cleared(s);expect(s.invalidations).toContain(403);}finally{await s.close();}},20000);
it('X3 local authority loss clears the unknown reconciliation intent before another request',async()=>{const s=await prepared();try{s.invalidate();const count=s.source.rows.length;await expect(s.rt.retry()).rejects.toThrow();cleared(s);expect(s.source.rows).toHaveLength(count);}finally{await s.close();}},20000);
it('X3 rotated CSRF cannot replay a stored reconciliation intent',async()=>{const s=await prepared();try{s.rotate();const posts=s.source.rows.filter(r=>r.method==='POST').length;await expect(s.rt.retry()).rejects.toMatchObject({status:403});cleared(s);expect(s.source.rows.filter(r=>r.method==='POST')).toHaveLength(posts);}finally{await s.close();}},20000);
it('X3 transient non-JSON C01 503 retains the original unknown rerun for explicit same-key recovery',async()=>{const s=await prepared();try{s.fail(503);await expect(s.rt.retry()).rejects.toThrow();expect(s.rt.view.pending).toBeDefined();s.recover();await s.rt.retry();expect(s.rt.view.pending).toBeUndefined();const rows=s.source.rows.filter(r=>r.path.endsWith('/reruns'));expect(rows).toHaveLength(2);for(const key of ['keyHash','bodyHash']as const)expect(rows[0][key]).toBe(rows[1][key]);const requests=s.source.requests.filter(r=>r.url.endsWith('/reruns'));expect(requests[0].headers.get('if-match')).toBe(requests[1].headers.get('if-match'));expect(s.invalidations).toEqual([]);}finally{await s.close();}},20000);
