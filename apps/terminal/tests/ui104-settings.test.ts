import { describe, expect, it } from "vitest";

import {
  canRevokeDevice,
  canRevokeSession,
  downloadAvailability,
  notificationFallback,
} from "../src/settings/c17";
import { ui104SettingsFixture } from "../src/settings/fixture";
import { loadSettingsBundle, SettingsGatewayError } from "../src/settings/gateway";

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
});
