import { describe, expect, it } from "vitest";
import { bffZodSchemas } from "../../../packages/api-client/src/bff-gen/quantos-bff.zod";

import {
  canRevokeDevice,
  canRevokeSession,
  downloadAvailability,
  notificationFallback,
} from "../src/settings/c17";
import { ui104SettingsFixture } from "../src/settings/fixture";
import { loadSettingsBundle, revokeMfaFactor, revokeSettingsSession, revokeTrustedDevice, saveNotificationSettings, saveProfileSettings, SettingsGatewayError } from "../src/settings/gateway";

describe("UI-104 settings safety rules", () => {
  it("never exposes session revocation for the current session, offline mode, or small screens", () => {
    const current = ui104SettingsFixture.sessions[0]!;
    const remote = ui104SettingsFixture.sessions[1]!;
    expect(canRevokeSession(current, { online: true, viewportWidth: 1440 })).toBe(false);
    expect(canRevokeSession(remote, { online: false, viewportWidth: 1440 })).toBe(false);
    expect(canRevokeSession(remote, { online: true, viewportWidth: 390 })).toBe(false);
    expect(canRevokeSession(remote, { online: true, viewportWidth: 1440 })).toBe(true);
  });

  it("protects the final MFA factor and all small-screen high-risk actions", () => {
    expect(canRevokeDevice({ online: true, viewportWidth: 1440, factorCount: 1 })).toBe(false);
    expect(canRevokeDevice({ online: true, viewportWidth: 390, factorCount: 2 })).toBe(false);
    expect(canRevokeDevice({ online: true, viewportWidth: 1440, factorCount: 2 })).toBe(true);
  });

  it("degrades rejected browser permission to in-app notification", () => {
    expect(notificationFallback("granted")).toBe("browser");
    expect(notificationFallback("denied")).toBe("in_app_only");
    expect(notificationFallback("unsupported")).toBe("in_app_only");
  });

  it("explains ready and expired BFF download links", () => {
    const ready = ui104SettingsFixture.downloads[0]!;
    const expired = ui104SettingsFixture.downloads[2]!;
    expect(downloadAvailability(ready, "2026-08-15T10:00:00Z")).toEqual({
      available: true,
      reason: "下载通过 BFF 短时签名链接提供，并记录审计。",
    });
    expect(downloadAvailability(expired, "2026-08-15T10:00:00Z")).toEqual({
      available: false,
      reason: "下载链接已过期，请重新生成。",
    });
  });
});

describe("UI-104 C17 gateway guard", () => {
  it("loads the complete authenticated settings bundle and rejects a missing section", async () => {
    const fixture = ui104SettingsFixture;
    expect(bffZodSchemas.ProfileSettings.safeParse(fixture.profile).success).toBe(true);
    expect(bffZodSchemas.NotificationPreferences.safeParse(fixture.notifications).success).toBe(true);
    expect(bffZodSchemas.SecuritySettings.safeParse(fixture.security).success).toBe(true);
    expect(bffZodSchemas.BrowserCapabilityPolicy.safeParse(fixture.browserPolicy).success).toBe(true);
    expect(fixture.sessions.every(value => bffZodSchemas.ActiveSession.safeParse(value).success)).toBe(true);
    expect(fixture.devices.every(value => bffZodSchemas.TrustedDevice.safeParse(value).success)).toBe(true);
    expect(fixture.downloads.every(value => bffZodSchemas.DownloadRecord.safeParse(value).success)).toBe(true);
    const responses: Record<string, unknown> = {
      "/v1/session": { actorId: "11111111-1111-4111-8111-111111111111", tenantId: "22222222-2222-4222-8222-222222222222", workspaceId: "33333333-3333-4333-8333-333333333333", accountId: "44444444-4444-4444-8444-444444444444", mode: "paper", environment: "dev", mfaState: "verified", expiresAt: new Date(Date.now()+300000).toISOString(), capabilities: ["settings.read"] },
      "/v1/settings/profile": fixture.profile,
      "/v1/settings/notification-preferences": fixture.notifications,
      "/v1/settings/security": fixture.security,
      "/v1/settings/sessions": fixture.sessions,
      "/v1/settings/trusted-devices": fixture.devices,
      "/v1/settings/downloads": { items: fixture.downloads },
      "/v1/platform/browser-capabilities": fixture.browserPolicy,
    };
    const requests: Request[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const request = input as Request;
      requests.push(request);
      const body = responses[new URL(request.url).pathname];
      return new Response(JSON.stringify(body ?? { code: "UNAVAILABLE" }), {
        status: body ? 200 : 503, headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    expect(await loadSettingsBundle("https://bff.example", fetchImpl)).toEqual(fixture);
    expect(requests).toHaveLength(8);
    expect(requests.every(request => request.credentials === "include")).toBe(true);
    delete responses["/v1/settings/security"];
    await expect(loadSettingsBundle("https://bff.example", fetchImpl)).rejects.toMatchObject({ operation: "getSecuritySettings" });
  });

  it("preserves concurrency, CSRF and reauthentication headers for settings mutations", async () => {
    const requests: Request[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      requests.push(input as Request);
      const request=input as Request;
      const profile=new URL(request.url).pathname.endsWith("/profile");
      const payload=request.method==="PUT" ? (profile ? ui104SettingsFixture.profile : ui104SettingsFixture.notifications) : {jobId:"11111111-1111-4111-8111-111111111111",status:"accepted",correlationId:"22222222-2222-4222-8222-222222222222",auditRef:"33333333-3333-4333-8333-333333333333"};
      return Response.json(payload, {status:request.method==="PUT"?200:202});
    }) as typeof fetch;
    await saveProfileSettings("https://bff.example", ui104SettingsFixture.profile, "v1", "idem-profile", "csrf", fetchImpl);
    await saveNotificationSettings("https://bff.example", ui104SettingsFixture.notifications, "v2", "idem-prefs", "csrf", fetchImpl);
    await revokeSettingsSession("https://bff.example", "session-remote", "reauth", "idem-session", "csrf", fetchImpl);
    await revokeTrustedDevice("https://bff.example", "device-remote", "reauth", "idem-device", "csrf", fetchImpl);
    expect(requests.map(request => request.method)).toEqual(["PUT", "PUT", "DELETE", "DELETE"]);
    expect(requests.map(request => request.headers.get("idempotency-key"))).toEqual(["idem-profile", "idem-prefs", "idem-session", "idem-device"]);
    expect(requests.every(request => request.headers.get("x-csrf-token") === "csrf" && request.credentials === "include")).toBe(true);
    expect(requests.slice(0, 2).map(request => request.headers.get("if-match"))).toEqual(["v1", "v2"]);
    expect(requests.slice(2).every(request => request.headers.get("x-reauth-token-ref") === "reauth")).toBe(true);
  });

  it("stops before loading settings when the session guard fails", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response(JSON.stringify({ code: "UNAUTHORIZED", message: "expired" }), { status: 401 });
    }) as typeof fetch;

    const error = await loadSettingsBundle("https://bff.example", fetchImpl).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(SettingsGatewayError);
    expect((error as SettingsGatewayError).operation).toBe("getSession");
    expect(calls).toBe(1);
  });

  it("forwards idempotency, CSRF and recent-auth headers when revoking an MFA factor", async () => {
    let capturedHeaders = new Headers();
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedHeaders = input instanceof Request ? input.headers : new Headers(init?.headers);
      return new Response(JSON.stringify({
        jobId: "11111111-2222-4333-8444-555555555555",
        status: "accepted",
        correlationId: "66666666-7777-4888-8999-000000000000",
        auditRef: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      }), { status: 202, headers: { "content-type": "application/json" } });
    }) as typeof fetch;

    const result = await revokeMfaFactor("https://bff.example", "factor-passkey", "reauth-ref", "idem-1", "csrf-1", fetchImpl);
    expect(result.auditRef).toBe("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    expect(capturedHeaders.get("idempotency-key")).toBe("idem-1");
    expect(capturedHeaders.get("x-csrf-token")).toBe("csrf-1");
    expect(capturedHeaders.get("x-reauth-token-ref")).toBe("reauth-ref");
  });
});

describe("A2 settings runtime response boundary", () => {
  it("stops before reading settings if the session response is empty", async () => {
    const requests: Request[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      requests.push(input as Request);
      return Response.json({});
    }) as typeof fetch;
    await expect(loadSettingsBundle("https://bff.example", fetchImpl)).rejects.toMatchObject({ name: "BffResponseError", operation: "getSession" });
    expect(requests).toHaveLength(1);
  });

  it("rejects an accepted envelope where a saved profile is required", async () => {
    const fetchImpl = (async () => Response.json({ status: "accepted" })) as typeof fetch;
    await expect(saveProfileSettings("https://bff.example", ui104SettingsFixture.profile, "v1", "key", "csrf", fetchImpl)).rejects.toMatchObject({ name: "BffResponseError", operation: "saveProfile" });
  });

  it.each([401, 403, 409, 429, 503])("preserves validated HTTP %i error metadata", async status => {
    const correlationId = "22222222-2222-4222-8222-222222222222";
    const code = status === 409 ? "VERSION_CONFLICT" : status === 429 ? "RATE_LIMITED" : "UNAVAILABLE";
    const body = { code, message: "internal detail", correlationId, ...(status === 409 ? { currentVersion: "profile-v9" } : {}), ...(status === 429 ? { retryAfter: 60 } : {}) };
    const fetchImpl = (async () => Response.json(body, { status })) as typeof fetch;
    const error = await saveProfileSettings("https://bff.example", ui104SettingsFixture.profile, "v1", "key", "csrf", fetchImpl).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(SettingsGatewayError);
    expect(error).toMatchObject({ status, code, correlationId, currentVersion: status === 409 ? "profile-v9" : undefined, retryAfter: status === 429 ? 60 : undefined });
    expect((error as Error).message).not.toContain("internal detail");
  });
});


it("discards a 409 envelope with malformed version metadata", async () => {
  const fetchImpl = (async () => Response.json({ code: "VERSION_CONFLICT", currentVersion: 9, message: "internal", correlationId: "22222222-2222-4222-8222-222222222222" }, { status: 409 })) as typeof fetch;
  const error = await saveProfileSettings("https://bff.example", ui104SettingsFixture.profile, "v1", "key", "csrf", fetchImpl).catch((value: unknown) => value);
  expect(error).toMatchObject({ name: "SettingsGatewayError", status: 409, code: undefined, correlationId: undefined, currentVersion: undefined });
});
