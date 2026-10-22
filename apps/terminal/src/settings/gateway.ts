import { bffZodSchemas, parseBffResponse, type BffOperationId, type BffRequestOptions, createBffClient } from "@sumalpha/api-client";
import { handleAuthHttpStatus } from "../auth/flow";
import type { NotificationPreferencesInput, ProfileSettingsInput, SettingsBundle } from "./c17";

export class SettingsGatewayError extends Error {
  constructor(
    message: string, readonly operation: string, readonly correlationId?: string,
    readonly status?: number, readonly code?: string, readonly currentVersion?: string,
    readonly retryAfter?: number,
  ) { super(message); this.name = "SettingsGatewayError"; }
}

function required<T>(result: { data?: T; error?: unknown; response: Response }, operation: BffOperationId): T {
  if (result.response.status === 401) handleAuthHttpStatus(401);
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

export async function loadSettingsSnapshot(origin: string, fetchImpl: typeof fetch = fetch, options: BffRequestOptions = {}, section?: SettingsSection) {
  const group = new AbortController();
  const cancel = () => group.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) group.abort();
  const client = createBffClient({ baseUrl: origin, fetch: fetchImpl, ...options, signal: group.signal });
  try {
    const session = required(await client.GET("/v1/session"), "getSession");
    const valid = (s: typeof session) => Date.parse(s.expiresAt) > Date.now() && s.mfaState !== "challenged";
    if (!valid(session)) { handleAuthHttpStatus(401); throw new SettingsGatewayError("会话已失效，请重新登录。", "getSession", undefined, 401); }
    const currentContext = required(await client.GET("/v1/context"), "getContext");
    const context = { ...currentContext, expiresAt: new Date(Math.min(Date.parse(session.expiresAt), Date.parse(currentContext.expiresAt))).toISOString() };
    if (!valid(context)) { handleAuthHttpStatus(401); throw new SettingsGatewayError("会话已失效，请重新登录。", "getContext", undefined, 401); }
    if (context.actorId !== session.actorId || context.tenantId !== session.tenantId || context.workspaceId !== session.workspaceId || context.accountId !== session.accountId || context.mode !== session.mode || !["research", "paper", "shadow"].includes(context.mode) || !context.capabilities.includes("settings.read")) throw new SettingsGatewayError("无法访问此设置。", "getContext", undefined, 403);
    const checked = <T>(promise: Promise<{ data?: T; error?: unknown; response: Response }>, operation: BffOperationId) =>
      promise.then(result => required(result, operation)).catch(error => { group.abort(); throw error; });
    const needed = (name: SettingsSection) => section === undefined || section === name;
    const [profile, notifications, security, sessions, devices, downloads, browserPolicy] = await Promise.all([
      checked(client.GET("/v1/settings/profile"), "getProfile"), needed("notifications") ? checked(client.GET("/v1/settings/notification-preferences"), "getNotificationPrefs") : undefined,
      needed("security") ? checked(client.GET("/v1/settings/security"), "getSecuritySettings") : undefined, needed("security") ? checked(client.GET("/v1/settings/sessions"), "listSessions") : undefined,
      needed("security") ? checked(client.GET("/v1/settings/trusted-devices"), "listDevices") : undefined, needed("browser") ? checked(client.GET("/v1/settings/downloads"), "listDownloads") : undefined,
      needed("browser") || needed("notifications") ? checked(client.GET("/v1/platform/browser-capabilities"), "getPlatformCapabilities") : undefined,
    ]);
    const policy = browserPolicy ? bffZodSchemas.BrowserCapabilityPolicy.strict().parse(browserPolicy) : undefined;
    const history = downloads?.items.map(item => {
      const row = bffZodSchemas.DownloadRecord.strict().parse(item);
      if (row.downloadUrl) throw new Error("History must not retain leases");
      return row;
    });
    if (!valid(context)) { handleAuthHttpStatus(401); throw new SettingsGatewayError("会话已失效，请重新登录。", "getSession", undefined, 401); }
    return { context, loadedAt: new Date().toISOString(), bundle: { profile, notifications, security, sessions, devices, downloads: history, browserPolicy: policy } };
  } finally {
    group.abort();
    options.signal?.removeEventListener("abort", cancel);
  }
}

export async function loadSettingsBundle(origin: string, fetchImpl: typeof fetch = fetch, options: BffRequestOptions = {}): Promise<SettingsBundle> {
  const b = (await loadSettingsSnapshot(origin, fetchImpl, options)).bundle;
  if (!b.notifications || !b.security || !b.sessions || !b.devices || !b.downloads || !b.browserPolicy) throw Error("Incomplete settings aggregate");
  return { profile: b.profile, notifications: b.notifications, security: b.security, sessions: b.sessions, devices: b.devices, downloads: b.downloads, browserPolicy: b.browserPolicy };
}
export function profileDraftInput(value: ProfileSettingsInput): ProfileSettingsInput {
  const keys = ["displayName", "title", "team", "locale", "timezone", "theme", "numberFormat", "timeDisplay", "defaultRoute", "density", "highContrast", "reducedMotion"] as const;
  return Object.fromEntries(keys.filter(k => value[k] !== undefined).map(k => [k, value[k]])) as unknown as ProfileSettingsInput;
}
export function notificationDraftInput(value: NotificationPreferencesInput): NotificationPreferencesInput {
  const { quietHoursEnabled, quietHoursStart, quietHoursEnd, criticalBypass, digestFrequency } = value;
  const rules = value.rules.map(({ key, severity, inApp, desktop, email, browser }) => ({ key, severity, inApp, desktop, email, browser }));
  return { rules, quietHoursEnabled, quietHoursStart, quietHoursEnd, criticalBypass, digestFrequency };
}
export const profileInput = (value: ProfileSettingsInput) => bffZodSchemas.ProfileSettingsInput.parse(profileDraftInput(value));
export const notificationInput = (value: NotificationPreferencesInput) => bffZodSchemas.NotificationPreferencesInput.parse(notificationDraftInput(value));
export type SettingsSection = "profile" | "notifications" | "security" | "browser";
export type SettingsSnapshot = Awaited<ReturnType<typeof loadSettingsSnapshot>>;

export async function saveProfileSettings(origin: string, profile: ProfileSettingsInput, version: string, idempotencyKey: string, csrfToken: string, fetchImpl: typeof fetch = fetch, options: BffRequestOptions = {}) {
  const client = createBffClient({ baseUrl: origin, fetch: fetchImpl, ...options });
  const result = await client.PUT("/v1/settings/profile", { body: profileInput(profile), params: { header: { "If-Match": version, "Idempotency-Key": idempotencyKey, "X-Request-Id": crypto.randomUUID(), "X-CSRF-Token": csrfToken } } });
  return required(result, "saveProfile");
}

export async function saveNotificationSettings(origin: string, preferences: NotificationPreferencesInput, version: string, idempotencyKey: string, csrfToken: string, fetchImpl: typeof fetch = fetch, options: BffRequestOptions = {}) {
  const client = createBffClient({ baseUrl: origin, fetch: fetchImpl, ...options });
  const result = await client.PUT("/v1/settings/notification-preferences", { body: notificationInput(preferences), params: { header: { "If-Match": version, "Idempotency-Key": idempotencyKey, "X-Request-Id": crypto.randomUUID(), "X-CSRF-Token": csrfToken } } });
  return required(result, "saveNotificationPrefs");
}

export async function revokeSettingsSession(origin: string, sessionId: string, reauthTokenRef: string, idempotencyKey: string, csrfToken: string, fetchImpl: typeof fetch = fetch, options: BffRequestOptions = {}) {
  const client = createBffClient({ baseUrl: origin, fetch: fetchImpl, ...options });
  const result = await client.DELETE("/v1/settings/sessions/{sessionId}", { params: { path: { sessionId }, header: { "Idempotency-Key": idempotencyKey, "X-Request-Id": crypto.randomUUID(), "X-CSRF-Token": csrfToken, "X-Reauth-Token-Ref": reauthTokenRef } } });
  return required(result, "revokeSession");
}

export async function revokeTrustedDevice(origin: string, deviceId: string, reauthTokenRef: string, idempotencyKey: string, csrfToken: string, fetchImpl: typeof fetch = fetch, options: BffRequestOptions = {}) {
  const client = createBffClient({ baseUrl: origin, fetch: fetchImpl, ...options });
  const result = await client.DELETE("/v1/settings/trusted-devices/{deviceId}", { params: { path: { deviceId }, header: { "Idempotency-Key": idempotencyKey, "X-Request-Id": crypto.randomUUID(), "X-CSRF-Token": csrfToken, "X-Reauth-Token-Ref": reauthTokenRef } } });
  return required(result, "revokeDevice");
}

export async function revokeMfaFactor(origin: string, factorId: string, reauthTokenRef: string, idempotencyKey: string, csrfToken: string, fetchImpl: typeof fetch = fetch, options: BffRequestOptions = {}) {
  const client = createBffClient({ baseUrl: origin, fetch: fetchImpl, ...options });
  const result = await client.DELETE("/v1/settings/mfa/factors/{factorId}", { params: { path: { factorId }, header: { "Idempotency-Key": idempotencyKey, "X-Request-Id": crypto.randomUUID(), "X-CSRF-Token": csrfToken, "X-Reauth-Token-Ref": reauthTokenRef } } });
  return required(result, "revokeMfaFactor");
}
