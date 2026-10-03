import { bffZodSchemas, parseBffResponse, type BffOperationId, createBffClient } from "@sumalpha/api-client";
import type { NotificationPreferencesInput, ProfileSettingsInput, SettingsBundle } from "./c17";

export class SettingsGatewayError extends Error {
  constructor(
    message: string, readonly operation: string, readonly correlationId?: string,
    readonly status?: number, readonly code?: string, readonly currentVersion?: string,
    readonly retryAfter?: number,
  ) { super(message); this.name = "SettingsGatewayError"; }
}

function required<T>(result: { data?: T; error?: unknown; response: Response }, operation: BffOperationId): T {
  if (result.data === undefined) {
    let error;
    try {
      const parsed = bffZodSchemas.ErrorEnvelope.safeParse(parseBffResponse(operation, result.response.status, result.error));
      error = parsed.success ? parsed.data : undefined;
    } catch {
      // Keep the transport status but discard all malformed provider metadata.
    }
    throw new SettingsGatewayError("设置服务暂不可用，请稍后重试。", operation,
      error?.correlationId, result.response.status, error?.code, error?.currentVersion, error?.retryAfter);
  }
  return parseBffResponse(operation, result.response.status, result.data) as T;
}

export async function loadSettingsBundle(origin: string, fetchImpl: typeof fetch = fetch): Promise<SettingsBundle> {
  const client = createBffClient({ baseUrl: origin, fetch: fetchImpl });
  const session = await client.GET("/v1/session");
  required(session, "getSession");
  const [profile, notifications, security, sessions, devices, downloads, browserPolicy] = await Promise.all([
    client.GET("/v1/settings/profile"), client.GET("/v1/settings/notification-preferences"), client.GET("/v1/settings/security"),
    client.GET("/v1/settings/sessions"), client.GET("/v1/settings/trusted-devices"), client.GET("/v1/settings/downloads"), client.GET("/v1/platform/browser-capabilities"),
  ]);
  return {
    profile: required(profile, "getProfile"), notifications: required(notifications, "getNotificationPrefs"), security: required(security, "getSecuritySettings"),
    sessions: required(sessions, "listSessions"), devices: required(devices, "listDevices"), downloads: required(downloads, "listDownloads").items, browserPolicy: required(browserPolicy, "getPlatformCapabilities"),
  };
}

export async function saveProfileSettings(origin: string, profile: ProfileSettingsInput, version: string, idempotencyKey: string, csrfToken: string, fetchImpl: typeof fetch = fetch) {
  const client = createBffClient({ baseUrl: origin, fetch: fetchImpl });
  const result = await client.PUT("/v1/settings/profile", { body: profile, params: { header: { "If-Match": version, "Idempotency-Key": idempotencyKey, "X-Request-Id": crypto.randomUUID(), "X-CSRF-Token": csrfToken } } });
  return required(result, "saveProfile");
}

export async function saveNotificationSettings(origin: string, preferences: NotificationPreferencesInput, version: string, idempotencyKey: string, csrfToken: string, fetchImpl: typeof fetch = fetch) {
  const client = createBffClient({ baseUrl: origin, fetch: fetchImpl });
  const result = await client.PUT("/v1/settings/notification-preferences", { body: preferences, params: { header: { "If-Match": version, "Idempotency-Key": idempotencyKey, "X-Request-Id": crypto.randomUUID(), "X-CSRF-Token": csrfToken } } });
  return required(result, "saveNotificationPrefs");
}

export async function revokeSettingsSession(origin: string, sessionId: string, reauthTokenRef: string, idempotencyKey: string, csrfToken: string, fetchImpl: typeof fetch = fetch) {
  const client = createBffClient({ baseUrl: origin, fetch: fetchImpl });
  const result = await client.DELETE("/v1/settings/sessions/{sessionId}", { params: { path: { sessionId }, header: { "Idempotency-Key": idempotencyKey, "X-Request-Id": crypto.randomUUID(), "X-CSRF-Token": csrfToken, "X-Reauth-Token-Ref": reauthTokenRef } } });
  return required(result, "revokeSession");
}

export async function revokeTrustedDevice(origin: string, deviceId: string, reauthTokenRef: string, idempotencyKey: string, csrfToken: string, fetchImpl: typeof fetch = fetch) {
  const client = createBffClient({ baseUrl: origin, fetch: fetchImpl });
  const result = await client.DELETE("/v1/settings/trusted-devices/{deviceId}", { params: { path: { deviceId }, header: { "Idempotency-Key": idempotencyKey, "X-Request-Id": crypto.randomUUID(), "X-CSRF-Token": csrfToken, "X-Reauth-Token-Ref": reauthTokenRef } } });
  return required(result, "revokeDevice");
}

export async function revokeMfaFactor(origin: string, factorId: string, reauthTokenRef: string, idempotencyKey: string, csrfToken: string, fetchImpl: typeof fetch = fetch) {
  const client = createBffClient({ baseUrl: origin, fetch: fetchImpl });
  const result = await client.DELETE("/v1/settings/mfa/factors/{factorId}", { params: { path: { factorId }, header: { "Idempotency-Key": idempotencyKey, "X-Request-Id": crypto.randomUUID(), "X-CSRF-Token": csrfToken, "X-Reauth-Token-Ref": reauthTokenRef } } });
  return required(result, "revokeMfaFactor");
}
