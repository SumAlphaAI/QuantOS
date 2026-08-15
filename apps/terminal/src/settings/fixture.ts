import type { SettingsBundle } from "./c17";

export const ui104SettingsFixture: SettingsBundle = {
  profile: { memberId: "member-018", displayName: "Alex Ning", email: "alex.ning@sumalpha.ai", emailVerified: true, title: "Risk Approver", team: "Risk & Governance", roleLabels: ["Risk Approver"], locale: "zh-CN", timezone: "Asia/Shanghai", theme: "dark", numberFormat: "comma_dot", timeDisplay: "utc_local", defaultRoute: "/command", density: "compact", highContrast: false, reducedMotion: false, objectVersion: "profile-v14" },
  notifications: { rules: [
    { key: "critical_risk", severity: "critical", inApp: true, desktop: true, email: true, browser: false }, { key: "approval_expiring", severity: "warning", inApp: true, desktop: true, email: true, browser: false },
    { key: "order_rejected", severity: "warning", inApp: true, desktop: true, email: true, browser: false }, { key: "incident_assigned", severity: "info", inApp: true, desktop: false, email: true, browser: false },
    { key: "research_completed", severity: "info", inApp: true, desktop: false, email: true, browser: false }, { key: "report_ready", severity: "info", inApp: true, desktop: false, email: true, browser: false },
  ], quietHoursEnabled: true, quietHoursStart: "22:00", quietHoursEnd: "07:00", criticalBypass: true, digestFrequency: "daily", objectVersion: "notifications-v7", browserPermission: "default" },
  security: { posture: "strong", score: 92, mfaEnabled: true, recoveryCodesRemaining: 8, lastVerifiedAt: "2026-08-10T10:54:00Z", correlationId: "1af2d9e0-f311-4ce2-8ff9-9ec76d13c311", factors: [
    { factorId: "factor-passkey-current", method: "passkey", label: "MacBook Pro", createdAt: "2026-06-01T04:00:00Z", lastUsedAt: "2026-08-15T03:18:00Z", currentDevice: true },
    { factorId: "factor-authenticator", method: "authenticator", label: "Authenticator app", createdAt: "2026-05-10T04:00:00Z", lastUsedAt: "2026-08-14T09:10:00Z", currentDevice: false },
  ] },
  sessions: [
    { sessionId: "sess-8f3a-current", client: "QuantOS Web", platform: "Chrome · macOS", location: "Shanghai", lastActiveAt: "2026-08-15T03:18:42Z", ipMasked: "203.0.113.xxx", current: true },
    { sessionId: "sess-12de-remote", client: "Chrome 139", platform: "macOS", location: "Shanghai", lastActiveAt: "2026-08-15T01:18:42Z", ipMasked: "203.0.113.xxx", current: false },
    { sessionId: "sess-4c7e-mobile", client: "Safari", platform: "iPhone", location: "Hangzhou", lastActiveAt: "2026-08-13T03:18:42Z", ipMasked: "203.0.113.xxx", current: false },
  ],
  devices: [
    { deviceId: "device-mbp-current", label: "MacBook Pro", verificationMethod: "passkey", trustedUntil: "2026-09-09T00:00:00Z", current: true },
    { deviceId: "device-iphone", label: "iPhone 16", verificationMethod: "biometric", trustedUntil: "2026-08-24T00:00:00Z", current: false },
  ],
  downloads: [
    { downloadId: "export-00917", objectLabel: "Audit export 00917", format: "JSON-CSV", requestedAt: "2026-08-15T00:42:00Z", status: "ready", expiresAt: "2026-08-15T12:42:00Z", downloadUrl: "https://bff.test.invalid/download/short-lived-00917", watermarked: true, correlationId: "7db31ab6-1a22-4d3d-a3da-c9aab07c1f50" },
    { downloadId: "report-20260609", objectLabel: "Performance report", format: "PDF", requestedAt: "2026-08-14T09:23:00Z", status: "downloaded", watermarked: true },
    { downloadId: "snapshot-export-0810", objectLabel: "Snapshot metadata", format: "Parquet", requestedAt: "2026-08-10T02:11:00Z", status: "expired", watermarked: false },
  ],
  browserPolicy: { kind: "web", authFlow: "browser_redirect", notifications: "browser", localFileImport: false, deepLinkScheme: "https://app.sumalpha.ai/auth/callback", downloadsViaBff: true, offlineDomainActions: false, businessPagesNoIndex: true, cspEnforced: true, sessionProtected: true },
};
