import { afterEach, expect, it, vi } from "vitest";
import { createSettingsRuntime } from "../src/settings/runtime";
import { ui104SettingsFixture } from "../src/settings/fixture";
import { sessionStore } from "../src/auth/flow";
const id = "11111111-1111-4111-8111-111111111111";
const ctx = () => ({ actorId: id, tenantId: id, workspaceId: id, accountId: id, mode: "shadow", environment: "dev", mfaState: "verified", expiresAt: new Date(Date.now() + 300000).toISOString(), capabilities: ["settings.read", "settings.write"] });
const accepted = { status: "accepted", jobId: id, correlationId: id, auditRef: id };
function setup(override: (request: Request, body: unknown) => Promise<Response | undefined> | Response | undefined = () => undefined, section?: "profile" | "security" | "notifications" | "browser") {
  const runtime = { online: true, width: 1440, csrf: "csrf-fixture" }; const requests: Request[] = [];
  const data = structuredClone(ui104SettingsFixture);
  const bodies: Record<string, () => unknown> = { "/v1/session": ctx, "/v1/context": ctx, "/v1/settings/profile": () => data.profile, "/v1/settings/notification-preferences": () => data.notifications, "/v1/settings/security": () => data.security, "/v1/settings/sessions": () => data.sessions, "/v1/settings/trusted-devices": () => data.devices, "/v1/settings/downloads": () => ({ items: data.downloads }), "/v1/platform/browser-capabilities": () => data.browserPolicy };
  const fetchImpl: typeof fetch = async (input, init) => {
    const request = new Request(input, init); requests.push(request.clone()); const path = new URL(request.url).pathname;
    const body = request.method === "GET" || request.method === "DELETE" ? undefined : await request.clone().json();
    const custom = await override(request, body); if (custom) return custom;
    if (path === "/v1/auth/mfa/challenges") { expect(body).toMatchObject({ purpose: "security_change", code: "123456" }); return Response.json({ status: "verified", challengeRef: id }); }
    if (path === "/v1/auth/reauth") return Response.json({ reauthTokenRef: id, expiresAt: new Date(Date.now() + 30000).toISOString() });
    if (request.method === "DELETE") return Response.json(accepted, { status: 202 });
    if (request.method === "PUT") return Response.json({ ...(path.endsWith("/profile") ? data.profile : data.notifications), ...(body as object), objectVersion: "server-v2" });
    return Response.json(bodies[path]?.() ?? {});
  };
  const actions = createSettingsRuntime({ mock: false, section, origin: "https://bff.example", fetchImpl, runtime: () => runtime, timeoutMs: 10 });
  return { actions, requests, runtime, data };
}
afterEach(() => { sessionStore.clear(); vi.useRealTimers(); });
it("loads session/context before private reads and strips all server-owned profile metadata on save", async () => {
  const t = setup(); const snapshot = await t.actions.load(); expect(snapshot.context.mode).toBe("shadow"); expect(t.requests.slice(0,2).map(r=>new URL(r.url).pathname)).toEqual(["/v1/session","/v1/context"]);
  const saved = await t.actions.saveProfile({ ...t.data.profile, displayName: "Controlled edit" }); const req = t.requests.at(-1)!; const body = await req.json();
  expect(body.displayName).toBe("Controlled edit"); for (const key of ["email","roleLabels","memberId","objectVersion","emailVerified"]) expect(body).not.toHaveProperty(key);
  expect(req.headers.get("if-match")).toBe(t.data.profile.objectVersion); expect(req.headers.get("x-csrf-token")).toBe("csrf-fixture"); expect(saved.objectVersion).toBe("server-v2");
  await t.actions.saveNotifications({ ...t.data.notifications, rules: t.data.notifications.rules.map(rule => Object.assign({}, rule, { privilegedOverride: true })) });
  const notificationBody = await t.requests.at(-1)!.json();
  for (const key of ["objectVersion", "browserPermission"]) expect(notificationBody).not.toHaveProperty(key);
  expect(notificationBody.rules.every((rule: Record<string, unknown>) => !("privilegedOverride" in rule))).toBe(true);
});
it.each(["expired","capability","workspace","challenged"])("%s blocks private C17 reads", async kind => {
  const t = setup(req => { const path = new URL(req.url).pathname; if (path === "/v1/session" && (kind === "expired" || kind === "challenged")) return Response.json({ ...ctx(), ...(kind === "expired" ? { expiresAt: "2000-01-01T00:00:00Z" } : { mfaState: "challenged" }) }); if (path === "/v1/context") return Response.json({ ...ctx(), ...(kind === "capability" ? { capabilities: [] } : kind === "workspace" ? { workspaceId: crypto.randomUUID() } : {}) }); });
  await expect(t.actions.load()).rejects.toHaveProperty("status"); expect(t.requests.length).toBeLessThanOrEqual(2);
});
it("a non-mock missing origin never renders or loads the demo", async () => { const a = createSettingsRuntime({ mock: false, runtime: () => ({ online:true,width:1440,csrf:"" }) }); await expect(a.load()).rejects.toMatchObject({status:503}); });
it("revoke posts security MFA then reauth and delete; 202 retains resource until fresh reads", async () => {
  const t = setup(); const s = await t.actions.load(), target = s.bundle.sessions![1]!;
  await t.actions.revoke("session", target.sessionId, `REVOKE ${target.sessionId}`, "123456");
  expect(t.requests.slice(-3).map(r => new URL(r.url).pathname)).toEqual(["/v1/auth/mfa/challenges","/v1/auth/reauth",`/v1/settings/sessions/${target.sessionId}`]); expect(t.requests.at(-1)!.headers.get("x-reauth-token-ref")).toBe(id);
  expect(s.bundle.sessions).toHaveLength(3); const count=t.requests.length; await t.actions.revoke("session",target.sessionId,`REVOKE ${target.sessionId}`,"123456"); expect(t.requests).toHaveLength(count);
});
it.each(["current","small","offline","last-factor","phrase"])("revoke %s refusal occurs before MFA network", async kind => {
  const t=setup(); if(kind==="last-factor")t.data.security.factors=t.data.security.factors.slice(0,1);const s=await t.actions.load();const target=s.bundle.sessions![kind==="current"?0:1]!;if(kind==="small")t.runtime.width=390;if(kind==="offline")t.runtime.online=false;const n=t.requests.length;
  await expect(kind==="last-factor"?t.actions.revoke("factor",s.bundle.security!.factors[0]!.factorId,`REVOKE ${s.bundle.security!.factors[0]!.factorId}`,"123456"):t.actions.revoke("session",target.sessionId,kind==="phrase"?"wrong":`REVOKE ${target.sessionId}`,"123456")).rejects.toThrow(); expect(t.requests).toHaveLength(n);
});
it("viewport or offline changes after MFA stop before reauth/delete", async()=>{
  let narrow=()=>{};const t=setup(req=>{if(new URL(req.url).pathname.endsWith("/challenges")){narrow();return Response.json({status:"verified",challengeRef:id});}});narrow=()=>{t.runtime.width=390;};await t.actions.load();const target=t.data.sessions[1]!;await expect(t.actions.revoke("session",target.sessionId,`REVOKE ${target.sessionId}`,"123456")).rejects.toThrow();expect(t.requests.at(-1)!.url).toContain("/challenges");
});
it("expired reauthentication grant cannot authorize DELETE", async()=>{
  const t=setup(req=>new URL(req.url).pathname.endsWith("/reauth")?Response.json({reauthTokenRef:id,expiresAt:"2000-01-01T00:00:00Z"}):undefined);await t.actions.load();const target=t.data.sessions[1]!;await expect(t.actions.revoke("session",target.sessionId,`REVOKE ${target.sessionId}`,"123456")).rejects.toThrow();expect(t.requests.some(r=>r.method==="DELETE")).toBe(false);
});
it("uncertain save preserves body/version/key; explicit identical retry uses the original intent", async()=>{
  let writes=0;const t=setup(req=>req.method==="PUT"&&writes++===0?new Promise<Response>(()=>{}):undefined);await t.actions.load();const draft={...t.data.profile,displayName:"Draft remains"},original=structuredClone(draft);await expect(t.actions.saveProfile(draft)).rejects.toMatchObject({code:"TIMEOUT",outcomeUnknown:true});await t.actions.saveProfile(draft);expect(draft).toEqual(original);const rows=t.requests.filter(r=>r.method==="PUT");expect(rows).toHaveLength(2);expect(rows[0]!.headers.get("idempotency-key")).toBe(rows[1]!.headers.get("idempotency-key"));expect(await rows[0]!.json()).toEqual(await rows[1]!.json());
});
it("409 preserves draft and rebase changes only metadata until the next explicit save",async()=>{
  const t=setup(req=>req.method==="PUT"?Response.json({code:"VERSION_CONFLICT",message:"private",correlationId:id,currentVersion:"new-version"},{status:409}):undefined);await t.actions.load();const draft={...t.data.profile,displayName:"Unsubmitted draft"};await expect(t.actions.saveProfile(draft)).rejects.toMatchObject({status:409});t.data.profile.objectVersion="new-version";const rebased=await t.actions.refreshProfile(draft);expect(rebased.displayName).toBe(draft.displayName);expect(rebased.objectVersion).toBe("new-version");expect(t.requests.filter(r=>r.method==="PUT")).toHaveLength(1);
});
it("a read-only context cannot start any settings mutation",async()=>{
  const t=setup(req=>new URL(req.url).pathname==="/v1/context"?Response.json({...ctx(),capabilities:["settings.read"]}):undefined);await t.actions.load();const n=t.requests.length;await expect(t.actions.saveProfile(t.data.profile)).rejects.toThrow();await expect(t.actions.saveNotifications(t.data.notifications)).rejects.toThrow();expect(t.requests).toHaveLength(n);
});
it("401 on a mutation clears memory; malformed success never confirms saving",async()=>{
  const t=setup(req=>req.method==="PUT"?Response.json({code:"UNAUTHENTICATED",message:"private"},{status:401}):undefined);await t.actions.load();sessionStore.set({subject:"old",establishedAt:"now",expiresIn:300});await expect(t.actions.saveProfile(t.data.profile)).rejects.toMatchObject({status:401});expect(sessionStore.get()).toBeNull();
  const bad=setup(req=>req.method==="PUT"?Response.json({status:"accepted"}):undefined);await bad.actions.load();await expect(bad.actions.saveNotifications(bad.data.notifications)).rejects.toHaveProperty("name","BffResponseError");
});
it("unmount or superseded read cannot publish old private settings",async()=>{const t=setup();const p=t.actions.load();t.actions.close();await expect(p).rejects.toThrow();await expect(t.actions.saveProfile(t.data.profile)).rejects.toThrow();});
it("demo mode never performs a network mutation and explicitly requires a real download issuer",async()=>{const f=vi.fn<typeof fetch>();const a=createSettingsRuntime({mock:true,fetchImpl:f,runtime:()=>({online:true,width:1440,csrf:""})});const s=await a.load();await a.saveProfile(s.bundle.profile);await expect(a.download(s.bundle.downloads![0]!)).rejects.toThrow("本地演示");expect(f).not.toHaveBeenCalled();});

it("profile section reads no unrelated security/download resources", async () => {
 const t=setup(req=>new URL(req.url).pathname.includes("downloads")?Response.json({code:"FORBIDDEN"},{status:403}):undefined,"profile");const s=await t.actions.load();expect(s.bundle.security).toBeUndefined();expect(t.requests.map(r=>new URL(r.url).pathname)).toEqual(["/v1/session","/v1/context","/v1/settings/profile"]);
});
it.each(["device","factor"] as const)("%s revocation uses the same verified security pipeline", async kind => {
 const t=setup();await t.actions.load();const target=kind==="device"?t.data.devices[1]!.deviceId:t.data.security.factors[1]!.factorId;expect((await t.actions.revoke(kind,target,`REVOKE ${target}`,"123456")).status).toBe("accepted");expect(t.requests.at(-1)!.url).toContain(kind==="device"?"trusted-devices":"mfa/factors");
});
it("rebase refuses a switched workspace before exposing merged drafts",async()=>{
 let switched=false;const t=setup(req=>switched&&["/v1/session","/v1/context"].includes(new URL(req.url).pathname)?Response.json({...ctx(),workspaceId:"22222222-2222-4222-8222-222222222222"}):undefined);await t.actions.load();switched=true;await expect(t.actions.refreshProfile(t.data.profile)).rejects.toMatchObject({status:403});
});
