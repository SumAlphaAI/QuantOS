import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {createRouteAccess, routeAccessPolicy, type AccessEnvironment, type AccessLoss} from "../src/auth/route-access";
import {publishAuthInvalidation, subscribeAuthInvalidation} from "../src/auth/invalidation";
import {sessionStore} from "../src/auth/flow";
import {ui101CommandFixture} from "../src/command/fixture";
const origin = "https://bff.test";
const open: Array<ReturnType<typeof createRouteAccess>> = [];
beforeEach(() => {vi.useFakeTimers();vi.setSystemTime(Date.parse("2026-10-22T13:00:00Z"));});
afterEach(() => {for (const access of open.splice(0)) access.close();vi.useRealTimers();vi.unstubAllGlobals();});
function setup(options: {streamStatus?: number; mock?: boolean} = {}) {
  const context = {...structuredClone(ui101CommandFixture.session), expiresAt: new Date(Date.now()+600000).toISOString()};
  let online = true, visible = true, environmentListener: (reason: "offline" | "hidden" | "focus") => void = () => {};
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({start(c) {stream = c;}});
  const losses: AccessLoss[] = [], requests: Array<{path: string; credentials?: RequestCredentials; cache?: RequestCache; signal?: AbortSignal | null}> = [];
  let pending = false;
  const fetchImpl: typeof fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);requests.push({path: new URL(request.url).pathname, credentials: request.credentials, cache: request.cache, signal: init?.signal ?? request.signal});
    if (request.url.includes("/stream")) return new Response(body, {status: options.streamStatus ?? 200, headers: {"content-type": "text/event-stream"}});
    if (pending) return new Promise<Response>(() => {});
    return Response.json(context);
  };
  const environment: AccessEnvironment = {online: () => online, visible: () => visible, subscribe(fn) {environmentListener = fn;return () => {environmentListener = () => {};};}};
  const access = createRouteAccess({origin, mock: options.mock ?? false, fetchImpl, environment, onInvalidate: l => losses.push(l)});open.push(access);
  const event = (type: string, sequence = 1, patch = {}) => stream.enqueue(new TextEncoder().encode('data: '+JSON.stringify({streamId:"55555555-5555-4555-8555-555555555555",eventId:crypto.randomUUID(),sequence,occurredAt:new Date().toISOString(),correlationId:crypto.randomUUID(),payloadVersion:"v1",payload:{type,objectId:"session-current"},...patch})+'\n\n'));
  return {access, context, losses, requests, event, stream, setPending() {pending = true;}, environment(reason: "offline" | "hidden" | "focus") {if (reason === "offline") online=false;if (reason === "hidden") visible=false;environmentListener(reason);}};
}
it("opens authenticated SSE and rechecks both C01 surfaces before authorizing publication", async () => {
  const s = setup();await s.access.bind(s.context);s.access.assertCurrent();
  expect(s.requests.map(r=>r.path)).toEqual(["/v1/settings/sessions/stream","/v1/session","/v1/context"]);
  expect(s.requests.every(r=>r.credentials==="include")).toBe(true);expect(s.requests[0]!.cache).toBe("no-store");expect(s.losses).toEqual([]);
});
it("terminal revocation clears once and synchronously fences any later action or rebind", async () => {
  const s = setup();await s.access.bind(s.context);s.event("permission_revoked");await vi.advanceTimersByTimeAsync(0);
  expect(s.losses).toEqual([{reason:"revoked",status:403}]);expect(()=>s.access.assertCurrent()).toThrow();await expect(s.access.bind(s.context)).rejects.toThrow();
  expect(s.requests.every(r=>r.signal?.aborted)).toBe(true);
});
it("does not apply remote session notifications as grants; global sequence gaps do not invent missing domain facts", async () => {
  const s = setup();await s.access.bind(s.context);s.event("session_revoked",10);s.event("session_revoked",10);s.event("session_revoked",40);await vi.advanceTimersByTimeAsync(0);
  expect(s.losses).toEqual([]);s.event("permission_revoked",1);await vi.advanceTimersByTimeAsync(0);expect(s.access.closed).toBe(true);
});
for (const status of [401,403]) it(`stream ${status} terminates before any C01 recheck or projection publication`, async () => {
  const s = setup({streamStatus:status});await expect(s.access.bind(s.context)).rejects.toThrow();expect(s.requests).toHaveLength(1);expect(s.losses[0]).toMatchObject({reason:"revoked",status});
});
for (const kind of ["bad-json","bad-schema","oversized","unknown-event","changed-stream"] as const) it(`rejects ${kind} stream without retaining authority`, async () => {
  const s = setup();await s.access.bind(s.context);
  if(kind==="bad-json")s.stream.enqueue(new TextEncoder().encode('data: {bad}\n\n'));
  if(kind==="bad-schema")s.stream.enqueue(new TextEncoder().encode('data: {}\n\n'));
  if(kind==="oversized")s.stream.enqueue(new TextEncoder().encode('data: '+"a".repeat(routeAccessPolicy.maxFrameChars+1)));
  if(kind==="unknown-event")s.event("permissions_granted");
  if(kind==="changed-stream"){s.event("session_revoked");s.event("session_revoked",2,{streamId:crypto.randomUUID()});}
  await vi.advanceTimersByTimeAsync(0);expect(s.losses).toEqual([{reason:"stream"}]);expect(()=>s.access.assertCurrent()).toThrow();
});
it("stream EOF blocks until explicit new monitor and full C01 validation; never silently reconnects", async () => {
  const s = setup();await s.access.bind(s.context);s.stream.close();await vi.advanceTimersByTimeAsync(0);expect(s.access.closed).toBe(true);
  await vi.advanceTimersByTimeAsync(20000);expect(s.requests).toHaveLength(3);
  const next = setup();await next.access.bind(next.context);expect(next.requests).toHaveLength(3);expect(next.access.closed).toBe(false);
});
for (const field of ["actorId","tenantId","workspaceId","accountId","mode","environment","mfaState","capabilities"] as const) it(`C01 polling detects silent ${field} change and clears in the bounded window`, async () => {
  const s = setup();await s.access.bind(s.context);
  Object.assign(s.context,{[field]:field==="mode"?"research":field==="environment"?"dev":field==="mfaState"?"challenged":field==="capabilities"?["settings.read"]:crypto.randomUUID()});
  await vi.advanceTimersByTimeAsync(5000);expect(s.losses).toEqual([{reason:"scope",status:403}]);expect(s.access.closed).toBe(true);
});
it("stalled identity checks expire the eight-second lease even if transport ignores cancellation", async () => {
  const s = setup();await s.access.bind(s.context);s.setPending();await vi.advanceTimersByTimeAsync(8001);expect(s.access.closed).toBe(true);expect(s.losses).toHaveLength(1);
});
it("earliest resource/session deadline invalidates; synchronous action guard catches delayed timers", async () => {
  const s = setup();await s.access.bind(s.context,Date.now()+1000);vi.setSystemTime(Date.now()+1001);expect(()=>s.access.assertCurrent()).toThrow();expect(s.losses).toEqual([{reason:"expired"}]);
});
for(const reason of ["offline","hidden","focus"] as const)it(`${reason} immediately clears authority and aborts outstanding reads`,async()=>{
  const s=setup();await s.access.bind(s.context);s.environment(reason);expect(s.access.closed).toBe(true);expect(s.losses).toEqual([{reason}]);expect(s.requests[0]!.signal?.aborted).toBe(true);
});
it("local session clear and replacement emit only narrowing invalidations",async()=>{
  const s=setup();await s.access.bind(s.context);sessionStore.clear();expect(s.losses).toEqual([{reason:"revoked",status:401}]);
  const next=setup();await next.access.bind(next.context);sessionStore.set({subject:"fixture",expiresIn:60,establishedAt:new Date().toISOString()});expect(next.losses).toEqual([{reason:"scope"}]);
});
it("mock view does not claim an authenticated stream and cleanup releases timers/listeners",async()=>{
  const s=setup({mock:true});await s.access.bind(s.context);expect(s.requests).toEqual([]);s.access.close();publishAuthInvalidation("session");await vi.advanceTimersByTimeAsync(10000);expect(s.losses).toEqual([]);
});
it("cross-tab hints carry no session facts; malformed or forged grants are ignored",()=>{
  const surface=new EventTarget(),messages:unknown[]=[];let receiver:((e:{data:unknown})=>void)|undefined;
  class Channel {onmessage?: (e:{data:unknown})=>void;constructor(){Object.defineProperty(this,"onmessage",{set(fn){receiver=fn;}});}postMessage(data:unknown){messages.push(data);}close(){}}
  const setItem=vi.fn();vi.stubGlobal("window",Object.assign(surface,{BroadcastChannel:Channel,localStorage:{setItem,removeItem:vi.fn()}}));
  const kinds:string[]=[];const stop=subscribeAuthInvalidation(k=>kinds.push(k));
  receiver?.({data:{version:1,type:"permissions_granted"}});receiver?.({data:{version:1,type:"context",token:"forbidden"}});expect(kinds).toEqual([]);
  receiver?.({data:{version:1,type:"context"}});expect(kinds).toEqual(["context"]);publishAuthInvalidation("session");
  expect(messages).toEqual([{version:1,type:"session"}]);expect(setItem).not.toHaveBeenCalled();stop();
});
it("transient storage fallback contains no identity or credentials",()=>{
  const surface=new EventTarget(),setItem=vi.fn(),removeItem=vi.fn();vi.stubGlobal("window",Object.assign(surface,{localStorage:{setItem,removeItem}}));publishAuthInvalidation("context");
  expect(setItem).toHaveBeenCalledWith("quantos.auth.invalidate",JSON.stringify({version:1,type:"context"}));expect(removeItem).toHaveBeenCalledWith("quantos.auth.invalidate");
});
