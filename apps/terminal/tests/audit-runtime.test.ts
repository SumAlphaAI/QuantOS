import {describe,it,expect} from "vitest";
import {createAuditRuntime} from "../src/audit/runtime";
const correlation="aaaaaaaa-1111-4111-8111-111111111111", id="11111111-2222-4333-8444-555555555555",eventId="aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const context={actorId:id,tenantId:id,workspaceId:id,accountId:id,mode:"paper",environment:"dev",capabilities:["audit:read","audit:export"],mfaState:"verified",expiresAt:"2099-01-01T00:00:00Z"};
const job={exportId:id,status:"queued",format:"jsonl",requestedBy:"auditor",requestedAt:"2026-10-22T00:00:00Z",watermark:"controlled",retentionUntil:"2098-01-01T00:00:00Z",correlationId:correlation,auditRef:eventId};
const event={eventId,correlationId:correlation,sequence:1,kind:"test.event",actor:"masked",objectRef:"test:1",occurredAt:"2026-10-22T00:00:00Z",redactionApplied:true,redactedPayload:{safe:true},payloadHash:"sha256:"+"a".repeat(64),retentionUntil:"2098-01-01T00:00:00Z"};
const body={scope:{correlationIds:[correlation]},format:"jsonl" as const,reason:"Controlled export test",watermark:"controlled",retentionDays:7};
function setup(handler?:(r:Request)=>Response|Promise<Response>|undefined){
 const requests:Request[]=[];let valid=true,csrf="csrf-local-test",online=true,width=1440,time=Date.now();
 const json=(b:unknown,status=200)=>new Response(JSON.stringify(b),{status,headers:{"content-type":"application/json"}});
 const transport:typeof fetch=async(input,init)=>{const r=new Request(input,init);requests.push(r);const overridden=await handler?.(r);if(overridden)return overridden;
 const p=new URL(r.url).pathname;
 if(p==="/v1/session"||p==="/v1/context")return json(context);
 if(p.endsWith("/challenges"))return json({status:"verified",challengeRef:eventId,attemptsRemaining:4,expiresAt:"2099-01-01T00:00:00Z"});
 if(p.endsWith("/reauth"))return json({reauthTokenRef:eventId,expiresAt:"2099-01-01T00:00:00Z"});
 if(p.includes("evidence-chains"))return json({correlationId:correlation,items:[],complete:true});
 if(p==="/v1/audit/events")return json({items:[]});
 return json(job,r.method==="POST"?202:200);};
 const runtime=createAuditRuntime({origin:"https://bff.example",fetchImpl:transport,authorize:()=>{if(!valid)throw Error("invalidated");},csrf:()=>csrf,online:()=>online,width:()=>width,now:()=>time,timeoutMs:30});
 return{runtime,requests,json,invalidate:()=>{valid=false;},noCsrf:()=>{csrf="";},offline:()=>{online=false;},mobile:()=>{width=390;},desktop:()=>{width=1440;},advance:(ms:number)=>{time+=ms;}};
}
describe("UI-507 guarded Audit Explorer",()=>{
 it("guards session/context authority before data, and refuses read-only mutation",async()=>{
  const s=setup(r=>new URL(r.url).pathname==="/v1/context"?new Response(JSON.stringify({...context,workspaceId:eventId})):undefined);
  await expect(s.runtime.load()).rejects.toMatchObject({status:403});expect(s.requests).toHaveLength(2);
  const v=setup(r=>/\/v1\/(session|context)$/.test(r.url)?new Response(JSON.stringify({...context,capabilities:["audit:read"]})):undefined);
  await v.runtime.load();await expect(v.runtime.create(body,"123456")).rejects.toMatchObject({status:403});expect(v.requests).toHaveLength(2);v.runtime.close();
 });
 it("sends filters and opaque cursor to server; new query discards the old cursor",async()=>{
  const s=setup(r=>r.url.includes("/audit/events")?new Response(JSON.stringify({items:[event],nextCursor:new URL(r.url).searchParams.has("cursor")?undefined:"opaque-A"})):undefined);
  await s.runtime.load();await s.runtime.search({kind:"test.event",correlationId:correlation,pageSize:2});await s.runtime.search({},true);await s.runtime.search({kind:"changed",pageSize:1});
  const q=s.requests.slice(2).map(r=>new URL(r.url).searchParams);expect(q[1].get("cursor")).toBe("opaque-A");expect(q[1].get("kind")).toBe("test.event");expect(q[2].has("cursor")).toBe(false);s.runtime.close();
 });
 it.each(["duplicate","loop","expired","oversize"])("rejects %s event page",async mode=>{
  const s=setup(r=>r.url.includes("/audit/events")?new Response(JSON.stringify({items:mode==="duplicate"?[event,event]:mode==="expired"?[{...event,retentionUntil:"2020-01-01T00:00:00Z"}]:mode==="oversize"?[event,{...event,eventId:id}]:[],nextCursor:mode==="loop"?"again":undefined})):undefined);
  await s.runtime.load();if(mode==="loop"){await s.runtime.search({pageSize:1});await expect(s.runtime.search({},true)).rejects.toMatchObject({status:502});}else await expect(s.runtime.search({pageSize:mode==="oversize"?1:25})).rejects.toMatchObject({status:410});s.runtime.close();
 });
 it("accumulates evidence pages preserving causation and scope-complete semantics",async()=>{
  const node={eventId,sequence:1,kind:"root",objectRef:"object:1",occurredAt:event.occurredAt,payloadHash:event.payloadHash,route:"/audit",retentionUntil:event.retentionUntil};
  const s=setup(r=>r.url.includes("evidence-chains")?new Response(JSON.stringify({correlationId:correlation,items:new URL(r.url).searchParams.has("cursor")?[{...node,eventId:id,sequence:2,causationId:eventId}]:[node],complete:new URL(r.url).searchParams.has("cursor"),nextCursor:new URL(r.url).searchParams.has("cursor")?undefined:"tail"})):undefined);
  await s.runtime.load();expect((await s.runtime.evidence(correlation)).complete).toBe(false);const chain=await s.runtime.evidence(correlation,true);expect(chain.complete).toBe(true);expect(chain.items[1].causationId).toBe(chain.items[0].eventId);s.runtime.close();
 });
 it("blocks invalid request, CSRF, offline, expiry and closed route before MFA",async()=>{
  const s=setup();await s.runtime.load();await expect(s.runtime.create({...body,reason:"short"},"123456")).rejects.toThrow();s.noCsrf();await expect(s.runtime.create(body,"123456")).rejects.toMatchObject({status:403});expect(s.requests).toHaveLength(2);
  const o=setup();await o.runtime.load();o.offline();await expect(o.runtime.search()).rejects.toMatchObject({status:403});o.runtime.close();
  const e=setup();await e.runtime.load();e.advance(100*366*86400000);await expect(e.runtime.search()).rejects.toMatchObject({status:401});e.runtime.close();
  s.runtime.close();await expect(s.runtime.search()).rejects.toMatchObject({status:403});
 });
 it("rechecks authority between MFA and reauth so revocation cannot dispatch mutation",async()=>{
  const s=setup(r=>{if(r.url.endsWith("/challenges")){s.invalidate();return s.json({status:"verified",challengeRef:eventId,expiresAt:"2099-01-01T00:00:00Z"});}});
  await s.runtime.load();await expect(s.runtime.create(body,"123456")).rejects.toThrow("invalidated");expect(s.requests.map(r=>new URL(r.url).pathname)).toEqual(["/v1/session","/v1/context","/v1/session","/v1/context","/v1/auth/mfa/challenges"]);s.runtime.close();
 });
 it("lost create response stays uncertain without auto-replay; explicit identical intent retains idempotency key",async()=>{
  let lost=true;const s=setup(r=>{if(r.url.endsWith("/v1/exports")&&lost){lost=false;throw TypeError("lost response");}return undefined;});
  await s.runtime.load();await expect(s.runtime.create(body,"123456")).rejects.toMatchObject({outcomeUnknown:true});expect(s.runtime.uncertain).toBe(true);expect(s.requests.filter(r=>r.url.endsWith("/v1/exports"))).toHaveLength(1);
  await expect(s.runtime.create({...body,reason:"changed intent"},"123456")).rejects.toMatchObject({status:409});const created=await s.runtime.create(body,"123456");expect(created.exportId).toBe(id);const writes=s.requests.filter(r=>r.url.endsWith("/v1/exports"));expect(writes).toHaveLength(2);expect(writes[0].headers.get("idempotency-key")).toBe(writes[1].headers.get("idempotency-key"));expect(await writes[0].text()).toBe(await writes[1].text());expect(s.runtime.uncertain).toBe(false);s.runtime.close();
 });
 it("honors validated 429 cooldown before MFA then permits explicit retry",async()=>{
  let limited=true;const s=setup(r=>{if(r.url.endsWith("/v1/exports")&&limited){limited=false;return s.json({code:"RATE_LIMITED",message:"safe",correlationId:correlation,retryAfter:2},429);}});
  await s.runtime.load();await expect(s.runtime.create(body,"123456")).rejects.toMatchObject({status:429});const count=s.requests.length;await expect(s.runtime.create(body,"123456")).rejects.toMatchObject({status:429});expect(s.requests).toHaveLength(count);s.advance(2100);expect((await s.runtime.create(body,"123456")).status).toBe("queued");s.runtime.close();
 });
 it("never downloads queued/cancelled/expired jobs and only hands off a valid ready lease",async()=>{
  let state="queued";const s=setup(r=>{if(r.url.endsWith("/download"))return s.json({exportId:id,downloadUrl:`https://bff.example/_bff/export-content/${eventId}/${"b".repeat(64)}`,expiresAt:new Date(Date.now()+60000).toISOString(),sha256:"a".repeat(64),sizeBytes:12,mediaType:"application/jsonl",watermarked:true,retentionUntil:job.retentionUntil,auditRef:eventId});if(r.url.includes(`/exports/${id}`))return s.json({...job,status:state});});
  await s.runtime.load();await s.runtime.status(id);let deliveries=0;await expect(s.runtime.download(id,()=>deliveries++)).rejects.toMatchObject({status:410});expect(s.requests.some(r=>r.url.endsWith("/download"))).toBe(false);
  state="ready";await s.runtime.status(id);const result=await s.runtime.download(id,()=>deliveries++);expect(deliveries).toBe(1);expect(result).not.toHaveProperty("downloadUrl");state="cancelled";await s.runtime.status(id);await expect(s.runtime.download(id,()=>deliveries++)).rejects.toMatchObject({status:410});s.runtime.close();
 });
 it("small screen cannot create or cancel even when DOM is bypassed",async()=>{
  const s=setup();await s.runtime.load();s.mobile();await expect(s.runtime.create(body,"123456")).rejects.toMatchObject({status:403});await expect(s.runtime.cancel(id,"123456")).rejects.toMatchObject({status:403});expect(s.requests).toHaveLength(2);s.runtime.close();
 });
 it("fresh cancel state is read before MFA; a cancelled job cannot be mutated",async()=>{
  const s=setup(r=>r.url.endsWith(`/exports/${id}`)?new Response(JSON.stringify({...job,status:"cancelled"})):undefined);
  await s.runtime.load();await expect(s.runtime.cancel(id,"123456")).rejects.toMatchObject({status:409});expect(s.requests.some(r=>r.method==="POST")).toBe(false);s.runtime.close();
 });
 it("lost cancel response resolves from authoritative read without replaying POST",async()=>{
  let cancelled=false;const s=setup(r=>{if(r.url.endsWith("/cancel")){cancelled=true;throw TypeError("lost cancel response");}if(r.url.endsWith(`/exports/${id}`))return new Response(JSON.stringify({...job,status:cancelled?"cancelled":"queued"}));});
  await s.runtime.load();await expect(s.runtime.cancel(id,"123456")).rejects.toMatchObject({outcomeUnknown:true});expect(s.runtime.uncertain).toBe(true);expect((await s.runtime.cancel(id,"123456")).status).toBe("cancelled");expect(s.runtime.uncertain).toBe(false);expect(s.requests.filter(r=>r.url.endsWith("/cancel"))).toHaveLength(1);s.runtime.close();
 });
 it("malformed accepted response remains unknown and fences changed intents",async()=>{
  const s=setup(r=>r.url.endsWith("/v1/exports")?new Response(JSON.stringify({status:"queued"}),{status:202}):undefined);
  await s.runtime.load();await expect(s.runtime.create(body,"123456")).rejects.toMatchObject({outcomeUnknown:true});expect(s.runtime.uncertain).toBe(true);await expect(s.runtime.create({...body,watermark:"changed"},"123456")).rejects.toMatchObject({status:409});s.runtime.close();
 });
 it("close aborts an in-flight search and prevents any late publication",async()=>{
  let started=()=>{};const arrived=new Promise<void>(r=>{started=r;});const s=setup(r=>{if(r.url.includes("/audit/events"))return new Promise<Response>((_,reject)=>{r.signal.addEventListener("abort",()=>reject(new DOMException("Aborted","AbortError")));started();});});
  await s.runtime.load();const pending=s.runtime.search();await arrived;s.runtime.close();await expect(pending).rejects.toThrow();expect(s.requests.at(-1)?.signal.aborted).toBe(true);
 });
 it("contradictory complete-with-cursor chain is refused",async()=>{
  const s=setup(r=>r.url.includes("evidence-chains")?new Response(JSON.stringify({correlationId:correlation,items:[],complete:true,nextCursor:"tail"})):undefined);await s.runtime.load();await expect(s.runtime.evidence(correlation)).rejects.toMatchObject({status:502});s.runtime.close();
 });

});

it('X06 pins Audit authority across reload and discards uncertain exports on a changed workspace',async()=>{let changed=false;const s=setup(r=>{if(/\/v1\/(session|context)$/.test(r.url))return s.json({...context,...changed?{workspaceId:eventId}:{}});if(new URL(r.url).pathname==='/v1/exports')throw Error('owned response lost');});await s.runtime.load();await expect(s.runtime.create(body,'123456')).rejects.toThrow();expect(s.runtime.uncertain).toBe(true);changed=true;await expect(s.runtime.load()).rejects.toMatchObject({status:403});expect(s.runtime.uncertain).toBe(false);const count=s.requests.length;await expect(s.runtime.create(body,'123456')).rejects.toMatchObject({status:403});expect(s.requests).toHaveLength(count);s.runtime.close();});
it('X06 same-authority reload cannot extend the original Audit session deadline',async()=>{const start=Date.now();let expiry=start+10000;const s=setup(r=>/\/v1\/(session|context)$/.test(r.url)?s.json({...context,expiresAt:new Date(expiry).toISOString()}):undefined);await s.runtime.load();expiry=start+60000;await s.runtime.load();s.advance(11000);await expect(s.runtime.search()).rejects.toMatchObject({status:401});s.runtime.close();});
it.each([401,403])('X06 non-JSON Audit %s clears unknown intents before any further MFA or mutation',async status=>{let refused=false;const s=setup(r=>{if(new URL(r.url).pathname==='/v1/exports')throw Error('owned response lost');if(refused&&r.url.includes('/audit/events'))return new Response('denied',{status,headers:{'content-type':'text/plain'}});});await s.runtime.load();await expect(s.runtime.create(body,'123456')).rejects.toThrow();expect(s.runtime.uncertain).toBe(true);refused=true;await expect(s.runtime.search()).rejects.toMatchObject({status});expect(s.runtime.uncertain).toBe(false);const count=s.requests.length;await expect(s.runtime.create(body,'123456')).rejects.toMatchObject({status:403});expect(s.requests).toHaveLength(count);s.runtime.close();});

it('X06 export revalidates authority before MFA even without an explicit reload',async()=>{let changed=false;const s=setup(r=>/\/v1\/(session|context)$/.test(r.url)?s.json({...context,...changed?{accountId:eventId}:{}}):undefined);await s.runtime.load();changed=true;await expect(s.runtime.create(body,'123456')).rejects.toMatchObject({status:403});expect(s.requests.some(r=>r.url.includes('/auth/')||r.url.endsWith('/exports'))).toBe(false);s.runtime.close();});
it('X06 transient identity failure preserves the original unknown export key for explicit recovery',async()=>{let lost=true,unavailable=false;const s=setup(r=>{if(unavailable&&r.url.endsWith('/v1/session'))return s.json({},503);if(lost&&r.url.endsWith('/v1/exports')){lost=false;throw Error('owned response lost');}});await s.runtime.load();await expect(s.runtime.create(body,'123456')).rejects.toThrow();unavailable=true;await expect(s.runtime.create(body,'123456')).rejects.toMatchObject({status:503});expect(s.runtime.uncertain).toBe(true);unavailable=false;await s.runtime.create(body,'123456');const writes=s.requests.filter(r=>r.url.endsWith('/v1/exports'));expect(writes).toHaveLength(2);expect(writes[0].headers.get('idempotency-key')).toBe(writes[1].headers.get('idempotency-key'));s.runtime.close();});

it('X06 small-screen refusal preserves an unknown export until desktop explicit same-key recovery',async()=>{let lost=true;const s=setup(r=>{if(lost&&r.url.endsWith('/v1/exports')){lost=false;throw Error('owned response lost');}return undefined;});await s.runtime.load();await expect(s.runtime.create(body,'123456')).rejects.toThrow();s.mobile();await expect(s.runtime.create(body,'123456')).rejects.toMatchObject({status:403});expect(s.runtime.uncertain).toBe(true);s.desktop();await s.runtime.create(body,'123456');const writes=s.requests.filter(r=>r.url.endsWith('/v1/exports'));expect(writes).toHaveLength(2);expect(writes[0].headers.get('idempotency-key')).toBe(writes[1].headers.get('idempotency-key'));s.runtime.close();});
it('X06 local authority loss during C01 reload immediately discards unknown export intent',async()=>{let invalidateRead=false;const s=setup(r=>{if(invalidateRead&&r.url.endsWith('/v1/session'))s.invalidate();if(r.url.endsWith('/v1/exports'))throw Error('owned response lost');return undefined;});await s.runtime.load();await expect(s.runtime.create(body,'123456')).rejects.toThrow();expect(s.runtime.uncertain).toBe(true);invalidateRead=true;await expect(s.runtime.load()).rejects.toThrow('invalidated');expect(s.runtime.uncertain).toBe(false);s.runtime.close();});
