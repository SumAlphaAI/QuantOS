import { createBffClient } from "@sumalpha/api-client";
import type { NotificationPreferencesInput, ProfileSettingsInput, SettingsBundle } from "./c17";

export class SettingsGatewayError extends Error {
  constructor(message: string, readonly operation: string, readonly correlationId?: string) { super(message); this.name = "SettingsGatewayError"; }
}

function required<T>(data: T | undefined, operation: string): T {
  if (data === undefined) throw new SettingsGatewayError("设置服务暂不可用，请稍后重试。", operation);
  return data;
}

export async function loadSettingsBundle(origin: string, fetchImpl: typeof fetch = fetch): Promise<SettingsBundle> {
  const client = createBffClient({ baseUrl: origin, fetch: fetchImpl });
  const session = await client.GET("/v1/session");
  if (!session.data) throw new SettingsGatewayError("会话已失效，请重新登录。", "getSession", session.error?.correlationId);
  const [profile, notifications, security, sessions, devices, downloads, browserPolicy] = await Promise.all([
    client.GET("/v1/settings/profile"), client.GET("/v1/settings/notification-preferences"), client.GET("/v1/settings/security"),
    client.GET("/v1/settings/sessions"), client.GET("/v1/settings/trusted-devices"), client.GET("/v1/settings/downloads"), client.GET("/v1/platform/browser-capabilities"),
  ]);
  return {
    profile: required(profile.data, "getProfile"), notifications: required(notifications.data, "getNotificationPrefs"), security: required(security.data, "getSecuritySettings"),
    sessions: required(sessions.data, "listSessions"), devices: required(devices.data, "listDevices"), downloads: required(downloads.data?.items, "listDownloads"), browserPolicy: required(browserPolicy.data, "getPlatformCapabilities"),
  };
}

export async function saveProfileSettings(origin: string, profile: ProfileSettingsInput, version: string, idempotencyKey: string, csrfToken: string, fetchImpl: typeof fetch = fetch) {
  const client = createBffClient({ baseUrl: origin, fetch: fetchImpl });
  const result = await client.PUT("/v1/settings/profile", { body: profile, params: { header: { "If-Match": version, "Idempotency-Key": idempotencyKey, "X-CSRF-Token": csrfToken } } });
  return required(result.data, "saveProfile");
}

export async function saveNotificationSettings(origin: string, preferences: NotificationPreferencesInput, version: string, idempotencyKey: string, csrfToken: string, fetchImpl: typeof fetch = fetch) {
  const client = createBffClient({ baseUrl: origin, fetch: fetchImpl });
  const result = await client.PUT("/v1/settings/notification-preferences", { body: preferences, params: { header: { "If-Match": version, "Idempotency-Key": idempotencyKey, "X-CSRF-Token": csrfToken } } });
  return required(result.data, "saveNotificationPrefs");
}

export async function revokeSettingsSession(origin: string, sessionId: string, reauthTokenRef: string, idempotencyKey: string, csrfToken: string, fetchImpl: typeof fetch = fetch) {
  const client = createBffClient({ baseUrl: origin, fetch: fetchImpl });
  const result = await client.DELETE("/v1/settings/sessions/{sessionId}", { params: { path: { sessionId }, header: { "Idempotency-Key": idempotencyKey, "X-CSRF-Token": csrfToken, "X-Reauth-Token-Ref": reauthTokenRef } } });
  return required(result.data, "revokeSession");
}

export async function revokeTrustedDevice(origin: string, deviceId: string, reauthTokenRef: string, idempotencyKey: string, csrfToken: string, fetchImpl: typeof fetch = fetch) {
  const client = createBffClient({ baseUrl: origin, fetch: fetchImpl });
  const result = await client.DELETE("/v1/settings/trusted-devices/{deviceId}", { params: { path: { deviceId }, header: { "Idempotency-Key": idempotencyKey, "X-CSRF-Token": csrfToken, "X-Reauth-Token-Ref": reauthTokenRef } } });
  return required(result.data, "revokeDevice");
}

export async function revokeMfaFactor(origin: string, factorId: string, reauthTokenRef: string, idempotencyKey: string, csrfToken: string, fetchImpl: typeof fetch = fetch) {
  const client = createBffClient({ baseUrl: origin, fetch: fetchImpl });
  const result = await client.DELETE("/v1/settings/mfa/factors/{factorId}", { params: { path: { factorId }, header: { "Idempotency-Key": idempotencyKey, "X-CSRF-Token": csrfToken, "X-Reauth-Token-Ref": reauthTokenRef } } });
  return required(result.data, "revokeMfaFactor");
}
