import { afterEach, expect, it, vi } from "vitest";
import { createSettingsRuntime } from "../src/settings/runtime";
import { ui104SettingsFixture } from "../src/settings/fixture";
import { profileDraftInput, notificationDraftInput, profileInput, notificationInput } from "../src/settings/gateway";
import { settingsCsrf, settingsDate, settingsInitials, settingsTheme } from "../src/settings/presentation";
const id = "11111111-1111-4111-8111-111111111111";
function setup(override: (r: Request) => Response | Promise<Response> | undefined = () => undefined) {
  const state = { online: true, width: 1440, csrf: "csrf-fixture" }, data = structuredClone(ui104SettingsFixture), requests: Request[] = [];
  const context = () => ({ actorId: id, tenantId: id, workspaceId: id, accountId: id, mode: "paper", environment: "dev", capabilities: ["settings.read", "settings.write"], mfaState: "verified", expiresAt: new Date(Date.now() + 60000).toISOString() });
  const fetchImpl: typeof fetch = async (input, init) => {
    const request = new Request(input, init); requests.push(request.clone()); const changed = await override(request); if (changed) return changed;
    const path = new URL(request.url).pathname;
    if (["/v1/session", "/v1/context"].includes(path)) return Response.json(context());
    if (path.endsWith("/challenges")) return Response.json({ status: "verified", challengeRef: id });
    if (path.endsWith("/reauth")) return Response.json({ reauthTokenRef: id, expiresAt: new Date(Date.now() + 30000).toISOString() });
    if (request.method === "PUT") return Response.json({ ...data.profile, ...await request.json(), objectVersion: "server-15" });
    return Response.json(data.profile);
  };
  return { actions: createSettingsRuntime({ mock: false, origin: "https://bff.example", section: "profile", fetchImpl, runtime: () => state }), data, state, requests, context };
}
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
it("invalid draft is retained without parsing during comparison/rebase, and still refused at save", async () => {
  const t = setup(); await t.actions.load(); const invalid = { ...t.data.profile, displayName: "" };
  expect(profileDraftInput(invalid).displayName).toBe(""); expect(() => profileInput(invalid)).toThrow();
  expect((await t.actions.refreshProfile(invalid)).displayName).toBe("");
  await expect(t.actions.saveProfile(invalid)).rejects.toThrow(); expect(t.requests.some(r => r.method === "PUT")).toBe(false);
  const notification = { ...t.data.notifications, quietHoursStart: "" };
  expect(notificationDraftInput(notification).quietHoursStart).toBe(""); expect(() => notificationInput(notification)).toThrow();
});
it("CSRF parsing never crashes private reads or synthesizes malformed cookie data", () => {
  expect(settingsCsrf("other=x; quantos_csrf=valid%20token")).toBe("valid token"); expect(settingsCsrf("quantos_csrf=%E0%A4%A")).toBe(""); expect(settingsCsrf("other=x")).toBe("");
});
it("theme and identity presentation follow actual preferences without invented names", () => {
  expect(settingsTheme("system", true)).toBe("light"); expect(settingsTheme("system", false)).toBe("dark"); expect(settingsTheme("dark", true)).toBe("dark"); expect(settingsTheme("light", false)).toBe("light"); expect(settingsInitials("  Alex   Ning ")).toBe("AN"); expect(settingsInitials("")).toBe("?"); expect(settingsInitials("王 远")).toBe("王远");
});
it("earlier session lease bounds the context projection and all writes", async () => {
  const now = Date.now(); const t = setup(r => new URL(r.url).pathname === "/v1/session" ? Response.json({ ...t.context(), expiresAt: new Date(now + 5000).toISOString() }) : undefined);
  expect((await t.actions.load()).context.expiresAt).toBe(new Date(now + 5000).toISOString()); vi.spyOn(Date, "now").mockReturnValue(now + 5001); const count = t.requests.length; await expect(t.actions.saveProfile(t.data.profile)).rejects.toMatchObject({ status: 401 }); expect(t.requests).toHaveLength(count);
});
it("returned foreign member is refused before publishing the saved profile", async () => {
  const t = setup(r => r.method === "PUT" ? Response.json({ ...t.data.profile, memberId: "foreign-member" }) : undefined); await t.actions.load(); await expect(t.actions.saveProfile(t.data.profile)).rejects.toMatchObject({ status: 403 });
});
it("standalone reauthentication uses C01 and returns no MFA code, challenge or token reference", async () => {
  const t = setup(); await t.actions.load(); const result = await t.actions.reauthenticate("123456"); expect(Object.keys(result)).toEqual(["expiresAt"]); expect(Date.parse(result.expiresAt)).toBeGreaterThan(Date.now());
  expect(t.requests.slice(-2).map(r => new URL(r.url).pathname)).toEqual(["/v1/auth/mfa/challenges", "/v1/auth/reauth"]); expect(await t.requests.at(-2)!.json()).toEqual({ purpose: "security_change", code: "123456" }); expect(t.requests.some(r => r.method === "DELETE")).toBe(false);
});
it.each(["offline", "small", "csrf", "code"])("reauth %s refusal occurs before any security request", async kind => {
  const t = setup(); await t.actions.load(); if (kind === "offline") t.state.online = false; if (kind === "small") t.state.width = 390; if (kind === "csrf") t.state.csrf = ""; const n = t.requests.length;
  await expect(t.actions.reauthenticate(kind === "code" ? "wrong" : "123456")).rejects.toThrow(); expect(t.requests).toHaveLength(n);
});
it("reauth expiry and policy changes after MFA prevent grant publication", async () => {
  const t = setup(r => { if (new URL(r.url).pathname.endsWith("/challenges")) { t.state.width = 390; return Response.json({ status: "verified", challengeRef: id }); } }); await t.actions.load(); await expect(t.actions.reauthenticate("123456")).rejects.toMatchObject({ status: 403 }); expect(t.requests.at(-1)!.url).toContain("/challenges");
  const expired = setup(r => new URL(r.url).pathname.endsWith("/reauth") ? Response.json({ reauthTokenRef: id, expiresAt: "2000-01-01T00:00:00Z" }) : undefined); await expired.actions.load(); await expect(expired.actions.reauthenticate("123456")).rejects.toMatchObject({ status: 403 });
});
it("429 blocks all explicit write retries until retryAfter without automatic replay", async () => {
  const now = Date.now(); vi.spyOn(Date, "now").mockReturnValue(now);
  let first = true; const t = setup(r => r.method === "PUT" && first ? (first = false, Response.json({ code: "RATE_LIMITED", message: "private", correlationId: id, retryAfter: 5 }, { status: 429 })) : undefined); await t.actions.load();
  await expect(t.actions.saveProfile(t.data.profile)).rejects.toMatchObject({ status: 429, retryAfter: 5 }); const n = t.requests.length; await expect(t.actions.saveProfile(t.data.profile)).rejects.toMatchObject({ status: 429 }); await expect(t.actions.reauthenticate("123456")).rejects.toMatchObject({ status: 429 }); expect(t.requests).toHaveLength(n);
  vi.spyOn(Date, "now").mockReturnValue(now + 5001); expect((await t.actions.saveProfile(t.data.profile)).objectVersion).toBe("server-15");
});

it("region and time-display preferences format actual timestamps without changing server values", () => {
  const value = "2026-10-22T09:18:42Z", preference = { locale: "en" as const, timezone: "Asia/Shanghai", timeDisplay: "utc_local" as const };
  expect(settingsDate(value, preference)).toContain("Asia/Shanghai"); expect(settingsDate(value, preference)).toContain("UTC");
  expect(settingsDate(value, { ...preference, timeDisplay: "local" })).not.toContain("UTC");
  expect(settingsDate(value, { ...preference, timezone: "invalid/zone" })).toBe("日期或时区不可用"); expect(settingsDate("invalid", preference)).toBe("时间未提供"); expect(value).toBe("2026-10-22T09:18:42Z");
});
