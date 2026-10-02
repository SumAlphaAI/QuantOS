# PRE-04 字段字典

> 版本：1.2；日期：2026-10-02；范围：一期官网与 Web Terminal。
> 由 `scripts/pre04-fields.mjs` 渲染；控制来源：[盘点基线](./PRE-04-inventory-baseline.json)、[OpenAPI](../bff/openapi/quantos-bff.v1.yaml)、[operation catalog](../bff/page-operation-catalog.yaml)。

## 1. 字段与来源口径

已发布字段以 OpenAPI 的 wire 名称、required 和完整约束为准；`$ref` 指向同文件 schema。领域字段与 HTTP 字段不同，由 transport/BFF 转换，页面不手写 DTO。`proto:` 是可解析的领域锚；“页面模型新增”不声称存在同名 Proto。

`planned:` 指盘点基线中的字段决策，并由 catalog 的后续任务承接；它不是已发布 schema。计划字段已有名称/类型/必需性决策，发布时必须补 wire schema 与映射；未发布能力不得升级为 Implemented/Integrated。

类型列为 schema 约束的 JSON 摘要（省略说明文案，保留枚举、范围、格式及嵌套 required）；可选不等于允许 null。完整说明见源 OpenAPI。

命令领域元数据见 `proto/quantos/common/v1/common.proto:CommandMetadata`；tenant/workspace/actor 由受信会话注入，客户端不可伪造。HTTP 请求以对应 operation 为准，不要求浏览器传递整个领域元数据。Decimal/Money 保留精确值，UTC 时间、Idempotency-Key、版本/409、错误 correlation、未知枚举阻断与敏感字段规则沿用执行计划 §5.3–5.6。

### 共享 wire 类型

| Schema | 完整类型约束摘要 |
|---|---|
| UUID | {"type":"string","format":"uuid"} |
| DateTime | {"type":"string","format":"date-time"} |
| DecimalValue | {"type":"string","pattern":"^-?\\d+(\\.\\d+)?$"} |
| MoneyValue | {"type":"object","required":["currencyCode","units","nanos"],"properties":{"currencyCode":{"type":"string","pattern":"^[A-Z]{3}$"},"units":{"type":"string","format":"int64"},"nanos":{"type":"integer","minimum":-999999999,"maximum":999999999}}} |
| RuntimeMode | {"type":"string","enum":["research","paper","shadow","assisted_live"]} |
| Environment | {"type":"string","enum":["dev","staging","prod"]} |
| DataQuality | {"type":"string","enum":["verified","provisional","degraded","failed","expired","license_missing"]} |
| TaskStatus | {"type":"string","enum":["queued","running","succeeded","failed","cancelled","cancel_requested"]} |
| OrderStatus | {"type":"string","enum":["draft","risk_checking","awaiting_approval","command_ready","submitted","accepted","partially_filled","filled","cancelled","rejected","expired"]} |
| TimeWindow | {"type":"object","required":["start","end"],"properties":{"start":{"$ref":"#/components/schemas/DateTime"},"end":{"$ref":"#/components/schemas/DateTime"}}} |
| ErrorEnvelope | {"type":"object","required":["code","message","correlationId"],"properties":{"code":{"type":"string"},"message":{"type":"string"},"correlationId":{"$ref":"#/components/schemas/UUID"},"fieldErrors":{"type":"object","additionalProperties":{"type":"string"}},"retryAfter":{"type":"integer","minimum":0},"currentVersion":{"type":"string"}}} |
| Page | {"type":"object","required":["items"],"properties":{"items":{"type":"array","items":{}},"nextCursor":{"type":"string"}}} |
| AsyncAccepted | {"type":"object","required":["jobId","status","correlationId"],"properties":{"jobId":{"$ref":"#/components/schemas/UUID"},"status":{"type":"string","enum":["accepted","cancel_requested"]},"correlationId":{"$ref":"#/components/schemas/UUID"}}} |
| AuditedAsyncAccepted | {"allOf":[{"$ref":"#/components/schemas/AsyncAccepted"},{"type":"object","required":["auditRef"],"properties":{"auditRef":{"$ref":"#/components/schemas/UUID"}}}]} |
| StreamEvent | {"type":"object","required":["streamId","sequence","eventId","occurredAt","correlationId","payloadVersion","payload"],"properties":{"streamId":{"$ref":"#/components/schemas/UUID"},"sequence":{"type":"integer","format":"int64","minimum":1},"eventId":{"$ref":"#/components/schemas/UUID"},"occurredAt":{"$ref":"#/components/schemas/DateTime"},"correlationId":{"$ref":"#/components/schemas/UUID"},"payloadVersion":{"type":"string"},"payload":{"type":"object"}}} |

## 2. C01 Session/Context

| wire 字段 / 计划字段 | 类型与序列化 | required | 领域源锚 | 领域→wire 映射 / 决策 | wire / 计划源锚 |
|---|---|---|---|---|---|
| SessionContext.actorId | {"$ref":"#/components/schemas/UUID"} | 是 | proto:common.v1.ActorRef.actor_id | ActorRef 只提取 actor_id；HTTP 为 UUID string | bff:SessionContext.actorId |
| SessionContext.tenantId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:SessionContext.tenantId |
| SessionContext.workspaceId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:SessionContext.workspaceId |
| SessionContext.accountId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:SessionContext.accountId |
| SessionContext.mode | {"$ref":"#/components/schemas/RuntimeMode"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:SessionContext.mode |
| SessionContext.environment | {"$ref":"#/components/schemas/Environment"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:SessionContext.environment |
| SessionContext.capabilities | {"type":"array","items":{"type":"string"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:SessionContext.capabilities |
| SessionContext.mfaState | {"type":"string","enum":["unenrolled","enrolled","challenged","verified"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:SessionContext.mfaState |
| SessionContext.expiresAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:SessionContext.expiresAt |
| ReauthRequest.challengeRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReauthRequest.challengeRef |
| mfaChallenge.request.purpose | {"type":"string","enum":["login","approval","kill_switch","security_change"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:mfaChallenge.request.purpose |
| mfaChallenge.request.code | {"type":"string"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:mfaChallenge.request.code |
| submitAccessRequest.request.teamName | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:submitAccessRequest.request.teamName |
| submitAccessRequest.request.contactEmail | {"type":"string","format":"email"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:submitAccessRequest.request.contactEmail |
| submitAccessRequest.request.purpose | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:submitAccessRequest.request.purpose |
| submitAccessRequest.request.markets | {"type":"array","items":{"type":"string"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:submitAccessRequest.request.markets |
| submitAccessRequest.request.expectedMode | {"$ref":"#/components/schemas/RuntimeMode"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:submitAccessRequest.request.expectedMode |
| submitAccessRequest.request.privacyNoticeVersion | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:submitAccessRequest.request.privacyNoticeVersion |

## 3. C02 Command Center

| wire 字段 / 计划字段 | 类型与序列化 | required | 领域源锚 | 领域→wire 映射 / 决策 | wire / 计划源锚 |
|---|---|---|---|---|---|
| riskPosture | enum{normal, elevated, halted} | 是 | planned-model:CommandCenterView（X02 读模型） | PLANNED：BFF-FE-002 冻结后同步 wire 映射 | planned:C02.plannedFields.0 |
| dataFreshness | enum{fresh, delayed, stale} + asOf:rfc3339 | 是 | planned-model:CommandCenterView | PLANNED：BFF-FE-002 冻结后同步 wire 映射 | planned:C02.plannedFields.1 |
| pendingApprovals / failedRuns / openRiskAlerts | int32 | 是 | planned-model:CommandCenterView | PLANNED：BFF-FE-002 冻结后同步 wire 映射 | planned:C02.plannedFields.2 |
| orderSummary | object{mode, submitted, filled, rejected} | 是 | planned-model:CommandCenterView（X04 投影） | PLANNED：BFF-FE-002 冻结后同步 wire 映射 | planned:C02.plannedFields.3 |
| alerts | AlertRef[]（见 C16） | 是 | planned-model:CommandCenterView | PLANNED：BFF-FE-002 冻结后同步 wire 映射 | planned:C02.plannedFields.4 |
| sampledAt | rfc3339 | 是 | planned-model:CommandCenterView | PLANNED：BFF-FE-002 冻结后同步 wire 映射 | planned:C02.plannedFields.5 |

尚未发布 operation：getCommandSummary、subscribeCommandEvents；责任任务 BFF-FE-002。以上已发布字段不能用于证明这些 operation 的请求、响应或实时载荷已冻结。

## 4. C03 Research Runtime

| wire 字段 / 计划字段 | 类型与序列化 | required | 领域源锚 | 领域→wire 映射 / 决策 | wire / 计划源锚 |
|---|---|---|---|---|---|
| ResearchRun.runId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ResearchRun.runId |
| ResearchRun.capability | {"type":"string"} | 是 | proto:engine.v1.Capability.name | 领域能力名称；HTTP string | bff:ResearchRun.capability |
| ResearchRun.dataSnapshotId | {"$ref":"#/components/schemas/UUID"} | 是 | proto:research.v1.DataSnapshot.snapshot_id | 固定数据快照引用，HTTP 使用 dataSnapshotId | bff:ResearchRun.dataSnapshotId |
| ResearchRun.budget | {"$ref":"#/components/schemas/DecimalValue"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ResearchRun.budget |
| ResearchRun.costUnits | {"$ref":"#/components/schemas/DecimalValue"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ResearchRun.costUnits |
| ResearchRun.deadlineAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ResearchRun.deadlineAt |
| ResearchRun.status | {"$ref":"#/components/schemas/TaskStatus"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ResearchRun.status |
| ResearchRun.inputHash | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ResearchRun.inputHash |
| ResearchRun.engineVersion | {"type":"string"} | 是 | proto:engine.v1.GetMetadataResponse.engine_version | 领域引擎版本，HTTP string | bff:ResearchRun.engineVersion |
| ResearchRun.artifactRefs | {"type":"array","items":{"$ref":"#/components/schemas/UUID"}} | 否 | proto:common.v1.ArtifactRef.artifact_id | 领域引用对象提取 artifact_id，HTTP 为 UUID[] | bff:ResearchRun.artifactRefs |
| ResearchRun.evidenceRefs | {"type":"array","items":{"$ref":"#/components/schemas/UUID"}} | 是 | proto:common.v1.EvidenceRef.evidence_id | 领域引用对象提取 evidence_id，HTTP 为 UUID[] | bff:ResearchRun.evidenceRefs |
| ResearchRun.correlationId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ResearchRun.correlationId |
| ResearchRun.createdAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ResearchRun.createdAt |
| createResearchRun.request.capability | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createResearchRun.request.capability |
| createResearchRun.request.dataSnapshotId | {"type":"string","format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createResearchRun.request.dataSnapshotId |
| createResearchRun.request.question | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createResearchRun.request.question |
| createResearchRun.request.budget | {"$ref":"#/components/schemas/DecimalValue"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createResearchRun.request.budget |
| createResearchRun.request.deadlineAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createResearchRun.request.deadlineAt |
| createResearchRun.request.attachments | {"type":"array","items":{"type":"string","format":"uuid"}} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createResearchRun.request.attachments |

## 5. C04 Snapshot/Artifact

| wire 字段 / 计划字段 | 类型与序列化 | required | 领域源锚 | 领域→wire 映射 / 决策 | wire / 计划源锚 |
|---|---|---|---|---|---|
| DataSnapshot.snapshotId | {"$ref":"#/components/schemas/UUID"} | 是 | proto:research.v1.DataSnapshot.snapshot_id | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:DataSnapshot.snapshotId |
| DataSnapshot.schemaVersion | {"type":"string"} | 是 | proto:research.v1.DataSnapshot.schema_version | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:DataSnapshot.schemaVersion |
| DataSnapshot.window | {"$ref":"#/components/schemas/TimeWindow"} | 是 | proto:research.v1.DataSnapshot.window | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:DataSnapshot.window |
| DataSnapshot.sources | {"type":"array","items":{"type":"string"}} | 否 | proto:common.v1.DataSourceRef.source_id | 领域 DataSourceRef[] 提取 source_id；HTTP string[]，可选 | bff:DataSnapshot.sources |
| DataSnapshot.quality | {"$ref":"#/components/schemas/DataQuality"} | 是 | proto:research.v1.DataSnapshot.quality | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:DataSnapshot.quality |
| DataSnapshot.qualityBlocked | {"type":"boolean"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:DataSnapshot.qualityBlocked |
| DataSnapshot.contentHash | {"type":"string"} | 是 | proto:research.v1.DataSnapshot.content_hash | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:DataSnapshot.contentHash |
| DataSnapshot.licenseLabel | {"type":"string"} | 是 | proto:research.v1.DataSnapshot.license_label | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:DataSnapshot.licenseLabel |
| DataSnapshot.capturedAt | {"$ref":"#/components/schemas/DateTime"} | 是 | proto:research.v1.DataSnapshot.captured_at | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:DataSnapshot.capturedAt |
| DataSnapshot.maxAgeSeconds | {"type":"integer","format":"int64"} | 是 | proto:research.v1.DataSnapshot.max_age | Proto Duration 转为 int64 秒；HTTP 名 maxAgeSeconds | bff:DataSnapshot.maxAgeSeconds |
| Artifact.artifactId | {"$ref":"#/components/schemas/UUID"} | 是 | proto:research.v1.ResearchArtifact.artifact_id | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Artifact.artifactId |
| Artifact.hypothesis | {"type":"string"} | 是 | proto:research.v1.ResearchArtifact.hypothesis | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Artifact.hypothesis |
| Artifact.summary | {"type":"string"} | 是 | proto:research.v1.ResearchArtifact.summary | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Artifact.summary |
| Artifact.engineVersion | {"type":"string"} | 是 | proto:research.v1.ResearchArtifact.engine_version | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Artifact.engineVersion |
| Artifact.promptVersion | {"type":"string"} | 是 | proto:research.v1.ResearchArtifact.prompt_version | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Artifact.promptVersion |
| Artifact.codeVersion | {"type":"string"} | 是 | proto:research.v1.ResearchArtifact.code_version | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Artifact.codeVersion |
| Artifact.environmentHash | {"type":"string"} | 是 | proto:research.v1.ResearchArtifact.environment_hash | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Artifact.environmentHash |
| Artifact.dataSnapshotId | {"$ref":"#/components/schemas/UUID"} | 是 | proto:research.v1.ResearchArtifact.data_snapshot_id | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Artifact.dataSnapshotId |
| Artifact.contentHash | {"type":"string"} | 是 | proto:research.v1.ResearchArtifact.content_hash | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Artifact.contentHash |
| Artifact.lineageRefs | {"type":"array","items":{"$ref":"#/components/schemas/UUID"}} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Artifact.lineageRefs |
| Artifact.createdAt | {"$ref":"#/components/schemas/DateTime"} | 是 | proto:research.v1.ResearchArtifact.created_at | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Artifact.createdAt |

尚未发布 operation：getArtifactAttachment；责任任务 BFF-FE-003。以上已发布字段不能用于证明这些 operation 的请求、响应或实时载荷已冻结。

## 6. C05 Strategy

| wire 字段 / 计划字段 | 类型与序列化 | required | 领域源锚 | 领域→wire 映射 / 决策 | wire / 计划源锚 |
|---|---|---|---|---|---|
| StrategySummary.strategyId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:StrategySummary.strategyId |
| StrategySummary.name | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:StrategySummary.name |
| StrategySummary.updatedAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:StrategySummary.updatedAt |
| StrategyDraft.strategyId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:StrategyDraft.strategyId |
| StrategyDraft.objectVersion | {"type":"string"} | 是 | none | BFF 草稿 objectVersion；旧 draftVersion 仅领域概念，不作为 wire 名 | bff:StrategyDraft.objectVersion |
| StrategyDraft.files | {"type":"object","additionalProperties":{"type":"string"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:StrategyDraft.files |
| StrategyDraft.parameters | {"type":"object"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:StrategyDraft.parameters |
| StrategyDraft.updatedAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:StrategyDraft.updatedAt |
| BacktestReport.runId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BacktestReport.runId |
| BacktestReport.strategyId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BacktestReport.strategyId |
| BacktestReport.dataSnapshotId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BacktestReport.dataSnapshotId |
| BacktestReport.status | {"$ref":"#/components/schemas/TaskStatus"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BacktestReport.status |
| BacktestReport.metrics | {"type":"object","additionalProperties":{"$ref":"#/components/schemas/DecimalValue"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BacktestReport.metrics |
| BacktestReport.leakViolations | {"type":"array","items":{"type":"string"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BacktestReport.leakViolations |
| BacktestReport.reportArtifactId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BacktestReport.reportArtifactId |
| StrategyRelease.releaseId | {"$ref":"#/components/schemas/UUID"} | 是 | proto:strategy.v1.StrategyRelease.release_id | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:StrategyRelease.releaseId |
| StrategyRelease.strategyId | {"$ref":"#/components/schemas/UUID"} | 是 | proto:strategy.v1.StrategyRelease.strategy_id | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:StrategyRelease.strategyId |
| StrategyRelease.backtestReportArtifactId | {"$ref":"#/components/schemas/UUID"} | 是 | proto:strategy.v1.StrategyRelease.backtest_report_artifact_id | 保持报告 Artifact 引用，不改成 reportHash | bff:StrategyRelease.backtestReportArtifactId |
| StrategyRelease.sourceDigest | {"type":"string"} | 是 | proto:strategy.v1.StrategyRelease.source_digest | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:StrategyRelease.sourceDigest |
| StrategyRelease.imageDigest | {"type":"string"} | 是 | proto:strategy.v1.StrategyRelease.image_digest | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:StrategyRelease.imageDigest |
| StrategyRelease.parameterHash | {"type":"string"} | 是 | proto:strategy.v1.StrategyRelease.parameter_hash | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:StrategyRelease.parameterHash |
| StrategyRelease.parameters | {"type":"object"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:StrategyRelease.parameters |
| StrategyRelease.snapshotId | {"$ref":"#/components/schemas/UUID"} | 是 | proto:strategy.v1.StrategyRelease.data_snapshot_id | HTTP 使用 snapshotId，保留同一 UUID 引用 | bff:StrategyRelease.snapshotId |
| StrategyRelease.allowedTargets | {"type":"array","items":{"type":"string","enum":["paper","shadow","assisted_live"]}} | 是 | proto:strategy.v1.StrategyRelease.allowed_targets | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:StrategyRelease.allowedTargets |
| StrategyRelease.approvalState | {"type":"string","enum":["none","pending","approved","rejected","expired"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:StrategyRelease.approvalState |
| StrategyRelease.createdAt | {"$ref":"#/components/schemas/DateTime"} | 是 | proto:strategy.v1.StrategyRelease.created_at | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:StrategyRelease.createdAt |
| saveStrategyDraft.request.files | {"type":"object","additionalProperties":{"type":"string"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:saveStrategyDraft.request.files |
| saveStrategyDraft.request.parameters | {"type":"object"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:saveStrategyDraft.request.parameters |
| createBacktest.request.strategyId | {"type":"string","format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createBacktest.request.strategyId |
| createBacktest.request.objectVersion | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createBacktest.request.objectVersion |
| createBacktest.request.dataSnapshotId | {"type":"string","format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createBacktest.request.dataSnapshotId |
| createRelease.request.strategyId | {"type":"string","format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createRelease.request.strategyId |
| createRelease.request.objectVersion | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createRelease.request.objectVersion |
| createRelease.request.backtestRunId | {"type":"string","format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createRelease.request.backtestRunId |
| createRelease.request.parameters | {"type":"object"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createRelease.request.parameters |
| requestReleaseRollback.request.targetReleaseId | {"type":"string","format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:requestReleaseRollback.request.targetReleaseId |

尚未发布 operation：subscribeBacktestRun；责任任务 BFF-FE-004。以上已发布字段不能用于证明这些 operation 的请求、响应或实时载荷已冻结。

## 7. C06 Portfolio/Risk

| wire 字段 / 计划字段 | 类型与序列化 | required | 领域源锚 | 领域→wire 映射 / 决策 | wire / 计划源锚 |
|---|---|---|---|---|---|
| PortfolioView.accountId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PortfolioView.accountId |
| PortfolioView.asOf | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PortfolioView.asOf |
| PortfolioView.stale | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PortfolioView.stale |
| PortfolioView.positions | {"type":"array","items":{"$ref":"#/components/schemas/Position"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PortfolioView.positions |
| PortfolioView.pnl | {"$ref":"#/components/schemas/MoneyValue"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PortfolioView.pnl |
| PortfolioView.exposure | {"$ref":"#/components/schemas/DecimalValue"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PortfolioView.exposure |
| RiskView.accountId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:RiskView.accountId |
| RiskView.asOf | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:RiskView.asOf |
| RiskView.hitRules | {"type":"array","items":{"type":"string"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:RiskView.hitRules |
| RiskView.limitIds | {"type":"array","items":{"$ref":"#/components/schemas/UUID"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:RiskView.limitIds |
| RiskView.killSwitch | {"type":"object","required":["state"],"properties":{"state":{"type":"string","enum":["disengaged","engaged"]},"actor":{"type":"string"},"at":{"$ref":"#/components/schemas/DateTime"}}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:RiskView.killSwitch |
| Position.symbol | {"type":"string"} | 是 | proto:trading.v1.Position.symbol | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Position.symbol |
| Position.side | {"type":"string","enum":["long","short"]} | 是 | proto:trading.v1.Position.side | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Position.side |
| Position.quantity | {"$ref":"#/components/schemas/DecimalValue"} | 是 | proto:trading.v1.Position.quantity | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Position.quantity |
| Position.avgPrice | {"$ref":"#/components/schemas/DecimalValue"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Position.avgPrice |
| engageKillSwitch.request.accountId | {"type":"string","format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:engageKillSwitch.request.accountId |
| engageKillSwitch.request.reason | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:engageKillSwitch.request.reason |
| engageKillSwitch.request.mfaChallengeRef | {"type":"string","format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:engageKillSwitch.request.mfaChallengeRef |
| engageKillSwitch.request.reauthTokenRef | {"type":"string","format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:engageKillSwitch.request.reauthTokenRef |
| engageKillSwitch.request.confirmPhrase | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:engageKillSwitch.request.confirmPhrase |
| releaseKillSwitch.request.accountId | {"type":"string","format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:releaseKillSwitch.request.accountId |
| releaseKillSwitch.request.reason | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:releaseKillSwitch.request.reason |
| releaseKillSwitch.request.mfaChallengeRef | {"type":"string","format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:releaseKillSwitch.request.mfaChallengeRef |
| releaseKillSwitch.request.reauthTokenRef | {"type":"string","format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:releaseKillSwitch.request.reauthTokenRef |

## 8. C07 Proposal/Risk Evaluation

| wire 字段 / 计划字段 | 类型与序列化 | required | 领域源锚 | 领域→wire 映射 / 决策 | wire / 计划源锚 |
|---|---|---|---|---|---|
| TradeProposal.proposalId | {"$ref":"#/components/schemas/UUID"} | 是 | proto:trading.v1.TradeProposal.proposal_id | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:TradeProposal.proposalId |
| TradeProposal.accountId | {"$ref":"#/components/schemas/UUID"} | 是 | proto:trading.v1.TradeProposal.account_id | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:TradeProposal.accountId |
| TradeProposal.symbol | {"type":"string"} | 是 | proto:trading.v1.TradeProposal.symbol | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:TradeProposal.symbol |
| TradeProposal.action | {"type":"string","enum":["buy","sell","reduce","close"]} | 是 | proto:trading.v1.TradeProposal.action | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:TradeProposal.action |
| TradeProposal.quantity | {"$ref":"#/components/schemas/DecimalValue"} | 是 | proto:trading.v1.TradeProposal.quantity | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:TradeProposal.quantity |
| TradeProposal.notional | {"$ref":"#/components/schemas/DecimalValue"} | 是 | proto:trading.v1.TradeProposal.notional | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:TradeProposal.notional |
| TradeProposal.signal | {"$ref":"#/components/schemas/Signal"} | 是 | proto:trading.v1.TradeProposal.signal | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:TradeProposal.signal |
| TradeProposal.rationale | {"type":"string"} | 是 | proto:trading.v1.TradeProposal.rationale | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:TradeProposal.rationale |
| TradeProposal.counterViews | {"type":"array","items":{"type":"string"},"minItems":1} | 是 | proto:trading.v1.TradeProposal.counter_views | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:TradeProposal.counterViews |
| TradeProposal.evidenceRefs | {"type":"array","items":{"$ref":"#/components/schemas/UUID"}} | 是 | proto:trading.v1.TradeProposal.evidence_refs | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:TradeProposal.evidenceRefs |
| TradeProposal.confidence | {"$ref":"#/components/schemas/DecimalValue"} | 是 | proto:trading.v1.TradeProposal.confidence | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:TradeProposal.confidence |
| TradeProposal.expiresAt | {"$ref":"#/components/schemas/DateTime"} | 是 | proto:trading.v1.TradeProposal.expires_at | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:TradeProposal.expiresAt |
| TradeProposal.executable | {"type":"boolean","enum":[false]} | 是 | proto:trading.v1.TradeProposal.executable | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:TradeProposal.executable |
| TradeProposal.objectVersion | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:TradeProposal.objectVersion |
| Signal.signalId | {"$ref":"#/components/schemas/UUID"} | 是 | proto:strategy.v1.Signal.signal_id | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Signal.signalId |
| Signal.strategyReleaseId | {"$ref":"#/components/schemas/UUID"} | 是 | proto:strategy.v1.Signal.strategy_release_id | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Signal.strategyReleaseId |
| Signal.symbol | {"type":"string"} | 是 | proto:strategy.v1.Signal.symbol | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Signal.symbol |
| Signal.direction | {"type":"string","enum":["long","short","flat"]} | 是 | proto:strategy.v1.Signal.direction | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Signal.direction |
| Signal.strength | {"$ref":"#/components/schemas/DecimalValue"} | 是 | proto:strategy.v1.Signal.strength | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Signal.strength |
| Signal.confidence | {"$ref":"#/components/schemas/DecimalValue"} | 是 | proto:strategy.v1.Signal.confidence | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Signal.confidence |
| Signal.generatedAt | {"$ref":"#/components/schemas/DateTime"} | 是 | proto:strategy.v1.Signal.generated_at | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Signal.generatedAt |
| Signal.validUntil | {"$ref":"#/components/schemas/DateTime"} | 是 | proto:strategy.v1.Signal.valid_until | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Signal.validUntil |
| requestRiskEvaluation.request.contextHash | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:requestRiskEvaluation.request.contextHash |

## 9. C08 Approval/MFA

| wire 字段 / 计划字段 | 类型与序列化 | required | 领域源锚 | 领域→wire 映射 / 决策 | wire / 计划源锚 |
|---|---|---|---|---|---|
| Approval.approvalId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Approval.approvalId |
| Approval.originator | {"type":"string"} | 是 | proto:common.v1.ActorRef.actor_id | 提取发起人 actor_id；HTTP string，不传 ActorRef 对象 | bff:Approval.originator |
| Approval.objectVersion | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Approval.objectVersion |
| Approval.status | {"type":"string","enum":["pending","approved","rejected","expired","conflict"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Approval.status |
| Approval.expiresAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Approval.expiresAt |
| Approval.signature | {"type":"string"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Approval.signature |
| Approval.commandRef | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Approval.commandRef |
| Approval.correlationId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Approval.correlationId |
| decideApproval.request.decision | {"type":"string","enum":["approve","reject","request_info"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:decideApproval.request.decision |
| decideApproval.request.reason | {"type":"string"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:decideApproval.request.reason |
| decideApproval.request.mfaChallengeRef | {"type":"string","format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:decideApproval.request.mfaChallengeRef |
| decideApproval.request.reauthTokenRef | {"type":"string","format":"uuid"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:decideApproval.request.reauthTokenRef |

## 10. C09 Command/Order

| wire 字段 / 计划字段 | 类型与序列化 | required | 领域源锚 | 领域→wire 映射 / 决策 | wire / 计划源锚 |
|---|---|---|---|---|---|
| Order.orderId | {"$ref":"#/components/schemas/UUID"} | 是 | proto:trading.v1.Order.order_id | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Order.orderId |
| Order.commandId | {"$ref":"#/components/schemas/UUID"} | 是 | proto:trading.v1.Order.command_id | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Order.commandId |
| Order.decisionId | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Order.decisionId |
| Order.proposalId | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Order.proposalId |
| Order.releaseId | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Order.releaseId |
| Order.accountId | {"$ref":"#/components/schemas/UUID"} | 是 | proto:trading.v1.Order.account_id | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Order.accountId |
| Order.venue | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Order.venue |
| Order.venueKind | {"type":"string","enum":["binance","okx","coinbase","ibkr","alpine","mock"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Order.venueKind |
| Order.symbol | {"type":"string"} | 是 | proto:trading.v1.Order.symbol | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Order.symbol |
| Order.intent | {"type":"string","enum":["open","increase","reduce","close"]} | 是 | proto:trading.v1.Order.intent | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Order.intent |
| Order.side | {"type":"string","enum":["buy","sell"]} | 是 | proto:trading.v1.Order.side | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Order.side |
| Order.quantity | {"$ref":"#/components/schemas/DecimalValue"} | 是 | proto:trading.v1.Order.quantity | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Order.quantity |
| Order.prices | {"type":"array","items":{"$ref":"#/components/schemas/DecimalValue"}} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Order.prices |
| Order.status | {"$ref":"#/components/schemas/OrderStatus"} | 是 | proto:trading.v1.Order.status | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Order.status |
| Order.filledQuantity | {"$ref":"#/components/schemas/DecimalValue"} | 是 | proto:trading.v1.Order.filled_quantity | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Order.filledQuantity |
| Order.averageFillPrice | {"$ref":"#/components/schemas/DecimalValue"} | 是 | proto:trading.v1.Order.average_fill_price | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Order.averageFillPrice |
| Order.fills | {"type":"array","items":{"$ref":"#/components/schemas/Fill"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Order.fills |
| Order.mode | {"$ref":"#/components/schemas/RuntimeMode"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Order.mode |
| Order.correlationId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Order.correlationId |
| Order.submittedAt | {"$ref":"#/components/schemas/DateTime"} | 是 | proto:trading.v1.Order.submitted_at | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Order.submittedAt |
| Fill.fillId | {"$ref":"#/components/schemas/UUID"} | 是 | proto:trading.v1.Fill.fill_id | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Fill.fillId |
| Fill.quantity | {"$ref":"#/components/schemas/DecimalValue"} | 是 | proto:trading.v1.Fill.quantity | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Fill.quantity |
| Fill.price | {"$ref":"#/components/schemas/DecimalValue"} | 是 | proto:trading.v1.Fill.price | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Fill.price |
| Fill.at | {"$ref":"#/components/schemas/DateTime"} | 是 | proto:trading.v1.Fill.filled_at | Proto Timestamp 转 RFC3339，wire 名为 at | bff:Fill.at |
| submitTradeCommand.request.commandRef | {"type":"string","format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:submitTradeCommand.request.commandRef |
| requestOrderCancel.request.commandRef | {"type":"string","format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:requestOrderCancel.request.commandRef |

## 11. C10 Audit/Export

| wire 字段 / 计划字段 | 类型与序列化 | required | 领域源锚 | 领域→wire 映射 / 决策 | wire / 计划源锚 |
|---|---|---|---|---|---|
| AuditEvent.eventId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AuditEvent.eventId |
| AuditEvent.correlationId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AuditEvent.correlationId |
| AuditEvent.causationId | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AuditEvent.causationId |
| AuditEvent.sequence | {"type":"integer","format":"int64","minimum":1} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AuditEvent.sequence |
| AuditEvent.kind | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AuditEvent.kind |
| AuditEvent.actor | {"type":"string"} | 是 | none | 服务端脱敏显示名/服务主体；HTTP string，不暴露 ActorRef | bff:AuditEvent.actor |
| AuditEvent.objectRef | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AuditEvent.objectRef |
| AuditEvent.occurredAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AuditEvent.occurredAt |
| AuditEvent.redactionApplied | {"type":"boolean","enum":[true]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AuditEvent.redactionApplied |
| AuditEvent.redactedPayload | {"type":"object","additionalProperties":true} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AuditEvent.redactedPayload |
| AuditEvent.payloadHash | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面审计读模型 hash；不是 EventEnvelope 字段 | bff:AuditEvent.payloadHash |
| AuditEvent.retentionUntil | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面审计保留截止时间；HTTP DateTime，不是策略标签 | bff:AuditEvent.retentionUntil |
| AuditEventPage.items | {"type":"array","items":{"$ref":"#/components/schemas/AuditEvent"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AuditEventPage.items |
| AuditEventPage.nextCursor | {"type":"string"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AuditEventPage.nextCursor |
| EvidenceNode.eventId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:EvidenceNode.eventId |
| EvidenceNode.causationId | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:EvidenceNode.causationId |
| EvidenceNode.sequence | {"type":"integer","format":"int64","minimum":1} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:EvidenceNode.sequence |
| EvidenceNode.kind | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:EvidenceNode.kind |
| EvidenceNode.objectRef | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:EvidenceNode.objectRef |
| EvidenceNode.occurredAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:EvidenceNode.occurredAt |
| EvidenceNode.payloadHash | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:EvidenceNode.payloadHash |
| EvidenceNode.route | {"type":"string","pattern":"^/"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:EvidenceNode.route |
| EvidenceNode.retentionUntil | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:EvidenceNode.retentionUntil |
| EvidenceChainPage.correlationId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:EvidenceChainPage.correlationId |
| EvidenceChainPage.items | {"type":"array","items":{"$ref":"#/components/schemas/EvidenceNode"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:EvidenceChainPage.items |
| EvidenceChainPage.nextCursor | {"type":"string"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:EvidenceChainPage.nextCursor |
| EvidenceChainPage.complete | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:EvidenceChainPage.complete |
| ExportScope.correlationIds | {"type":"array","minItems":1,"maxItems":100,"uniqueItems":true,"items":{"$ref":"#/components/schemas/UUID"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportScope.correlationIds |
| ExportScope.eventKinds | {"type":"array","maxItems":50,"uniqueItems":true,"items":{"type":"string"}} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportScope.eventKinds |
| ExportScope.startAt | {"$ref":"#/components/schemas/DateTime"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportScope.startAt |
| ExportScope.endAt | {"$ref":"#/components/schemas/DateTime"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportScope.endAt |
| ExportRequest.scope | {"$ref":"#/components/schemas/ExportScope"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportRequest.scope |
| ExportRequest.format | {"type":"string","enum":["jsonl","csv","pdf"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportRequest.format |
| ExportRequest.reason | {"type":"string","minLength":8,"maxLength":500} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportRequest.reason |
| ExportRequest.watermark | {"type":"string","minLength":3,"maxLength":120} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportRequest.watermark |
| ExportRequest.retentionDays | {"type":"integer","minimum":1,"maximum":30} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportRequest.retentionDays |
| ExportJob.exportId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportJob.exportId |
| ExportJob.status | {"type":"string","enum":["queued","generating","ready","cancel_requested","cancelled","expired","failed"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportJob.status |
| ExportJob.format | {"type":"string","enum":["jsonl","csv","pdf"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportJob.format |
| ExportJob.requestedBy | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportJob.requestedBy |
| ExportJob.requestedAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportJob.requestedAt |
| ExportJob.completedAt | {"$ref":"#/components/schemas/DateTime"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportJob.completedAt |
| ExportJob.watermark | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportJob.watermark |
| ExportJob.retentionUntil | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportJob.retentionUntil |
| ExportJob.correlationId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportJob.correlationId |
| ExportJob.auditRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportJob.auditRef |
| ExportDownloadMetadata.exportId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportDownloadMetadata.exportId |
| ExportDownloadMetadata.downloadUrl | {"type":"string","format":"uri"} | 是 | none | 独立下载元数据的一次性短时 URL；不属于 ExportJob | bff:ExportDownloadMetadata.downloadUrl |
| ExportDownloadMetadata.expiresAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportDownloadMetadata.expiresAt |
| ExportDownloadMetadata.sha256 | {"type":"string","pattern":"^[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportDownloadMetadata.sha256 |
| ExportDownloadMetadata.sizeBytes | {"type":"integer","format":"int64","minimum":1} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportDownloadMetadata.sizeBytes |
| ExportDownloadMetadata.mediaType | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportDownloadMetadata.mediaType |
| ExportDownloadMetadata.watermarked | {"type":"boolean","enum":[true]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportDownloadMetadata.watermarked |
| ExportDownloadMetadata.retentionUntil | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportDownloadMetadata.retentionUntil |
| ExportDownloadMetadata.auditRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportDownloadMetadata.auditRef |

## 12. C11 Ops/Admin

| wire 字段 / 计划字段 | 类型与序列化 | required | 领域源锚 | 领域→wire 映射 / 决策 | wire / 计划源锚 |
|---|---|---|---|---|---|
| service / health / latencyMs | string / enum{healthy, degraded, down} / int32 | 是 | planned-model:ServiceHealth（F09） | PLANNED：BFF-FE-010 冻结后同步 wire 映射 | planned:C11.plannedFields.0 |
| dlqDepth | int32 | 是 | planned-model:ServiceHealth（F05 DLQ） | PLANNED：BFF-FE-010 冻结后同步 wire 映射 | planned:C11.plannedFields.1 |
| incidentId / actionId | uuid / string（白名单枚举） | 是 | planned-model:Incident（仅批准 actionId） | PLANNED：BFF-FE-010 冻结后同步 wire 映射 | planned:C11.plannedFields.2 |
| configVersion | version | 是 | planned-model:AdminView | PLANNED：BFF-FE-010 冻结后同步 wire 映射 | planned:C11.plannedFields.3 |
| memberId / role | uuid / string | 是 | planned-model:AdminMember（F06 RBAC） | PLANNED：BFF-FE-010 冻结后同步 wire 映射 | planned:C11.plannedFields.4 |
| capability / flag | string / string + rollout 配置 | 是 | proto:engine.v1.Capability / planned-model:FlagView | PLANNED：BFF-FE-010 冻结后同步 wire 映射 | planned:C11.plannedFields.5 |
| auditRef | uuid（correlationId） | 是 | planned-model:AdminView | PLANNED：BFF-FE-010 冻结后同步 wire 映射 | planned:C11.plannedFields.6 |

尚未发布 operation：getServiceHealth、listIncidents、getIncident、listMembers、listPolicies、listCapabilities、listFeatureFlags、runApprovedRunbookAction、updateMember、savePolicy、saveCapability、saveFeatureFlag；责任任务 BFF-FE-010。以上已发布字段不能用于证明这些 operation 的请求、响应或实时载荷已冻结。

## 13. C12 Market/Candle

| wire 字段 / 计划字段 | 类型与序列化 | required | 领域源锚 | 领域→wire 映射 / 决策 | wire / 计划源锚 |
|---|---|---|---|---|---|
| canonicalSymbol / productType | string / enum{spot, perp, future} | 是 | planned-model:Instrument | PLANNED：BFF-FE-005 冻结后同步 wire 映射 | planned:C12.plannedFields.0 |
| venue | enum:VenueKind | 是 | proto:trading.v1.VenueKind | PLANNED：BFF-FE-005 冻结后同步 wire 映射 | planned:C12.plannedFields.1 |
| bid / ask / mid | decimal | 是 | planned-model:VenueQuote | PLANNED：BFF-FE-005 冻结后同步 wire 映射 | planned:C12.plannedFields.2 |
| feeEstimate / slippageEstimate | money / decimal（标注估算） | 是 | planned-model:VenueQuote | PLANNED：BFF-FE-005 冻结后同步 wire 映射 | planned:C12.plannedFields.3 |
| lotSize / minNotional | decimal / money | 是 | planned-model:VenueQuote | PLANNED：BFF-FE-005 冻结后同步 wire 映射 | planned:C12.plannedFields.4 |
| source / asOf / latencyMs / quality | string / rfc3339 / int32 / enum:DataQuality | 是 | planned-model:VenueQuote（每行必备） | PLANNED：BFF-FE-005 冻结后同步 wire 映射 | planned:C12.plannedFields.5 |
| interval | enum{1m, 5m, 15m, 1h, 4h, 1D, 1W, custom} | 是 | planned-model:CandleSeries | PLANNED：BFF-FE-005 冻结后同步 wire 映射 | planned:C12.plannedFields.6 |
| timezone | string（IANA） | 是 | planned-model:CandleSeries | PLANNED：BFF-FE-005 冻结后同步 wire 映射 | planned:C12.plannedFields.7 |
| ohlcv | object[]{o,h,l,c,v:decimal, t:rfc3339} | 是 | planned-model:CandleSeries | PLANNED：BFF-FE-005 冻结后同步 wire 映射 | planned:C12.plannedFields.8 |
| gaps | TimeWindow[] | 是 | planned-model:CandleSeries | PLANNED：BFF-FE-005 冻结后同步 wire 映射 | planned:C12.plannedFields.9 |

尚未发布 operation：getMarketCatalog、getWatchlist、getVenueQuotes、getCandleSeries、saveWatchlist、subscribeQuotes、subscribeCandles；责任任务 BFF-FE-005。以上已发布字段不能用于证明这些 operation 的请求、响应或实时载荷已冻结。

## 14. C13 Trade Preflight

| wire 字段 / 计划字段 | 类型与序列化 | required | 领域源锚 | 领域→wire 映射 / 决策 | wire / 计划源锚 |
|---|---|---|---|---|---|
| accountId / mode | uuid / enum:RuntimeMode | 是 | planned-model:PreflightView | PLANNED：BFF-FE-006 冻结后同步 wire 映射 | planned:C13.plannedFields.0 |
| venueOptions | VenueOption[]（health, asOf, supportedIntents:enum:OrderIntentType[]） | 是 | planned-model:PreflightView（单 venue 时只读） | PLANNED：BFF-FE-006 冻结后同步 wire 映射 | planned:C13.plannedFields.1 |
| balanceRef / positionRef | uuid（快照引用） | 是 | planned-model:PreflightView（X01 读模型） | PLANNED：BFF-FE-006 冻结后同步 wire 映射 | planned:C13.plannedFields.2 |
| quoteRef | uuid + asOf:rfc3339 | 是 | planned-model:PreflightView（C12 报价快照） | PLANNED：BFF-FE-006 冻结后同步 wire 映射 | planned:C13.plannedFields.3 |
| limitImpact | object{limitId:uuid, before:decimal, after:decimal}[] | 是 | planned-model:PreflightView（X02） | PLANNED：BFF-FE-006 冻结后同步 wire 映射 | planned:C13.plannedFields.4 |
| objectVersion | version | 是 | planned-model:PreflightView | PLANNED：BFF-FE-006 冻结后同步 wire 映射 | planned:C13.plannedFields.5 |
| blockingReasons | string[]（稳定机器码） | 是 | planned-model:PreflightView | PLANNED：BFF-FE-006 冻结后同步 wire 映射 | planned:C13.plannedFields.6 |

尚未发布 operation：getOrderCapabilities、getTradePreflight、subscribeTradePreflight；责任任务 BFF-FE-006。以上已发布字段不能用于证明这些 operation 的请求、响应或实时载荷已冻结。

## 15. C14 Performance/Report

| wire 字段 / 计划字段 | 类型与序列化 | required | 领域源锚 | 领域→wire 映射 / 决策 | wire / 计划源锚 |
|---|---|---|---|---|---|
| accountId / currency | uuid / string（ISO 4217） | 是 | planned-model:PerformanceView | PLANNED：BFF-FE-008 冻结后同步 wire 映射 | planned:C14.plannedFields.0 |
| method | enum{twr, mwr, simple} | 是 | planned-model:PerformanceView（标注口径与适用条件） | PLANNED：BFF-FE-008 冻结后同步 wire 映射 | planned:C14.plannedFields.1 |
| ledgerVersion / valuationSnapshotId | version / uuid | 是 | planned-model:PerformanceView（X01/X05） | PLANNED：BFF-FE-008 冻结后同步 wire 映射 | planned:C14.plannedFields.2 |
| coverage | TimeWindow | 是 | proto:common.v1.TimeWindow | PLANNED：BFF-FE-008 冻结后同步 wire 映射 | planned:C14.plannedFields.3 |
| asOf | rfc3339 | 是 | planned-model:PerformanceView | PLANNED：BFF-FE-008 冻结后同步 wire 映射 | planned:C14.plannedFields.4 |
| pnl / return / drawdown / fees | money / decimal / decimal / money | 是 | planned-model:PerformanceView | PLANNED：BFF-FE-008 冻结后同步 wire 映射 | planned:C14.plannedFields.5 |
| provisional | bool | 是 | planned-model:PerformanceView（未对账强制 true） | PLANNED：BFF-FE-008 冻结后同步 wire 映射 | planned:C14.plannedFields.6 |
| period / reportVersion | enum{week, month, quarter, year} + 自然/滚动 / version | 是 | planned-model:ReportJob | PLANNED：BFF-FE-008 冻结后同步 wire 映射 | planned:C14.plannedFields.7 |
| supersededBy | uuid | opt | planned-model:ReportJob | PLANNED：BFF-FE-008 冻结后同步 wire 映射 | planned:C14.plannedFields.8 |

尚未发布 operation：getPerformanceSummary、getPerformanceSeries、getPerformanceAttribution、createPerformanceReport、getReportStatus、getReportDownload；责任任务 BFF-FE-008。以上已发布字段不能用于证明这些 operation 的请求、响应或实时载荷已冻结。

## 16. C15 Reconciliation

| wire 字段 / 计划字段 | 类型与序列化 | required | 领域源锚 | 领域→wire 映射 / 决策 | wire / 计划源锚 |
|---|---|---|---|---|---|
| runId / accountId / venue | uuid / uuid / enum:VenueKind | 是 | planned-model:ReconRun（X05） | PLANNED：BFF-FE-009 冻结后同步 wire 映射 | planned:C15.plannedFields.0 |
| window / ledgerVersion | TimeWindow / version | 是 | planned-model:ReconRun | PLANNED：BFF-FE-009 冻结后同步 wire 映射 | planned:C15.plannedFields.1 |
| status | enum:matched / investigating / resolved（+missing_data） | 是 | planned-model:ReconRun（tokens 状态枚举对齐） | PLANNED：BFF-FE-009 冻结后同步 wire 映射 | planned:C15.plannedFields.2 |
| breakId | uuid | 是 | planned-model:ReconBreak | PLANNED：BFF-FE-009 冻结后同步 wire 映射 | planned:C15.plannedFields.3 |
| internalValue / externalValue | decimal | 是 | planned-model:ReconBreak（不可前端改写） | PLANNED：BFF-FE-009 冻结后同步 wire 映射 | planned:C15.plannedFields.4 |
| reason | string（稳定机器码） | 是 | planned-model:ReconBreak | PLANNED：BFF-FE-009 冻结后同步 wire 映射 | planned:C15.plannedFields.5 |
| evidenceRefs | EvidenceRef[] | 是 | proto:common.v1.EvidenceRef | PLANNED：BFF-FE-009 冻结后同步 wire 映射 | planned:C15.plannedFields.6 |
| rerunRequestedBy / rerunIdempotencyKey | ActorRef / idempotency-key | 重跑时必填 | planned-model:ReconRun | PLANNED：BFF-FE-009 冻结后同步 wire 映射 | planned:C15.plannedFields.7 |

尚未发布 operation：listReconciliationRuns、getReconciliationRun、listReconciliationBreaks、getReconciliationBreak、listLedgerEntries、requestReconciliationRerun、subscribeReconciliationRun；责任任务 BFF-FE-009。以上已发布字段不能用于证明这些 operation 的请求、响应或实时载荷已冻结。

## 17. C16 Alert/Notification

| wire 字段 / 计划字段 | 类型与序列化 | required | 领域源锚 | 领域→wire 映射 / 决策 | wire / 计划源锚 |
|---|---|---|---|---|---|
| alertId | uuid | 是 | planned-model:Alert（F09/X05/X06） | PLANNED：BFF-FE-010 冻结后同步 wire 映射 | planned:C16.plannedFields.0 |
| severity | enum{info, warning, critical} | 是 | planned-model:Alert | PLANNED：BFF-FE-010 冻结后同步 wire 映射 | planned:C16.plannedFields.1 |
| domain | enum{risk, order, market, reconciliation, report, system} | 是 | planned-model:Alert | PLANNED：BFF-FE-010 冻结后同步 wire 映射 | planned:C16.plannedFields.2 |
| accountRef / venueRef | uuid / enum:VenueKind | opt | planned-model:Alert | PLANNED：BFF-FE-010 冻结后同步 wire 映射 | planned:C16.plannedFields.3 |
| status | enum{unacked, acked}（ack≠resolved） | 是 | planned-model:Alert | PLANNED：BFF-FE-010 冻结后同步 wire 映射 | planned:C16.plannedFields.4 |
| occurredAt / asOf | rfc3339 | 是 | planned-model:Alert | PLANNED：BFF-FE-010 冻结后同步 wire 映射 | planned:C16.plannedFields.5 |
| objectRef / correlationId | string / uuid | 是 | planned-model:Alert | PLANNED：BFF-FE-010 冻结后同步 wire 映射 | planned:C16.plannedFields.6 |
| ackActor / ackAt | ActorRef / rfc3339 | acked 后必填 | planned-model:Alert | PLANNED：BFF-FE-010 冻结后同步 wire 映射 | planned:C16.plannedFields.7 |

尚未发布 operation：listAlerts、getAlert、getAlertSubscriptions、ackAlert、unackAlert、saveAlertSubscriptions、subscribeAlerts；责任任务 BFF-FE-010。以上已发布字段不能用于证明这些 operation 的请求、响应或实时载荷已冻结。

## 18. C17 Settings/Browser Platform

| wire 字段 / 计划字段 | 类型与序列化 | required | 领域源锚 | 领域→wire 映射 / 决策 | wire / 计划源锚 |
|---|---|---|---|---|---|
| ProfileSettingsInput.displayName | {"type":"string","minLength":1,"maxLength":80} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettingsInput.displayName |
| ProfileSettingsInput.title | {"type":"string","maxLength":120} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettingsInput.title |
| ProfileSettingsInput.team | {"type":"string","maxLength":120} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettingsInput.team |
| ProfileSettingsInput.locale | {"type":"string","enum":["zh-CN","en"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettingsInput.locale |
| ProfileSettingsInput.timezone | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettingsInput.timezone |
| ProfileSettingsInput.theme | {"type":"string","enum":["system","dark","light"]} | 是 | none | HTTP 枚举包含 system/dark/light | bff:ProfileSettingsInput.theme |
| ProfileSettingsInput.numberFormat | {"type":"string","enum":["comma_dot","space_comma"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettingsInput.numberFormat |
| ProfileSettingsInput.timeDisplay | {"type":"string","enum":["utc_local","local"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettingsInput.timeDisplay |
| ProfileSettingsInput.defaultRoute | {"type":"string","enum":["/command","/research","/portfolio","/markets"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettingsInput.defaultRoute |
| ProfileSettingsInput.density | {"type":"string","enum":["compact","comfortable"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettingsInput.density |
| ProfileSettingsInput.highContrast | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettingsInput.highContrast |
| ProfileSettingsInput.reducedMotion | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettingsInput.reducedMotion |
| ProfileSettings.displayName | {"type":"string","minLength":1,"maxLength":80} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettings.displayName |
| ProfileSettings.title | {"type":"string","maxLength":120} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettings.title |
| ProfileSettings.team | {"type":"string","maxLength":120} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettings.team |
| ProfileSettings.locale | {"type":"string","enum":["zh-CN","en"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettings.locale |
| ProfileSettings.timezone | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettings.timezone |
| ProfileSettings.theme | {"type":"string","enum":["system","dark","light"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettings.theme |
| ProfileSettings.numberFormat | {"type":"string","enum":["comma_dot","space_comma"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettings.numberFormat |
| ProfileSettings.timeDisplay | {"type":"string","enum":["utc_local","local"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettings.timeDisplay |
| ProfileSettings.defaultRoute | {"type":"string","enum":["/command","/research","/portfolio","/markets"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettings.defaultRoute |
| ProfileSettings.density | {"type":"string","enum":["compact","comfortable"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettings.density |
| ProfileSettings.highContrast | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettings.highContrast |
| ProfileSettings.reducedMotion | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettings.reducedMotion |
| ProfileSettings.memberId | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettings.memberId |
| ProfileSettings.email | {"type":"string","format":"email","readOnly":true} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettings.email |
| ProfileSettings.emailVerified | {"type":"boolean","readOnly":true} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettings.emailVerified |
| ProfileSettings.roleLabels | {"type":"array","items":{"type":"string"},"readOnly":true} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettings.roleLabels |
| ProfileSettings.objectVersion | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ProfileSettings.objectVersion |
| NotificationRule.key | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:NotificationRule.key |
| NotificationRule.severity | {"type":"string","enum":["critical","warning","info"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:NotificationRule.severity |
| NotificationRule.inApp | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:NotificationRule.inApp |
| NotificationRule.desktop | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:NotificationRule.desktop |
| NotificationRule.email | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:NotificationRule.email |
| NotificationRule.browser | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:NotificationRule.browser |
| NotificationPreferencesInput.rules | {"type":"array","items":{"$ref":"#/components/schemas/NotificationRule"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:NotificationPreferencesInput.rules |
| NotificationPreferencesInput.quietHoursEnabled | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:NotificationPreferencesInput.quietHoursEnabled |
| NotificationPreferencesInput.quietHoursStart | {"type":"string","pattern":"^([01]\\d&#124;2[0-3]):[0-5]\\d$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:NotificationPreferencesInput.quietHoursStart |
| NotificationPreferencesInput.quietHoursEnd | {"type":"string","pattern":"^([01]\\d&#124;2[0-3]):[0-5]\\d$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:NotificationPreferencesInput.quietHoursEnd |
| NotificationPreferencesInput.criticalBypass | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:NotificationPreferencesInput.criticalBypass |
| NotificationPreferencesInput.digestFrequency | {"type":"string","enum":["off","daily","weekly"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:NotificationPreferencesInput.digestFrequency |
| NotificationPreferences.rules | {"type":"array","items":{"$ref":"#/components/schemas/NotificationRule"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:NotificationPreferences.rules |
| NotificationPreferences.quietHoursEnabled | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:NotificationPreferences.quietHoursEnabled |
| NotificationPreferences.quietHoursStart | {"type":"string","pattern":"^([01]\\d&#124;2[0-3]):[0-5]\\d$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:NotificationPreferences.quietHoursStart |
| NotificationPreferences.quietHoursEnd | {"type":"string","pattern":"^([01]\\d&#124;2[0-3]):[0-5]\\d$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:NotificationPreferences.quietHoursEnd |
| NotificationPreferences.criticalBypass | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:NotificationPreferences.criticalBypass |
| NotificationPreferences.digestFrequency | {"type":"string","enum":["off","daily","weekly"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:NotificationPreferences.digestFrequency |
| NotificationPreferences.objectVersion | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:NotificationPreferences.objectVersion |
| NotificationPreferences.browserPermission | {"type":"string","enum":["granted","denied","default","unsupported"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:NotificationPreferences.browserPermission |
| MfaFactor.factorId | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:MfaFactor.factorId |
| MfaFactor.method | {"type":"string","enum":["passkey","authenticator","recovery_codes"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:MfaFactor.method |
| MfaFactor.label | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:MfaFactor.label |
| MfaFactor.createdAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:MfaFactor.createdAt |
| MfaFactor.lastUsedAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:MfaFactor.lastUsedAt |
| MfaFactor.currentDevice | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:MfaFactor.currentDevice |
| SecuritySettings.posture | {"type":"string","enum":["strong","attention_required","unknown"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:SecuritySettings.posture |
| SecuritySettings.score | {"type":"integer","minimum":0,"maximum":100} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:SecuritySettings.score |
| SecuritySettings.mfaEnabled | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:SecuritySettings.mfaEnabled |
| SecuritySettings.factors | {"type":"array","items":{"$ref":"#/components/schemas/MfaFactor"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:SecuritySettings.factors |
| SecuritySettings.recoveryCodesRemaining | {"type":"integer","minimum":0} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:SecuritySettings.recoveryCodesRemaining |
| SecuritySettings.lastVerifiedAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:SecuritySettings.lastVerifiedAt |
| SecuritySettings.correlationId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:SecuritySettings.correlationId |
| ActiveSession.sessionId | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ActiveSession.sessionId |
| ActiveSession.client | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ActiveSession.client |
| ActiveSession.platform | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ActiveSession.platform |
| ActiveSession.location | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ActiveSession.location |
| ActiveSession.lastActiveAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ActiveSession.lastActiveAt |
| ActiveSession.ipMasked | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ActiveSession.ipMasked |
| ActiveSession.current | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ActiveSession.current |
| TrustedDevice.deviceId | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:TrustedDevice.deviceId |
| TrustedDevice.label | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:TrustedDevice.label |
| TrustedDevice.verificationMethod | {"type":"string","enum":["passkey","biometric","authenticator"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:TrustedDevice.verificationMethod |
| TrustedDevice.trustedUntil | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:TrustedDevice.trustedUntil |
| TrustedDevice.current | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:TrustedDevice.current |
| DownloadRecord.downloadId | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:DownloadRecord.downloadId |
| DownloadRecord.objectLabel | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:DownloadRecord.objectLabel |
| DownloadRecord.format | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:DownloadRecord.format |
| DownloadRecord.requestedAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:DownloadRecord.requestedAt |
| DownloadRecord.status | {"type":"string","enum":["preparing","ready","downloaded","expired","failed"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:DownloadRecord.status |
| DownloadRecord.expiresAt | {"$ref":"#/components/schemas/DateTime"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:DownloadRecord.expiresAt |
| DownloadRecord.downloadUrl | {"type":"string","format":"uri"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:DownloadRecord.downloadUrl |
| DownloadRecord.watermarked | {"type":"boolean"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:DownloadRecord.watermarked |
| DownloadRecord.correlationId | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:DownloadRecord.correlationId |
| BrowserCapabilityPolicy.kind | {"type":"string","enum":["web"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BrowserCapabilityPolicy.kind |
| BrowserCapabilityPolicy.authFlow | {"type":"string","enum":["browser_redirect"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BrowserCapabilityPolicy.authFlow |
| BrowserCapabilityPolicy.notifications | {"type":"string","enum":["browser"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BrowserCapabilityPolicy.notifications |
| BrowserCapabilityPolicy.localFileImport | {"type":"boolean","enum":[false]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BrowserCapabilityPolicy.localFileImport |
| BrowserCapabilityPolicy.deepLinkScheme | {"type":"string","format":"uri"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BrowserCapabilityPolicy.deepLinkScheme |
| BrowserCapabilityPolicy.downloadsViaBff | {"type":"boolean","enum":[true]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BrowserCapabilityPolicy.downloadsViaBff |
| BrowserCapabilityPolicy.offlineDomainActions | {"type":"boolean","enum":[false]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BrowserCapabilityPolicy.offlineDomainActions |
| BrowserCapabilityPolicy.businessPagesNoIndex | {"type":"boolean","enum":[true]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BrowserCapabilityPolicy.businessPagesNoIndex |
| BrowserCapabilityPolicy.cspEnforced | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BrowserCapabilityPolicy.cspEnforced |
| BrowserCapabilityPolicy.sessionProtected | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BrowserCapabilityPolicy.sessionProtected |
| setupMfa.request.method | {"type":"string","enum":["passkey","authenticator"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:setupMfa.request.method |

## 19. 完备性与验收边界

- 共 383 行契约字段（展开后的 wire 属性与计划字段行）；共享 schema 摘要另计，不沿用旧144行口径。
- 必填字段、可选字段、请求与响应按真实 schema 区分；SSE 信封为共享 StreamEvent，载荷版本和实时恢复仍按各 operation 规则执行。
- 已发布部分只证明仓库契约；未配置生成式 MSW 返回501。本地参考 provider 不替代 staging、真实数据库/身份/对象存储或正式签署。
- 当前一期不包含原生控制面；原生接口独立见 [DESK-PRE-04 承接表](./DESK-PRE-04-interface-transfer.md)。
