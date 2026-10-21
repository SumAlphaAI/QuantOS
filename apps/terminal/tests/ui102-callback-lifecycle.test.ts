import { afterEach, expect, it, vi } from "vitest";
import { beginAuth, consumePendingAuth, exchangeCode, handleAuthHttpStatus, pendingAuthKey, pendingAuthLifetimeMs, sessionStore } from "../src/auth/flow";
import { completeLoginMfa } from "../src/auth/bff";
const config = { issuer: "https://mock.idp.local", clientId: "fixture", redirectUri: "http://localhost/auth/callback" };
const valid = () => ({ verifier: "v".repeat(64), state: "a".repeat(32), returnTo: "/orders?token=secret", issuedAt: Date.now() });
const actor = { subject: "old", establishedAt: new Date().toISOString(), expiresIn: 300 };
afterEach(() => { vi.useRealTimers(); sessionStore.clear(); });
it("consumes a pending callback exactly once and removes stale session metadata", () => {
  let raw: string | null = JSON.stringify(valid());
  const storage = { getItem: () => raw, removeItem: (key: string) => { expect(key).toBe(pendingAuthKey); raw = null; } };
  sessionStore.set(actor);
  expect(consumePendingAuth(storage).returnTo).toBe("/command");
  expect(sessionStore.get()).toBeNull();
  expect(() => consumePendingAuth(storage)).toThrow("已失效");
});
it.each([null, "not-json", "{}", JSON.stringify({ ...valid(), issuedAt: 0 }), JSON.stringify({ ...valid(), state: "" }), JSON.stringify({ ...valid(), verifier: "" }), JSON.stringify({ ...valid(), issuedAt: Date.now() + 60_000 })])("invalid pending %s is destroyed before refusal", (raw) => {
  const removeItem = vi.fn();
  expect(() => consumePendingAuth({ getItem: () => raw, removeItem })).toThrow("已失效");
  expect(removeItem).toHaveBeenCalledOnce();
});
it("expiry boundary rejects before any exchange, then a fresh login can recover", async () => {
  vi.useFakeTimers();
  const pending = valid(); const fetchImpl = vi.fn<typeof fetch>();
  vi.advanceTimersByTime(pendingAuthLifetimeMs);
  await expect(exchangeCode(config, pending, "code", pending.state, fetchImpl)).rejects.toThrow("已失效");
  expect(fetchImpl).not.toHaveBeenCalled();
  const fresh = await beginAuth(config, "/portfolio");
  fetchImpl.mockResolvedValue(Response.json({ subject: "fresh", expires_in: 300 }));
  expect((await exchangeCode(config, fresh.pending, "code", fresh.pending.state, fetchImpl)).subject).toBe("fresh");
});
it.each([{}, { subject: "", expires_in: 300 }, { subject: "actor", expires_in: 0 }, { subject: "actor", expires_in: "300" }, { subject: "actor", expires_in: 300, mfa_required: "false" }])("malformed token metadata never preserves old actor: %j", async body => {
  sessionStore.set(actor); const p = valid();
  await expect(exchangeCode(config, p, "code", p.state, (async () => Response.json(body)) as typeof fetch)).rejects.toThrow("必要字段");
  expect(sessionStore.get()).toBeNull();
});
it("state refusal and transport failure clear a previous actor and never disclose network details", async () => {
  const p = valid(); sessionStore.set(actor);
  await expect(exchangeCode(config, p, "code", "wrong")).rejects.toThrow("不匹配");
  expect(sessionStore.get()).toBeNull(); sessionStore.set(actor);
  await expect(exchangeCode(config, p, "code", p.state, (async () => { throw Error("secret-provider"); }) as typeof fetch)).rejects.toThrow("登录交换失败");
  expect(sessionStore.get()).toBeNull();
});
it("a response arriving after 401 cannot resurrect a cleared actor", async () => {
  const p = valid(); let release!: (r: Response) => void;
  const exchange = exchangeCode(config, p, "code", p.state, (() => new Promise<Response>(r => { release = r; })) as typeof fetch);
  sessionStore.clear(); release(Response.json({ subject: "late", expires_in: 300 }));
  await expect(exchange).rejects.toThrow("已失效"); expect(sessionStore.get()).toBeNull();
});
it.each([200, 401, 403, 500])("BFF session establishment status %i never establishes client metadata or retries", async status => {
  sessionStore.set(actor);
  const p = valid();
  const fetchImpl = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ subject: "candidate", expires_in: 300, access_token: "short-token" }))
    .mockResolvedValueOnce(new Response(null, { status }));
  await expect(exchangeCode(config, p, "code", p.state, fetchImpl, "https://bff.example"))
    .rejects.toThrow("服务端会话建立失败");
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  expect(fetchImpl.mock.calls[1]).toEqual(["https://bff.example/v1/auth/session", expect.objectContaining({
    method: "POST", credentials: "include", headers: { authorization: "Bearer short-token" },
  })]);
  expect(sessionStore.get()).toBeNull();
});
it("401 while BFF establishment is pending rejects its late success, then a fresh login can recover", async () => {
  const p = valid();
  let release!: (response: Response) => void;
  let markStarted!: () => void;
  const started = new Promise<void>(resolve => { markStarted = resolve; });
  const fetchImpl = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ subject: "late", expires_in: 300, access_token: "short-token" }))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { release = resolve; markStarted(); }));
  const exchange = exchangeCode(config, p, "code", p.state, fetchImpl, "https://bff.example");
  await started;
  expect(handleAuthHttpStatus(401).kind).toBe("login");
  release(new Response(null, { status: 204 }));
  await expect(exchange).rejects.toThrow("已失效");
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  expect(sessionStore.get()).toBeNull();

  const fresh = await beginAuth(config, "/portfolio");
  fetchImpl.mockResolvedValueOnce(Response.json({ subject: "fresh", expires_in: 600, access_token: "fresh-short-token" }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  const session = await exchangeCode(config, fresh.pending, "fresh-code", fresh.pending.state, fetchImpl, "https://bff.example");
  expect(sessionStore.get()).toEqual(session);
  expect(session).toMatchObject({ subject: "fresh", expiresIn: 600 });
  expect(JSON.stringify(session)).not.toContain("token");
  expect(fetchImpl).toHaveBeenCalledTimes(4);
});
it("MFA 401 clears metadata without replaying the write", async () => {
  sessionStore.set(actor); const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ code: "UNAUTHORIZED", message: "secret" }, { status: 401 }));
  await expect(completeLoginMfa("https://bff.example", "123456", "csrf", fetchImpl)).rejects.toMatchObject({ status: 401 });
  expect(sessionStore.get()).toBeNull(); expect(fetchImpl).toHaveBeenCalledOnce();
});

it("a stalled token request times out without retries or retained session", async () => {
  vi.useFakeTimers(); const p = valid(); sessionStore.set(actor);
  const fetchImpl = vi.fn<typeof fetch>().mockImplementation(() => new Promise<Response>(() => {}));
  const exchange = exchangeCode(config, p, "code", p.state, fetchImpl);
  const rejected = expect(exchange).rejects.toThrow("登录交换失败");
  await vi.advanceTimersByTimeAsync(15_001); await rejected;
  expect(fetchImpl).toHaveBeenCalledOnce(); expect(sessionStore.get()).toBeNull();
});
