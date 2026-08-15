import type { BffComponents, BffOperations } from "@sumalpha/api-client";

export type ProfileSettings = BffComponents["schemas"]["ProfileSettings"];
export type ProfileSettingsInput = BffComponents["schemas"]["ProfileSettingsInput"];
export type NotificationPreferences = BffComponents["schemas"]["NotificationPreferences"];
export type NotificationPreferencesInput = BffComponents["schemas"]["NotificationPreferencesInput"];
export type NotificationRule = BffComponents["schemas"]["NotificationRule"];
export type SecuritySettings = BffComponents["schemas"]["SecuritySettings"];
export type ActiveSession = BffComponents["schemas"]["ActiveSession"];
export type TrustedDevice = BffComponents["schemas"]["TrustedDevice"];
export type DownloadRecord = BffComponents["schemas"]["DownloadRecord"];
export type BrowserCapabilityPolicy = BffComponents["schemas"]["BrowserCapabilityPolicy"];
export type AsyncAccepted = BffComponents["schemas"]["AsyncAccepted"];
export type SaveProfileRequest = BffOperations["saveProfile"]["requestBody"]["content"]["application/json"];
export type SaveNotificationRequest = BffOperations["saveNotificationPrefs"]["requestBody"]["content"]["application/json"];

export interface SettingsBundle {
  profile: ProfileSettings;
  notifications: NotificationPreferences;
  security: SecuritySettings;
  sessions: ActiveSession[];
  devices: TrustedDevice[];
  downloads: DownloadRecord[];
  browserPolicy: BrowserCapabilityPolicy;
}

export type BrowserPermissionState = "granted" | "denied" | "default" | "unsupported";
export interface BrowserRuntimeCapabilities {
  browserLabel: string;
  operatingSystem: string;
  notifications: BrowserPermissionState;
  webSocket: boolean;
  serverSentEvents: boolean;
  clipboard: boolean;
  downloads: boolean;
  serviceWorker: boolean;
  storageEstimate: boolean;
  indexedDb: boolean;
  passkey: boolean;
}

export function canShowHighRiskSettingsAction(viewportWidth: number): boolean {
  return viewportWidth >= 768;
}

export function canRevokeSession(session: ActiveSession, input: { online: boolean; viewportWidth: number }): boolean {
  return !session.current && input.online && canShowHighRiskSettingsAction(input.viewportWidth);
}

export function canRevokeDevice(input: { online: boolean; viewportWidth: number; factorCount: number }): boolean {
  return input.online && canShowHighRiskSettingsAction(input.viewportWidth) && input.factorCount > 1;
}

export function notificationFallback(permission: BrowserPermissionState): "browser" | "in_app_only" {
  return permission === "granted" ? "browser" : "in_app_only";
}

export function downloadAvailability(record: DownloadRecord, nowIso: string): { available: boolean; reason: string } {
  if (record.status !== "ready") return { available: false, reason: record.status === "expired" ? "下载链接已过期，请重新生成。" : "文件尚未准备完成。" };
  if (!record.downloadUrl || !record.expiresAt || record.expiresAt <= nowIso) return { available: false, reason: "短时下载链接不可用或已过期。" };
  return { available: true, reason: "下载通过 BFF 短时签名链接提供，并记录审计。" };
}

export function detectBrowserRuntime(scope: Window & typeof globalThis): BrowserRuntimeCapabilities {
  const userAgent = scope.navigator.userAgent;
  const chrome = userAgent.match(/(?:Chrome|CriOS)\/(\d+)/)?.[1];
  const safari = !chrome && userAgent.match(/Version\/(\d+).+Safari/)?.[1];
  const firefox = userAgent.match(/Firefox\/(\d+)/)?.[1];
  return {
    browserLabel: chrome ? `Chrome ${chrome}` : firefox ? `Firefox ${firefox}` : safari ? `Safari ${safari}` : "Unknown / upgrade required",
    operatingSystem: /Mac/.test(userAgent) ? "macOS" : /Win/.test(userAgent) ? "Windows" : /Linux/.test(userAgent) ? "Linux" : "Unknown",
    notifications: !("Notification" in scope) ? "unsupported" : scope.Notification.permission,
    webSocket: "WebSocket" in scope,
    serverSentEvents: "EventSource" in scope,
    clipboard: Boolean(scope.navigator.clipboard),
    downloads: "download" in scope.document.createElement("a"),
    serviceWorker: "serviceWorker" in scope.navigator,
    storageEstimate: Boolean(scope.navigator.storage?.estimate),
    indexedDb: "indexedDB" in scope,
    passkey: "PublicKeyCredential" in scope,
  };
}
