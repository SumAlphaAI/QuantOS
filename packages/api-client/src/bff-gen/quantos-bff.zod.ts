/* eslint-disable */
// Generated from bff/openapi/quantos-bff.v1.yaml (1.21.0). Do not edit.
import { z } from "zod";

export const AssistedNativeCapabilitiesSchema = z.object({
  "schemaVersion": z.literal("quantos-assisted-testnet-capabilities.v1"),
  "actorId": z.lazy(() => UUIDSchema),
  "tenantId": z.lazy(() => UUIDSchema),
  "workspaceId": z.lazy(() => UUIDSchema),
  "accountId": z.lazy(() => UUIDSchema),
  "mode": z.enum(["paper","shadow","assisted_live"]),
  "serverFlagEnabled": z.boolean(),
  "targetEnabled": z.boolean(),
  "canRequest": z.boolean(),
  "canApprove": z.boolean(),
  "executionAuthority": z.literal(false),
  "policyRevision": z.number().int().min(1),
  "policyVersion": z.literal("core-l03-local.v1"),
  "checkedAt": z.string().datetime({ offset: true }),
  "expiresAt": z.string().datetime({ offset: true }),
  "reconciliationReaderEnabled": z.boolean().optional(),
}).strict();

export const AssistedSubjectSchema = z.object({
  "subjectId": z.lazy(() => UUIDSchema),
  "subjectHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "proposalHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "decisionId": z.lazy(() => UUIDSchema),
  "originator": z.lazy(() => UUIDSchema),
  "accountId": z.lazy(() => UUIDSchema),
  "symbol": z.string().min(1).max(20),
  "side": z.enum(["buy","sell"]),
  "quantity": z.lazy(() => DecimalValueSchema),
  "limitPrice": z.lazy(() => DecimalValueSchema),
  "expiresAt": z.string().datetime({ offset: true }),
}).strict();

export const AssistedApprovalRequestSchema = z.object({
  "requesterId": z.lazy(() => UUIDSchema),
  "requestId": z.lazy(() => UUIDSchema),
  "subjectId": z.lazy(() => UUIDSchema),
  "subjectHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "policyVersion": z.string().min(1).max(20),
  "revision": z.number().int().min(0).max(2),
  "status": z.enum(["pending","awaiting_second","approved"]),
  "approvers": z.array(z.lazy(() => UUIDSchema)).max(2),
  "expiresAt": z.string().datetime({ offset: true }),
  "notional": z.lazy(() => DecimalValueSchema),
  "executionAuthority": z.literal(false),
}).strict();

export const AssistedNativeOrderSchema = z.object({
  "orderId": z.string().min(1).max(128),
  "commandId": z.lazy(() => UUIDSchema),
  "accountId": z.lazy(() => UUIDSchema),
  "symbol": z.string().min(1).max(20),
  "side": z.enum(["buy","sell"]),
  "quantity": z.lazy(() => DecimalValueSchema),
  "filledQuantity": z.lazy(() => DecimalValueSchema),
  "status": z.string().min(1).max(32),
}).strict();

export const AssistedNativeCommandSchema = z.object({
  "requestId": z.lazy(() => UUIDSchema),
  "subjectHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "commandId": z.lazy(() => UUIDSchema),
  "expiresAt": z.string().datetime({ offset: true }),
  "state": z.enum(["accepted","unknown"]),
  "signature": z.string().regex(new RegExp("^[a-f0-9]{64}$")),
  "order": z.lazy(() => AssistedNativeOrderSchema).optional(),
}).strict();

export const AssistedObservedOrderSchema = z.object({
  "orderId": z.string().min(1).max(128),
  "commandId": z.lazy(() => UUIDSchema),
  "accountId": z.lazy(() => UUIDSchema),
  "symbol": z.string().min(1).max(20),
  "side": z.enum(["buy","sell"]),
  "quantity": z.lazy(() => DecimalValueSchema),
  "filledQuantity": z.lazy(() => DecimalValueSchema),
  "averageFillPrice": z.union([z.lazy(() => DecimalValueSchema), z.null()]),
  "status": z.string().min(1).max(32),
  "submittedAt": z.lazy(() => DateTimeSchema),
  "updatedAt": z.lazy(() => DateTimeSchema),
}).strict();

export const AssistedObservedFillSchema = z.object({
  "fillId": z.string().min(1).max(128),
  "orderId": z.string().min(1).max(128),
  "commandId": z.lazy(() => UUIDSchema),
  "accountId": z.lazy(() => UUIDSchema),
  "symbol": z.string().min(1).max(20),
  "side": z.enum(["buy","sell"]),
  "quantity": z.lazy(() => DecimalValueSchema),
  "price": z.lazy(() => DecimalValueSchema),
  "feeCurrency": z.string().min(1).max(20),
  "feeAmount": z.lazy(() => DecimalValueSchema),
  "filledAt": z.lazy(() => DateTimeSchema),
  "factHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
}).strict();

export const AssistedExecutionFactsSchema = z.object({
  "schemaVersion": z.literal("quantos-native-execution-facts.v1"),
  "requestId": z.lazy(() => UUIDSchema),
  "subjectHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "tenantId": z.lazy(() => UUIDSchema),
  "workspaceId": z.lazy(() => UUIDSchema),
  "accountId": z.lazy(() => UUIDSchema),
  "commandId": z.lazy(() => UUIDSchema),
  "decisionId": z.lazy(() => UUIDSchema),
  "proposalHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "quoteCurrency": z.literal("USDT"),
  "outcome": z.enum(["accepted","unknown"]),
  "journalAvailable": z.boolean(),
  "consumerReady": z.boolean(),
  "reason": z.enum(["OBSERVED_NATIVE_FACTS","OUTCOME_UNRESOLVED","JOURNAL_UNAVAILABLE","FEE_CONVERSION_REQUIRED"]),
  "order": z.union([z.lazy(() => AssistedObservedOrderSchema), z.null()]),
  "fills": z.array(z.lazy(() => AssistedObservedFillSchema)).max(10000),
  "factHashes": z.array(z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$"))).max(20002),
  "nativeSourceHashes": z.array(z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$"))).max(20002),
  "sourceHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "recordedAt": z.lazy(() => DateTimeSchema),
  "executionAuthority": z.literal(false),
}).strict();

export const AssistedRequestViewSchema = z.object({
  "request": z.lazy(() => AssistedApprovalRequestSchema),
  "subject": z.lazy(() => AssistedSubjectSchema),
  "command": z.lazy(() => AssistedNativeCommandSchema).optional(),
  "facts": z.lazy(() => AssistedExecutionFactsSchema).optional(),
  "ledger": z.lazy(() => AssistedLedgerReceiptSchema).optional(),
}).strict();

export const AssistedSubjectListSchema = z.object({
  "items": z.array(z.lazy(() => AssistedSubjectSchema)).max(50),
}).strict();

export const AssistedRequestListSchema = z.object({
  "items": z.array(z.lazy(() => AssistedRequestViewSchema)).max(200),
}).strict();

export const AssistedApprovalAuditSchema = z.object({
  "items": z.array(z.object({
  "sequence": z.number().int().min(1),
  "requestId": z.lazy(() => UUIDSchema),
  "subjectHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "actorId": z.lazy(() => UUIDSchema),
  "userId": z.lazy(() => UUIDSchema),
  "slot": z.union([z.literal(1), z.literal(2)]),
  "signature": z.string().regex(new RegExp("^[a-f0-9]{64}$")),
}).strict()).max(2),
  "verified": z.literal(true),
  "nativeSubmissions": z.number().int().min(0),
}).strict();

export const OpenAssistedRequestSchema = z.object({
  "subjectId": z.lazy(() => UUIDSchema),
}).strict();

export const ApproveAssistedRequestSchema = z.object({
  "expectedRevision": z.number().int().min(0).max(1),
  "mfaChallengeRef": z.string().min(1).max(128),
  "reauthTokenRef": z.string().min(1).max(128),
}).strict();

export const SubmitAssistedRequestSchema = z.object({
  "expectedRevision": z.literal(2),
}).strict();

export const UUIDSchema = z.string().uuid();

export const DateTimeSchema = z.string().datetime({ offset: true }).describe("RFC 3339 UTC");

export const DecimalValueSchema = z.string().regex(new RegExp("^-?\\d+(\\.\\d+)?$")).describe("十进制定点字符串（proto DecimalValue.value；禁 IEEE-754 交易计算）");

export const MoneyValueSchema = z.object({
  "currencyCode": z.string().regex(new RegExp("^[A-Z]{3}$")),
  "units": z.string(),
  "nanos": z.number().int().min(-999999999).max(999999999),
}).passthrough();

export const RuntimeModeSchema = z.enum(["research","paper","shadow","assisted_live"]).describe("assisted_live 仅 M5+ 且服务端 flag/capability 放行才可见；客户端不得硬编码可用性");

export const EnvironmentSchema = z.enum(["dev","staging","prod"]);

export const DataQualitySchema = z.enum(["verified","provisional","degraded","failed","expired","license_missing"]).describe("未知值客户端显示\"未知/需升级\"并阻断高风险动作");

export const TaskStatusSchema = z.enum(["queued","running","succeeded","failed","cancelled","cancel_requested"]);

export const OrderStatusSchema = z.enum(["draft","risk_checking","awaiting_approval","command_ready","submitted","accepted","partially_filled","filled","cancelled","rejected","expired"]);

export const TimeWindowSchema = z.object({
  "start": z.lazy(() => DateTimeSchema),
  "end": z.lazy(() => DateTimeSchema),
}).passthrough();

export const ErrorEnvelopeSchema = z.object({
  "code": z.string().describe("稳定机器码，如 FORBIDDEN/VERSION_CONFLICT/COMMAND_EXPIRED/DATA_STALE"),
  "message": z.string().describe("安全可展示文案（i18n key 由客户端映射）"),
  "correlationId": z.lazy(() => UUIDSchema),
  "fieldErrors": z.record(z.string(), z.string()).optional(),
  "retryAfter": z.number().int().min(0).describe("秒").optional(),
  "currentVersion": z.string().describe("409 时返回，供客户端 diff").optional(),
  "conflictDiff": z.object({
  "files": z.record(z.string(), z.string()),
  "parameters": z.object({

}).passthrough(),
}).strict().optional(),
}).strict();

export const PageSchema = z.object({
  "items": z.array(z.unknown()),
  "nextCursor": z.string().describe("缺省表示末页").optional(),
}).passthrough();

export const AsyncAcceptedSchema = z.object({
  "jobId": z.lazy(() => UUIDSchema),
  "status": z.enum(["accepted","cancel_requested"]),
  "correlationId": z.lazy(() => UUIDSchema),
  "auditRef": z.lazy(() => UUIDSchema).optional(),
}).passthrough();

export const AuditedAsyncAcceptedSchema = z.intersection(z.lazy(() => AsyncAcceptedSchema), z.object({
  "auditRef": z.lazy(() => UUIDSchema),
  "mfaEnrollment": z.lazy(() => MfaEnrollmentSchema).optional(),
}).passthrough());

export const MfaEnrollmentSchema = z.object({
  "factorRef": z.lazy(() => UUIDSchema),
  "delivery": z.enum(["one_time","restart_required"]),
  "uri": z.string().describe("One-time otpauth enrollment URI for the authenticated user only; never persist, log, cache or send to analytics. Idempotent job replay omits this material.").optional(),
}).strict();

export const ReauthRequestSchema = z.object({
  "challengeRef": z.lazy(() => UUIDSchema),
}).strict();

export const StreamEventSchema = z.object({
  "streamId": z.lazy(() => UUIDSchema),
  "sequence": z.number().int().min(1),
  "eventId": z.lazy(() => UUIDSchema),
  "occurredAt": z.lazy(() => DateTimeSchema),
  "correlationId": z.lazy(() => UUIDSchema),
  "payloadVersion": z.enum(["v1","1"]).describe("Canonical v1; legacy 1 remains supported during the 1.4.0 migration window. Other versions fail closed."),
  "payload": z.object({

}).passthrough().describe("领域事件载荷；payload.type=permission_revoked 为终态语义"),
}).passthrough();

export const SessionContextSchema = z.object({
  "actorId": z.lazy(() => UUIDSchema),
  "tenantId": z.lazy(() => UUIDSchema),
  "workspaceId": z.lazy(() => UUIDSchema),
  "accountId": z.lazy(() => UUIDSchema),
  "mode": z.lazy(() => RuntimeModeSchema),
  "environment": z.lazy(() => EnvironmentSchema),
  "capabilities": z.array(z.string()).describe("capability key 全集（权限裁剪唯一来源）"),
  "mfaState": z.enum(["unenrolled","enrolled","challenged","verified"]),
  "expiresAt": z.lazy(() => DateTimeSchema),
}).passthrough();

export const ProfileSettingsInputSchema = z.object({
  "displayName": z.string().min(1).max(80),
  "title": z.string().max(120).optional(),
  "team": z.string().max(120).optional(),
  "locale": z.enum(["zh-CN","en"]),
  "timezone": z.string().describe("IANA timezone"),
  "theme": z.enum(["system","dark","light"]),
  "numberFormat": z.enum(["comma_dot","space_comma"]),
  "timeDisplay": z.enum(["utc_local","local"]),
  "defaultRoute": z.enum(["/command","/research","/portfolio","/markets"]),
  "density": z.enum(["compact","comfortable"]),
  "highContrast": z.boolean(),
  "reducedMotion": z.boolean(),
}).passthrough();

export const ProfileSettingsSchema = z.intersection(z.lazy(() => ProfileSettingsInputSchema), z.object({
  "memberId": z.string(),
  "email": z.string().email(),
  "emailVerified": z.boolean(),
  "roleLabels": z.array(z.string()),
  "objectVersion": z.string(),
}).passthrough());

export const NotificationRuleSchema = z.object({
  "key": z.string(),
  "severity": z.enum(["critical","warning","info"]),
  "inApp": z.boolean(),
  "desktop": z.boolean(),
  "email": z.boolean(),
  "browser": z.boolean(),
}).passthrough();

export const NotificationPreferencesInputSchema = z.object({
  "rules": z.array(z.lazy(() => NotificationRuleSchema)),
  "quietHoursEnabled": z.boolean(),
  "quietHoursStart": z.string().regex(new RegExp("^([01]\\d|2[0-3]):[0-5]\\d$")),
  "quietHoursEnd": z.string().regex(new RegExp("^([01]\\d|2[0-3]):[0-5]\\d$")),
  "criticalBypass": z.boolean().describe("Critical 可绕过静默但仍受服务端授权策略约束"),
  "digestFrequency": z.enum(["off","daily","weekly"]),
}).passthrough();

export const NotificationPreferencesSchema = z.intersection(z.lazy(() => NotificationPreferencesInputSchema), z.object({
  "objectVersion": z.string(),
  "browserPermission": z.enum(["granted","denied","default","unsupported"]),
}).passthrough());

export const MfaFactorSchema = z.object({
  "factorId": z.string(),
  "method": z.enum(["passkey","authenticator","recovery_codes"]),
  "label": z.string(),
  "createdAt": z.lazy(() => DateTimeSchema),
  "lastUsedAt": z.lazy(() => DateTimeSchema),
  "currentDevice": z.boolean(),
}).passthrough();

export const SecuritySettingsSchema = z.object({
  "availableMfaMethods": z.array(z.enum(["authenticator","passkey"])).describe("Server-enabled enrollment methods. WebAuthn requires a separately enabled provider capability; unavailable methods fail closed.").optional(),
  "firstFactorSetupRef": z.lazy(() => UUIDSchema).optional(),
  "posture": z.enum(["strong","attention_required","unknown"]),
  "score": z.number().int().min(0).max(100),
  "mfaEnabled": z.boolean(),
  "factors": z.array(z.lazy(() => MfaFactorSchema)),
  "recoveryCodesRemaining": z.number().int().min(0),
  "lastVerifiedAt": z.lazy(() => DateTimeSchema),
  "correlationId": z.lazy(() => UUIDSchema),
}).passthrough();

export const ActiveSessionSchema = z.object({
  "sessionId": z.string(),
  "client": z.string(),
  "platform": z.string(),
  "location": z.string(),
  "lastActiveAt": z.lazy(() => DateTimeSchema),
  "ipMasked": z.string().describe("仅脱敏 IP，禁止返回完整地址"),
  "current": z.boolean(),
}).passthrough();

export const TrustedDeviceSchema = z.object({
  "deviceId": z.string(),
  "label": z.string(),
  "verificationMethod": z.enum(["passkey","biometric","authenticator"]),
  "trustedUntil": z.lazy(() => DateTimeSchema),
  "current": z.boolean(),
}).passthrough();

export const DownloadRecordSchema = z.object({
  "downloadId": z.string(),
  "objectLabel": z.string(),
  "format": z.string(),
  "requestedAt": z.lazy(() => DateTimeSchema),
  "status": z.enum(["preparing","ready","downloaded","expired","failed"]),
  "expiresAt": z.lazy(() => DateTimeSchema).optional(),
  "downloadUrl": z.string().url().describe("BFF 短时签名 URL；不得写入日志或持久化").optional(),
  "watermarked": z.boolean().optional(),
  "correlationId": z.lazy(() => UUIDSchema).optional(),
  "downloadPath": z.string().regex(new RegExp("^/v1/exports/[0-9a-fA-F-]{36}/download$")).describe("Metadata-only action path. Obtain a fresh current-session short-lived link from the export owner. History never stores or returns a bearer URL; expiresAt is artifact retention, not a minted URL lifetime.").optional(),
}).passthrough();

export const BrowserCapabilityPolicySchema = z.object({
  "kind": z.literal("web"),
  "authFlow": z.literal("browser_redirect"),
  "notifications": z.literal("browser"),
  "localFileImport": z.literal(false),
  "deepLinkScheme": z.string().url(),
  "downloadsViaBff": z.literal(true),
  "offlineDomainActions": z.literal(false),
  "businessPagesNoIndex": z.literal(true),
  "cspEnforced": z.boolean(),
  "sessionProtected": z.boolean(),
  "permissionState": z.object({
  "notifications": z.literal("unknown"),
  "clipboard": z.literal("unknown"),
  "authority": z.literal("browser_runtime"),
  "requestedByServer": z.literal(false),
}).passthrough().describe("Server cannot observe browser-native permission. Browser runtime detection is local and may only narrow this policy; this GET never prompts.").optional(),
  "fallbacks": z.array(z.enum(["notification_in_app","clipboard_manual","download_retry","online_only"])).max(4).optional(),
  "downloadLinkTtlSeconds": z.literal(300).optional(),
  "downloadHistoryIncludesLinks": z.literal(false).optional(),
}).passthrough();

export const AuditEventSchema = z.object({
  "eventId": z.lazy(() => UUIDSchema),
  "correlationId": z.lazy(() => UUIDSchema),
  "causationId": z.lazy(() => UUIDSchema).optional(),
  "sequence": z.number().int().min(1),
  "kind": z.string(),
  "actor": z.string().describe("已脱敏的 actor 显示名或服务主体"),
  "objectRef": z.string(),
  "occurredAt": z.lazy(() => DateTimeSchema),
  "redactionApplied": z.literal(true),
  "redactedPayload": z.object({

}).passthrough().describe("只允许服务端脱敏后输出；密钥、token、完整账户标识禁止出现"),
  "payloadHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "retentionUntil": z.lazy(() => DateTimeSchema),
}).passthrough();

export const AuditEventPageSchema = z.intersection(z.lazy(() => PageSchema), z.object({
  "items": z.array(z.lazy(() => AuditEventSchema)),
}).passthrough());

export const EvidenceNodeSchema = z.object({
  "eventId": z.lazy(() => UUIDSchema),
  "causationId": z.lazy(() => UUIDSchema).optional(),
  "sequence": z.number().int().min(1),
  "kind": z.string(),
  "objectRef": z.string(),
  "occurredAt": z.lazy(() => DateTimeSchema),
  "payloadHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "route": z.string().regex(new RegExp("^/")).describe("只含资源引用，不含 token"),
  "retentionUntil": z.lazy(() => DateTimeSchema),
}).passthrough();

export const EvidenceChainPageSchema = z.object({
  "correlationId": z.lazy(() => UUIDSchema),
  "items": z.array(z.lazy(() => EvidenceNodeSchema)),
  "nextCursor": z.string().optional(),
  "complete": z.boolean().describe("true 仅表示当前授权范围内证据链完整"),
}).passthrough();

export const ExportScopeSchema = z.object({
  "correlationIds": z.array(z.lazy(() => UUIDSchema)).min(1).max(100),
  "eventKinds": z.array(z.string()).max(50).optional(),
  "startAt": z.lazy(() => DateTimeSchema).optional(),
  "endAt": z.lazy(() => DateTimeSchema).optional(),
}).strict();

export const ExportRequestSchema = z.object({
  "scope": z.lazy(() => ExportScopeSchema),
  "format": z.enum(["jsonl","csv","pdf"]),
  "reason": z.string().min(8).max(500),
  "watermark": z.string().min(3).max(120),
  "retentionDays": z.number().int().min(1).max(30),
}).strict();

export const ExportJobSchema = z.object({
  "exportId": z.lazy(() => UUIDSchema),
  "status": z.enum(["queued","generating","ready","cancel_requested","cancelled","expired","failed"]),
  "format": z.enum(["jsonl","csv","pdf"]),
  "requestedBy": z.string(),
  "requestedAt": z.lazy(() => DateTimeSchema),
  "completedAt": z.lazy(() => DateTimeSchema).optional(),
  "watermark": z.string(),
  "retentionUntil": z.lazy(() => DateTimeSchema),
  "correlationId": z.lazy(() => UUIDSchema),
  "auditRef": z.lazy(() => UUIDSchema),
}).passthrough();

export const ExportDownloadMetadataSchema = z.object({
  "exportId": z.lazy(() => UUIDSchema),
  "downloadUrl": z.string().url().regex(new RegExp("^https://[^/?#@\\s\\\\]+/_bff/export-content/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{64}$")).max(2048).describe("C10/C17 封闭内容 origin：必须与浏览器配置的 BFF API HTTPS origin 相同； 服务端仅使用 QUANTOS_BFF_PUBLIC_ORIGIN，不使用 Terminal origin、Host 或 Forwarded。 路径含 opaque ticket（不是 exportId）及 HMAC-SHA256，无 userinfo/query/fragment； 有效期为 min(当前会话期限, retentionUntil, 签发时刻+300秒)。 GET 内容端点重新校验当前身份、权限与资源范围，原子一次性消费；失败后须由用户重新申请租约。 API 与 /_bff/export-content 均须代理到同一 BFF，内容为 no-store/nosniff/attachment/no-referrer； 禁止写入日志、历史、遥测或持久化。"),
  "expiresAt": z.lazy(() => DateTimeSchema),
  "sha256": z.string().regex(new RegExp("^[a-f0-9]{64}$")),
  "sizeBytes": z.number().int().min(1),
  "mediaType": z.string(),
  "watermarked": z.literal(true),
  "retentionUntil": z.lazy(() => DateTimeSchema),
  "auditRef": z.lazy(() => UUIDSchema),
}).passthrough();

export const ResearchRunSchema = z.object({
  "runId": z.lazy(() => UUIDSchema),
  "capability": z.string(),
  "dataSnapshotId": z.lazy(() => UUIDSchema),
  "budget": z.lazy(() => DecimalValueSchema),
  "costUnits": z.lazy(() => DecimalValueSchema).optional(),
  "deadlineAt": z.lazy(() => DateTimeSchema),
  "status": z.lazy(() => TaskStatusSchema),
  "inputHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "engineVersion": z.string(),
  "artifactRefs": z.array(z.lazy(() => UUIDSchema)).optional(),
  "evidenceRefs": z.array(z.lazy(() => UUIDSchema)),
  "correlationId": z.lazy(() => UUIDSchema),
  "createdAt": z.lazy(() => DateTimeSchema),
  "auditRef": z.lazy(() => UUIDSchema).optional(),
}).passthrough();

export const DataSnapshotSchema = z.object({
  "snapshotId": z.lazy(() => UUIDSchema),
  "schemaVersion": z.string(),
  "window": z.lazy(() => TimeWindowSchema),
  "sources": z.array(z.string()).min(1),
  "quality": z.lazy(() => DataQualitySchema),
  "qualityBlocked": z.boolean().describe("质量受限阻断标识（服务端权威，前端不可覆盖）").optional(),
  "contentHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "licenseLabel": z.string().min(1),
  "capturedAt": z.lazy(() => DateTimeSchema),
  "maxAgeSeconds": z.number().int().min(0),
  "auditRef": z.lazy(() => UUIDSchema).optional(),
}).passthrough();

export const ArtifactSchema = z.object({
  "artifactId": z.lazy(() => UUIDSchema),
  "hypothesis": z.string(),
  "summary": z.string(),
  "engineVersion": z.string(),
  "promptVersion": z.string(),
  "codeVersion": z.string(),
  "environmentHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "dataSnapshotId": z.lazy(() => UUIDSchema),
  "contentHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "lineageRefs": z.array(z.lazy(() => UUIDSchema)).optional(),
  "createdAt": z.lazy(() => DateTimeSchema),
  "auditRef": z.lazy(() => UUIDSchema).optional(),
}).passthrough();

export const StrategySummarySchema = z.object({
  "strategyId": z.lazy(() => UUIDSchema),
  "name": z.string(),
  "updatedAt": z.lazy(() => DateTimeSchema),
}).passthrough();

export const StrategyDraftSchema = z.object({
  "strategyId": z.lazy(() => UUIDSchema),
  "objectVersion": z.string(),
  "files": z.record(z.string(), z.string()),
  "parameters": z.object({

}).passthrough(),
  "updatedAt": z.lazy(() => DateTimeSchema),
  "dataSnapshotId": z.lazy(() => UUIDSchema).optional(),
  "artifactRefs": z.array(z.object({

}).passthrough()).optional(),
}).passthrough();

export const BacktestReportSchema = z.object({
  "runId": z.lazy(() => UUIDSchema),
  "strategyId": z.lazy(() => UUIDSchema),
  "dataSnapshotId": z.lazy(() => UUIDSchema),
  "status": z.lazy(() => TaskStatusSchema),
  "metrics": z.record(z.string(), z.lazy(() => DecimalValueSchema)),
  "leakViolations": z.array(z.string()).describe("泄漏检查失败规则码（非空阻断 Release）"),
  "reportArtifactId": z.lazy(() => UUIDSchema),
  "objectVersion": z.string().optional(),
  "reportHash": z.string().optional(),
}).passthrough();

export const StrategyReleaseSchema = z.object({
  "releaseId": z.lazy(() => UUIDSchema),
  "strategyId": z.lazy(() => UUIDSchema),
  "backtestReportArtifactId": z.lazy(() => UUIDSchema),
  "sourceDigest": z.string(),
  "imageDigest": z.string(),
  "parameterHash": z.string(),
  "parameters": z.object({

}).passthrough(),
  "snapshotId": z.lazy(() => UUIDSchema),
  "allowedTargets": z.array(z.enum(["paper","shadow","assisted_live"])).describe("服务端权威；M3/M4 仅 paper/shadow；assisted_live 出现需 flag 放行"),
  "approvalState": z.enum(["none","pending","approved","rejected","expired"]),
  "createdAt": z.lazy(() => DateTimeSchema),
  "objectVersion": z.string().optional(),
  "contentHash": z.string().optional(),
  "expiresAt": z.lazy(() => DateTimeSchema).optional(),
  "approvalTimeline": z.array(z.object({

}).passthrough()).optional(),
}).passthrough();

export const PositionSchema = z.object({
  "symbol": z.string(),
  "side": z.enum(["long","short"]),
  "quantity": z.lazy(() => DecimalValueSchema),
  "avgPrice": z.lazy(() => DecimalValueSchema),
}).passthrough();

export const PortfolioViewSchema = z.object({
  "accountId": z.lazy(() => UUIDSchema),
  "asOf": z.lazy(() => DateTimeSchema),
  "stale": z.boolean().describe("true 时命令类操作由服务端拒绝"),
  "positions": z.array(z.lazy(() => PositionSchema)),
  "pnl": z.lazy(() => MoneyValueSchema),
  "exposure": z.lazy(() => DecimalValueSchema),
}).passthrough();

export const RiskViewSchema = z.object({
  "accountId": z.lazy(() => UUIDSchema),
  "asOf": z.lazy(() => DateTimeSchema),
  "hitRules": z.array(z.string()),
  "limitIds": z.array(z.lazy(() => UUIDSchema)),
  "killSwitch": z.object({
  "state": z.enum(["disengaged","engaged"]),
  "actor": z.string().optional(),
  "at": z.lazy(() => DateTimeSchema).optional(),
}).passthrough(),
  "correlationId": z.lazy(() => UUIDSchema).optional(),
  "objectVersion": z.string().optional(),
  "auditRef": z.lazy(() => UUIDSchema).optional(),
}).passthrough();

export const SignalSchema = z.object({
  "signalId": z.lazy(() => UUIDSchema),
  "strategyReleaseId": z.lazy(() => UUIDSchema),
  "symbol": z.string(),
  "direction": z.enum(["long","short","flat"]),
  "strength": z.lazy(() => DecimalValueSchema),
  "confidence": z.lazy(() => DecimalValueSchema),
  "generatedAt": z.lazy(() => DateTimeSchema),
  "validUntil": z.lazy(() => DateTimeSchema),
}).passthrough();

export const TradeProposalSchema = z.object({
  "proposalId": z.lazy(() => UUIDSchema),
  "accountId": z.lazy(() => UUIDSchema),
  "symbol": z.string(),
  "action": z.enum(["buy","sell","reduce","close"]),
  "quantity": z.lazy(() => DecimalValueSchema),
  "notional": z.lazy(() => DecimalValueSchema),
  "signal": z.lazy(() => SignalSchema),
  "rationale": z.string(),
  "counterViews": z.array(z.string()).min(1).describe("反方观点（R04 强制；proto trading.v1.TradeProposal.counter_views）"),
  "evidenceRefs": z.array(z.lazy(() => UUIDSchema)),
  "confidence": z.lazy(() => DecimalValueSchema),
  "expiresAt": z.lazy(() => DateTimeSchema),
  "executable": z.literal(false).describe("恒 false（A02；schema 层强制）"),
  "objectVersion": z.string(),
  "status": z.enum(["active","awaiting_approval","approved","command_ready","request_info","rejected","expired","submitted"]).optional(),
  "correlationId": z.lazy(() => UUIDSchema).optional(),
}).passthrough();

export const ApprovalRuleCheckSchema = z.object({
  "rule": z.string(),
  "breached": z.boolean(),
  "limitId": z.string(),
}).strict();

export const ApprovalRiskDecisionSchema = z.object({
  "decisionId": z.lazy(() => UUIDSchema),
  "proposalId": z.lazy(() => UUIDSchema),
  "accountId": z.lazy(() => UUIDSchema),
  "mode": z.enum(["paper","shadow"]),
  "verdict": z.enum(["allow","deny","approval_required"]),
  "checks": z.array(z.lazy(() => ApprovalRuleCheckSchema)),
  "policyVersion": z.string(),
  "policyRevision": z.string(),
  "signer": z.string(),
  "signatureVerifiedByOwner": z.boolean(),
  "snapshotHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "factsHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "intentHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "contextHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "decidedAt": z.lazy(() => DateTimeSchema),
  "expiresAt": z.lazy(() => DateTimeSchema),
  "issuable": z.literal(false),
}).strict();

export const ApprovalCurrentRiskSchema = z.object({
  "contextHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "asOf": z.lazy(() => DateTimeSchema),
  "expiresAt": z.lazy(() => DateTimeSchema),
  "verdict": z.enum(["allow","deny","approval_required"]),
  "checks": z.array(z.lazy(() => ApprovalRuleCheckSchema)),
  "policyVersion": z.string(),
  "policyRevision": z.string(),
}).strict();

export const ApprovalImpactSchema = z.object({
  "quoteUnit": z.string(),
  "equity": z.lazy(() => DecimalValueSchema),
  "grossBefore": z.lazy(() => DecimalValueSchema),
  "grossAfter": z.lazy(() => DecimalValueSchema),
  "symbolBefore": z.lazy(() => DecimalValueSchema),
  "symbolAfter": z.lazy(() => DecimalValueSchema),
  "portfolioAsOf": z.lazy(() => DateTimeSchema),
  "financialAsOf": z.lazy(() => DateTimeSchema),
  "venue": z.string(),
  "venueHealthy": z.boolean(),
  "maxOrderNotional": z.lazy(() => DecimalValueSchema),
  "maxLeverage": z.lazy(() => DecimalValueSchema),
  "maxConcentration": z.lazy(() => DecimalValueSchema),
  "approvalThreshold": z.lazy(() => DecimalValueSchema),
  "maxDailyLoss": z.lazy(() => DecimalValueSchema),
  "model": z.literal("x02_conservative_gross_addition"),
}).strict();

export const ApprovalReviewContextSchema = z.object({
  "accountId": z.lazy(() => UUIDSchema),
  "mode": z.enum(["paper","shadow"]),
  "proposal": z.lazy(() => TradeProposalSchema),
  "riskDecision": z.lazy(() => ApprovalRiskDecisionSchema),
  "currentRisk": z.lazy(() => ApprovalCurrentRiskSchema),
  "impact": z.lazy(() => ApprovalImpactSchema),
}).strict();

export const ApprovalSchema = z.object({
  "reviewContext": z.lazy(() => ApprovalReviewContextSchema).optional(),
  "approvalId": z.lazy(() => UUIDSchema),
  "originator": z.string().describe("发起人 actorId（禁自批判定）"),
  "objectVersion": z.string(),
  "status": z.enum(["pending","approved","rejected","expired","conflict"]),
  "expiresAt": z.lazy(() => DateTimeSchema),
  "signature": z.string().describe("批准后服务端签名").optional(),
  "commandRef": z.lazy(() => UUIDSchema).optional(),
  "correlationId": z.lazy(() => UUIDSchema),
  "commandExpiresAt": z.lazy(() => DateTimeSchema).optional(),
  "issuanceState": z.enum(["not_issued","consumed"]).optional(),
  "decision": z.enum(["approve","reject","request_info"]).optional(),
  "auditRef": z.lazy(() => UUIDSchema).optional(),
  "kind": z.string().optional(),
  "objectRef": z.lazy(() => UUIDSchema).optional(),
}).passthrough();

export const FillSchema = z.object({
  "fillId": z.lazy(() => UUIDSchema),
  "quantity": z.lazy(() => DecimalValueSchema),
  "price": z.lazy(() => DecimalValueSchema),
  "at": z.lazy(() => DateTimeSchema),
}).passthrough();

export const OrderSchema = z.object({
  "orderId": z.lazy(() => UUIDSchema),
  "commandId": z.lazy(() => UUIDSchema),
  "decisionId": z.lazy(() => UUIDSchema).optional(),
  "proposalId": z.lazy(() => UUIDSchema).optional(),
  "releaseId": z.lazy(() => UUIDSchema).optional(),
  "accountId": z.lazy(() => UUIDSchema),
  "venue": z.string(),
  "venueKind": z.enum(["binance","okx","coinbase","ibkr","alpine","mock"]),
  "productType": z.literal("spot").describe("订单源明确提供的产品维度；缺失时不得推断为 spot 或叠加 C12 图表。").optional(),
  "symbol": z.string(),
  "intent": z.enum(["open","increase","reduce","close"]),
  "side": z.enum(["buy","sell"]),
  "quantity": z.lazy(() => DecimalValueSchema),
  "prices": z.array(z.lazy(() => DecimalValueSchema)).optional(),
  "status": z.lazy(() => OrderStatusSchema),
  "filledQuantity": z.lazy(() => DecimalValueSchema),
  "averageFillPrice": z.lazy(() => DecimalValueSchema),
  "fills": z.array(z.lazy(() => FillSchema)),
  "mode": z.lazy(() => RuntimeModeSchema),
  "correlationId": z.lazy(() => UUIDSchema),
  "submittedAt": z.lazy(() => DateTimeSchema),
  "evidence": z.object({
  "proposalHash": z.string(),
  "riskDecisionId": z.string(),
  "approvalId": z.string(),
  "commandId": z.string(),
  "releaseId": z.string(),
  "snapshotHash": z.string(),
  "portfolioHash": z.string(),
  "factHashes": z.array(z.string()),
}).passthrough().optional(),
  "cancelCommandRef": z.lazy(() => UUIDSchema).optional(),
}).passthrough();

export const ResearchAcceptedSchema = z.intersection(z.lazy(() => AsyncAcceptedSchema), z.object({
  "statusRef": z.string().regex(new RegExp("^/v1/research-runs/[a-f0-9-]{36}$")),
  "auditRef": z.lazy(() => UUIDSchema),
}).passthrough());

export const ArtifactAttachmentSchema = z.object({
  "artifactId": z.lazy(() => UUIDSchema),
  "mediaType": z.literal("application/json"),
  "contentHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "content": z.object({

}).passthrough(),
  "auditRef": z.lazy(() => UUIDSchema),
  "correlationId": z.lazy(() => UUIDSchema).optional(),
}).passthrough().describe("授权后返回已校验hash的JSON内容；不返回内部存储路径或可转发的Storage凭据。");

export const MarketInstrumentSchema = z.object({
  "instrumentId": z.string(),
  "canonicalSymbol": z.string(),
  "venue": z.enum(["binance","coinbase"]),
  "productType": z.literal("spot"),
  "intervals": z.array(z.string()),
  "timezones": z.array(z.string()),
  "priceKind": z.enum(["top_of_book","last_trade"]),
  "topOfBook": z.boolean(),
  "lotSize": z.string().regex(new RegExp("^[0-9]+(?:\\.[0-9]+)?$")),
  "minNotional": z.string().regex(new RegExp("^[0-9]+(?:\\.[0-9]+)?$")),
}).strict();

export const MarketCatalogSchema = z.object({
  "items": z.array(z.lazy(() => MarketInstrumentSchema)),
  "asOf": z.lazy(() => DateTimeSchema),
}).strict();

export const MarketProvenanceSchema = z.object({
  "source": z.string(),
  "venue": z.enum(["binance","coinbase"]),
  "asOf": z.lazy(() => DateTimeSchema),
  "quality": z.enum(["passed","degraded"]),
  "license": z.string(),
  "approvalRef": z.string(),
  "approvalVersion": z.string(),
  "dataSnapshotId": z.lazy(() => UUIDSchema),
  "latencyMs": z.number().int().min(0),
}).strict();

export const VenueQuoteSchema = z.object({
  "instrumentId": z.string(),
  "canonicalSymbol": z.string(),
  "productType": z.literal("spot"),
  "bid": z.union([z.string().regex(new RegExp("^[0-9]+(?:\\.[0-9]+)?$")), z.literal(null)]),
  "ask": z.union([z.string().regex(new RegExp("^[0-9]+(?:\\.[0-9]+)?$")), z.literal(null)]),
  "mid": z.union([z.string().regex(new RegExp("^[0-9]+(?:\\.[0-9]+)?$")), z.literal(null)]),
  "lastPrice": z.union([z.string().regex(new RegExp("^[0-9]+(?:\\.[0-9]+)?$")), z.literal(null)]),
  "priceKind": z.enum(["top_of_book","last_trade"]),
  "executable": z.literal(false),
  "feeEstimate": z.literal(null),
  "slippageEstimate": z.literal(null),
  "estimates": z.literal(true),
  "lotSize": z.string().regex(new RegExp("^[0-9]+(?:\\.[0-9]+)?$")),
  "minNotional": z.string().regex(new RegExp("^[0-9]+(?:\\.[0-9]+)?$")),
  "provenance": z.lazy(() => MarketProvenanceSchema),
  "sequence": z.number().int().min(1),
}).strict();

export const VenueQuotesSchema = z.object({
  "items": z.array(z.lazy(() => VenueQuoteSchema)),
}).strict();

export const MarketWatchlistSchema = z.object({
  "instrumentIds": z.array(z.string()).max(100),
  "objectVersion": z.string(),
  "auditRef": z.lazy(() => UUIDSchema).optional(),
  "correlationId": z.lazy(() => UUIDSchema).optional(),
}).strict();

export const SaveMarketWatchlistSchema = z.object({
  "instrumentIds": z.array(z.string().min(1).max(100)).max(100),
}).strict();

export const CandleSeriesSchema = z.object({
  "instrumentId": z.string(),
  "canonicalSymbol": z.string(),
  "venue": z.enum(["binance","coinbase"]),
  "productType": z.literal("spot"),
  "interval": z.enum(["1m","5m","15m","1h","4h","1D","1W"]),
  "timezone": z.enum(["UTC","Asia/Shanghai"]),
  "ohlcv": z.array(z.object({
  "t": z.lazy(() => DateTimeSchema),
  "o": z.string().regex(new RegExp("^[0-9]+(?:\\.[0-9]+)?$")),
  "h": z.string().regex(new RegExp("^[0-9]+(?:\\.[0-9]+)?$")),
  "l": z.string().regex(new RegExp("^[0-9]+(?:\\.[0-9]+)?$")),
  "c": z.string().regex(new RegExp("^[0-9]+(?:\\.[0-9]+)?$")),
  "v": z.string().regex(new RegExp("^[0-9]+(?:\\.[0-9]+)?$")),
}).strict()).max(500),
  "gaps": z.array(z.object({
  "start": z.lazy(() => DateTimeSchema),
  "end": z.lazy(() => DateTimeSchema),
}).strict()),
  "eventMarkers": z.array(z.object({
  "kind": z.literal("data_gap"),
  "at": z.lazy(() => DateTimeSchema),
}).strict()),
  "provenance": z.lazy(() => MarketProvenanceSchema),
  "sequence": z.number().int().min(1),
  "replaceSeries": z.literal(true),
  "aggregation": z.literal("trade_events"),
}).strict();

export const OrderCapabilitiesSchema = z.object({
  "accountId": z.lazy(() => UUIDSchema),
  "mode": z.enum(["paper","shadow"]),
  "canSubmit": z.boolean(),
  "canCancel": z.boolean(),
  "venueSubmit": z.literal(false),
  "quantityScale": z.number().int().min(0).max(18),
  "priceScale": z.number().int().min(0).max(18),
  "maxQuantity": z.lazy(() => DecimalValueSchema),
  "maxNotional": z.lazy(() => DecimalValueSchema),
  "assistedTestnetAdmission": z.lazy(() => AssistedTestnetAdmissionSchema).optional(),
}).strict();

export const AssistedTestnetAdmissionSchema = z.object({
  "schemaVersion": z.literal("quantos-assisted-testnet-admission.v1"),
  "policyVersion": z.literal("disabled-until-native-bridge.v1"),
  "actorId": z.lazy(() => UUIDSchema),
  "tenantId": z.lazy(() => UUIDSchema),
  "workspaceId": z.lazy(() => UUIDSchema),
  "accountId": z.lazy(() => UUIDSchema),
  "mode": z.enum(["paper","shadow"]),
  "serverFlagEnabled": z.literal(false),
  "targetEnabled": z.literal(false),
  "executionAuthority": z.literal(false),
  "reasonCode": z.literal("EXECUTION_BRIDGE_UNAVAILABLE"),
  "checkedAt": z.lazy(() => DateTimeSchema),
  "expiresAt": z.lazy(() => DateTimeSchema),
}).strict().describe("Read-only scoped declaration. v1 is default-off and conveys no execution or approval authority; absence means unavailable. C11 flags and public build flags cannot enable this policy.");

export const TradePreflightSchema = z.object({
  "proposalId": z.lazy(() => UUIDSchema),
  "accountId": z.lazy(() => UUIDSchema),
  "mode": z.enum(["paper","shadow"]),
  "contextHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "objectVersion": z.string(),
  "asOf": z.lazy(() => DateTimeSchema),
  "expiresAt": z.lazy(() => DateTimeSchema),
  "verdict": z.enum(["allow","approval_required","deny"]),
  "hitRules": z.array(z.string()),
  "executable": z.literal(false),
  "correlationId": z.lazy(() => UUIDSchema).optional(),
  "ticketContext": z.lazy(() => TradeTicketContextSchema).optional(),
}).strict();

export const TradeTicketContextSchema = z.object({
  "symbol": z.string(),
  "quantity": z.lazy(() => DecimalValueSchema),
  "limitPrice": z.lazy(() => DecimalValueSchema),
  "quoteUnit": z.string(),
  "equity": z.lazy(() => DecimalValueSchema),
  "availableCash": z.null().describe("Current account source supplies equity only; never infer available cash or cash sufficiency."),
  "financialAsOf": z.lazy(() => DateTimeSchema),
  "venue": z.string(),
  "venueHealthy": z.boolean(),
  "venueObservedAt": z.lazy(() => DateTimeSchema),
  "policyVersion": z.string(),
  "policyRevision": z.string(),
  "inputHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "maxAgeSeconds": z.number().int().min(1).max(60),
}).strict();

export const ReconciliationEvidenceRefSchema = z.object({
  "kind": z.enum(["order","fill","audit","alert"]),
  "ref": z.string(),
  "sourceRef": z.string(),
  "resolution": z.enum(["source_record","bff_audit","x05_exception"]),
}).strict();

export const ReconciliationRunSchema = z.object({
  "runId": z.lazy(() => UUIDSchema),
  "accountId": z.lazy(() => UUIDSchema),
  "mode": z.literal("shadow"),
  "currency": z.string(),
  "status": z.literal("succeeded"),
  "result": z.enum(["clean","differences"]),
  "objectVersion": z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  "reportHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "inputHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "asOf": z.string().datetime({ offset: true }),
  "expiresAt": z.string().datetime({ offset: true }),
  "provisional": z.boolean(),
  "breakCount": z.number().int().min(0),
  "correlationId": z.lazy(() => UUIDSchema),
  "auditRef": z.union([z.string().uuid(), z.null()]),
  "evidenceRefs": z.array(z.lazy(() => ReconciliationEvidenceRefSchema)),
  "day": z.string().regex(new RegExp("^\\d{4}-\\d{2}-\\d{2}$")),
}).strict();

export const ReconciliationBreakSchema = z.object({
  "breakId": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "runId": z.lazy(() => UUIDSchema),
  "accountId": z.lazy(() => UUIDSchema),
  "mode": z.literal("shadow"),
  "kind": z.string(),
  "entity": z.string(),
  "status": z.enum(["open","acknowledged","closed"]),
  "objectVersion": z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  "expectedJson": z.string(),
  "actualJson": z.string(),
  "expectedSource": z.string(),
  "actualSource": z.string(),
  "detectedAt": z.string().datetime({ offset: true }),
  "lastDetectedAt": z.string().datetime({ offset: true }),
  "closureReportHash": z.union([z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")), z.null()]),
  "evidenceRefs": z.array(z.lazy(() => ReconciliationEvidenceRefSchema)),
  "day": z.string().regex(new RegExp("^\\d{4}-\\d{2}-\\d{2}$")),
}).strict();

export const LedgerEntrySchema = z.object({
  "entryId": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "runId": z.lazy(() => UUIDSchema),
  "accountId": z.lazy(() => UUIDSchema),
  "mode": z.literal("shadow"),
  "currency": z.string(),
  "kind": z.enum(["snapshot","fill"]),
  "side": z.enum(["expected","actual"]),
  "ledgerVersion": z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  "sourceRef": z.string(),
  "sourceHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "asOf": z.string().datetime({ offset: true }),
  "amounts": z.record(z.string(), z.lazy(() => DecimalValueSchema)),
  "evidenceRefs": z.array(z.lazy(() => ReconciliationEvidenceRefSchema)),
  "day": z.string().regex(new RegExp("^\\d{4}-\\d{2}-\\d{2}$")),
}).strict();

export const ReconciliationRerunSchema = z.object({
  "reason": z.string().min(1).max(256),
}).strict();

export const ReconciliationRunPageSchema = z.object({
  "items": z.array(z.lazy(() => ReconciliationRunSchema)),
  "nextCursor": z.union([z.string(), z.null()]),
}).strict();

export const ReconciliationBreakPageSchema = z.object({
  "items": z.array(z.lazy(() => ReconciliationBreakSchema)),
  "nextCursor": z.union([z.string(), z.null()]),
}).strict();

export const LedgerEntryPageSchema = z.object({
  "items": z.array(z.lazy(() => LedgerEntrySchema)),
  "nextCursor": z.union([z.string(), z.null()]),
}).strict();

export const PerformanceQuerySchema = z.object({
  "accountId": z.lazy(() => UUIDSchema),
  "currency": z.literal("USD"),
  "method": z.enum(["simple","twr","mwr"]),
  "period": z.enum(["custom","week","month","quarter","year"]),
  "periodMode": z.enum(["rolling","calendar"]),
  "start": z.string().datetime({ offset: true }).optional(),
  "end": z.string().datetime({ offset: true }).optional(),
}).strict();

export const PerformanceCoverageSchema = z.object({
  "requestedStart": z.string().datetime({ offset: true }),
  "requestedEnd": z.string().datetime({ offset: true }),
  "start": z.string().datetime({ offset: true }),
  "end": z.string().datetime({ offset: true }),
  "complete": z.boolean(),
  "points": z.number().int().min(2),
  "maxIntervalSeconds": z.literal(60),
}).strict();

export const PerformancePointSchema = z.object({
  "asOf": z.string().datetime({ offset: true }),
  "equity": z.lazy(() => DecimalValueSchema),
  "cumulativeFees": z.lazy(() => DecimalValueSchema),
  "drawdown": z.lazy(() => DecimalValueSchema),
  "ledgerVersion": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "valuationSnapshotId": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "reconciliationRunId": z.lazy(() => UUIDSchema),
  "provisional": z.boolean(),
}).strict();

export const PerformanceAttributionSchema = z.object({
  "symbol": z.string(),
  "pnl": z.lazy(() => DecimalValueSchema),
}).strict();

export const PerformanceViewSchema = z.object({
  "accountId": z.lazy(() => UUIDSchema),
  "currency": z.literal("USD"),
  "method": z.literal("simple"),
  "period": z.enum(["custom","week","month","quarter","year"]),
  "periodMode": z.enum(["rolling","calendar"]),
  "asOf": z.string().datetime({ offset: true }),
  "ledgerVersion": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "valuationSnapshotId": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "coverage": z.lazy(() => PerformanceCoverageSchema),
  "provisional": z.boolean(),
  "pnl": z.lazy(() => DecimalValueSchema),
  "return": z.lazy(() => DecimalValueSchema),
  "drawdown": z.lazy(() => DecimalValueSchema),
  "fees": z.lazy(() => DecimalValueSchema),
  "series": z.array(z.lazy(() => PerformancePointSchema)).min(2).max(1000),
  "attribution": z.array(z.lazy(() => PerformanceAttributionSchema)),
  "precision": z.string(),
  "venueSubmit": z.literal(false),
}).strict();

export const PerformanceReportSchema = z.object({
  "accountId": z.lazy(() => UUIDSchema),
  "currency": z.literal("USD"),
  "method": z.literal("simple"),
  "period": z.enum(["custom","week","month","quarter","year"]),
  "periodMode": z.enum(["rolling","calendar"]),
  "asOf": z.string().datetime({ offset: true }),
  "ledgerVersion": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "valuationSnapshotId": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "coverage": z.lazy(() => PerformanceCoverageSchema),
  "provisional": z.boolean(),
  "reportId": z.lazy(() => UUIDSchema),
  "status": z.enum(["queued","succeeded"]),
  "reportVersion": z.literal("1"),
  "createdAt": z.string().datetime({ offset: true }),
  "expiresAt": z.string().datetime({ offset: true }),
  "correlationId": z.lazy(() => UUIDSchema),
  "auditRef": z.lazy(() => UUIDSchema),
  "supersededBy": z.union([z.string().uuid(), z.null()]),
}).strict();

export const PerformanceReportDocumentSchema = z.object({
  "metadata": z.lazy(() => PerformanceReportSchema),
  "performance": z.lazy(() => PerformanceViewSchema),
}).strict();

export const PerformanceDownloadSchema = z.object({
  "accountId": z.lazy(() => UUIDSchema),
  "currency": z.literal("USD"),
  "method": z.literal("simple"),
  "period": z.enum(["custom","week","month","quarter","year"]),
  "periodMode": z.enum(["rolling","calendar"]),
  "asOf": z.string().datetime({ offset: true }),
  "ledgerVersion": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "valuationSnapshotId": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "coverage": z.lazy(() => PerformanceCoverageSchema),
  "provisional": z.boolean(),
  "reportId": z.lazy(() => UUIDSchema),
  "status": z.enum(["queued","succeeded"]),
  "reportVersion": z.literal("1"),
  "createdAt": z.string().datetime({ offset: true }),
  "expiresAt": z.string().datetime({ offset: true }),
  "correlationId": z.lazy(() => UUIDSchema),
  "auditRef": z.lazy(() => UUIDSchema),
  "supersededBy": z.union([z.string().uuid(), z.null()]),
  "downloadPath": z.string().regex(new RegExp("^/v1/performance/reports/[a-f0-9-]+/content\\?ticket=[a-f0-9-]+$")),
  "sha256": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "sizeBytes": z.number().int().min(1),
  "mediaType": z.literal("application/json"),
  "downloadExpiresAt": z.string().datetime({ offset: true }),
}).strict();

export const AdminMemberSpecSchema = z.object({
  "kind": z.literal("member"),
  "actorId": z.lazy(() => UUIDSchema),
  "roleId": z.lazy(() => UUIDSchema),
  "active": z.boolean(),
}).strict();

export const AdminRoleSpecSchema = z.object({
  "kind": z.literal("role"),
  "name": z.string().regex(new RegExp("^[a-zA-Z0-9_.-]+$")).min(1).max(64),
  "baseRole": z.enum(["owner","operator","approver","viewer","service"]),
  "permissions": z.array(z.enum(["ops.read","ops.operate","ops.approve","admin.read","admin.write","alerts.read"])).max(6),
}).strict();

export const AdminPolicySpecSchema = z.object({
  "kind": z.literal("policy"),
  "name": z.string().regex(new RegExp("^[a-zA-Z0-9_.-]+$")).min(1).max(64),
  "roleId": z.lazy(() => UUIDSchema),
  "deniedCapabilities": z.array(z.enum(["ops.read","ops.operate","ops.approve","admin.read","admin.write","alerts.read"])).max(6),
  "active": z.boolean(),
}).strict();

export const AdminCapabilitySpecSchema = z.union([z.lazy(() => AdminPermissionCapabilitySpecSchema), z.lazy(() => AdminEngineCapabilitySpecSchema)]);

export const AdminFlagSpecSchema = z.object({
  "kind": z.literal("flag"),
  "name": z.enum(["alerts-live-view","incident-timeline","admin-catalog-preview","ops-notices"]),
  "enabled": z.boolean(),
  "rolloutPercent": z.number().int().min(0).max(100),
}).strict();

export const AdminSpecSchema = z.union([z.lazy(() => AdminMemberSpecSchema), z.lazy(() => AdminRoleSpecSchema), z.lazy(() => AdminPolicySpecSchema), z.lazy(() => AdminCapabilitySpecSchema), z.lazy(() => AdminFlagSpecSchema)]);

export const AdminResourceSchema = z.union([z.object({
  "id": z.lazy(() => UUIDSchema),
  "kind": z.literal("members"),
  "objectVersion": z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  "configVersion": z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  "deleted": z.boolean(),
  "protected": z.boolean(),
  "spec": z.lazy(() => AdminMemberSpecSchema),
  "auditRef": z.lazy(() => UUIDSchema).optional(),
  "correlationId": z.lazy(() => UUIDSchema).optional(),
}).strict(), z.object({
  "id": z.lazy(() => UUIDSchema),
  "kind": z.literal("roles"),
  "objectVersion": z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  "configVersion": z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  "deleted": z.boolean(),
  "protected": z.boolean(),
  "spec": z.lazy(() => AdminRoleSpecSchema),
  "auditRef": z.lazy(() => UUIDSchema).optional(),
  "correlationId": z.lazy(() => UUIDSchema).optional(),
}).strict(), z.object({
  "id": z.lazy(() => UUIDSchema),
  "kind": z.literal("policies"),
  "objectVersion": z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  "configVersion": z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  "deleted": z.boolean(),
  "protected": z.boolean(),
  "spec": z.lazy(() => AdminPolicySpecSchema),
  "auditRef": z.lazy(() => UUIDSchema).optional(),
  "correlationId": z.lazy(() => UUIDSchema).optional(),
}).strict(), z.object({
  "id": z.lazy(() => UUIDSchema),
  "kind": z.literal("capabilities"),
  "objectVersion": z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  "configVersion": z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  "deleted": z.boolean(),
  "protected": z.boolean(),
  "spec": z.lazy(() => AdminCapabilitySpecSchema),
  "auditRef": z.lazy(() => UUIDSchema).optional(),
  "correlationId": z.lazy(() => UUIDSchema).optional(),
}).strict(), z.object({
  "id": z.lazy(() => UUIDSchema),
  "kind": z.literal("feature-flags"),
  "objectVersion": z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  "configVersion": z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  "deleted": z.boolean(),
  "protected": z.boolean(),
  "spec": z.lazy(() => AdminFlagSpecSchema),
  "auditRef": z.lazy(() => UUIDSchema).optional(),
  "correlationId": z.lazy(() => UUIDSchema).optional(),
}).strict()]);

export const GovernanceActionSchema = z.object({
  "reason": z.string().min(1).max(256),
  "mfaChallengeRef": z.lazy(() => UUIDSchema),
  "reauthTokenRef": z.lazy(() => UUIDSchema),
  "spec": z.lazy(() => AdminSpecSchema),
}).strict();

export const OpsActionSchema = z.object({
  "reason": z.string().min(1).max(256),
  "mfaChallengeRef": z.lazy(() => UUIDSchema),
  "reauthTokenRef": z.lazy(() => UUIDSchema),
}).strict();

export const OpsIncidentCreateSchema = z.object({
  "reason": z.string().min(1).max(256),
  "mfaChallengeRef": z.lazy(() => UUIDSchema),
  "reauthTokenRef": z.lazy(() => UUIDSchema),
  "alertId": z.lazy(() => UUIDSchema),
}).strict();

export const OpsRunbookExecuteSchema = z.object({
  "reason": z.string().min(1).max(256),
  "mfaChallengeRef": z.lazy(() => UUIDSchema),
  "reauthTokenRef": z.lazy(() => UUIDSchema),
  "commandId": z.lazy(() => UUIDSchema).optional(),
}).strict();

export const AlertSubscriptionsSchema = z.object({
  "objectVersion": z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  "severities": z.array(z.enum(["critical","warning","info"])).max(3),
  "domains": z.array(z.enum(["risk","order","market","reconciliation","report","system"])).max(6),
  "auditRef": z.lazy(() => UUIDSchema).optional(),
  "correlationId": z.lazy(() => UUIDSchema).optional(),
}).strict();

export const SaveAlertSubscriptionsSchema = z.object({
  "severities": z.array(z.enum(["critical","warning","info"])).min(1).max(3),
  "domains": z.array(z.enum(["risk","order","market","reconciliation","report","system"])).min(1).max(6),
}).strict();

export const OpsHealthSchema = z.object({
  "service": z.literal("service-x06"),
  "health": z.enum(["healthy","degraded"]),
  "ready": z.boolean(),
  "objectVersion": z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  "sourceHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "asOf": z.string().datetime({ offset: true }),
  "expiresAt": z.string().datetime({ offset: true }),
  "accountId": z.lazy(() => UUIDSchema),
  "mode": z.enum(["paper","shadow"]),
  "latencyMs": z.number().int().min(0),
  "dlqDepth": z.number().int().min(0),
  "metricsHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "components": z.array(z.object({
  "name": z.enum(["execution","portfolio","risk","reconciliation"]),
  "ready": z.boolean(),
  "asOf": z.string().datetime({ offset: true }),
}).strict()).max(4),
}).strict();

export const OpsAlertSchema = z.object({
  "readOnly": z.boolean().optional(),
  "sourceEvidence": z.lazy(() => AssistedReconciliationAlertEvidenceSchema).optional(),
  "id": z.lazy(() => UUIDSchema),
  "alertId": z.lazy(() => UUIDSchema),
  "sourceRef": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "rule": z.string().max(64),
  "severity": z.enum(["critical","warning","info"]),
  "domain": z.enum(["risk","order","market","reconciliation","report","system"]),
  "accountId": z.lazy(() => UUIDSchema),
  "mode": z.enum(["paper","shadow","assisted_live"]),
  "status": z.enum(["unacked","acked"]),
  "active": z.boolean(),
  "resolved": z.boolean(),
  "objectVersion": z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  "sourceVersion": z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  "occurredAt": z.string().datetime({ offset: true }),
  "asOf": z.string().datetime({ offset: true }),
  "ackActor": z.union([z.string().uuid(), z.null()]),
  "ackAt": z.union([z.string().datetime({ offset: true }), z.null()]),
  "objectRef": z.enum(["/operations/health","/orders"]),
  "auditRef": z.lazy(() => UUIDSchema).optional(),
  "correlationId": z.lazy(() => UUIDSchema),
}).strict();

export const OpsIncidentSchema = z.object({
  "id": z.lazy(() => UUIDSchema),
  "incidentId": z.lazy(() => UUIDSchema),
  "sourceRef": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "alertId": z.lazy(() => UUIDSchema),
  "status": z.enum(["open","acknowledged","resolved"]),
  "objectVersion": z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  "openedSource": z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  "asOf": z.string().datetime({ offset: true }),
  "accountId": z.lazy(() => UUIDSchema),
  "mode": z.enum(["paper","shadow"]),
  "auditRef": z.lazy(() => UUIDSchema).optional(),
  "correlationId": z.lazy(() => UUIDSchema).optional(),
}).strict();

export const OpsPrecheckSchema = z.object({
  "actionId": z.enum(["inspect-health","inspect-evidence"]),
  "allowed": z.boolean(),
  "reason": z.enum(["allowed","source_evidence_unavailable"]),
  "sourceVersion": z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  "expiresAt": z.string().datetime({ offset: true }),
}).strict();

export const OpsRunbookActionsSchema = z.object({
  "items": z.array(z.object({
  "actionId": z.enum(["inspect-health","inspect-evidence"]),
  "parameters": z.array(z.literal("commandId")).max(1),
}).strict()).max(2),
}).strict();

export const OpsRunbookReceiptSchema = z.object({
  "operationId": z.lazy(() => UUIDSchema),
  "status": z.literal("succeeded"),
  "sourceOperationRef": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "outcome": z.object({
  "status": z.literal("applied"),
  "reference": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
}).strict(),
  "auditRef": z.lazy(() => UUIDSchema),
  "correlationId": z.lazy(() => UUIDSchema),
}).strict();

export const AdminResourcePageSchema = z.object({
  "items": z.array(z.lazy(() => AdminResourceSchema)).max(200),
  "nextCursor": z.union([z.string().uuid(), z.null()]),
  "configVersion": z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
  "availableReviews": z.array(z.lazy(() => AdminEngineCapabilitySpecSchema)).max(1000).optional(),
}).strict();

export const OpsAlertPageSchema = z.object({
  "items": z.array(z.lazy(() => OpsAlertSchema)).max(200),
  "nextCursor": z.union([z.string().uuid(), z.null()]),
  "configVersion": z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
}).strict();

export const OpsIncidentPageSchema = z.object({
  "items": z.array(z.lazy(() => OpsIncidentSchema)).max(200),
  "nextCursor": z.union([z.string().uuid(), z.null()]),
  "configVersion": z.string().regex(new RegExp("^(0|[1-9][0-9]*)$")),
}).strict();

export const OpsIncidentTimelineSchema = z.object({
  "items": z.array(z.object({
  "eventId": z.lazy(() => UUIDSchema),
  "occurredAt": z.string().datetime({ offset: true }),
  "payload": z.lazy(() => OpsIncidentSchema),
  "auditRef": z.string().uuid().optional(),
  "correlationId": z.string().uuid().optional(),
}).strict()).max(10000),
}).strict();

export const GovernanceMemberActionSchema = z.object({
  "reason": z.string().min(1).max(256),
  "mfaChallengeRef": z.lazy(() => UUIDSchema),
  "reauthTokenRef": z.lazy(() => UUIDSchema),
  "spec": z.lazy(() => AdminMemberSpecSchema),
}).strict();

export const GovernanceRoleActionSchema = z.object({
  "reason": z.string().min(1).max(256),
  "mfaChallengeRef": z.lazy(() => UUIDSchema),
  "reauthTokenRef": z.lazy(() => UUIDSchema),
  "spec": z.lazy(() => AdminRoleSpecSchema),
}).strict();

export const GovernancePolicyActionSchema = z.object({
  "reason": z.string().min(1).max(256),
  "mfaChallengeRef": z.lazy(() => UUIDSchema),
  "reauthTokenRef": z.lazy(() => UUIDSchema),
  "spec": z.lazy(() => AdminPolicySpecSchema),
}).strict();

export const GovernanceCapabilityActionSchema = z.object({
  "reason": z.string().min(1).max(256),
  "mfaChallengeRef": z.lazy(() => UUIDSchema),
  "reauthTokenRef": z.lazy(() => UUIDSchema),
  "spec": z.lazy(() => AdminCapabilitySpecSchema),
}).strict();

export const GovernanceFeatureFlagActionSchema = z.object({
  "reason": z.string().min(1).max(256),
  "mfaChallengeRef": z.lazy(() => UUIDSchema),
  "reauthTokenRef": z.lazy(() => UUIDSchema),
  "spec": z.lazy(() => AdminFlagSpecSchema),
}).strict();

export const AdminPermissionCapabilitySpecSchema = z.object({
  "kind": z.literal("capability"),
  "name": z.enum(["ops.read","ops.operate","ops.approve","admin.read","admin.write","alerts.read"]),
  "enabled": z.boolean(),
}).strict();

export const AdminEngineCapabilitySpecSchema = z.object({
  "kind": z.literal("engine_capability"),
  "reviewId": z.lazy(() => UUIDSchema),
  "name": z.string().min(1).max(160),
  "version": z.string().min(1).max(64),
  "description": z.string().max(512),
  "enabled": z.boolean(),
}).strict();

export const CommandItemSchema = z.object({
  "kind": z.enum(["run","order","approval","alert"]),
  "id": z.lazy(() => UUIDSchema),
  "severity": z.enum(["critical","warning","info"]),
  "status": z.string().min(1).max(32),
  "occurredAt": z.union([z.lazy(() => DateTimeSchema), z.null()]),
  "objectRef": z.string().regex(new RegExp("^/(research/runs|orders|approvals|operations/alerts)/[a-f0-9-]{36}$")),
}).strict();

export const CommandSourceSchema = z.object({
  "domain": z.enum(["research","execution","operations","strategy"]),
  "status": z.enum(["ready","stale","unavailable","forbidden"]),
  "asOf": z.union([z.lazy(() => DateTimeSchema), z.null()]),
  "sourceHash": z.union([z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")), z.null()]),
}).strict();

export const CommandSummarySchema = z.object({
  "accountId": z.lazy(() => UUIDSchema),
  "mode": z.lazy(() => RuntimeModeSchema),
  "sampledAt": z.lazy(() => DateTimeSchema),
  "asOf": z.union([z.lazy(() => DateTimeSchema), z.null()]),
  "expiresAt": z.lazy(() => DateTimeSchema),
  "revision": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "partial": z.boolean(),
  "dataFreshness": z.enum(["fresh","stale","unavailable"]),
  "riskPosture": z.enum(["normal","elevated","halted","unknown"]),
  "systemHealth": z.union([z.enum(["healthy","degraded"]), z.null()]),
  "pendingApprovals": z.union([z.number().int().min(0).max(4000), z.null()]),
  "failedRuns": z.union([z.number().int().min(0).max(2000), z.null()]),
  "runningRuns": z.union([z.number().int().min(0).max(2000), z.null()]),
  "openRiskAlerts": z.union([z.number().int().min(0).max(2000), z.null()]).describe("Authorized active C16 alerts with domain=risk only; no fabricated X02 alert events"),
  "orderSummary": z.union([z.object({
  "mode": z.enum(["paper","shadow"]),
  "submitted": z.number().int().min(0).max(2000),
  "filled": z.number().int().min(0).max(2000),
  "rejected": z.number().int().min(0).max(2000),
}).strict(), z.null()]),
  "priority": z.array(z.lazy(() => CommandItemSchema)).max(50),
  "recentActivity": z.array(z.lazy(() => CommandItemSchema)).max(50),
  "sources": z.array(z.lazy(() => CommandSourceSchema)).min(4).max(4),
  "bounded": z.object({
  "sourceCount": z.literal(4),
  "rowLimit": z.literal(2000),
  "itemLimit": z.literal(50),
  "truncated": z.boolean(),
}).strict(),
}).strict();

export const AssistedLedgerReceiptSchema = z.object({
  "requestId": z.lazy(() => UUIDSchema),
  "commandId": z.lazy(() => UUIDSchema),
  "subjectHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "sourceHash": z.union([z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")), z.null()]),
  "entryHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "sequence": z.number().int().min(1).max(100000000),
  "state": z.enum(["applied","quarantined","no_fill_observed"]),
  "reason": z.enum(["OBSERVED_NATIVE_FACTS","OUTCOME_UNRESOLVED","JOURNAL_UNAVAILABLE","FEE_CONVERSION_REQUIRED"]),
  "observedFillIds": z.array(z.string().min(1).max(128)).max(10000),
  "appliedFillIds": z.array(z.string().min(1).max(128)).max(10000),
}).strict();

export const AssistedLedgerPositionSchema = z.object({
  "symbol": z.string().min(1).max(20),
  "quantity": z.lazy(() => DecimalValueSchema),
  "averageEntryPrice": z.lazy(() => DecimalValueSchema),
  "realizedPnl": z.lazy(() => DecimalValueSchema),
}).strict();

export const AssistedLedgerViewSchema = z.object({
  "schemaVersion": z.literal("quantos-native-ledger.v1"),
  "tenantId": z.lazy(() => UUIDSchema),
  "workspaceId": z.lazy(() => UUIDSchema),
  "accountId": z.lazy(() => UUIDSchema),
  "quoteCurrency": z.literal("USDT"),
  "ledgerHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "anchor": z.object({
  "sequence": z.number().int().min(0).max(100000000),
  "head": z.union([z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")), z.null()]),
}).strict(),
  "consumerReady": z.boolean().describe("Observed ledger usable for reconciliation; never valuation or permission. False when any command is quarantined."),
  "valuationReady": z.literal(false),
  "executionAuthority": z.literal(false),
  "scope": z.literal("OBSERVED_NATIVE_FILLS_ONLY"),
  "appliedFillCount": z.number().int().min(0).max(100000000),
  "quarantinedCommandCount": z.number().int().min(0).max(100000000),
  "quoteCashDelta": z.lazy(() => DecimalValueSchema),
  "quoteFeesTotal": z.lazy(() => DecimalValueSchema),
  "positions": z.array(z.lazy(() => AssistedLedgerPositionSchema)).max(10000),
  "entries": z.array(z.lazy(() => AssistedLedgerReceiptSchema)).max(10000),
}).strict();

export const AssistedReconciliationBindingSchema = z.object({
  "requestId": z.lazy(() => UUIDSchema),
  "commandId": z.lazy(() => UUIDSchema),
  "sourceHash": z.union([z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")), z.null()]),
  "ledgerEntryHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
}).strict();

export const AssistedReconciliationFindingSchema = z.object({
  "kind": z.string().min(1).max(512),
  "entity": z.string().min(1).max(512),
  "commandId": z.union([z.lazy(() => UUIDSchema), z.null()]),
  "expected": z.unknown(),
  "observed": z.unknown(),
}).strict();

export const AssistedReconciliationAlertEvidenceSchema = z.object({
  "evidenceId": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "reportId": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "scope": z.object({
  "tenantId": z.lazy(() => UUIDSchema),
  "workspaceId": z.lazy(() => UUIDSchema),
  "accountId": z.lazy(() => UUIDSchema),
}).strict(),
  "finding": z.lazy(() => AssistedReconciliationFindingSchema),
  "binding": z.union([z.lazy(() => AssistedReconciliationBindingSchema), z.null()]),
  "ledgerHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "booksHash": z.union([z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")), z.null()]),
  "observedAt": z.lazy(() => DateTimeSchema),
  "status": z.literal("OPEN"),
  "executionAuthority": z.literal(false),
}).strict();

export const AssistedReconciliationViewSchema = z.object({
  "schemaVersion": z.literal("quantos-current-reconciliation.v1"),
  "tenantId": z.lazy(() => UUIDSchema),
  "workspaceId": z.lazy(() => UUIDSchema),
  "accountId": z.lazy(() => UUIDSchema),
  "mode": z.literal("assisted_live"),
  "reportId": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "ledgerHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "booksHash": z.union([z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")), z.null()]),
  "booksSourceId": z.string().min(1).max(512),
  "booksState": z.enum(["AVAILABLE_OBSERVATIONS","UNAVAILABLE","STALE"]),
  "comparisonStatus": z.enum(["MATCHED_OBSERVATIONS","DIFFERENCES","UNAVAILABLE"]),
  "coverage": z.literal("OBSERVED_EXECUTION_DELTAS_ONLY"),
  "fullBooksReady": z.literal(false),
  "dayCloseAllowed": z.literal(false),
  "executionAuthority": z.literal(false),
  "checkedAt": z.lazy(() => DateTimeSchema),
  "sourceBindings": z.array(z.lazy(() => AssistedReconciliationBindingSchema)).max(20000),
  "findings": z.array(z.lazy(() => AssistedReconciliationFindingSchema)).max(20000),
  "unknownObligationsOpen": z.number().int().min(0).max(20000),
  "openAlertEvidenceCount": z.number().int().min(0).max(20000),
  "alertEvidence": z.array(z.lazy(() => AssistedReconciliationAlertEvidenceSchema)).max(20000),
  "anchor": z.object({
  "sequence": z.number().int().min(0).max(20000),
  "head": z.union([z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")), z.null()]),
}).strict(),
}).strict();

export const bffZodSchemas = {
  AssistedNativeCapabilities: AssistedNativeCapabilitiesSchema,
  AssistedSubject: AssistedSubjectSchema,
  AssistedApprovalRequest: AssistedApprovalRequestSchema,
  AssistedNativeOrder: AssistedNativeOrderSchema,
  AssistedNativeCommand: AssistedNativeCommandSchema,
  AssistedObservedOrder: AssistedObservedOrderSchema,
  AssistedObservedFill: AssistedObservedFillSchema,
  AssistedExecutionFacts: AssistedExecutionFactsSchema,
  AssistedRequestView: AssistedRequestViewSchema,
  AssistedSubjectList: AssistedSubjectListSchema,
  AssistedRequestList: AssistedRequestListSchema,
  AssistedApprovalAudit: AssistedApprovalAuditSchema,
  OpenAssistedRequest: OpenAssistedRequestSchema,
  ApproveAssistedRequest: ApproveAssistedRequestSchema,
  SubmitAssistedRequest: SubmitAssistedRequestSchema,
  UUID: UUIDSchema,
  DateTime: DateTimeSchema,
  DecimalValue: DecimalValueSchema,
  MoneyValue: MoneyValueSchema,
  RuntimeMode: RuntimeModeSchema,
  Environment: EnvironmentSchema,
  DataQuality: DataQualitySchema,
  TaskStatus: TaskStatusSchema,
  OrderStatus: OrderStatusSchema,
  TimeWindow: TimeWindowSchema,
  ErrorEnvelope: ErrorEnvelopeSchema,
  Page: PageSchema,
  AsyncAccepted: AsyncAcceptedSchema,
  AuditedAsyncAccepted: AuditedAsyncAcceptedSchema,
  MfaEnrollment: MfaEnrollmentSchema,
  ReauthRequest: ReauthRequestSchema,
  StreamEvent: StreamEventSchema,
  SessionContext: SessionContextSchema,
  ProfileSettingsInput: ProfileSettingsInputSchema,
  ProfileSettings: ProfileSettingsSchema,
  NotificationRule: NotificationRuleSchema,
  NotificationPreferencesInput: NotificationPreferencesInputSchema,
  NotificationPreferences: NotificationPreferencesSchema,
  MfaFactor: MfaFactorSchema,
  SecuritySettings: SecuritySettingsSchema,
  ActiveSession: ActiveSessionSchema,
  TrustedDevice: TrustedDeviceSchema,
  DownloadRecord: DownloadRecordSchema,
  BrowserCapabilityPolicy: BrowserCapabilityPolicySchema,
  AuditEvent: AuditEventSchema,
  AuditEventPage: AuditEventPageSchema,
  EvidenceNode: EvidenceNodeSchema,
  EvidenceChainPage: EvidenceChainPageSchema,
  ExportScope: ExportScopeSchema,
  ExportRequest: ExportRequestSchema,
  ExportJob: ExportJobSchema,
  ExportDownloadMetadata: ExportDownloadMetadataSchema,
  ResearchRun: ResearchRunSchema,
  DataSnapshot: DataSnapshotSchema,
  Artifact: ArtifactSchema,
  StrategySummary: StrategySummarySchema,
  StrategyDraft: StrategyDraftSchema,
  BacktestReport: BacktestReportSchema,
  StrategyRelease: StrategyReleaseSchema,
  Position: PositionSchema,
  PortfolioView: PortfolioViewSchema,
  RiskView: RiskViewSchema,
  Signal: SignalSchema,
  TradeProposal: TradeProposalSchema,
  ApprovalRuleCheck: ApprovalRuleCheckSchema,
  ApprovalRiskDecision: ApprovalRiskDecisionSchema,
  ApprovalCurrentRisk: ApprovalCurrentRiskSchema,
  ApprovalImpact: ApprovalImpactSchema,
  ApprovalReviewContext: ApprovalReviewContextSchema,
  Approval: ApprovalSchema,
  Fill: FillSchema,
  Order: OrderSchema,
  ResearchAccepted: ResearchAcceptedSchema,
  ArtifactAttachment: ArtifactAttachmentSchema,
  MarketInstrument: MarketInstrumentSchema,
  MarketCatalog: MarketCatalogSchema,
  MarketProvenance: MarketProvenanceSchema,
  VenueQuote: VenueQuoteSchema,
  VenueQuotes: VenueQuotesSchema,
  MarketWatchlist: MarketWatchlistSchema,
  SaveMarketWatchlist: SaveMarketWatchlistSchema,
  CandleSeries: CandleSeriesSchema,
  OrderCapabilities: OrderCapabilitiesSchema,
  AssistedTestnetAdmission: AssistedTestnetAdmissionSchema,
  TradePreflight: TradePreflightSchema,
  TradeTicketContext: TradeTicketContextSchema,
  ReconciliationEvidenceRef: ReconciliationEvidenceRefSchema,
  ReconciliationRun: ReconciliationRunSchema,
  ReconciliationBreak: ReconciliationBreakSchema,
  LedgerEntry: LedgerEntrySchema,
  ReconciliationRerun: ReconciliationRerunSchema,
  ReconciliationRunPage: ReconciliationRunPageSchema,
  ReconciliationBreakPage: ReconciliationBreakPageSchema,
  LedgerEntryPage: LedgerEntryPageSchema,
  PerformanceQuery: PerformanceQuerySchema,
  PerformanceCoverage: PerformanceCoverageSchema,
  PerformancePoint: PerformancePointSchema,
  PerformanceAttribution: PerformanceAttributionSchema,
  PerformanceView: PerformanceViewSchema,
  PerformanceReport: PerformanceReportSchema,
  PerformanceReportDocument: PerformanceReportDocumentSchema,
  PerformanceDownload: PerformanceDownloadSchema,
  AdminMemberSpec: AdminMemberSpecSchema,
  AdminRoleSpec: AdminRoleSpecSchema,
  AdminPolicySpec: AdminPolicySpecSchema,
  AdminCapabilitySpec: AdminCapabilitySpecSchema,
  AdminFlagSpec: AdminFlagSpecSchema,
  AdminSpec: AdminSpecSchema,
  AdminResource: AdminResourceSchema,
  GovernanceAction: GovernanceActionSchema,
  OpsAction: OpsActionSchema,
  OpsIncidentCreate: OpsIncidentCreateSchema,
  OpsRunbookExecute: OpsRunbookExecuteSchema,
  AlertSubscriptions: AlertSubscriptionsSchema,
  SaveAlertSubscriptions: SaveAlertSubscriptionsSchema,
  OpsHealth: OpsHealthSchema,
  OpsAlert: OpsAlertSchema,
  OpsIncident: OpsIncidentSchema,
  OpsPrecheck: OpsPrecheckSchema,
  OpsRunbookActions: OpsRunbookActionsSchema,
  OpsRunbookReceipt: OpsRunbookReceiptSchema,
  AdminResourcePage: AdminResourcePageSchema,
  OpsAlertPage: OpsAlertPageSchema,
  OpsIncidentPage: OpsIncidentPageSchema,
  OpsIncidentTimeline: OpsIncidentTimelineSchema,
  GovernanceMemberAction: GovernanceMemberActionSchema,
  GovernanceRoleAction: GovernanceRoleActionSchema,
  GovernancePolicyAction: GovernancePolicyActionSchema,
  GovernanceCapabilityAction: GovernanceCapabilityActionSchema,
  GovernanceFeatureFlagAction: GovernanceFeatureFlagActionSchema,
  AdminPermissionCapabilitySpec: AdminPermissionCapabilitySpecSchema,
  AdminEngineCapabilitySpec: AdminEngineCapabilitySpecSchema,
  CommandItem: CommandItemSchema,
  CommandSource: CommandSourceSchema,
  CommandSummary: CommandSummarySchema,
  AssistedLedgerReceipt: AssistedLedgerReceiptSchema,
  AssistedLedgerPosition: AssistedLedgerPositionSchema,
  AssistedLedgerView: AssistedLedgerViewSchema,
  AssistedReconciliationBinding: AssistedReconciliationBindingSchema,
  AssistedReconciliationFinding: AssistedReconciliationFindingSchema,
  AssistedReconciliationAlertEvidence: AssistedReconciliationAlertEvidenceSchema,
  AssistedReconciliationView: AssistedReconciliationViewSchema,
} as const;

export const bffResponseSchemas = {
  "getSession": {
    "200": z.lazy(() => SessionContextSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getContext": {
    "200": z.lazy(() => SessionContextSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "reauth": {
    "200": z.object({
  "reauthTokenRef": z.string().uuid(),
  "expiresAt": z.lazy(() => DateTimeSchema),
}).passthrough(),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "429": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "mfaChallenge": {
    "200": z.object({
  "challengeRef": z.string().uuid(),
  "status": z.enum(["pending","verified","failed"]),
}).passthrough(),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "429": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "logout": {
    "204": z.undefined(),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "submitAccessRequest": {
    "202": z.lazy(() => AuditedAsyncAcceptedSchema),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "429": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getProfile": {
    "200": z.lazy(() => ProfileSettingsSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "saveProfile": {
    "200": z.lazy(() => ProfileSettingsSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getNotificationPrefs": {
    "200": z.lazy(() => NotificationPreferencesSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "saveNotificationPrefs": {
    "200": z.lazy(() => NotificationPreferencesSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getSecuritySettings": {
    "200": z.lazy(() => SecuritySettingsSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "listSessions": {
    "200": z.array(z.lazy(() => ActiveSessionSchema)),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "revokeSession": {
    "202": z.lazy(() => AuditedAsyncAcceptedSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "subscribeSessionRevocations": {
    "200": z.undefined(),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "listDevices": {
    "200": z.array(z.lazy(() => TrustedDeviceSchema)),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "revokeDevice": {
    "202": z.lazy(() => AuditedAsyncAcceptedSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "setupMfa": {
    "202": z.lazy(() => AuditedAsyncAcceptedSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "revokeMfaFactor": {
    "202": z.lazy(() => AuditedAsyncAcceptedSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "listDownloads": {
    "200": z.intersection(z.lazy(() => PageSchema), z.object({
  "items": z.array(z.lazy(() => DownloadRecordSchema)).optional(),
}).passthrough()),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getPlatformCapabilities": {
    "200": z.lazy(() => BrowserCapabilityPolicySchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "listResearchRuns": {
    "200": z.intersection(z.lazy(() => PageSchema), z.object({
  "items": z.array(z.lazy(() => ResearchRunSchema)).optional(),
}).passthrough()),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "createResearchRun": {
    "202": z.lazy(() => ResearchAcceptedSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getResearchRun": {
    "200": z.lazy(() => ResearchRunSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "cancelResearchRun": {
    "202": z.lazy(() => ResearchAcceptedSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "subscribeResearchRun": {
    "200": z.undefined(),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "listDataSnapshots": {
    "200": z.intersection(z.lazy(() => PageSchema), z.object({
  "items": z.array(z.lazy(() => DataSnapshotSchema)).optional(),
}).passthrough()),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getDataSnapshot": {
    "200": z.lazy(() => DataSnapshotSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getArtifact": {
    "200": z.lazy(() => ArtifactSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "listStrategies": {
    "200": z.intersection(z.lazy(() => PageSchema), z.object({
  "items": z.array(z.lazy(() => StrategySummarySchema)).optional(),
}).passthrough()),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getStrategyDraft": {
    "200": z.lazy(() => StrategyDraftSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "saveStrategyDraft": {
    "200": z.lazy(() => StrategyDraftSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "runStaticCheck": {
    "202": z.lazy(() => AsyncAcceptedSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "createBacktest": {
    "202": z.lazy(() => AsyncAcceptedSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getBacktest": {
    "200": z.lazy(() => BacktestReportSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "listReleases": {
    "200": z.intersection(z.lazy(() => PageSchema), z.object({
  "items": z.array(z.lazy(() => StrategyReleaseSchema)).optional(),
}).passthrough()),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "createRelease": {
    "201": z.lazy(() => StrategyReleaseSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getRelease": {
    "200": z.lazy(() => StrategyReleaseSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "submitReleaseApproval": {
    "202": z.lazy(() => AsyncAcceptedSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "requestReleaseRollback": {
    "202": z.lazy(() => AsyncAcceptedSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getPortfolio": {
    "200": z.lazy(() => PortfolioViewSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getRiskView": {
    "200": z.lazy(() => RiskViewSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "engageKillSwitch": {
    "200": z.intersection(z.lazy(() => RiskViewSchema), z.unknown()),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "releaseKillSwitch": {
    "200": z.intersection(z.lazy(() => RiskViewSchema), z.unknown()),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "subscribePortfolio": {
    "200": z.undefined(),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "listProposals": {
    "200": z.intersection(z.lazy(() => PageSchema), z.object({
  "items": z.array(z.lazy(() => TradeProposalSchema)).optional(),
}).passthrough()),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getProposal": {
    "200": z.lazy(() => TradeProposalSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "requestRiskEvaluation": {
    "202": z.lazy(() => AsyncAcceptedSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "subscribeProposal": {
    "200": z.undefined(),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "listApprovals": {
    "200": z.intersection(z.lazy(() => PageSchema), z.object({
  "items": z.array(z.lazy(() => ApprovalSchema)).optional(),
}).passthrough()),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getApproval": {
    "200": z.lazy(() => ApprovalSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "decideApproval": {
    "200": z.lazy(() => ApprovalSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "submitTradeCommand": {
    "202": z.lazy(() => AsyncAcceptedSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "listOrders": {
    "200": z.intersection(z.lazy(() => PageSchema), z.object({
  "items": z.array(z.lazy(() => OrderSchema)).optional(),
}).passthrough()),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getOrder": {
    "200": z.lazy(() => OrderSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "requestOrderCancel": {
    "202": z.lazy(() => AsyncAcceptedSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "subscribeOrder": {
    "200": z.undefined(),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "searchAuditEvents": {
    "200": z.lazy(() => AuditEventPageSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getEvidenceChain": {
    "200": z.lazy(() => EvidenceChainPageSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "createExport": {
    "202": z.lazy(() => ExportJobSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getExportStatus": {
    "200": z.lazy(() => ExportJobSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "cancelExport": {
    "202": z.lazy(() => ExportJobSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getExportDownload": {
    "200": z.lazy(() => ExportDownloadMetadataSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "410": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getArtifactAttachment": {
    "200": z.lazy(() => ArtifactAttachmentSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getMarketCatalog": {
    "200": z.lazy(() => MarketCatalogSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "429": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getWatchlist": {
    "200": z.lazy(() => MarketWatchlistSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "429": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "saveWatchlist": {
    "200": z.lazy(() => MarketWatchlistSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "429": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getVenueQuotes": {
    "200": z.lazy(() => VenueQuotesSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "429": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getCandleSeries": {
    "200": z.lazy(() => CandleSeriesSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "429": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "subscribeQuotes": {
    "200": z.undefined(),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "429": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "subscribeCandles": {
    "200": z.undefined(),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "422": z.lazy(() => ErrorEnvelopeSchema),
    "429": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getOrderCapabilities": {
    "200": z.lazy(() => OrderCapabilitiesSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getTradePreflight": {
    "200": z.lazy(() => TradePreflightSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "subscribeTradePreflight": {
    "200": z.undefined(),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "subscribeBacktestRun": {
    "200": z.undefined(),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "listReconciliationRuns": {
    "200": z.lazy(() => ReconciliationRunPageSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getReconciliationRun": {
    "200": z.lazy(() => ReconciliationRunSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "listReconciliationBreaks": {
    "200": z.lazy(() => ReconciliationBreakPageSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getReconciliationBreak": {
    "200": z.lazy(() => ReconciliationBreakSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "listLedgerEntries": {
    "200": z.lazy(() => LedgerEntryPageSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "requestReconciliationRerun": {
    "202": z.lazy(() => AuditedAsyncAcceptedSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "subscribeReconciliationRun": {
    "200": z.undefined(),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getPerformanceSummary": {
    "200": z.lazy(() => PerformanceViewSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getPerformanceSeries": {
    "200": z.lazy(() => PerformanceViewSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getPerformanceAttribution": {
    "200": z.lazy(() => PerformanceViewSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "createPerformanceReport": {
    "202": z.lazy(() => PerformanceReportSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getReportStatus": {
    "200": z.lazy(() => PerformanceReportSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getPerformanceReport": {
    "200": z.lazy(() => PerformanceReportDocumentSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getReportDownload": {
    "200": z.lazy(() => PerformanceDownloadSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "downloadPerformanceReport": {
    "200": z.lazy(() => PerformanceReportDocumentSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getServiceHealth": {
    "200": z.lazy(() => OpsHealthSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getServiceMetrics": {
    "200": z.lazy(() => OpsHealthSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "listIncidents": {
    "200": z.lazy(() => OpsIncidentPageSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "openIncident": {
    "201": z.lazy(() => OpsIncidentSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getIncident": {
    "200": z.lazy(() => OpsIncidentSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getIncidentTimeline": {
    "200": z.lazy(() => OpsIncidentTimelineSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "ackIncident": {
    "200": z.lazy(() => OpsIncidentSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "resolveIncident": {
    "200": z.lazy(() => OpsIncidentSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "listRunbookActions": {
    "200": z.lazy(() => OpsRunbookActionsSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "checkRunbookPreconditions": {
    "200": z.lazy(() => OpsPrecheckSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "runApprovedRunbookAction": {
    "200": z.lazy(() => OpsRunbookReceiptSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "listMembers": {
    "200": z.lazy(() => AdminResourcePageSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "createMember": {
    "201": z.lazy(() => AdminResourceSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getMember": {
    "200": z.lazy(() => AdminResourceSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "updateMember": {
    "200": z.lazy(() => AdminResourceSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "deleteMember": {
    "200": z.lazy(() => AdminResourceSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "listRoles": {
    "200": z.lazy(() => AdminResourcePageSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "createRole": {
    "201": z.lazy(() => AdminResourceSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getRole": {
    "200": z.lazy(() => AdminResourceSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "saveRole": {
    "200": z.lazy(() => AdminResourceSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "deleteRole": {
    "200": z.lazy(() => AdminResourceSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "listPolicies": {
    "200": z.lazy(() => AdminResourcePageSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "createPolicy": {
    "201": z.lazy(() => AdminResourceSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getPolicy": {
    "200": z.lazy(() => AdminResourceSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "savePolicy": {
    "200": z.lazy(() => AdminResourceSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "deletePolicy": {
    "200": z.lazy(() => AdminResourceSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "listCapabilities": {
    "200": z.lazy(() => AdminResourcePageSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "createCapability": {
    "201": z.lazy(() => AdminResourceSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getCapability": {
    "200": z.lazy(() => AdminResourceSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "saveCapability": {
    "200": z.lazy(() => AdminResourceSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "deleteCapability": {
    "200": z.lazy(() => AdminResourceSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "listFeatureFlags": {
    "200": z.lazy(() => AdminResourcePageSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "createFeatureFlag": {
    "201": z.lazy(() => AdminResourceSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getFeatureFlag": {
    "200": z.lazy(() => AdminResourceSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "saveFeatureFlag": {
    "200": z.lazy(() => AdminResourceSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "deleteFeatureFlag": {
    "200": z.lazy(() => AdminResourceSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "listAlerts": {
    "200": z.lazy(() => OpsAlertPageSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getAlert": {
    "200": z.lazy(() => OpsAlertSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "ackAlert": {
    "200": z.lazy(() => OpsAlertSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "unackAlert": {
    "200": z.lazy(() => OpsAlertSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getAlertSubscriptions": {
    "200": z.lazy(() => AlertSubscriptionsSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "saveAlertSubscriptions": {
    "200": z.lazy(() => AlertSubscriptionsSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "subscribeAlerts": {
    "200": z.undefined(),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getCommandSummary": {
    "200": z.lazy(() => CommandSummarySchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "subscribeCommandEvents": {
    "200": z.undefined(),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getAssistedNativeCapabilities": {
    "200": z.lazy(() => AssistedNativeCapabilitiesSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "listAssistedSubjects": {
    "200": z.lazy(() => AssistedSubjectListSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "listAssistedRequests": {
    "200": z.lazy(() => AssistedRequestListSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "openAssistedRequest": {
    "200": z.lazy(() => AssistedRequestViewSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getAssistedRequest": {
    "200": z.lazy(() => AssistedRequestViewSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "approveAssistedRequest": {
    "200": z.lazy(() => AssistedRequestViewSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "submitAssistedRequest": {
    "200": z.lazy(() => AssistedNativeCommandSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getAssistedApprovalAudit": {
    "200": z.lazy(() => AssistedApprovalAuditSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getAssistedNativeLedger": {
    "200": z.lazy(() => AssistedLedgerViewSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
  "getAssistedCurrentReconciliation": {
    "200": z.lazy(() => AssistedReconciliationViewSchema),
    "401": z.lazy(() => ErrorEnvelopeSchema),
    "403": z.lazy(() => ErrorEnvelopeSchema),
    "404": z.lazy(() => ErrorEnvelopeSchema),
    "409": z.intersection(z.lazy(() => ErrorEnvelopeSchema), z.unknown()),
    "default": z.lazy(() => ErrorEnvelopeSchema),
  },
} as const;
