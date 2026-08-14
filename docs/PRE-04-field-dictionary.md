# PRE-04 字段字典

> 任务：PRE-04 接口盘点  版本：1.0  日期：2026-08-14
> 规则：每个字段必须有 名称 / 类型与序列化 / required / 权威来源 四项，禁止"待开发时再定"。
> 来源标注：`proto:xxx` = 已有 F03 proto 锚；`bff:xxx` = BFF 页面模型新增字段（由 BFF-FE-000–011 在 OpenAPI 定义，proto 无对应对象时以领域服务读模型为权威）。
> JSON 命名 lowerCamelCase；snake_case ↔ camelCase 转换只在生成/transport 层（执行计划 5.3）。

## 1. 共享类型与序列化约定

| 类型记号 | 定义 | 序列化 |
|---|---|---|
| `uuid` | 领域主键/引用 UUID；opaque，不解析业务含义 | string |
| `rfc3339` | 带时区时间；内部 UTC，展示按用户时区并给原始时间 | string（RFC 3339） |
| `decimal` | 数量/价格/比率，proto `DecimalValue.value` | string（十进制定点；禁 IEEE-754 交易计算） |
| `money` | 金额，proto `MoneyValue{currencyCode, units, nanos}` | object |
| `hash` | content/source/image/parameter/input/environment/report hash | string（完整保留） |
| `version` | objectVersion/ETag；危险动作前刷新并携带 expected version | string |
| `cursor` | 分页游标；不持久化为领域数据 | string |
| `idempotency-key` | command 幂等键；同一业务意图重试复用 | header `Idempotency-Key` |
| `enum:*` | 以 proto 枚举为准；未知值显示"未知/需升级"并阻断高风险动作 | string（SCREAMING_SNAKE → 生成层映射） |

通用元数据（全部 command 注入，proto:common.v1.CommandMetadata）：`requestId:uuid`(req)、`tenantId:uuid`(req，BFF 注入)、`workspaceId:uuid`(req，BFF 注入)、`actor:ActorRef`(req，BFF 注入)、`correlationId:uuid`(req)、`causationId:uuid`(opt)、`mode:enum:RuntimeMode`(req)、`environment:enum:Environment`(req)、`issuedAt:rfc3339`(req)。

错误 envelope（bff:ErrorEnvelope）：`code:string`(req)、`message:string`(req，安全可展示)、`correlationId:uuid`(req)、`fieldErrors:map<string,string>`(opt)、`retryAfter:int32`(opt，秒)、`currentVersion:version`(opt)。

SSE 事件信封（bff:StreamEvent）：`streamId:uuid`(req)、`sequence:int64`(req)、`eventId:uuid`(req)、`occurredAt:rfc3339`(req)、`correlationId:uuid`(req)、`payloadVersion:string`(req)、`payload:JsonDocument`(req，proto:common.v1.JsonDocument)。

## 2. C01 Session/Context（bff:SessionContext）

| 字段 | 类型 | required | 来源 |
|---|---|---|---|
| actorId | uuid | 是 | proto:common.v1.ActorRef.actor_id |
| tenantId / workspaceId / accountId | uuid | 是 | bff:SessionContext（映射 F06 主上下文） |
| mode | enum:RuntimeMode | 是 | proto:common.v1.RuntimeMode |
| environment | enum:Environment | 是 | proto:common.v1.Environment |
| capabilities | string[]（capability key） | 是 | bff:SessionContext（F06 capability） |
| mfaState | enum{unenrolled, enrolled, challenged, verified} | 是 | bff:SessionContext |
| expiresAt | rfc3339 | 是 | bff:SessionContext |

## 3. C02 Command Center（bff:CommandCenterView）

| 字段 | 类型 | required | 来源 |
|---|---|---|---|
| riskPosture | enum{normal, elevated, halted} | 是 | bff:CommandCenterView（X02 读模型） |
| dataFreshness | enum{fresh, delayed, stale} + asOf:rfc3339 | 是 | bff:CommandCenterView |
| pendingApprovals / failedRuns / openRiskAlerts | int32 | 是 | bff:CommandCenterView |
| orderSummary | object{mode, submitted, filled, rejected} | 是 | bff:CommandCenterView（X04 投影） |
| alerts | AlertRef[]（见 C16） | 是 | bff:CommandCenterView |
| sampledAt | rfc3339 | 是 | bff:CommandCenterView |

## 4. C03 Research Runtime（proto:research.v1 + bff:ResearchRun）

| 字段 | 类型 | required | 来源 |
|---|---|---|---|
| runId | uuid | 是 | bff:ResearchRun（F07 任务） |
| capability | string | 是 | proto:engine.v1.Capability.name |
| dataSnapshotId | uuid | 是 | proto:research.v1.DataSnapshot.snapshot_id |
| budget / costUnits | decimal | 是 | bff:ResearchRun（F07 成本限额） |
| deadlineAt | rfc3339 | 是 | bff:ResearchRun |
| status | enum{queued, running, succeeded, failed, cancelled, cancel_requested} | 是 | bff:ResearchRun |
| inputHash | hash | 是 | bff:ResearchRun（R03 重放锚） |
| engineVersion | string | 是 | proto:engine.v1.GetMetadataResponse.version |
| artifactRefs / evidenceRefs | ArtifactRef[] / EvidenceRef[] | 是 | proto:common.v1.ArtifactRef / EvidenceRef |
| sequence | int64 | 是（流事件） | bff:StreamEvent.sequence |

## 5. C04 Snapshot/Artifact（proto:research.v1）

| 字段 | 类型 | required | 来源 |
|---|---|---|---|
| snapshotId / artifactId | uuid | 是 | proto:research.v1.DataSnapshot / ResearchArtifact |
| schemaVersion | string | 是 | proto:research.v1.DataSnapshot.schema_version |
| window | TimeWindow | 是 | proto:common.v1.TimeWindow |
| sources | DataSourceRef[] | 是 | proto:common.v1.DataSourceRef |
| quality | enum:DataQuality | 是 | proto:common.v1.DataQuality |
| contentHash | hash | 是 | proto:research.v1.DataSnapshot.content_hash |
| licenseLabel | string | 是 | proto:research.v1.DataSnapshot.license_label |
| capturedAt / maxAge | rfc3339 / int64（秒，proto Duration） | 是 | proto:research.v1.DataSnapshot.captured_at / max_age |
| hypothesis / summary | string | 是 | proto:research.v1.ResearchArtifact |
| engineVersion / promptVersion / codeVersion | string | 是 | proto:research.v1.ResearchArtifact |
| environmentHash | hash | 是 | proto:research.v1.ResearchArtifact.environment_hash |

## 6. C05 Strategy（proto:strategy.v1 + bff:Draft/Backtest）

| 字段 | 类型 | required | 来源 |
|---|---|---|---|
| strategyId / releaseId | uuid | 是 | proto:strategy.v1.StrategyRelease |
| draftVersion / expectedVersion | version | 是 | bff:StrategyDraft（S01 冲突检测） |
| parameters | JsonDocument | 是 | proto:common.v1.JsonDocument |
| snapshotId | uuid | 是 | proto:research.v1.DataSnapshot.snapshot_id |
| reportArtifactId | uuid（回测报告 Artifact 引用，hash 经 Artifact content_hash） | 是 | proto:strategy.v1.StrategyRelease.backtest_report_artifact_id |
| sourceDigest / imageDigest / parameterHash | hash | 是 | proto:strategy.v1.StrategyRelease.source_digest / image_digest / parameter_hash |
| leakViolations | string[]（规则码） | 是 | bff:BacktestReport（S02） |
| allowedTargets | enum:DeploymentTarget[] | 是 | proto:strategy.v1.DeploymentTarget |
| approvalState | enum{none, pending, approved, rejected, expired} | 是 | bff:ReleaseView（S04） |

## 7. C06 Portfolio/Risk（proto:trading.v1.Position + bff:PortfolioView/RiskView）

| 字段 | 类型 | required | 来源 |
|---|---|---|---|
| accountId | uuid | 是 | bff:PortfolioView |
| asOf / stale | rfc3339 / bool | 是 | bff:PortfolioView（X01 读模型） |
| positions | Position[]（symbol, side:enum:PositionSide, quantity:decimal, avgPrice:decimal） | 是 | proto:trading.v1.Position |
| pnl / exposure | money / decimal | 是 | bff:PortfolioView |
| hitRules / limitIds | string[] / uuid[] | 是 | proto:trading.v1.RiskDecision |
| verdict | enum:RiskVerdict | 是 | proto:trading.v1.RiskVerdict |
| killSwitch | enum{disengaged, engaged} + actor + at:rfc3339 | 是 | bff:RiskView（X02） |

## 8. C07 Proposal/Evaluation（proto:trading.v1）

| 字段 | 类型 | required | 来源 |
|---|---|---|---|
| proposalId | uuid | 是 | proto:trading.v1.TradeProposal |
| accountId / symbol | uuid / string | 是 | proto:trading.v1.TradeProposal |
| action | enum:ProposalAction | 是 | proto:trading.v1.ProposalAction |
| quantity / notional | decimal / decimal | 是 | proto:trading.v1.TradeProposal（均为 DecimalValue） |
| signal | Signal（direction:enum:SignalDirection, strength:decimal） | 是 | proto:strategy.v1.Signal |
| rationale | string | 是 | proto:trading.v1.TradeProposal.rationale |
| counterViews | string[]（反方观点，R04 强制） | 是 | proto:trading.v1.TradeProposal.counter_views（2026-08-14 非破坏增补 field 16） |
| evidenceRefs | EvidenceRef[] | 是 | proto:common.v1.EvidenceRef |
| expiresAt | rfc3339 | 是 | proto:trading.v1.TradeProposal |
| executable | bool（恒 false） | 是 | proto:trading.v1.TradeProposal.executable |
| decisionId / signer / decidedAt | uuid / string（签名主体）/ rfc3339 | 评估后必填 | proto:trading.v1.RiskDecision |

## 9. C08 Approval/MFA（bff:Approval）

| 字段 | 类型 | required | 来源 |
|---|---|---|---|
| approvalId | uuid | 是 | bff:Approval（X03 状态机） |
| originator | ActorRef | 是 | proto:common.v1.ActorRef（禁自批判定） |
| objectVersion | version | 是 | bff:Approval |
| decision | enum{approve, reject, request_info} | 是（decide 请求） | bff:Approval |
| reason / note | string | decision≠approve 时必填 | bff:Approval |
| mfaChallengeRef | uuid | 是（高风险） | bff:Approval（F06/L03） |
| status | enum{pending, approved, rejected, expired, conflict} | 是 | bff:Approval |
| expiresAt | rfc3339 | 是 | bff:Approval |
| signature | string（服务端签名） | 批准后必填 | bff:Approval |
| commandRef | uuid | 批准后必填 | proto:trading.v1.TradeCommand.command_id |

## 10. C09 Command/Order（proto:trading.v1）

| 字段 | 类型 | required | 来源 |
|---|---|---|---|
| commandId / decisionId | uuid | 是 | proto:trading.v1.TradeCommand |
| accountId / venue / venueKind / symbol | uuid / string / enum:VenueKind / string | 是 | proto:trading.v1.TradeCommand（venue + venue_kind 双字段） |
| intent / side | enum:OrderIntentType / enum:OrderSide | 是 | proto:trading.v1 |
| quantity / prices | decimal / decimal[] | 是 | proto:trading.v1.TradeCommand |
| idempotencyKey | idempotency-key | 是 | proto:trading.v1.TradeCommand.idempotency_key |
| expiresAt | rfc3339 | 是 | proto:trading.v1.TradeCommand |
| orderId / status | uuid / enum:OrderStatus | 是 | proto:trading.v1.Order |
| filledQuantity / averageFillPrice | decimal / decimal | 是 | proto:trading.v1.Order |
| fills | Fill[]（fillId, quantity:decimal, price:decimal, at:rfc3339） | 是 | proto:trading.v1.Fill |
| sequence / correlationId | int64 / uuid | 是（事件流） | bff:StreamEvent |

## 11. C10 Audit/Export（proto:events.v1 + bff:ExportJob）

| 字段 | 类型 | required | 来源 |
|---|---|---|---|
| correlationId / causationId | uuid | 是 / opt | proto:common.v1.CommandMetadata |
| actor | ActorRef | 是 | proto:common.v1.ActorRef |
| occurredAt | rfc3339 | 是 | proto:events.v1.EventEnvelope.occurred_at |
| objectRef | string（类型+uuid） | 是 | bff:AuditEventRow |
| hash | hash | 是 | proto:events.v1.EventEnvelope（append-only 锚） |
| redactedPayload | JsonDocument | 是 | bff:AuditEventRow（脱敏后） |
| retention | string（保留策略标识） | 是 | bff:AuditEventRow |
| exportId / scope / status | uuid / string / enum{queued, generating, ready, expired, cancelled} | 是 | bff:ExportJob |
| expiresAt / signedUrl | rfc3339 / string（短时） | ready 后必填 | bff:ExportJob |

## 12. C11 Ops/Admin（bff:ServiceHealth/Incident/AdminView）

| 字段 | 类型 | required | 来源 |
|---|---|---|---|
| service / health / latencyMs | string / enum{healthy, degraded, down} / int32 | 是 | bff:ServiceHealth（F09） |
| dlqDepth | int32 | 是 | bff:ServiceHealth（F05 DLQ） |
| incidentId / actionId | uuid / string（白名单枚举） | 是 | bff:Incident（仅批准 actionId） |
| configVersion | version | 是 | bff:AdminView |
| memberId / role | uuid / string | 是 | bff:AdminMember（F06 RBAC） |
| capability / flag | string / string + rollout 配置 | 是 | proto:engine.v1.Capability / bff:FlagView |
| auditRef | uuid（correlationId） | 是 | bff:AdminView |

## 13. C12 Market/Candle（bff:Instrument/VenueQuote/CandleSeries）

| 字段 | 类型 | required | 来源 |
|---|---|---|---|
| canonicalSymbol / productType | string / enum{spot, perp, future} | 是 | bff:Instrument |
| venue | enum:VenueKind | 是 | proto:trading.v1.VenueKind |
| bid / ask / mid | decimal | 是 | bff:VenueQuote |
| feeEstimate / slippageEstimate | money / decimal（标注估算） | 是 | bff:VenueQuote |
| lotSize / minNotional | decimal / money | 是 | bff:VenueQuote |
| source / asOf / latencyMs / quality | string / rfc3339 / int32 / enum:DataQuality | 是 | bff:VenueQuote（每行必备） |
| interval | enum{1m, 5m, 15m, 1h, 4h, 1D, 1W, custom} | 是 | bff:CandleSeries |
| timezone | string（IANA） | 是 | bff:CandleSeries |
| ohlcv | object[]{o,h,l,c,v:decimal, t:rfc3339} | 是 | bff:CandleSeries |
| gaps | TimeWindow[] | 是 | bff:CandleSeries |

## 14. C13 Trade Preflight（bff:PreflightView）

| 字段 | 类型 | required | 来源 |
|---|---|---|---|
| accountId / mode | uuid / enum:RuntimeMode | 是 | bff:PreflightView |
| venueOptions | VenueOption[]（health, asOf, supportedIntents:enum:OrderIntentType[]） | 是 | bff:PreflightView（单 venue 时只读） |
| balanceRef / positionRef | uuid（快照引用） | 是 | bff:PreflightView（X01 读模型） |
| quoteRef | uuid + asOf:rfc3339 | 是 | bff:PreflightView（C12 报价快照） |
| limitImpact | object{limitId:uuid, before:decimal, after:decimal}[] | 是 | bff:PreflightView（X02） |
| objectVersion | version | 是 | bff:PreflightView |
| blockingReasons | string[]（稳定机器码） | 是 | bff:PreflightView |

## 15. C14 Performance/Report（bff:PerformanceView/ReportJob）

| 字段 | 类型 | required | 来源 |
|---|---|---|---|
| accountId / currency | uuid / string（ISO 4217） | 是 | bff:PerformanceView |
| method | enum{twr, mwr, simple} | 是 | bff:PerformanceView（标注口径与适用条件） |
| ledgerVersion / valuationSnapshotId | version / uuid | 是 | bff:PerformanceView（X01/X05） |
| coverage | TimeWindow | 是 | proto:common.v1.TimeWindow |
| asOf | rfc3339 | 是 | bff:PerformanceView |
| pnl / return / drawdown / fees | money / decimal / decimal / money | 是 | bff:PerformanceView |
| provisional | bool | 是 | bff:PerformanceView（未对账强制 true） |
| period / reportVersion | enum{week, month, quarter, year} + 自然/滚动 / version | 是 | bff:ReportJob |
| supersededBy | uuid | opt | bff:ReportJob |

## 16. C15 Reconciliation（bff:ReconRun/Break/LedgerEntry）

| 字段 | 类型 | required | 来源 |
|---|---|---|---|
| runId / accountId / venue | uuid / uuid / enum:VenueKind | 是 | bff:ReconRun（X05） |
| window / ledgerVersion | TimeWindow / version | 是 | bff:ReconRun |
| status | enum:matched / investigating / resolved（+missing_data） | 是 | bff:ReconRun（tokens 状态枚举对齐） |
| breakId | uuid | 是 | bff:ReconBreak |
| internalValue / externalValue | decimal | 是 | bff:ReconBreak（不可前端改写） |
| reason | string（稳定机器码） | 是 | bff:ReconBreak |
| evidenceRefs | EvidenceRef[] | 是 | proto:common.v1.EvidenceRef |
| rerunRequestedBy / rerunIdempotencyKey | ActorRef / idempotency-key | 重跑时必填 | bff:ReconRun |

## 17. C16 Alert/Notification（bff:Alert）

| 字段 | 类型 | required | 来源 |
|---|---|---|---|
| alertId | uuid | 是 | bff:Alert（F09/X05/X06） |
| severity | enum{info, warning, critical} | 是 | bff:Alert |
| domain | enum{risk, order, market, reconciliation, report, system} | 是 | bff:Alert |
| accountRef / venueRef | uuid / enum:VenueKind | opt | bff:Alert |
| status | enum{unacked, acked}（ack≠resolved） | 是 | bff:Alert |
| occurredAt / asOf | rfc3339 | 是 | bff:Alert |
| objectRef / correlationId | string / uuid | 是 | bff:Alert |
| ackActor / ackAt | ActorRef / rfc3339 | acked 后必填 | bff:Alert |

## 18. C17 Settings/Platform（bff:Profile/Session/Device/PlatformCapabilities）

| 字段 | 类型 | required | 来源 |
|---|---|---|---|
| locale / timezone / theme | string / string（IANA）/ enum{dark, light} | 是 | bff:Profile |
| sessionId / deviceId | uuid | 是 | bff:Session / Device |
| notificationPermission | enum{granted, denied, default, unsupported} | 是 | bff:BrowserCapability |
| downloadRecord | object{exportId:uuid, at:rfc3339, scope:string} | 是 | bff:DownloadRecord |
| platformCapabilities | object（authFlow, notifications, localFileImport, deepLinkScheme） | 是 | bff:PlatformCapabilities（L02/L03；不含 token/secret/本地敏感缓存内容） |

## 19. 完备性声明

- 全部 17 个契约的关键字段均有类型、required 与权威来源；无"待开发时再定"字段。
- 新增 bff: 页面模型字段共 9 组（SessionContext、CommandCenterView、ResearchRun、SnapshotView/ArtifactView、StrategyDraft/BacktestReport/ReleaseView、PortfolioView/RiskView、Approval、PreflightView、PerformanceView/ReportJob、ReconRun/Break、Alert、Profile/PlatformCapabilities），由 BFF-FE-000–011 在 OpenAPI 定义并生成 client；proto 已有对象字段以 proto 为唯一事实来源，页面不手写重复 DTO。
