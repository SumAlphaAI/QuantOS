/* eslint-disable */
// Generated from bff/openapi/quantos-bff.v1.yaml (1.3.0). Do not edit.
import { z } from "zod";

export const UUIDSchema = z.string().uuid();

export const DateTimeSchema = z.string().datetime({ offset: true }).describe("RFC 3339 UTC");

export const DecimalValueSchema = z.string().regex(new RegExp("^-?\\d+(\\.\\d+)?$")).describe("十进制定点字符串（proto DecimalValue.value；禁 IEEE-754 交易计算）");

export const MoneyValueSchema = z.object({
  "currencyCode": z.string().regex(new RegExp("^[A-Z]{3}$")),
  "units": z.string(),
  "nanos": z.number().int().min(-999999999).max(999999999),
});

export const RuntimeModeSchema = z.enum(["research","paper","shadow","assisted_live"]).describe("assisted_live 仅 M5+ 且服务端 flag/capability 放行才可见；客户端不得硬编码可用性");

export const EnvironmentSchema = z.enum(["dev","staging","prod"]);

export const DataQualitySchema = z.enum(["verified","provisional","degraded","failed","expired","license_missing"]).describe("未知值客户端显示\"未知/需升级\"并阻断高风险动作");

export const TaskStatusSchema = z.enum(["queued","running","succeeded","failed","cancelled","cancel_requested"]);

export const OrderStatusSchema = z.enum(["draft","risk_checking","awaiting_approval","command_ready","submitted","accepted","partially_filled","filled","cancelled","rejected","expired"]);

export const TimeWindowSchema = z.object({
  "start": z.lazy(() => DateTimeSchema),
  "end": z.lazy(() => DateTimeSchema),
});

export const ErrorEnvelopeSchema = z.object({
  "code": z.string().describe("稳定机器码，如 FORBIDDEN/VERSION_CONFLICT/COMMAND_EXPIRED/DATA_STALE"),
  "message": z.string().describe("安全可展示文案（i18n key 由客户端映射）"),
  "correlationId": z.lazy(() => UUIDSchema),
  "fieldErrors": z.record(z.string(), z.string()).optional(),
  "retryAfter": z.number().int().min(0).describe("秒").optional(),
  "currentVersion": z.string().describe("409 时返回，供客户端 diff").optional(),
});

export const PageSchema = z.object({
  "items": z.array(z.unknown()),
  "nextCursor": z.string().describe("缺省表示末页").optional(),
});

export const AsyncAcceptedSchema = z.object({
  "jobId": z.lazy(() => UUIDSchema),
  "status": z.enum(["accepted","cancel_requested"]),
  "correlationId": z.lazy(() => UUIDSchema),
});

export const AuditedAsyncAcceptedSchema = z.intersection(z.lazy(() => AsyncAcceptedSchema), z.object({
  "auditRef": z.lazy(() => UUIDSchema),
}));

export const ReauthRequestSchema = z.object({
  "challengeRef": z.lazy(() => UUIDSchema),
}).strict();

export const StreamEventSchema = z.object({
  "streamId": z.lazy(() => UUIDSchema),
  "sequence": z.number().int().min(1),
  "eventId": z.lazy(() => UUIDSchema),
  "occurredAt": z.lazy(() => DateTimeSchema),
  "correlationId": z.lazy(() => UUIDSchema),
  "payloadVersion": z.string().describe("载荷 schema 版本（未知版本客户端 fail closed）"),
  "payload": z.object({

}).describe("领域事件载荷；payload.type=permission_revoked 为终态语义"),
});

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
});

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
});

export const ProfileSettingsSchema = z.intersection(z.lazy(() => ProfileSettingsInputSchema), z.object({
  "memberId": z.string(),
  "email": z.string().email(),
  "emailVerified": z.boolean(),
  "roleLabels": z.array(z.string()),
  "objectVersion": z.string(),
}));

export const NotificationRuleSchema = z.object({
  "key": z.string(),
  "severity": z.enum(["critical","warning","info"]),
  "inApp": z.boolean(),
  "desktop": z.boolean(),
  "email": z.boolean(),
  "browser": z.boolean(),
});

export const NotificationPreferencesInputSchema = z.object({
  "rules": z.array(z.lazy(() => NotificationRuleSchema)),
  "quietHoursEnabled": z.boolean(),
  "quietHoursStart": z.string().regex(new RegExp("^([01]\\d|2[0-3]):[0-5]\\d$")),
  "quietHoursEnd": z.string().regex(new RegExp("^([01]\\d|2[0-3]):[0-5]\\d$")),
  "criticalBypass": z.boolean().describe("Critical 可绕过静默但仍受服务端授权策略约束"),
  "digestFrequency": z.enum(["off","daily","weekly"]),
});

export const NotificationPreferencesSchema = z.intersection(z.lazy(() => NotificationPreferencesInputSchema), z.object({
  "objectVersion": z.string(),
  "browserPermission": z.enum(["granted","denied","default","unsupported"]),
}));

export const MfaFactorSchema = z.object({
  "factorId": z.string(),
  "method": z.enum(["passkey","authenticator","recovery_codes"]),
  "label": z.string(),
  "createdAt": z.lazy(() => DateTimeSchema),
  "lastUsedAt": z.lazy(() => DateTimeSchema),
  "currentDevice": z.boolean(),
});

export const SecuritySettingsSchema = z.object({
  "posture": z.enum(["strong","attention_required","unknown"]),
  "score": z.number().int().min(0).max(100),
  "mfaEnabled": z.boolean(),
  "factors": z.array(z.lazy(() => MfaFactorSchema)),
  "recoveryCodesRemaining": z.number().int().min(0),
  "lastVerifiedAt": z.lazy(() => DateTimeSchema),
  "correlationId": z.lazy(() => UUIDSchema),
});

export const ActiveSessionSchema = z.object({
  "sessionId": z.string(),
  "client": z.string(),
  "platform": z.string(),
  "location": z.string(),
  "lastActiveAt": z.lazy(() => DateTimeSchema),
  "ipMasked": z.string().describe("仅脱敏 IP，禁止返回完整地址"),
  "current": z.boolean(),
});

export const TrustedDeviceSchema = z.object({
  "deviceId": z.string(),
  "label": z.string(),
  "verificationMethod": z.enum(["passkey","biometric","authenticator"]),
  "trustedUntil": z.lazy(() => DateTimeSchema),
  "current": z.boolean(),
});

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
});

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
});

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

}).describe("只允许服务端脱敏后输出；密钥、token、完整账户标识禁止出现"),
  "payloadHash": z.string().regex(new RegExp("^sha256:[a-f0-9]{64}$")),
  "retentionUntil": z.lazy(() => DateTimeSchema),
});

export const AuditEventPageSchema = z.intersection(z.lazy(() => PageSchema), z.object({
  "items": z.array(z.lazy(() => AuditEventSchema)),
}));

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
});

export const EvidenceChainPageSchema = z.object({
  "correlationId": z.lazy(() => UUIDSchema),
  "items": z.array(z.lazy(() => EvidenceNodeSchema)),
  "nextCursor": z.string().optional(),
  "complete": z.boolean().describe("true 仅表示当前授权范围内证据链完整"),
});

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
});

export const ExportDownloadMetadataSchema = z.object({
  "exportId": z.lazy(() => UUIDSchema),
  "downloadUrl": z.string().url().describe("一次性不透明签名 URL，最长 5 分钟"),
  "expiresAt": z.lazy(() => DateTimeSchema),
  "sha256": z.string().regex(new RegExp("^[a-f0-9]{64}$")),
  "sizeBytes": z.number().int().min(1),
  "mediaType": z.string(),
  "watermarked": z.literal(true),
  "retentionUntil": z.lazy(() => DateTimeSchema),
  "auditRef": z.lazy(() => UUIDSchema),
});

export const ResearchRunSchema = z.object({
  "runId": z.lazy(() => UUIDSchema),
  "capability": z.string(),
  "dataSnapshotId": z.lazy(() => UUIDSchema),
  "budget": z.lazy(() => DecimalValueSchema),
  "costUnits": z.lazy(() => DecimalValueSchema).optional(),
  "deadlineAt": z.lazy(() => DateTimeSchema),
  "status": z.lazy(() => TaskStatusSchema),
  "inputHash": z.string(),
  "engineVersion": z.string(),
  "artifactRefs": z.array(z.lazy(() => UUIDSchema)).optional(),
  "evidenceRefs": z.array(z.lazy(() => UUIDSchema)),
  "correlationId": z.lazy(() => UUIDSchema),
  "createdAt": z.lazy(() => DateTimeSchema),
});

export const DataSnapshotSchema = z.object({
  "snapshotId": z.lazy(() => UUIDSchema),
  "schemaVersion": z.string(),
  "window": z.lazy(() => TimeWindowSchema),
  "sources": z.array(z.string()).optional(),
  "quality": z.lazy(() => DataQualitySchema),
  "qualityBlocked": z.boolean().describe("质量受限阻断标识（服务端权威，前端不可覆盖）").optional(),
  "contentHash": z.string(),
  "licenseLabel": z.string(),
  "capturedAt": z.lazy(() => DateTimeSchema),
  "maxAgeSeconds": z.number().int(),
});

export const ArtifactSchema = z.object({
  "artifactId": z.lazy(() => UUIDSchema),
  "hypothesis": z.string(),
  "summary": z.string(),
  "engineVersion": z.string(),
  "promptVersion": z.string(),
  "codeVersion": z.string(),
  "environmentHash": z.string(),
  "dataSnapshotId": z.lazy(() => UUIDSchema),
  "contentHash": z.string(),
  "lineageRefs": z.array(z.lazy(() => UUIDSchema)).optional(),
  "createdAt": z.lazy(() => DateTimeSchema),
});

export const StrategySummarySchema = z.object({
  "strategyId": z.lazy(() => UUIDSchema),
  "name": z.string(),
  "updatedAt": z.lazy(() => DateTimeSchema),
});

export const StrategyDraftSchema = z.object({
  "strategyId": z.lazy(() => UUIDSchema),
  "objectVersion": z.string(),
  "files": z.record(z.string(), z.string()),
  "parameters": z.object({

}),
  "updatedAt": z.lazy(() => DateTimeSchema),
});

export const BacktestReportSchema = z.object({
  "runId": z.lazy(() => UUIDSchema),
  "strategyId": z.lazy(() => UUIDSchema),
  "dataSnapshotId": z.lazy(() => UUIDSchema),
  "status": z.lazy(() => TaskStatusSchema),
  "metrics": z.record(z.string(), z.lazy(() => DecimalValueSchema)),
  "leakViolations": z.array(z.string()).describe("泄漏检查失败规则码（非空阻断 Release）"),
  "reportArtifactId": z.lazy(() => UUIDSchema),
});

export const StrategyReleaseSchema = z.object({
  "releaseId": z.lazy(() => UUIDSchema),
  "strategyId": z.lazy(() => UUIDSchema),
  "backtestReportArtifactId": z.lazy(() => UUIDSchema),
  "sourceDigest": z.string(),
  "imageDigest": z.string(),
  "parameterHash": z.string(),
  "parameters": z.object({

}),
  "snapshotId": z.lazy(() => UUIDSchema),
  "allowedTargets": z.array(z.enum(["paper","shadow","assisted_live"])).describe("服务端权威；M3/M4 仅 paper/shadow；assisted_live 出现需 flag 放行"),
  "approvalState": z.enum(["none","pending","approved","rejected","expired"]),
  "createdAt": z.lazy(() => DateTimeSchema),
});

export const PositionSchema = z.object({
  "symbol": z.string(),
  "side": z.enum(["long","short"]),
  "quantity": z.lazy(() => DecimalValueSchema),
  "avgPrice": z.lazy(() => DecimalValueSchema),
});

export const PortfolioViewSchema = z.object({
  "accountId": z.lazy(() => UUIDSchema),
  "asOf": z.lazy(() => DateTimeSchema),
  "stale": z.boolean().describe("true 时命令类操作由服务端拒绝"),
  "positions": z.array(z.lazy(() => PositionSchema)),
  "pnl": z.lazy(() => MoneyValueSchema),
  "exposure": z.lazy(() => DecimalValueSchema),
});

export const RiskViewSchema = z.object({
  "accountId": z.lazy(() => UUIDSchema),
  "asOf": z.lazy(() => DateTimeSchema),
  "hitRules": z.array(z.string()),
  "limitIds": z.array(z.lazy(() => UUIDSchema)),
  "killSwitch": z.object({
  "state": z.enum(["disengaged","engaged"]),
  "actor": z.string().optional(),
  "at": z.lazy(() => DateTimeSchema).optional(),
}),
});

export const SignalSchema = z.object({
  "signalId": z.lazy(() => UUIDSchema),
  "strategyReleaseId": z.lazy(() => UUIDSchema),
  "symbol": z.string(),
  "direction": z.enum(["long","short","flat"]),
  "strength": z.lazy(() => DecimalValueSchema),
  "confidence": z.lazy(() => DecimalValueSchema),
  "generatedAt": z.lazy(() => DateTimeSchema),
  "validUntil": z.lazy(() => DateTimeSchema),
});

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
});

export const ApprovalSchema = z.object({
  "approvalId": z.lazy(() => UUIDSchema),
  "originator": z.string().describe("发起人 actorId（禁自批判定）"),
  "objectVersion": z.string(),
  "status": z.enum(["pending","approved","rejected","expired","conflict"]),
  "expiresAt": z.lazy(() => DateTimeSchema),
  "signature": z.string().describe("批准后服务端签名").optional(),
  "commandRef": z.lazy(() => UUIDSchema).optional(),
  "correlationId": z.lazy(() => UUIDSchema),
});

export const FillSchema = z.object({
  "fillId": z.lazy(() => UUIDSchema),
  "quantity": z.lazy(() => DecimalValueSchema),
  "price": z.lazy(() => DecimalValueSchema),
  "at": z.lazy(() => DateTimeSchema),
});

export const OrderSchema = z.object({
  "orderId": z.lazy(() => UUIDSchema),
  "commandId": z.lazy(() => UUIDSchema),
  "decisionId": z.lazy(() => UUIDSchema).optional(),
  "proposalId": z.lazy(() => UUIDSchema).optional(),
  "releaseId": z.lazy(() => UUIDSchema).optional(),
  "accountId": z.lazy(() => UUIDSchema),
  "venue": z.string(),
  "venueKind": z.enum(["binance","okx","coinbase","ibkr","alpine","mock"]),
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
});

export const bffZodSchemas = {
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
  Approval: ApprovalSchema,
  Fill: FillSchema,
  Order: OrderSchema,
} as const;
