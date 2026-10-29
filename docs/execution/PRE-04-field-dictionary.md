# PRE-04 字段字典

> 版本：1.14；日期：2026-10-29；范围：一期官网与 Web Terminal。
> 由 `scripts/pre04-fields.mjs` 渲染；控制来源：[盘点基线](./PRE-04-inventory-baseline.json)、[OpenAPI](../../bff/openapi/quantos-bff.v1.yaml)、[operation catalog](../../bff/page-operation-catalog.yaml)。

## 1. 字段与来源口径

已发布字段以 OpenAPI 的 wire 名称、required 和完整约束为准；`$ref` 指向同文件 schema。领域字段与 HTTP 字段不同，由 transport/BFF 转换，页面不手写 DTO。`proto:` 是可解析的领域锚；“页面模型新增”不声称存在同名 Proto。

`planned:` 指盘点基线中的字段决策，并由 catalog 的后续任务承接；它不是已发布 schema。计划字段已有名称/类型/必需性决策，发布时必须补 wire schema 与映射；未发布能力不得升级为 Implemented/Integrated。

类型列为 schema 约束的 JSON 摘要（省略说明文案，保留枚举、范围、格式及嵌套 required）；可选不等于允许 null。完整说明见源 OpenAPI。

命令领域元数据见 `proto/quantos/common/v1/common.proto:CommandMetadata`；tenant/workspace/actor 由受信会话注入，客户端不可伪造。HTTP 请求以对应 operation 为准，不要求浏览器传递整个领域元数据。Decimal/Money 保留精确值，UTC 时间、Idempotency-Key、版本/409、错误 correlation、未知枚举阻断与敏感字段规则沿用执行计划 §5.3–5.6。

### 共享 wire 类型

| Schema | 完整类型约束摘要 |
|---|---|
| AssistedObservedOrder | {"type":"object","additionalProperties":false,"required":["orderId","commandId","accountId","symbol","side","quantity","filledQuantity","averageFillPrice","status","submittedAt","updatedAt"],"properties":{"orderId":{"type":"string","minLength":1,"maxLength":128},"commandId":{"$ref":"#/components/schemas/UUID"},"accountId":{"$ref":"#/components/schemas/UUID"},"symbol":{"type":"string","minLength":1,"maxLength":20},"side":{"type":"string","enum":["buy","sell"]},"quantity":{"$ref":"#/components/schemas/DecimalValue"},"filledQuantity":{"$ref":"#/components/schemas/DecimalValue"},"averageFillPrice":{"anyOf":[{"$ref":"#/components/schemas/DecimalValue"},{"type":"null"}]},"status":{"type":"string","minLength":1,"maxLength":32},"submittedAt":{"$ref":"#/components/schemas/DateTime"},"updatedAt":{"$ref":"#/components/schemas/DateTime"}}} |
| AssistedObservedFill | {"type":"object","additionalProperties":false,"required":["fillId","orderId","commandId","accountId","symbol","side","quantity","price","feeCurrency","feeAmount","filledAt","factHash"],"properties":{"fillId":{"type":"string","minLength":1,"maxLength":128},"orderId":{"type":"string","minLength":1,"maxLength":128},"commandId":{"$ref":"#/components/schemas/UUID"},"accountId":{"$ref":"#/components/schemas/UUID"},"symbol":{"type":"string","minLength":1,"maxLength":20},"side":{"type":"string","enum":["buy","sell"]},"quantity":{"$ref":"#/components/schemas/DecimalValue"},"price":{"$ref":"#/components/schemas/DecimalValue"},"feeCurrency":{"type":"string","minLength":1,"maxLength":20},"feeAmount":{"$ref":"#/components/schemas/DecimalValue"},"filledAt":{"$ref":"#/components/schemas/DateTime"},"factHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"}}} |
| AssistedExecutionFacts | {"type":"object","additionalProperties":false,"required":["schemaVersion","requestId","subjectHash","tenantId","workspaceId","accountId","commandId","decisionId","proposalHash","quoteCurrency","outcome","journalAvailable","consumerReady","reason","order","fills","factHashes","nativeSourceHashes","sourceHash","recordedAt","executionAuthority"],"properties":{"schemaVersion":{"type":"string","enum":["quantos-native-execution-facts.v1"]},"requestId":{"$ref":"#/components/schemas/UUID"},"subjectHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"tenantId":{"$ref":"#/components/schemas/UUID"},"workspaceId":{"$ref":"#/components/schemas/UUID"},"accountId":{"$ref":"#/components/schemas/UUID"},"commandId":{"$ref":"#/components/schemas/UUID"},"decisionId":{"$ref":"#/components/schemas/UUID"},"proposalHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"quoteCurrency":{"type":"string","enum":["USDT"]},"outcome":{"type":"string","enum":["accepted","unknown"]},"journalAvailable":{"type":"boolean"},"consumerReady":{"type":"boolean"},"reason":{"type":"string","enum":["OBSERVED_NATIVE_FACTS","OUTCOME_UNRESOLVED","JOURNAL_UNAVAILABLE","FEE_CONVERSION_REQUIRED"]},"order":{"anyOf":[{"$ref":"#/components/schemas/AssistedObservedOrder"},{"type":"null"}]},"fills":{"type":"array","maxItems":10000,"items":{"$ref":"#/components/schemas/AssistedObservedFill"}},"factHashes":{"type":"array","maxItems":20002,"items":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"}},"nativeSourceHashes":{"type":"array","maxItems":20002,"items":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"}},"sourceHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"recordedAt":{"$ref":"#/components/schemas/DateTime"},"executionAuthority":{"type":"boolean","enum":[false]}}} |
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
| ErrorEnvelope | {"type":"object","required":["code","message","correlationId"],"properties":{"code":{"type":"string"},"message":{"type":"string"},"correlationId":{"$ref":"#/components/schemas/UUID"},"fieldErrors":{"type":"object","additionalProperties":{"type":"string"}},"retryAfter":{"type":"integer","minimum":0},"currentVersion":{"type":"string"},"conflictDiff":{"type":"object","properties":{"files":{"type":"object","additionalProperties":{"type":"string"}},"parameters":{"type":"object","additionalProperties":true}},"required":["files","parameters"],"additionalProperties":false}},"additionalProperties":false} |
| Page | {"type":"object","required":["items"],"properties":{"items":{"type":"array","items":{}},"nextCursor":{"type":"string"}}} |
| AsyncAccepted | {"type":"object","required":["jobId","status","correlationId"],"properties":{"jobId":{"$ref":"#/components/schemas/UUID"},"status":{"type":"string","enum":["accepted","cancel_requested"]},"correlationId":{"$ref":"#/components/schemas/UUID"},"auditRef":{"$ref":"#/components/schemas/UUID"}}} |
| AuditedAsyncAccepted | {"allOf":[{"$ref":"#/components/schemas/AsyncAccepted"},{"type":"object","required":["auditRef"],"properties":{"auditRef":{"$ref":"#/components/schemas/UUID"},"mfaEnrollment":{"$ref":"#/components/schemas/MfaEnrollment"}}}]} |
| StreamEvent | {"type":"object","required":["streamId","sequence","eventId","occurredAt","correlationId","payloadVersion","payload"],"properties":{"streamId":{"$ref":"#/components/schemas/UUID"},"sequence":{"type":"integer","format":"int64","minimum":1},"eventId":{"$ref":"#/components/schemas/UUID"},"occurredAt":{"$ref":"#/components/schemas/DateTime"},"correlationId":{"$ref":"#/components/schemas/UUID"},"payloadVersion":{"type":"string","enum":["v1","1"]},"payload":{"type":"object"}}} |
| ApprovalRuleCheck | {"type":"object","required":["rule","breached","limitId"],"properties":{"rule":{"type":"string"},"breached":{"type":"boolean"},"limitId":{"type":"string"}},"additionalProperties":false} |
| ApprovalRiskDecision | {"type":"object","required":["decisionId","proposalId","accountId","mode","verdict","checks","policyVersion","policyRevision","signer","signatureVerifiedByOwner","snapshotHash","factsHash","intentHash","contextHash","decidedAt","expiresAt","issuable"],"properties":{"decisionId":{"$ref":"#/components/schemas/UUID"},"proposalId":{"$ref":"#/components/schemas/UUID"},"accountId":{"$ref":"#/components/schemas/UUID"},"mode":{"type":"string","enum":["paper","shadow"]},"verdict":{"type":"string","enum":["allow","deny","approval_required"]},"checks":{"type":"array","items":{"$ref":"#/components/schemas/ApprovalRuleCheck"}},"policyVersion":{"type":"string"},"policyRevision":{"type":"string"},"signer":{"type":"string"},"signatureVerifiedByOwner":{"type":"boolean"},"snapshotHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"factsHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"intentHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"contextHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"decidedAt":{"$ref":"#/components/schemas/DateTime"},"expiresAt":{"$ref":"#/components/schemas/DateTime"},"issuable":{"type":"boolean","enum":[false]}},"additionalProperties":false} |
| ApprovalCurrentRisk | {"type":"object","required":["contextHash","asOf","expiresAt","verdict","checks","policyVersion","policyRevision"],"properties":{"contextHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"asOf":{"$ref":"#/components/schemas/DateTime"},"expiresAt":{"$ref":"#/components/schemas/DateTime"},"verdict":{"type":"string","enum":["allow","deny","approval_required"]},"checks":{"type":"array","items":{"$ref":"#/components/schemas/ApprovalRuleCheck"}},"policyVersion":{"type":"string"},"policyRevision":{"type":"string"}},"additionalProperties":false} |
| ApprovalImpact | {"type":"object","required":["quoteUnit","equity","grossBefore","grossAfter","symbolBefore","symbolAfter","portfolioAsOf","financialAsOf","venue","venueHealthy","maxOrderNotional","maxLeverage","maxConcentration","approvalThreshold","maxDailyLoss","model"],"properties":{"quoteUnit":{"type":"string"},"equity":{"$ref":"#/components/schemas/DecimalValue"},"grossBefore":{"$ref":"#/components/schemas/DecimalValue"},"grossAfter":{"$ref":"#/components/schemas/DecimalValue"},"symbolBefore":{"$ref":"#/components/schemas/DecimalValue"},"symbolAfter":{"$ref":"#/components/schemas/DecimalValue"},"portfolioAsOf":{"$ref":"#/components/schemas/DateTime"},"financialAsOf":{"$ref":"#/components/schemas/DateTime"},"venue":{"type":"string"},"venueHealthy":{"type":"boolean"},"maxOrderNotional":{"$ref":"#/components/schemas/DecimalValue"},"maxLeverage":{"$ref":"#/components/schemas/DecimalValue"},"maxConcentration":{"$ref":"#/components/schemas/DecimalValue"},"approvalThreshold":{"$ref":"#/components/schemas/DecimalValue"},"maxDailyLoss":{"$ref":"#/components/schemas/DecimalValue"},"model":{"type":"string","enum":["x02_conservative_gross_addition"]}},"additionalProperties":false} |
| ApprovalReviewContext | {"type":"object","required":["accountId","mode","proposal","riskDecision","currentRisk","impact"],"properties":{"accountId":{"$ref":"#/components/schemas/UUID"},"mode":{"type":"string","enum":["paper","shadow"]},"proposal":{"$ref":"#/components/schemas/TradeProposal"},"riskDecision":{"$ref":"#/components/schemas/ApprovalRiskDecision"},"currentRisk":{"$ref":"#/components/schemas/ApprovalCurrentRisk"},"impact":{"$ref":"#/components/schemas/ApprovalImpact"}},"additionalProperties":false} |
| TradeTicketContext | {"type":"object","additionalProperties":false,"required":["symbol","quantity","limitPrice","quoteUnit","equity","availableCash","financialAsOf","venue","venueHealthy","venueObservedAt","policyVersion","policyRevision","inputHash","maxAgeSeconds"],"properties":{"symbol":{"type":"string"},"quantity":{"$ref":"#/components/schemas/DecimalValue"},"limitPrice":{"$ref":"#/components/schemas/DecimalValue"},"quoteUnit":{"type":"string"},"equity":{"$ref":"#/components/schemas/DecimalValue"},"availableCash":{"type":"null"},"financialAsOf":{"$ref":"#/components/schemas/DateTime"},"venue":{"type":"string"},"venueHealthy":{"type":"boolean"},"venueObservedAt":{"$ref":"#/components/schemas/DateTime"},"policyVersion":{"type":"string"},"policyRevision":{"type":"string"},"inputHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"maxAgeSeconds":{"type":"integer","minimum":1,"maximum":60}}} |
| ReconciliationEvidenceRef | {"type":"object","additionalProperties":false,"required":["kind","ref","sourceRef","resolution"],"properties":{"kind":{"type":"string","enum":["order","fill","audit","alert"]},"ref":{"type":"string"},"sourceRef":{"type":"string"},"resolution":{"type":"string","enum":["source_record","bff_audit","x05_exception"]}}} |
| LedgerEntry | {"type":"object","additionalProperties":false,"required":["entryId","runId","accountId","mode","currency","kind","side","ledgerVersion","sourceRef","sourceHash","asOf","amounts","evidenceRefs","day"],"properties":{"entryId":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"runId":{"$ref":"#/components/schemas/UUID"},"accountId":{"$ref":"#/components/schemas/UUID"},"mode":{"type":"string","enum":["shadow"]},"currency":{"type":"string"},"kind":{"type":"string","enum":["snapshot","fill"]},"side":{"type":"string","enum":["expected","actual"]},"ledgerVersion":{"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"},"sourceRef":{"type":"string"},"sourceHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"asOf":{"type":"string","format":"date-time"},"amounts":{"type":"object","additionalProperties":{"$ref":"#/components/schemas/DecimalValue"}},"evidenceRefs":{"type":"array","items":{"$ref":"#/components/schemas/ReconciliationEvidenceRef"}},"day":{"type":"string","format":"date","pattern":"^\\d{4}-\\d{2}-\\d{2}$"}}} |
| PerformanceCoverage | {"type":"object","additionalProperties":false,"required":["requestedStart","requestedEnd","start","end","complete","points","maxIntervalSeconds"],"properties":{"requestedStart":{"type":"string","format":"date-time"},"requestedEnd":{"type":"string","format":"date-time"},"start":{"type":"string","format":"date-time"},"end":{"type":"string","format":"date-time"},"complete":{"type":"boolean"},"points":{"type":"integer","minimum":2},"maxIntervalSeconds":{"type":"integer","enum":[60]}}} |
| PerformancePoint | {"type":"object","additionalProperties":false,"required":["asOf","equity","cumulativeFees","drawdown","ledgerVersion","valuationSnapshotId","reconciliationRunId","provisional"],"properties":{"asOf":{"type":"string","format":"date-time"},"equity":{"$ref":"#/components/schemas/DecimalValue"},"cumulativeFees":{"$ref":"#/components/schemas/DecimalValue"},"drawdown":{"$ref":"#/components/schemas/DecimalValue"},"ledgerVersion":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"valuationSnapshotId":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"reconciliationRunId":{"$ref":"#/components/schemas/UUID"},"provisional":{"type":"boolean"}}} |
| PerformanceAttribution | {"type":"object","additionalProperties":false,"required":["symbol","pnl"],"properties":{"symbol":{"type":"string"},"pnl":{"$ref":"#/components/schemas/DecimalValue"}}} |
| AdminMemberSpec | {"type":"object","additionalProperties":false,"required":["kind","actorId","roleId","active"],"properties":{"kind":{"type":"string","enum":["member"]},"actorId":{"$ref":"#/components/schemas/UUID"},"roleId":{"$ref":"#/components/schemas/UUID"},"active":{"type":"boolean"}}} |
| AdminRoleSpec | {"type":"object","additionalProperties":false,"required":["kind","name","baseRole","permissions"],"properties":{"kind":{"type":"string","enum":["role"]},"name":{"type":"string","minLength":1,"maxLength":64,"pattern":"^[a-zA-Z0-9_.-]+$"},"baseRole":{"type":"string","enum":["owner","operator","approver","viewer","service"]},"permissions":{"type":"array","items":{"type":"string","enum":["ops.read","ops.operate","ops.approve","admin.read","admin.write","alerts.read"]},"maxItems":6}}} |
| AdminPolicySpec | {"type":"object","additionalProperties":false,"required":["kind","name","roleId","deniedCapabilities","active"],"properties":{"kind":{"type":"string","enum":["policy"]},"name":{"type":"string","minLength":1,"maxLength":64,"pattern":"^[a-zA-Z0-9_.-]+$"},"roleId":{"$ref":"#/components/schemas/UUID"},"deniedCapabilities":{"type":"array","items":{"type":"string","enum":["ops.read","ops.operate","ops.approve","admin.read","admin.write","alerts.read"]},"maxItems":6},"active":{"type":"boolean"}}} |
| AdminCapabilitySpec | {"oneOf":[{"$ref":"#/components/schemas/AdminPermissionCapabilitySpec"},{"$ref":"#/components/schemas/AdminEngineCapabilitySpec"}]} |
| AdminFlagSpec | {"type":"object","additionalProperties":false,"required":["kind","name","enabled","rolloutPercent"],"properties":{"kind":{"type":"string","enum":["flag"]},"name":{"type":"string","enum":["alerts-live-view","incident-timeline","admin-catalog-preview","ops-notices"]},"enabled":{"type":"boolean"},"rolloutPercent":{"type":"integer","minimum":0,"maximum":100}}} |
| AdminSpec | {"oneOf":[{"$ref":"#/components/schemas/AdminMemberSpec"},{"$ref":"#/components/schemas/AdminRoleSpec"},{"$ref":"#/components/schemas/AdminPolicySpec"},{"$ref":"#/components/schemas/AdminCapabilitySpec"},{"$ref":"#/components/schemas/AdminFlagSpec"}]} |
| AdminResource | {"oneOf":[{"type":"object","additionalProperties":false,"required":["id","kind","objectVersion","configVersion","deleted","protected","spec"],"properties":{"id":{"$ref":"#/components/schemas/UUID"},"kind":{"type":"string","enum":["members"]},"objectVersion":{"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"},"configVersion":{"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"},"deleted":{"type":"boolean"},"protected":{"type":"boolean"},"spec":{"$ref":"#/components/schemas/AdminMemberSpec"},"auditRef":{"$ref":"#/components/schemas/UUID"},"correlationId":{"$ref":"#/components/schemas/UUID"}}},{"type":"object","additionalProperties":false,"required":["id","kind","objectVersion","configVersion","deleted","protected","spec"],"properties":{"id":{"$ref":"#/components/schemas/UUID"},"kind":{"type":"string","enum":["roles"]},"objectVersion":{"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"},"configVersion":{"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"},"deleted":{"type":"boolean"},"protected":{"type":"boolean"},"spec":{"$ref":"#/components/schemas/AdminRoleSpec"},"auditRef":{"$ref":"#/components/schemas/UUID"},"correlationId":{"$ref":"#/components/schemas/UUID"}}},{"type":"object","additionalProperties":false,"required":["id","kind","objectVersion","configVersion","deleted","protected","spec"],"properties":{"id":{"$ref":"#/components/schemas/UUID"},"kind":{"type":"string","enum":["policies"]},"objectVersion":{"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"},"configVersion":{"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"},"deleted":{"type":"boolean"},"protected":{"type":"boolean"},"spec":{"$ref":"#/components/schemas/AdminPolicySpec"},"auditRef":{"$ref":"#/components/schemas/UUID"},"correlationId":{"$ref":"#/components/schemas/UUID"}}},{"type":"object","additionalProperties":false,"required":["id","kind","objectVersion","configVersion","deleted","protected","spec"],"properties":{"id":{"$ref":"#/components/schemas/UUID"},"kind":{"type":"string","enum":["capabilities"]},"objectVersion":{"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"},"configVersion":{"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"},"deleted":{"type":"boolean"},"protected":{"type":"boolean"},"spec":{"$ref":"#/components/schemas/AdminCapabilitySpec"},"auditRef":{"$ref":"#/components/schemas/UUID"},"correlationId":{"$ref":"#/components/schemas/UUID"}}},{"type":"object","additionalProperties":false,"required":["id","kind","objectVersion","configVersion","deleted","protected","spec"],"properties":{"id":{"$ref":"#/components/schemas/UUID"},"kind":{"type":"string","enum":["feature-flags"]},"objectVersion":{"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"},"configVersion":{"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"},"deleted":{"type":"boolean"},"protected":{"type":"boolean"},"spec":{"$ref":"#/components/schemas/AdminFlagSpec"},"auditRef":{"$ref":"#/components/schemas/UUID"},"correlationId":{"$ref":"#/components/schemas/UUID"}}}]} |
| GovernanceAction | {"type":"object","additionalProperties":false,"required":["reason","mfaChallengeRef","reauthTokenRef","spec"],"properties":{"reason":{"type":"string","minLength":1,"maxLength":256},"mfaChallengeRef":{"$ref":"#/components/schemas/UUID"},"reauthTokenRef":{"$ref":"#/components/schemas/UUID"},"spec":{"$ref":"#/components/schemas/AdminSpec"}}} |
| AdminPermissionCapabilitySpec | {"type":"object","additionalProperties":false,"required":["kind","name","enabled"],"properties":{"kind":{"type":"string","enum":["capability"]},"name":{"type":"string","enum":["ops.read","ops.operate","ops.approve","admin.read","admin.write","alerts.read"]},"enabled":{"type":"boolean"}}} |
| AdminEngineCapabilitySpec | {"type":"object","additionalProperties":false,"required":["kind","reviewId","name","version","description","enabled"],"properties":{"kind":{"type":"string","enum":["engine_capability"]},"reviewId":{"$ref":"#/components/schemas/UUID"},"name":{"type":"string","minLength":1,"maxLength":160},"version":{"type":"string","minLength":1,"maxLength":64},"enabled":{"type":"boolean"}}} |
| CommandItem | {"type":"object","additionalProperties":false,"required":["kind","id","severity","status","occurredAt","objectRef"],"properties":{"kind":{"type":"string","enum":["run","order","approval","alert"]},"id":{"$ref":"#/components/schemas/UUID"},"severity":{"type":"string","enum":["critical","warning","info"]},"status":{"type":"string","minLength":1,"maxLength":32},"occurredAt":{"anyOf":[{"$ref":"#/components/schemas/DateTime"},{"type":"null"}]},"objectRef":{"type":"string","pattern":"^/(research/runs&#124;orders&#124;approvals&#124;operations/alerts)/[a-f0-9-]{36}$"}}} |
| CommandSource | {"type":"object","additionalProperties":false,"required":["domain","status","asOf","sourceHash"],"properties":{"domain":{"type":"string","enum":["research","execution","operations","strategy"]},"status":{"type":"string","enum":["ready","stale","unavailable","forbidden"]},"asOf":{"anyOf":[{"$ref":"#/components/schemas/DateTime"},{"type":"null"}]},"sourceHash":{"anyOf":[{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},{"type":"null"}]}}} |
| AssistedLedgerReceipt | {"type":"object","additionalProperties":false,"required":["requestId","commandId","subjectHash","sourceHash","entryHash","sequence","state","reason","observedFillIds","appliedFillIds"],"properties":{"requestId":{"$ref":"#/components/schemas/UUID"},"commandId":{"$ref":"#/components/schemas/UUID"},"subjectHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"sourceHash":{"anyOf":[{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},{"type":"null"}]},"entryHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"sequence":{"type":"integer","minimum":1,"maximum":100000000},"state":{"type":"string","enum":["applied","quarantined","no_fill_observed"]},"reason":{"type":"string","enum":["OBSERVED_NATIVE_FACTS","OUTCOME_UNRESOLVED","JOURNAL_UNAVAILABLE","FEE_CONVERSION_REQUIRED"]},"observedFillIds":{"type":"array","items":{"type":"string","minLength":1,"maxLength":128},"maxItems":10000},"appliedFillIds":{"type":"array","items":{"type":"string","minLength":1,"maxLength":128},"maxItems":10000}}} |
| AssistedLedgerPosition | {"type":"object","additionalProperties":false,"required":["symbol","quantity","averageEntryPrice","realizedPnl"],"properties":{"symbol":{"type":"string","minLength":1,"maxLength":20},"quantity":{"$ref":"#/components/schemas/DecimalValue"},"averageEntryPrice":{"$ref":"#/components/schemas/DecimalValue"},"realizedPnl":{"$ref":"#/components/schemas/DecimalValue"}}} |
| AssistedReconciliationBinding | {"type":"object","additionalProperties":false,"required":["requestId","commandId","sourceHash","ledgerEntryHash"],"properties":{"requestId":{"$ref":"#/components/schemas/UUID"},"commandId":{"$ref":"#/components/schemas/UUID"},"sourceHash":{"anyOf":[{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},{"type":"null"}]},"ledgerEntryHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"}}} |
| AssistedReconciliationFinding | {"type":"object","additionalProperties":false,"required":["kind","entity","commandId","expected","observed"],"properties":{"kind":{"type":"string","minLength":1,"maxLength":512},"entity":{"type":"string","minLength":1,"maxLength":512},"commandId":{"anyOf":[{"$ref":"#/components/schemas/UUID"},{"type":"null"}]},"expected":{},"observed":{}}} |
| AssistedReconciliationAlertEvidence | {"type":"object","additionalProperties":false,"required":["evidenceId","reportId","scope","finding","binding","ledgerHash","booksHash","observedAt","status","executionAuthority"],"properties":{"evidenceId":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"reportId":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"scope":{"type":"object","additionalProperties":false,"required":["tenantId","workspaceId","accountId"],"properties":{"tenantId":{"$ref":"#/components/schemas/UUID"},"workspaceId":{"$ref":"#/components/schemas/UUID"},"accountId":{"$ref":"#/components/schemas/UUID"}}},"finding":{"$ref":"#/components/schemas/AssistedReconciliationFinding"},"binding":{"anyOf":[{"$ref":"#/components/schemas/AssistedReconciliationBinding"},{"type":"null"}]},"ledgerHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"booksHash":{"anyOf":[{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},{"type":"null"}]},"observedAt":{"$ref":"#/components/schemas/DateTime"},"status":{"type":"string","enum":["OPEN"]},"executionAuthority":{"type":"boolean","enum":[false]}}} |
| AssistedKillEvent | {"type":"object","additionalProperties":false,"required":["eventId","correlationId","sequence","action","scope","actorId","generation","reason","occurredAt","expiresAt","approvalRef","riskReceiptHash","recordHash","unknownPreserved","executionAuthority"],"properties":{"eventId":{"$ref":"#/components/schemas/UUID"},"correlationId":{"$ref":"#/components/schemas/UUID"},"sequence":{"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"},"action":{"type":"string","enum":["engage","approve_release","release"]},"scope":{"type":"string","enum":["global","account"]},"actorId":{"$ref":"#/components/schemas/UUID"},"generation":{"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"},"reason":{"type":"string","maxLength":256},"occurredAt":{"$ref":"#/components/schemas/DateTime"},"expiresAt":{"$ref":"#/components/schemas/DateTime"},"approvalRef":{"anyOf":[{"$ref":"#/components/schemas/UUID"},{"type":"null"}]},"riskReceiptHash":{"anyOf":[{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},{"type":"null"}]},"recordHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"unknownPreserved":{"type":"boolean","enum":[true]},"executionAuthority":{"type":"boolean","enum":[false]}}} |
| AssistedActivationScope | {"type":"object","additionalProperties":false,"required":["tenantId","workspaceId","accountId","mode","featureKey"],"properties":{"tenantId":{"$ref":"#/components/schemas/UUID"},"workspaceId":{"$ref":"#/components/schemas/UUID"},"accountId":{"$ref":"#/components/schemas/UUID"},"mode":{"type":"string","enum":["assisted_live"]},"featureKey":{"type":"string","enum":["execution.assisted-testnet"]}}} |
| AssistedActivationEvent | {"type":"object","additionalProperties":false,"required":["resourceId","eventId","correlationId","version","enabled","validFrom","validUntil","source","actorId","reason","previous","recordHash","unknownPreserved","executionAuthority"],"properties":{"resourceId":{"$ref":"#/components/schemas/UUID"},"eventId":{"$ref":"#/components/schemas/UUID"},"correlationId":{"$ref":"#/components/schemas/UUID"},"version":{"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$","maxLength":20},"enabled":{"type":"boolean"},"validFrom":{"$ref":"#/components/schemas/DateTime"},"validUntil":{"$ref":"#/components/schemas/DateTime"},"source":{"type":"string","enum":["owner_reference_bootstrap","public_c11"]},"actorId":{"oneOf":[{"$ref":"#/components/schemas/UUID"},{"type":"null"}]},"reason":{"type":"string","minLength":1,"maxLength":256},"previous":{"oneOf":[{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},{"type":"null"}]},"recordHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"unknownPreserved":{"type":"boolean","enum":[true]},"executionAuthority":{"type":"boolean","enum":[false]}}} |
| NativeValuationScope | {"type":"object","additionalProperties":false,"required":["tenantId","workspaceId","accountId"],"properties":{"tenantId":{"$ref":"#/components/schemas/UUID"},"workspaceId":{"$ref":"#/components/schemas/UUID"},"accountId":{"$ref":"#/components/schemas/UUID"}}} |
| NativeValuationPosition | {"type":"object","additionalProperties":false,"required":["symbol","quantity","averageEntryPrice","markPrice","marketValue","unrealizedPnl","realizedPnl","markSourceRef","markObservedAt"],"properties":{"symbol":{"type":"string"},"quantity":{"type":"string","pattern":"^-?[0-9]+(?:\\.[0-9]+)?$"},"averageEntryPrice":{"type":"string","pattern":"^-?[0-9]+(?:\\.[0-9]+)?$"},"markPrice":{"type":"string","pattern":"^-?[0-9]+(?:\\.[0-9]+)?$"},"marketValue":{"type":"string","pattern":"^-?[0-9]+(?:\\.[0-9]+)?$"},"unrealizedPnl":{"type":"string","pattern":"^-?[0-9]+(?:\\.[0-9]+)?$"},"realizedPnl":{"type":"string","pattern":"^-?[0-9]+(?:\\.[0-9]+)?$"},"markSourceRef":{"type":"string"},"markObservedAt":{"type":"string","format":"date-time"}}} |
| NativeRiskInputSnapshot | {"type":"object","additionalProperties":false,"required":["schemaVersion","scope","ledgerHash","ledgerAnchor","sourceHash","sourceVersion","sourceTrust","basis","killGeneration","quoteCurrency","positions","quoteCash","equity","realizedPnlToday","unrealizedPnl","totalPnlToday","exposureGross","exposureNet","generatedAt","expiresAt","snapshotHash","executionAuthority"],"properties":{"schemaVersion":{"type":"string","enum":["quantos-native-risk-input-snapshot.v1"]},"scope":{"$ref":"#/components/schemas/NativeValuationScope"},"ledgerHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"ledgerAnchor":{"type":"object","additionalProperties":false,"required":["sequence","head"],"properties":{"sequence":{"type":"integer","minimum":0},"head":{"type":["string","null"],"pattern":"^sha256:[a-f0-9]{64}$"}}},"sourceHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"sourceVersion":{"type":"integer","minimum":1,"maximum":512},"sourceTrust":{"type":"string","enum":["OWNER_AUTHENTICATED_REFERENCE_INPUT_NOT_REAL_MARKET"]},"basis":{"type":"string","enum":["EMPTY_ORIGIN_PLUS_NATIVE_FILLS_NO_EXTERNAL_FLOWS"]},"killGeneration":{"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"},"quoteCurrency":{"type":"string","enum":["USDT"]},"positions":{"type":"array","items":{"$ref":"#/components/schemas/NativeValuationPosition"},"maxItems":256},"quoteCash":{"type":"string","pattern":"^-?[0-9]+(?:\\.[0-9]+)?$"},"equity":{"type":"string","pattern":"^-?[0-9]+(?:\\.[0-9]+)?$"},"realizedPnlToday":{"type":"string","pattern":"^-?[0-9]+(?:\\.[0-9]+)?$"},"unrealizedPnl":{"type":"string","pattern":"^-?[0-9]+(?:\\.[0-9]+)?$"},"totalPnlToday":{"type":"string","pattern":"^-?[0-9]+(?:\\.[0-9]+)?$"},"exposureGross":{"type":"string","pattern":"^-?[0-9]+(?:\\.[0-9]+)?$"},"exposureNet":{"type":"string","pattern":"^-?[0-9]+(?:\\.[0-9]+)?$"},"generatedAt":{"type":"string","format":"date-time"},"expiresAt":{"type":"string","format":"date-time"},"snapshotHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"executionAuthority":{"type":"boolean","enum":[false]}}} |
| NativeValuationView | {"oneOf":[{"type":"object","additionalProperties":false,"required":["schemaVersion","tenantId","workspaceId","accountId","mode","checkedAt","expiresAt","ledgerHash","ledgerAnchor","killGeneration","quarantinedCommandCount","riskInputReady","reason","sourceTrust","executionAuthority","sourceVersions","snapshotCount","sourceHash","sourceVersion","snapshot"],"properties":{"schemaVersion":{"type":"string","enum":["quantos-native-valuation-view.v1"]},"tenantId":{"$ref":"#/components/schemas/UUID"},"workspaceId":{"$ref":"#/components/schemas/UUID"},"accountId":{"$ref":"#/components/schemas/UUID"},"mode":{"type":"string","enum":["assisted_live"]},"checkedAt":{"type":"string","format":"date-time"},"expiresAt":{"type":"string","format":"date-time"},"ledgerHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"ledgerAnchor":{"type":"object","additionalProperties":false,"required":["sequence","head"],"properties":{"sequence":{"type":"integer","minimum":0},"head":{"type":["string","null"],"pattern":"^sha256:[a-f0-9]{64}$"}}},"killGeneration":{"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"},"quarantinedCommandCount":{"type":"integer","enum":[0]},"riskInputReady":{"type":"boolean","enum":[true]},"reason":{"type":"string","enum":["READY_OWNED_REFERENCE_INPUT"]},"sourceTrust":{"type":"string","enum":["OWNER_AUTHENTICATED_REFERENCE_INPUT_NOT_REAL_MARKET"]},"executionAuthority":{"type":"boolean","enum":[false]},"sourceVersions":{"type":"integer","minimum":1,"maximum":512},"snapshotCount":{"type":"integer","minimum":1,"maximum":512},"sourceHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"sourceVersion":{"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"},"snapshot":{"$ref":"#/components/schemas/NativeRiskInputSnapshot"}}},{"type":"object","additionalProperties":false,"required":["schemaVersion","tenantId","workspaceId","accountId","mode","checkedAt","expiresAt","ledgerHash","ledgerAnchor","killGeneration","quarantinedCommandCount","riskInputReady","reason","sourceTrust","executionAuthority","sourceVersions","snapshotCount"],"properties":{"schemaVersion":{"type":"string","enum":["quantos-native-valuation-view.v1"]},"tenantId":{"$ref":"#/components/schemas/UUID"},"workspaceId":{"$ref":"#/components/schemas/UUID"},"accountId":{"$ref":"#/components/schemas/UUID"},"mode":{"type":"string","enum":["assisted_live"]},"checkedAt":{"type":"string","format":"date-time"},"expiresAt":{"type":"string","format":"date-time"},"ledgerHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"ledgerAnchor":{"type":"object","additionalProperties":false,"required":["sequence","head"],"properties":{"sequence":{"type":"integer","minimum":0},"head":{"type":["string","null"],"pattern":"^sha256:[a-f0-9]{64}$"}}},"killGeneration":{"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"},"quarantinedCommandCount":{"type":"integer","minimum":0},"riskInputReady":{"type":"boolean","enum":[false]},"reason":{"type":"string","enum":["SOURCE_UNAVAILABLE","OPEN_ORDER_RESERVATIONS_UNMODELED","UNKNOWN_OR_QUARANTINED_OBLIGATIONS","LEDGER_MISMATCH","LEDGER_TIME_MISMATCH","DAY_ROLLOVER","STALE_SOURCE","INACTIVE_ACCOUNT","MISSING_MARK","STALE_OR_UNTRUSTED_MARK","INVALID_ACCOUNT_CASH_OR_EQUITY"]},"sourceTrust":{"type":"string","enum":["OWNER_AUTHENTICATED_REFERENCE_INPUT_NOT_REAL_MARKET"]},"executionAuthority":{"type":"boolean","enum":[false]},"sourceVersions":{"type":"integer","minimum":0,"maximum":512},"snapshotCount":{"type":"integer","minimum":0,"maximum":512},"sourceHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"sourceVersion":{"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"}}}]} |
| NativeCurrentRiskDecision | {"type":"object","additionalProperties":false,"required":["decisionId","verdict","purpose","proposalHash","snapshotHash","intentHash","factsHash","policyVersion","killGeneration","checks","decidedAt","expiresAt","signer","signature","executionAuthority"],"properties":{"decisionId":{"$ref":"#/components/schemas/UUID"},"verdict":{"type":"string","enum":["deny","approval_required"]},"purpose":{"type":"string","enum":["assisted_testnet_review"]},"proposalHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"snapshotHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"intentHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"factsHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"policyVersion":{"type":"string","minLength":1},"killGeneration":{"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"},"checks":{"type":"array","minItems":15,"maxItems":15,"items":{"type":"object","additionalProperties":false,"required":["rule","breached","limit_id"],"properties":{"rule":{"type":"string","enum":["identity","numbers","precision","global_kill","account_kill","release","snapshot","financials","venue","duplicate","order_notional","leverage","concentration","daily_loss","approval"]},"breached":{"type":"boolean"},"limit_id":{"type":"string","minLength":1}}}},"decidedAt":{"type":"string","format":"date-time"},"expiresAt":{"type":"string","format":"date-time"},"signer":{"type":"string","minLength":1},"signature":{"type":"string","pattern":"^[a-f0-9]{64}$"},"executionAuthority":{"type":"boolean","enum":[false]}}} |
| NativeRiskReviewView | {"oneOf":[{"type":"object","additionalProperties":false,"required":["schemaVersion","previousSubjectId","proposalId","proposalHash","snapshotHash","ledgerHash","sourceHash","sourceVersion","sourceTrust","killGeneration","decision","executionAuthority"],"properties":{"schemaVersion":{"type":"string","enum":["quantos-native-risk-review.v1"]},"previousSubjectId":{"$ref":"#/components/schemas/UUID"},"proposalId":{"type":"string","minLength":1},"proposalHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"snapshotHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"ledgerHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"sourceHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"sourceVersion":{"type":"string","pattern":"^[1-9][0-9]*$"},"sourceTrust":{"type":"string","enum":["OWNER_AUTHENTICATED_REFERENCE_INPUT_NOT_REAL_MARKET"]},"killGeneration":{"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"},"decision":{"type":"object","additionalProperties":false,"required":["decisionId","verdict","purpose","proposalHash","snapshotHash","intentHash","factsHash","policyVersion","killGeneration","checks","decidedAt","expiresAt","signer","signature","executionAuthority"],"properties":{"decisionId":{"$ref":"#/components/schemas/UUID"},"verdict":{"type":"string","enum":["deny"]},"purpose":{"type":"string","enum":["assisted_testnet_review"]},"proposalHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"snapshotHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"intentHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"factsHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"policyVersion":{"type":"string","minLength":1},"killGeneration":{"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"},"checks":{"type":"array","minItems":15,"maxItems":15,"items":{"type":"object","additionalProperties":false,"required":["rule","breached","limit_id"],"properties":{"rule":{"type":"string","enum":["identity","numbers","precision","global_kill","account_kill","release","snapshot","financials","venue","duplicate","order_notional","leverage","concentration","daily_loss","approval"]},"breached":{"type":"boolean"},"limit_id":{"type":"string","minLength":1}}}},"decidedAt":{"type":"string","format":"date-time"},"expiresAt":{"type":"string","format":"date-time"},"signer":{"type":"string","minLength":1},"signature":{"type":"string","pattern":"^[a-f0-9]{64}$"},"executionAuthority":{"type":"boolean","enum":[false]}}},"executionAuthority":{"type":"boolean","enum":[false]}}},{"type":"object","additionalProperties":false,"required":["schemaVersion","previousSubjectId","proposalId","proposalHash","snapshotHash","ledgerHash","sourceHash","sourceVersion","sourceTrust","killGeneration","decision","executionAuthority","subject"],"properties":{"schemaVersion":{"type":"string","enum":["quantos-native-risk-review.v1"]},"previousSubjectId":{"$ref":"#/components/schemas/UUID"},"proposalId":{"type":"string","minLength":1},"proposalHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"snapshotHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"ledgerHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"sourceHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"sourceVersion":{"type":"string","pattern":"^[1-9][0-9]*$"},"sourceTrust":{"type":"string","enum":["OWNER_AUTHENTICATED_REFERENCE_INPUT_NOT_REAL_MARKET"]},"killGeneration":{"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"},"decision":{"type":"object","additionalProperties":false,"required":["decisionId","verdict","purpose","proposalHash","snapshotHash","intentHash","factsHash","policyVersion","killGeneration","checks","decidedAt","expiresAt","signer","signature","executionAuthority"],"properties":{"decisionId":{"$ref":"#/components/schemas/UUID"},"verdict":{"type":"string","enum":["approval_required"]},"purpose":{"type":"string","enum":["assisted_testnet_review"]},"proposalHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"snapshotHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"intentHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"factsHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"policyVersion":{"type":"string","minLength":1},"killGeneration":{"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"},"checks":{"type":"array","minItems":15,"maxItems":15,"items":{"type":"object","additionalProperties":false,"required":["rule","breached","limit_id"],"properties":{"rule":{"type":"string","enum":["identity","numbers","precision","global_kill","account_kill","release","snapshot","financials","venue","duplicate","order_notional","leverage","concentration","daily_loss","approval"]},"breached":{"type":"boolean"},"limit_id":{"type":"string","minLength":1}}}},"decidedAt":{"type":"string","format":"date-time"},"expiresAt":{"type":"string","format":"date-time"},"signer":{"type":"string","minLength":1},"signature":{"type":"string","pattern":"^[a-f0-9]{64}$"},"executionAuthority":{"type":"boolean","enum":[false]}}},"executionAuthority":{"type":"boolean","enum":[false]},"subject":{"$ref":"#/components/schemas/AssistedSubject"}}}]} |
| NativeSubjectRiskBinding | {"type":"object","additionalProperties":false,"required":["snapshotHash","ledgerHash","sourceHash","sourceVersion","killGeneration","expiresAt","executionAuthority"],"properties":{"snapshotHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"ledgerHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"sourceHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"sourceVersion":{"type":"string","pattern":"^[1-9][0-9]*$"},"killGeneration":{"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"},"expiresAt":{"type":"string","format":"date-time"},"executionAuthority":{"type":"boolean","enum":[false]}}} |
| NativeRiskCandidate | {"type":"object","additionalProperties":false,"required":["subjectId","proposalId","proposalHash","proposalExpiresAt","accountId","symbol","side","quantity","limitPrice","executionAuthority"],"properties":{"subjectId":{"$ref":"#/components/schemas/UUID"},"proposalId":{"type":"string","minLength":1},"proposalHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"proposalExpiresAt":{"type":"string","format":"date-time"},"accountId":{"$ref":"#/components/schemas/UUID"},"symbol":{"type":"string"},"side":{"type":"string","enum":["buy","sell"]},"quantity":{"type":"string","pattern":"^[0-9]+(?:\\.[0-9]+)?$"},"limitPrice":{"type":"string","pattern":"^[0-9]+(?:\\.[0-9]+)?$"},"executionAuthority":{"type":"boolean","enum":[false]}}} |

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
| reauth.request.challengeRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:reauth.request.challengeRef |
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
| CommandSummary.accountId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:CommandSummary.accountId |
| CommandSummary.mode | {"$ref":"#/components/schemas/RuntimeMode"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:CommandSummary.mode |
| CommandSummary.sampledAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:CommandSummary.sampledAt |
| CommandSummary.asOf | {"anyOf":[{"$ref":"#/components/schemas/DateTime"},{"type":"null"}]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:CommandSummary.asOf |
| CommandSummary.expiresAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:CommandSummary.expiresAt |
| CommandSummary.revision | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:CommandSummary.revision |
| CommandSummary.partial | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:CommandSummary.partial |
| CommandSummary.dataFreshness | {"type":"string","enum":["fresh","stale","unavailable"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:CommandSummary.dataFreshness |
| CommandSummary.riskPosture | {"type":"string","enum":["normal","elevated","halted","unknown"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:CommandSummary.riskPosture |
| CommandSummary.systemHealth | {"anyOf":[{"type":"string","enum":["healthy","degraded"]},{"type":"null"}]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:CommandSummary.systemHealth |
| CommandSummary.pendingApprovals | {"anyOf":[{"type":"integer","minimum":0,"maximum":4000},{"type":"null"}]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:CommandSummary.pendingApprovals |
| CommandSummary.failedRuns | {"anyOf":[{"type":"integer","minimum":0,"maximum":2000},{"type":"null"}]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:CommandSummary.failedRuns |
| CommandSummary.runningRuns | {"anyOf":[{"type":"integer","minimum":0,"maximum":2000},{"type":"null"}]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:CommandSummary.runningRuns |
| CommandSummary.openRiskAlerts | {"anyOf":[{"type":"integer","minimum":0,"maximum":2000},{"type":"null"}]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:CommandSummary.openRiskAlerts |
| CommandSummary.orderSummary | {"anyOf":[{"type":"object","additionalProperties":false,"required":["mode","submitted","filled","rejected"],"properties":{"mode":{"type":"string","enum":["paper","shadow"]},"submitted":{"type":"integer","minimum":0,"maximum":2000},"filled":{"type":"integer","minimum":0,"maximum":2000},"rejected":{"type":"integer","minimum":0,"maximum":2000}}},{"type":"null"}]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:CommandSummary.orderSummary |
| CommandSummary.priority | {"type":"array","maxItems":50,"items":{"$ref":"#/components/schemas/CommandItem"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:CommandSummary.priority |
| CommandSummary.recentActivity | {"type":"array","maxItems":50,"items":{"$ref":"#/components/schemas/CommandItem"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:CommandSummary.recentActivity |
| CommandSummary.sources | {"type":"array","minItems":4,"maxItems":4,"items":{"$ref":"#/components/schemas/CommandSource"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:CommandSummary.sources |
| CommandSummary.bounded | {"type":"object","additionalProperties":false,"required":["sourceCount","rowLimit","itemLimit","truncated"],"properties":{"sourceCount":{"type":"integer","enum":[4]},"rowLimit":{"type":"integer","enum":[2000]},"itemLimit":{"type":"integer","enum":[50]},"truncated":{"type":"boolean"}}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:CommandSummary.bounded |

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
| ResearchRun.inputHash | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ResearchRun.inputHash |
| ResearchRun.engineVersion | {"type":"string"} | 是 | proto:engine.v1.GetMetadataResponse.engine_version | 领域引擎版本，HTTP string | bff:ResearchRun.engineVersion |
| ResearchRun.artifactRefs | {"type":"array","items":{"$ref":"#/components/schemas/UUID"}} | 否 | proto:common.v1.ArtifactRef.artifact_id | 领域引用对象提取 artifact_id，HTTP 为 UUID[] | bff:ResearchRun.artifactRefs |
| ResearchRun.evidenceRefs | {"type":"array","items":{"$ref":"#/components/schemas/UUID"}} | 是 | proto:common.v1.EvidenceRef.evidence_id | 领域引用对象提取 evidence_id，HTTP 为 UUID[] | bff:ResearchRun.evidenceRefs |
| ResearchRun.correlationId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ResearchRun.correlationId |
| ResearchRun.createdAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ResearchRun.createdAt |
| ResearchRun.auditRef | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ResearchRun.auditRef |
| ResearchAccepted.jobId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ResearchAccepted.jobId |
| ResearchAccepted.status | {"type":"string","enum":["accepted","cancel_requested"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ResearchAccepted.status |
| ResearchAccepted.correlationId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ResearchAccepted.correlationId |
| ResearchAccepted.auditRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ResearchAccepted.auditRef |
| ResearchAccepted.statusRef | {"type":"string","pattern":"^/v1/research-runs/[a-f0-9-]{36}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ResearchAccepted.statusRef |
| createResearchRun.request.capability | {"type":"string","enum":["research.hypothesis.v1","research.experiment.v1"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createResearchRun.request.capability |
| createResearchRun.request.dataSnapshotId | {"type":"string","format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createResearchRun.request.dataSnapshotId |
| createResearchRun.request.question | {"type":"string","minLength":1,"maxLength":8000} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createResearchRun.request.question |
| createResearchRun.request.budget | {"type":"string","pattern":"^[1-9][0-9]{0,6}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createResearchRun.request.budget |
| createResearchRun.request.deadlineAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createResearchRun.request.deadlineAt |
| createResearchRun.request.attachments | {"type":"array","items":{"type":"string","format":"uuid"},"maxItems":16,"uniqueItems":true} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createResearchRun.request.attachments |

## 5. C04 Snapshot/Artifact

| wire 字段 / 计划字段 | 类型与序列化 | required | 领域源锚 | 领域→wire 映射 / 决策 | wire / 计划源锚 |
|---|---|---|---|---|---|
| DataSnapshot.snapshotId | {"$ref":"#/components/schemas/UUID"} | 是 | proto:research.v1.DataSnapshot.snapshot_id | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:DataSnapshot.snapshotId |
| DataSnapshot.schemaVersion | {"type":"string"} | 是 | proto:research.v1.DataSnapshot.schema_version | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:DataSnapshot.schemaVersion |
| DataSnapshot.window | {"$ref":"#/components/schemas/TimeWindow"} | 是 | proto:research.v1.DataSnapshot.window | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:DataSnapshot.window |
| DataSnapshot.sources | {"type":"array","items":{"type":"string"},"minItems":1} | 是 | proto:common.v1.DataSourceRef.source_id | 领域 DataSourceRef[] 提取 source_id；HTTP string[]，可选 | bff:DataSnapshot.sources |
| DataSnapshot.quality | {"$ref":"#/components/schemas/DataQuality"} | 是 | proto:research.v1.DataSnapshot.quality | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:DataSnapshot.quality |
| DataSnapshot.qualityBlocked | {"type":"boolean"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:DataSnapshot.qualityBlocked |
| DataSnapshot.contentHash | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | proto:research.v1.DataSnapshot.content_hash | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:DataSnapshot.contentHash |
| DataSnapshot.licenseLabel | {"type":"string","minLength":1} | 是 | proto:research.v1.DataSnapshot.license_label | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:DataSnapshot.licenseLabel |
| DataSnapshot.capturedAt | {"$ref":"#/components/schemas/DateTime"} | 是 | proto:research.v1.DataSnapshot.captured_at | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:DataSnapshot.capturedAt |
| DataSnapshot.maxAgeSeconds | {"type":"integer","format":"int64","minimum":0} | 是 | proto:research.v1.DataSnapshot.max_age | Proto Duration 转为 int64 秒；HTTP 名 maxAgeSeconds | bff:DataSnapshot.maxAgeSeconds |
| DataSnapshot.auditRef | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:DataSnapshot.auditRef |
| Artifact.artifactId | {"$ref":"#/components/schemas/UUID"} | 是 | proto:research.v1.ResearchArtifact.artifact_id | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Artifact.artifactId |
| Artifact.hypothesis | {"type":"string"} | 是 | proto:research.v1.ResearchArtifact.hypothesis | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Artifact.hypothesis |
| Artifact.summary | {"type":"string"} | 是 | proto:research.v1.ResearchArtifact.summary | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Artifact.summary |
| Artifact.engineVersion | {"type":"string"} | 是 | proto:research.v1.ResearchArtifact.engine_version | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Artifact.engineVersion |
| Artifact.promptVersion | {"type":"string"} | 是 | proto:research.v1.ResearchArtifact.prompt_version | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Artifact.promptVersion |
| Artifact.codeVersion | {"type":"string"} | 是 | proto:research.v1.ResearchArtifact.code_version | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Artifact.codeVersion |
| Artifact.environmentHash | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | proto:research.v1.ResearchArtifact.environment_hash | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Artifact.environmentHash |
| Artifact.dataSnapshotId | {"$ref":"#/components/schemas/UUID"} | 是 | proto:research.v1.ResearchArtifact.data_snapshot_id | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Artifact.dataSnapshotId |
| Artifact.contentHash | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | proto:research.v1.ResearchArtifact.content_hash | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Artifact.contentHash |
| Artifact.lineageRefs | {"type":"array","items":{"$ref":"#/components/schemas/UUID"}} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Artifact.lineageRefs |
| Artifact.createdAt | {"$ref":"#/components/schemas/DateTime"} | 是 | proto:research.v1.ResearchArtifact.created_at | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Artifact.createdAt |
| Artifact.auditRef | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Artifact.auditRef |
| ArtifactAttachment.artifactId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ArtifactAttachment.artifactId |
| ArtifactAttachment.mediaType | {"type":"string","enum":["application/json"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ArtifactAttachment.mediaType |
| ArtifactAttachment.contentHash | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ArtifactAttachment.contentHash |
| ArtifactAttachment.content | {"type":"object"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ArtifactAttachment.content |
| ArtifactAttachment.auditRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ArtifactAttachment.auditRef |
| ArtifactAttachment.correlationId | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ArtifactAttachment.correlationId |

## 6. C05 Strategy

| wire 字段 / 计划字段 | 类型与序列化 | required | 领域源锚 | 领域→wire 映射 / 决策 | wire / 计划源锚 |
|---|---|---|---|---|---|
| StrategySummary.strategyId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:StrategySummary.strategyId |
| StrategySummary.name | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:StrategySummary.name |
| StrategySummary.updatedAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:StrategySummary.updatedAt |
| StrategyDraft.strategyId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:StrategyDraft.strategyId |
| StrategyDraft.objectVersion | {"type":"string"} | 是 | none | BFF 草稿 objectVersion；旧 draftVersion 仅领域概念，不作为 wire 名 | bff:StrategyDraft.objectVersion |
| StrategyDraft.files | {"type":"object","additionalProperties":{"type":"string"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:StrategyDraft.files |
| StrategyDraft.parameters | {"type":"object","additionalProperties":true} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:StrategyDraft.parameters |
| StrategyDraft.updatedAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:StrategyDraft.updatedAt |
| StrategyDraft.dataSnapshotId | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:StrategyDraft.dataSnapshotId |
| StrategyDraft.artifactRefs | {"type":"array","items":{"type":"object","additionalProperties":true}} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:StrategyDraft.artifactRefs |
| BacktestReport.runId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BacktestReport.runId |
| BacktestReport.strategyId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BacktestReport.strategyId |
| BacktestReport.dataSnapshotId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BacktestReport.dataSnapshotId |
| BacktestReport.status | {"$ref":"#/components/schemas/TaskStatus"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BacktestReport.status |
| BacktestReport.metrics | {"type":"object","additionalProperties":{"$ref":"#/components/schemas/DecimalValue"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BacktestReport.metrics |
| BacktestReport.leakViolations | {"type":"array","items":{"type":"string"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BacktestReport.leakViolations |
| BacktestReport.reportArtifactId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BacktestReport.reportArtifactId |
| BacktestReport.objectVersion | {"type":"string"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BacktestReport.objectVersion |
| BacktestReport.reportHash | {"type":"string"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BacktestReport.reportHash |
| StrategyRelease.releaseId | {"$ref":"#/components/schemas/UUID"} | 是 | proto:strategy.v1.StrategyRelease.release_id | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:StrategyRelease.releaseId |
| StrategyRelease.strategyId | {"$ref":"#/components/schemas/UUID"} | 是 | proto:strategy.v1.StrategyRelease.strategy_id | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:StrategyRelease.strategyId |
| StrategyRelease.backtestReportArtifactId | {"$ref":"#/components/schemas/UUID"} | 是 | proto:strategy.v1.StrategyRelease.backtest_report_artifact_id | 保持报告 Artifact 引用，不改成 reportHash | bff:StrategyRelease.backtestReportArtifactId |
| StrategyRelease.sourceDigest | {"type":"string"} | 是 | proto:strategy.v1.StrategyRelease.source_digest | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:StrategyRelease.sourceDigest |
| StrategyRelease.imageDigest | {"type":"string"} | 是 | proto:strategy.v1.StrategyRelease.image_digest | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:StrategyRelease.imageDigest |
| StrategyRelease.parameterHash | {"type":"string"} | 是 | proto:strategy.v1.StrategyRelease.parameter_hash | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:StrategyRelease.parameterHash |
| StrategyRelease.parameters | {"type":"object","additionalProperties":true} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:StrategyRelease.parameters |
| StrategyRelease.snapshotId | {"$ref":"#/components/schemas/UUID"} | 是 | proto:strategy.v1.StrategyRelease.data_snapshot_id | HTTP 使用 snapshotId，保留同一 UUID 引用 | bff:StrategyRelease.snapshotId |
| StrategyRelease.allowedTargets | {"type":"array","items":{"type":"string","enum":["paper","shadow","assisted_live"]}} | 是 | proto:strategy.v1.StrategyRelease.allowed_targets | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:StrategyRelease.allowedTargets |
| StrategyRelease.approvalState | {"type":"string","enum":["none","pending","approved","rejected","expired"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:StrategyRelease.approvalState |
| StrategyRelease.createdAt | {"$ref":"#/components/schemas/DateTime"} | 是 | proto:strategy.v1.StrategyRelease.created_at | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:StrategyRelease.createdAt |
| StrategyRelease.objectVersion | {"type":"string"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:StrategyRelease.objectVersion |
| StrategyRelease.contentHash | {"type":"string"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:StrategyRelease.contentHash |
| StrategyRelease.expiresAt | {"$ref":"#/components/schemas/DateTime"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:StrategyRelease.expiresAt |
| StrategyRelease.approvalTimeline | {"type":"array","items":{"type":"object"}} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:StrategyRelease.approvalTimeline |
| saveStrategyDraft.request.files | {"type":"object","additionalProperties":{"type":"string"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:saveStrategyDraft.request.files |
| saveStrategyDraft.request.parameters | {"type":"object","additionalProperties":true} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:saveStrategyDraft.request.parameters |
| createBacktest.request.strategyId | {"type":"string","format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createBacktest.request.strategyId |
| createBacktest.request.objectVersion | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createBacktest.request.objectVersion |
| createBacktest.request.dataSnapshotId | {"type":"string","format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createBacktest.request.dataSnapshotId |
| createRelease.request.strategyId | {"type":"string","format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createRelease.request.strategyId |
| createRelease.request.objectVersion | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createRelease.request.objectVersion |
| createRelease.request.backtestRunId | {"type":"string","format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createRelease.request.backtestRunId |
| createRelease.request.parameters | {"type":"object","additionalProperties":true} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createRelease.request.parameters |
| requestReleaseRollback.request.targetReleaseId | {"type":"string","format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:requestReleaseRollback.request.targetReleaseId |

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
| RiskView.correlationId | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:RiskView.correlationId |
| RiskView.objectVersion | {"type":"string"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:RiskView.objectVersion |
| RiskView.auditRef | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:RiskView.auditRef |
| Position.symbol | {"type":"string"} | 是 | proto:trading.v1.Position.symbol | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Position.symbol |
| Position.side | {"type":"string","enum":["long","short"]} | 是 | proto:trading.v1.Position.side | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Position.side |
| Position.quantity | {"$ref":"#/components/schemas/DecimalValue"} | 是 | proto:trading.v1.Position.quantity | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Position.quantity |
| Position.avgPrice | {"$ref":"#/components/schemas/DecimalValue"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Position.avgPrice |
| AssistedKillIntent.scope | {"type":"string","enum":["global","account"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillIntent.scope |
| AssistedKillIntent.accountId | {"anyOf":[{"$ref":"#/components/schemas/UUID"},{"type":"null"}]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillIntent.accountId |
| AssistedKillIntent.expectedGeneration | {"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillIntent.expectedGeneration |
| AssistedKillIntent.reason | {"type":"string","minLength":1,"maxLength":256} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillIntent.reason |
| AssistedKillIntent.confirmPhrase | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillIntent.confirmPhrase |
| AssistedKillIntent.mfaChallengeRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillIntent.mfaChallengeRef |
| AssistedKillIntent.reauthTokenRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillIntent.reauthTokenRef |
| AssistedKillIntent.approvalRef | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillIntent.approvalRef |
| AssistedKillReceipt.schemaVersion | {"type":"string","enum":["quantos-current-kill-receipt.v1"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillReceipt.schemaVersion |
| AssistedKillReceipt.event | {"$ref":"#/components/schemas/AssistedKillEvent"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillReceipt.event |
| AssistedKillReceipt.readCurrentState | {"type":"boolean","enum":[true]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillReceipt.readCurrentState |
| AssistedKillReceipt.executionAuthority | {"type":"boolean","enum":[false]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillReceipt.executionAuthority |
| AssistedKillView.schemaVersion | {"type":"string","enum":["quantos-current-kill-controls.v1"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillView.schemaVersion |
| AssistedKillView.tenantId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillView.tenantId |
| AssistedKillView.workspaceId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillView.workspaceId |
| AssistedKillView.accountId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillView.accountId |
| AssistedKillView.mode | {"type":"string","enum":["assisted_live"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillView.mode |
| AssistedKillView.generation | {"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillView.generation |
| AssistedKillView.globalActive | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillView.globalActive |
| AssistedKillView.accountActive | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillView.accountActive |
| AssistedKillView.nativeStopped | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillView.nativeStopped |
| AssistedKillView.permanentNativeStop | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillView.permanentNativeStop |
| AssistedKillView.nativeGeneration | {"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillView.nativeGeneration |
| AssistedKillView.protectedCommands | {"type":"integer","minimum":0} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillView.protectedCommands |
| AssistedKillView.unknownCommands | {"type":"integer","minimum":0} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillView.unknownCommands |
| AssistedKillView.canEngageAccount | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillView.canEngageAccount |
| AssistedKillView.canEngageGlobal | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillView.canEngageGlobal |
| AssistedKillView.canApproveRelease | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillView.canApproveRelease |
| AssistedKillView.canRelease | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillView.canRelease |
| AssistedKillView.history | {"type":"array","maxItems":100,"items":{"$ref":"#/components/schemas/AssistedKillEvent"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillView.history |
| AssistedKillView.historyTruncated | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillView.historyTruncated |
| AssistedKillView.releaseApprovals | {"type":"array","maxItems":100,"items":{"$ref":"#/components/schemas/AssistedKillEvent"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillView.releaseApprovals |
| AssistedKillView.checkedAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillView.checkedAt |
| AssistedKillView.expiresAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillView.expiresAt |
| AssistedKillView.unknownPreserved | {"type":"boolean","enum":[true]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillView.unknownPreserved |
| AssistedKillView.executionAuthority | {"type":"boolean","enum":[false]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedKillView.executionAuthority |
| AssistedLedgerView.schemaVersion | {"type":"string","enum":["quantos-native-ledger.v1"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedLedgerView.schemaVersion |
| AssistedLedgerView.tenantId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedLedgerView.tenantId |
| AssistedLedgerView.workspaceId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedLedgerView.workspaceId |
| AssistedLedgerView.accountId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedLedgerView.accountId |
| AssistedLedgerView.quoteCurrency | {"type":"string","enum":["USDT"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedLedgerView.quoteCurrency |
| AssistedLedgerView.ledgerHash | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedLedgerView.ledgerHash |
| AssistedLedgerView.anchor | {"type":"object","additionalProperties":false,"required":["sequence","head"],"properties":{"sequence":{"type":"integer","minimum":0,"maximum":100000000},"head":{"anyOf":[{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},{"type":"null"}]}}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedLedgerView.anchor |
| AssistedLedgerView.consumerReady | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedLedgerView.consumerReady |
| AssistedLedgerView.valuationReady | {"type":"boolean","enum":[false]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedLedgerView.valuationReady |
| AssistedLedgerView.executionAuthority | {"type":"boolean","enum":[false]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedLedgerView.executionAuthority |
| AssistedLedgerView.scope | {"type":"string","enum":["OBSERVED_NATIVE_FILLS_ONLY"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedLedgerView.scope |
| AssistedLedgerView.appliedFillCount | {"type":"integer","minimum":0,"maximum":100000000} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedLedgerView.appliedFillCount |
| AssistedLedgerView.quarantinedCommandCount | {"type":"integer","minimum":0,"maximum":100000000} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedLedgerView.quarantinedCommandCount |
| AssistedLedgerView.quoteCashDelta | {"$ref":"#/components/schemas/DecimalValue"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedLedgerView.quoteCashDelta |
| AssistedLedgerView.quoteFeesTotal | {"$ref":"#/components/schemas/DecimalValue"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedLedgerView.quoteFeesTotal |
| AssistedLedgerView.positions | {"type":"array","items":{"$ref":"#/components/schemas/AssistedLedgerPosition"},"maxItems":10000} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedLedgerView.positions |
| AssistedLedgerView.entries | {"type":"array","items":{"$ref":"#/components/schemas/AssistedLedgerReceipt"},"maxItems":10000} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedLedgerView.entries |
| engageKillSwitch.request.scope | {"type":"string","enum":["global","account"]} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:engageKillSwitch.request.scope |
| engageKillSwitch.request.expectedGeneration | {"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:engageKillSwitch.request.expectedGeneration |
| engageKillSwitch.request.approvalRef | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:engageKillSwitch.request.approvalRef |
| engageKillSwitch.request.accountId | {"type":["string","null"],"format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:engageKillSwitch.request.accountId |
| engageKillSwitch.request.reason | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:engageKillSwitch.request.reason |
| engageKillSwitch.request.mfaChallengeRef | {"type":"string","format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:engageKillSwitch.request.mfaChallengeRef |
| engageKillSwitch.request.reauthTokenRef | {"type":"string","format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:engageKillSwitch.request.reauthTokenRef |
| engageKillSwitch.request.confirmPhrase | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:engageKillSwitch.request.confirmPhrase |
| releaseKillSwitch.request.scope | {"type":"string","enum":["global","account"]} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:releaseKillSwitch.request.scope |
| releaseKillSwitch.request.expectedGeneration | {"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:releaseKillSwitch.request.expectedGeneration |
| releaseKillSwitch.request.approvalRef | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:releaseKillSwitch.request.approvalRef |
| releaseKillSwitch.request.accountId | {"type":["string","null"],"format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:releaseKillSwitch.request.accountId |
| releaseKillSwitch.request.confirmPhrase | {"type":"string"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:releaseKillSwitch.request.confirmPhrase |
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
| TradeProposal.status | {"type":"string","enum":["active","awaiting_approval","approved","command_ready","request_info","rejected","expired","submitted"]} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:TradeProposal.status |
| TradeProposal.correlationId | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:TradeProposal.correlationId |
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
| Approval.reviewContext | {"$ref":"#/components/schemas/ApprovalReviewContext"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Approval.reviewContext |
| Approval.approvalId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Approval.approvalId |
| Approval.originator | {"type":"string"} | 是 | proto:common.v1.ActorRef.actor_id | 提取发起人 actor_id；HTTP string，不传 ActorRef 对象 | bff:Approval.originator |
| Approval.objectVersion | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Approval.objectVersion |
| Approval.status | {"type":"string","enum":["pending","approved","rejected","expired","conflict"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Approval.status |
| Approval.expiresAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Approval.expiresAt |
| Approval.signature | {"type":"string"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Approval.signature |
| Approval.commandRef | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Approval.commandRef |
| Approval.correlationId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Approval.correlationId |
| Approval.commandExpiresAt | {"$ref":"#/components/schemas/DateTime"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Approval.commandExpiresAt |
| Approval.issuanceState | {"type":"string","enum":["not_issued","consumed"]} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Approval.issuanceState |
| Approval.decision | {"type":"string","enum":["approve","reject","request_info"]} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Approval.decision |
| Approval.auditRef | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Approval.auditRef |
| Approval.kind | {"type":"string"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Approval.kind |
| Approval.objectRef | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Approval.objectRef |
| AssistedNativeCapabilities.schemaVersion | {"type":"string","enum":["quantos-assisted-testnet-capabilities.v1"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCapabilities.schemaVersion |
| AssistedNativeCapabilities.actorId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCapabilities.actorId |
| AssistedNativeCapabilities.tenantId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCapabilities.tenantId |
| AssistedNativeCapabilities.workspaceId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCapabilities.workspaceId |
| AssistedNativeCapabilities.accountId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCapabilities.accountId |
| AssistedNativeCapabilities.mode | {"type":"string","enum":["paper","shadow","assisted_live"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCapabilities.mode |
| AssistedNativeCapabilities.serverFlagEnabled | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCapabilities.serverFlagEnabled |
| AssistedNativeCapabilities.targetEnabled | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCapabilities.targetEnabled |
| AssistedNativeCapabilities.canRequest | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCapabilities.canRequest |
| AssistedNativeCapabilities.canApprove | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCapabilities.canApprove |
| AssistedNativeCapabilities.executionAuthority | {"type":"boolean","enum":[false]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCapabilities.executionAuthority |
| AssistedNativeCapabilities.policyRevision | {"type":"integer","minimum":1} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCapabilities.policyRevision |
| AssistedNativeCapabilities.policyVersion | {"type":"string","enum":["core-l03-local.v1"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCapabilities.policyVersion |
| AssistedNativeCapabilities.checkedAt | {"type":"string","format":"date-time"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCapabilities.checkedAt |
| AssistedNativeCapabilities.expiresAt | {"type":"string","format":"date-time"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCapabilities.expiresAt |
| AssistedNativeCapabilities.reconciliationReaderEnabled | {"type":"boolean"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCapabilities.reconciliationReaderEnabled |
| AssistedNativeCapabilities.activationVersion | {"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$","maxLength":20} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCapabilities.activationVersion |
| AssistedNativeCapabilities.activationExpiresAt | {"$ref":"#/components/schemas/DateTime"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCapabilities.activationExpiresAt |
| AssistedNativeCapabilities.currentReviewExecutionEnabled | {"type":"boolean"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCapabilities.currentReviewExecutionEnabled |
| AssistedNativeCapabilities.currentRiskReviewOnly | {"type":"boolean"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCapabilities.currentRiskReviewOnly |
| AssistedNativeCapabilities.nativeRiskReviewEnabled | {"type":"boolean"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCapabilities.nativeRiskReviewEnabled |
| AssistedSubject.subjectId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedSubject.subjectId |
| AssistedSubject.subjectHash | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedSubject.subjectHash |
| AssistedSubject.proposalHash | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedSubject.proposalHash |
| AssistedSubject.decisionId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedSubject.decisionId |
| AssistedSubject.originator | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedSubject.originator |
| AssistedSubject.accountId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedSubject.accountId |
| AssistedSubject.symbol | {"type":"string","minLength":1,"maxLength":20} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedSubject.symbol |
| AssistedSubject.side | {"type":"string","enum":["buy","sell"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedSubject.side |
| AssistedSubject.quantity | {"$ref":"#/components/schemas/DecimalValue"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedSubject.quantity |
| AssistedSubject.limitPrice | {"$ref":"#/components/schemas/DecimalValue"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedSubject.limitPrice |
| AssistedSubject.expiresAt | {"type":"string","format":"date-time"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedSubject.expiresAt |
| AssistedSubject.nativeRiskBinding | {"$ref":"#/components/schemas/NativeSubjectRiskBinding"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedSubject.nativeRiskBinding |
| AssistedApprovalRequest.requesterId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedApprovalRequest.requesterId |
| AssistedApprovalRequest.requestId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedApprovalRequest.requestId |
| AssistedApprovalRequest.subjectId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedApprovalRequest.subjectId |
| AssistedApprovalRequest.subjectHash | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedApprovalRequest.subjectHash |
| AssistedApprovalRequest.policyVersion | {"type":"string","minLength":1,"maxLength":20} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedApprovalRequest.policyVersion |
| AssistedApprovalRequest.revision | {"type":"integer","minimum":0,"maximum":2} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedApprovalRequest.revision |
| AssistedApprovalRequest.status | {"type":"string","enum":["pending","awaiting_second","approved"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedApprovalRequest.status |
| AssistedApprovalRequest.approvers | {"type":"array","items":{"$ref":"#/components/schemas/UUID"},"maxItems":2} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedApprovalRequest.approvers |
| AssistedApprovalRequest.expiresAt | {"type":"string","format":"date-time"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedApprovalRequest.expiresAt |
| AssistedApprovalRequest.notional | {"$ref":"#/components/schemas/DecimalValue"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedApprovalRequest.notional |
| AssistedApprovalRequest.executionAuthority | {"type":"boolean","enum":[false]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedApprovalRequest.executionAuthority |
| AssistedNativeOrder.orderId | {"type":"string","minLength":1,"maxLength":128} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeOrder.orderId |
| AssistedNativeOrder.commandId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeOrder.commandId |
| AssistedNativeOrder.accountId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeOrder.accountId |
| AssistedNativeOrder.symbol | {"type":"string","minLength":1,"maxLength":20} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeOrder.symbol |
| AssistedNativeOrder.side | {"type":"string","enum":["buy","sell"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeOrder.side |
| AssistedNativeOrder.quantity | {"$ref":"#/components/schemas/DecimalValue"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeOrder.quantity |
| AssistedNativeOrder.filledQuantity | {"$ref":"#/components/schemas/DecimalValue"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeOrder.filledQuantity |
| AssistedNativeOrder.status | {"type":"string","minLength":1,"maxLength":32} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeOrder.status |
| AssistedNativeCommand.requestId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCommand.requestId |
| AssistedNativeCommand.subjectHash | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCommand.subjectHash |
| AssistedNativeCommand.commandId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCommand.commandId |
| AssistedNativeCommand.expiresAt | {"type":"string","format":"date-time"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCommand.expiresAt |
| AssistedNativeCommand.state | {"type":"string","enum":["accepted","unknown"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCommand.state |
| AssistedNativeCommand.signature | {"type":"string","pattern":"^[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCommand.signature |
| AssistedNativeCommand.currentRisk | {"$ref":"#/components/schemas/AssistedCurrentExecutionBinding"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCommand.currentRisk |
| AssistedNativeCommand.order | {"$ref":"#/components/schemas/AssistedNativeOrder"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedNativeCommand.order |
| AssistedRequestView.request | {"$ref":"#/components/schemas/AssistedApprovalRequest"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedRequestView.request |
| AssistedRequestView.subject | {"$ref":"#/components/schemas/AssistedSubject"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedRequestView.subject |
| AssistedRequestView.command | {"$ref":"#/components/schemas/AssistedNativeCommand"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedRequestView.command |
| AssistedRequestView.facts | {"$ref":"#/components/schemas/AssistedExecutionFacts"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedRequestView.facts |
| AssistedRequestView.ledger | {"$ref":"#/components/schemas/AssistedLedgerReceipt"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedRequestView.ledger |
| AssistedSubjectList.items | {"type":"array","items":{"$ref":"#/components/schemas/AssistedSubject"},"maxItems":4096} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedSubjectList.items |
| AssistedRequestList.items | {"type":"array","items":{"$ref":"#/components/schemas/AssistedRequestView"},"maxItems":200} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedRequestList.items |
| AssistedApprovalAudit.items | {"type":"array","items":{"type":"object","additionalProperties":false,"required":["sequence","requestId","subjectHash","actorId","userId","slot","signature"],"properties":{"sequence":{"type":"integer","minimum":1},"requestId":{"$ref":"#/components/schemas/UUID"},"subjectHash":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},"actorId":{"$ref":"#/components/schemas/UUID"},"userId":{"$ref":"#/components/schemas/UUID"},"slot":{"type":"integer","enum":[1,2]},"signature":{"type":"string","pattern":"^[a-f0-9]{64}$"}}},"maxItems":2} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedApprovalAudit.items |
| AssistedApprovalAudit.verified | {"type":"boolean","enum":[true]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedApprovalAudit.verified |
| AssistedApprovalAudit.nativeSubmissions | {"type":"integer","minimum":0} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedApprovalAudit.nativeSubmissions |
| OpenAssistedRequest.subjectId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpenAssistedRequest.subjectId |
| ApproveAssistedRequest.expectedRevision | {"type":"integer","minimum":0,"maximum":1} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ApproveAssistedRequest.expectedRevision |
| ApproveAssistedRequest.mfaChallengeRef | {"type":"string","minLength":1,"maxLength":128} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ApproveAssistedRequest.mfaChallengeRef |
| ApproveAssistedRequest.reauthTokenRef | {"type":"string","minLength":1,"maxLength":128} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ApproveAssistedRequest.reauthTokenRef |
| SubmitAssistedRequest.expectedRevision | {"type":"integer","enum":[2]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:SubmitAssistedRequest.expectedRevision |
| NativeRiskCandidateList.items | {"type":"array","maxItems":4096,"items":{"$ref":"#/components/schemas/NativeRiskCandidate"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:NativeRiskCandidateList.items |
| NativeRiskReviewRequest.snapshotHash | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:NativeRiskReviewRequest.snapshotHash |
| NativeRiskReviewRequest.expectedGeneration | {"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:NativeRiskReviewRequest.expectedGeneration |
| AssistedCurrentExecutionBinding.snapshotHash | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedCurrentExecutionBinding.snapshotHash |
| AssistedCurrentExecutionBinding.ledgerHash | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedCurrentExecutionBinding.ledgerHash |
| AssistedCurrentExecutionBinding.sourceHash | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedCurrentExecutionBinding.sourceHash |
| AssistedCurrentExecutionBinding.proposalHash | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedCurrentExecutionBinding.proposalHash |
| AssistedCurrentExecutionBinding.sourceVersion | {"type":"integer","minimum":1} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedCurrentExecutionBinding.sourceVersion |
| AssistedCurrentExecutionBinding.killGeneration | {"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedCurrentExecutionBinding.killGeneration |
| AssistedCurrentExecutionBinding.decisionId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedCurrentExecutionBinding.decisionId |
| AssistedCurrentExecutionBinding.notional | {"$ref":"#/components/schemas/DecimalValue"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedCurrentExecutionBinding.notional |
| AssistedCurrentExecutionBinding.activation | {"type":"object","additionalProperties":false,"required":["version","enabled","validFrom","validUntil","head"],"properties":{"version":{"type":"integer","minimum":0},"enabled":{"type":"boolean","enum":[true]},"validFrom":{"type":"string","format":"date-time"},"validUntil":{"type":"string","format":"date-time"},"head":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"}}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedCurrentExecutionBinding.activation |
| decideApproval.request.decision | {"type":"string","enum":["approve","reject","request_info"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:decideApproval.request.decision |
| decideApproval.request.reason | {"type":"string"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:decideApproval.request.reason |
| decideApproval.request.mfaChallengeRef | {"type":"string","format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:decideApproval.request.mfaChallengeRef |
| decideApproval.request.reauthTokenRef | {"type":"string","format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:decideApproval.request.reauthTokenRef |

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
| Order.productType | {"type":"string","enum":["spot"]} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Order.productType |
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
| Order.evidence | {"type":"object","required":["proposalHash","riskDecisionId","approvalId","commandId","releaseId","snapshotHash","portfolioHash","factHashes"],"properties":{"proposalHash":{"type":"string"},"riskDecisionId":{"type":"string"},"approvalId":{"type":"string"},"commandId":{"type":"string"},"releaseId":{"type":"string"},"snapshotHash":{"type":"string"},"portfolioHash":{"type":"string"},"factHashes":{"type":"array","items":{"type":"string"}}}} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Order.evidence |
| Order.cancelCommandRef | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:Order.cancelCommandRef |
| Fill.fillId | {"$ref":"#/components/schemas/UUID"} | 是 | proto:trading.v1.Fill.fill_id | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Fill.fillId |
| Fill.quantity | {"$ref":"#/components/schemas/DecimalValue"} | 是 | proto:trading.v1.Fill.quantity | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Fill.quantity |
| Fill.price | {"$ref":"#/components/schemas/DecimalValue"} | 是 | proto:trading.v1.Fill.price | 领域字段由 BFF/transport 转为本行 wire 名称与约束；required/枚举裁剪以已发布 OpenAPI 为准，未知值阻断 | bff:Fill.price |
| Fill.at | {"$ref":"#/components/schemas/DateTime"} | 是 | proto:trading.v1.Fill.filled_at | Proto Timestamp 转 RFC3339，wire 名为 at | bff:Fill.at |
| AssistedReconciliationView.schemaVersion | {"type":"string","enum":["quantos-current-reconciliation.v1"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedReconciliationView.schemaVersion |
| AssistedReconciliationView.tenantId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedReconciliationView.tenantId |
| AssistedReconciliationView.workspaceId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedReconciliationView.workspaceId |
| AssistedReconciliationView.accountId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedReconciliationView.accountId |
| AssistedReconciliationView.mode | {"type":"string","enum":["assisted_live"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedReconciliationView.mode |
| AssistedReconciliationView.reportId | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedReconciliationView.reportId |
| AssistedReconciliationView.ledgerHash | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedReconciliationView.ledgerHash |
| AssistedReconciliationView.booksHash | {"anyOf":[{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},{"type":"null"}]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedReconciliationView.booksHash |
| AssistedReconciliationView.booksSourceId | {"type":"string","minLength":1,"maxLength":512} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedReconciliationView.booksSourceId |
| AssistedReconciliationView.booksState | {"type":"string","enum":["AVAILABLE_OBSERVATIONS","UNAVAILABLE","STALE"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedReconciliationView.booksState |
| AssistedReconciliationView.comparisonStatus | {"type":"string","enum":["MATCHED_OBSERVATIONS","DIFFERENCES","UNAVAILABLE"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedReconciliationView.comparisonStatus |
| AssistedReconciliationView.coverage | {"type":"string","enum":["OBSERVED_EXECUTION_DELTAS_ONLY"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedReconciliationView.coverage |
| AssistedReconciliationView.fullBooksReady | {"type":"boolean","enum":[false]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedReconciliationView.fullBooksReady |
| AssistedReconciliationView.dayCloseAllowed | {"type":"boolean","enum":[false]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedReconciliationView.dayCloseAllowed |
| AssistedReconciliationView.executionAuthority | {"type":"boolean","enum":[false]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedReconciliationView.executionAuthority |
| AssistedReconciliationView.checkedAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedReconciliationView.checkedAt |
| AssistedReconciliationView.sourceBindings | {"type":"array","items":{"$ref":"#/components/schemas/AssistedReconciliationBinding"},"maxItems":20000} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedReconciliationView.sourceBindings |
| AssistedReconciliationView.findings | {"type":"array","items":{"$ref":"#/components/schemas/AssistedReconciliationFinding"},"maxItems":20000} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedReconciliationView.findings |
| AssistedReconciliationView.unknownObligationsOpen | {"type":"integer","minimum":0,"maximum":20000} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedReconciliationView.unknownObligationsOpen |
| AssistedReconciliationView.openAlertEvidenceCount | {"type":"integer","minimum":0,"maximum":20000} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedReconciliationView.openAlertEvidenceCount |
| AssistedReconciliationView.alertEvidence | {"type":"array","items":{"$ref":"#/components/schemas/AssistedReconciliationAlertEvidence"},"maxItems":20000} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedReconciliationView.alertEvidence |
| AssistedReconciliationView.anchor | {"type":"object","additionalProperties":false,"required":["sequence","head"],"properties":{"sequence":{"type":"integer","minimum":0,"maximum":20000},"head":{"anyOf":[{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"},{"type":"null"}]}}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedReconciliationView.anchor |
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
| ExportDownloadMetadata.downloadUrl | {"type":"string","format":"uri","maxLength":2048,"pattern":"^https://[^/?#@\\s\\\\]+/_bff/export-content/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{64}$"} | 是 | none | 独立下载元数据的一次性短时 URL；不属于 ExportJob | bff:ExportDownloadMetadata.downloadUrl |
| ExportDownloadMetadata.expiresAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportDownloadMetadata.expiresAt |
| ExportDownloadMetadata.sha256 | {"type":"string","pattern":"^[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportDownloadMetadata.sha256 |
| ExportDownloadMetadata.sizeBytes | {"type":"integer","format":"int64","minimum":1} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportDownloadMetadata.sizeBytes |
| ExportDownloadMetadata.mediaType | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportDownloadMetadata.mediaType |
| ExportDownloadMetadata.watermarked | {"type":"boolean","enum":[true]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportDownloadMetadata.watermarked |
| ExportDownloadMetadata.retentionUntil | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportDownloadMetadata.retentionUntil |
| ExportDownloadMetadata.auditRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ExportDownloadMetadata.auditRef |
| createExport.request.scope | {"$ref":"#/components/schemas/ExportScope"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createExport.request.scope |
| createExport.request.format | {"type":"string","enum":["jsonl","csv","pdf"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createExport.request.format |
| createExport.request.reason | {"type":"string","minLength":8,"maxLength":500} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createExport.request.reason |
| createExport.request.watermark | {"type":"string","minLength":3,"maxLength":120} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createExport.request.watermark |
| createExport.request.retentionDays | {"type":"integer","minimum":1,"maximum":30} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:createExport.request.retentionDays |

## 12. C11 Ops/Admin

| wire 字段 / 计划字段 | 类型与序列化 | required | 领域源锚 | 领域→wire 映射 / 决策 | wire / 计划源锚 |
|---|---|---|---|---|---|
| AdminResourcePage.items | {"type":"array","items":{"$ref":"#/components/schemas/AdminResource"},"maxItems":200} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AdminResourcePage.items |
| AdminResourcePage.nextCursor | {"type":["string","null"],"format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AdminResourcePage.nextCursor |
| AdminResourcePage.configVersion | {"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AdminResourcePage.configVersion |
| AdminResourcePage.availableReviews | {"type":"array","maxItems":1000,"items":{"$ref":"#/components/schemas/AdminEngineCapabilitySpec"}} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AdminResourcePage.availableReviews |
| GovernanceCapabilityAction.reason | {"type":"string","minLength":1,"maxLength":256} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:GovernanceCapabilityAction.reason |
| GovernanceCapabilityAction.mfaChallengeRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:GovernanceCapabilityAction.mfaChallengeRef |
| GovernanceCapabilityAction.reauthTokenRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:GovernanceCapabilityAction.reauthTokenRef |
| GovernanceCapabilityAction.spec | {"$ref":"#/components/schemas/AdminCapabilitySpec"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:GovernanceCapabilityAction.spec |
| GovernanceFeatureFlagAction.reason | {"type":"string","minLength":1,"maxLength":256} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:GovernanceFeatureFlagAction.reason |
| GovernanceFeatureFlagAction.mfaChallengeRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:GovernanceFeatureFlagAction.mfaChallengeRef |
| GovernanceFeatureFlagAction.reauthTokenRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:GovernanceFeatureFlagAction.reauthTokenRef |
| GovernanceFeatureFlagAction.spec | {"$ref":"#/components/schemas/AdminFlagSpec"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:GovernanceFeatureFlagAction.spec |
| GovernanceMemberAction.reason | {"type":"string","minLength":1,"maxLength":256} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:GovernanceMemberAction.reason |
| GovernanceMemberAction.mfaChallengeRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:GovernanceMemberAction.mfaChallengeRef |
| GovernanceMemberAction.reauthTokenRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:GovernanceMemberAction.reauthTokenRef |
| GovernanceMemberAction.spec | {"$ref":"#/components/schemas/AdminMemberSpec"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:GovernanceMemberAction.spec |
| GovernancePolicyAction.reason | {"type":"string","minLength":1,"maxLength":256} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:GovernancePolicyAction.reason |
| GovernancePolicyAction.mfaChallengeRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:GovernancePolicyAction.mfaChallengeRef |
| GovernancePolicyAction.reauthTokenRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:GovernancePolicyAction.reauthTokenRef |
| GovernancePolicyAction.spec | {"$ref":"#/components/schemas/AdminPolicySpec"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:GovernancePolicyAction.spec |
| GovernanceRoleAction.reason | {"type":"string","minLength":1,"maxLength":256} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:GovernanceRoleAction.reason |
| GovernanceRoleAction.mfaChallengeRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:GovernanceRoleAction.mfaChallengeRef |
| GovernanceRoleAction.reauthTokenRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:GovernanceRoleAction.reauthTokenRef |
| GovernanceRoleAction.spec | {"$ref":"#/components/schemas/AdminRoleSpec"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:GovernanceRoleAction.spec |
| OpsAction.reason | {"type":"string","minLength":1,"maxLength":256} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAction.reason |
| OpsAction.mfaChallengeRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAction.mfaChallengeRef |
| OpsAction.reauthTokenRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAction.reauthTokenRef |
| OpsHealth.service | {"type":"string","enum":["service-x06"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsHealth.service |
| OpsHealth.health | {"type":"string","enum":["healthy","degraded"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsHealth.health |
| OpsHealth.ready | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsHealth.ready |
| OpsHealth.objectVersion | {"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsHealth.objectVersion |
| OpsHealth.sourceHash | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsHealth.sourceHash |
| OpsHealth.asOf | {"type":"string","format":"date-time"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsHealth.asOf |
| OpsHealth.expiresAt | {"type":"string","format":"date-time"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsHealth.expiresAt |
| OpsHealth.accountId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsHealth.accountId |
| OpsHealth.mode | {"type":"string","enum":["paper","shadow"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsHealth.mode |
| OpsHealth.latencyMs | {"type":"integer","minimum":0} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsHealth.latencyMs |
| OpsHealth.dlqDepth | {"type":"integer","minimum":0} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsHealth.dlqDepth |
| OpsHealth.metricsHash | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsHealth.metricsHash |
| OpsHealth.components | {"type":"array","items":{"type":"object","additionalProperties":false,"required":["name","ready","asOf"],"properties":{"name":{"type":"string","enum":["execution","portfolio","risk","reconciliation"]},"ready":{"type":"boolean"},"asOf":{"type":"string","format":"date-time"}}},"maxItems":4} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsHealth.components |
| OpsIncident.id | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsIncident.id |
| OpsIncident.incidentId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsIncident.incidentId |
| OpsIncident.sourceRef | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsIncident.sourceRef |
| OpsIncident.alertId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsIncident.alertId |
| OpsIncident.status | {"type":"string","enum":["open","acknowledged","resolved"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsIncident.status |
| OpsIncident.objectVersion | {"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsIncident.objectVersion |
| OpsIncident.openedSource | {"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsIncident.openedSource |
| OpsIncident.asOf | {"type":"string","format":"date-time"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsIncident.asOf |
| OpsIncident.accountId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsIncident.accountId |
| OpsIncident.mode | {"type":"string","enum":["paper","shadow"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsIncident.mode |
| OpsIncident.auditRef | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsIncident.auditRef |
| OpsIncident.correlationId | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsIncident.correlationId |
| OpsIncidentCreate.reason | {"type":"string","minLength":1,"maxLength":256} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsIncidentCreate.reason |
| OpsIncidentCreate.mfaChallengeRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsIncidentCreate.mfaChallengeRef |
| OpsIncidentCreate.reauthTokenRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsIncidentCreate.reauthTokenRef |
| OpsIncidentCreate.alertId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsIncidentCreate.alertId |
| OpsIncidentPage.items | {"type":"array","items":{"$ref":"#/components/schemas/OpsIncident"},"maxItems":200} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsIncidentPage.items |
| OpsIncidentPage.nextCursor | {"type":["string","null"],"format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsIncidentPage.nextCursor |
| OpsIncidentPage.configVersion | {"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsIncidentPage.configVersion |
| OpsIncidentTimeline.items | {"type":"array","items":{"type":"object","additionalProperties":false,"required":["eventId","occurredAt","payload"],"properties":{"eventId":{"$ref":"#/components/schemas/UUID"},"occurredAt":{"type":"string","format":"date-time"},"payload":{"$ref":"#/components/schemas/OpsIncident"},"auditRef":{"type":"string","format":"uuid"},"correlationId":{"type":"string","format":"uuid"}}},"maxItems":10000} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsIncidentTimeline.items |
| OpsPrecheck.actionId | {"type":"string","enum":["inspect-health","inspect-evidence"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsPrecheck.actionId |
| OpsPrecheck.allowed | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsPrecheck.allowed |
| OpsPrecheck.reason | {"type":"string","enum":["allowed","source_evidence_unavailable"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsPrecheck.reason |
| OpsPrecheck.sourceVersion | {"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsPrecheck.sourceVersion |
| OpsPrecheck.expiresAt | {"type":"string","format":"date-time"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsPrecheck.expiresAt |
| OpsRunbookActions.items | {"type":"array","items":{"type":"object","additionalProperties":false,"required":["actionId","parameters"],"properties":{"actionId":{"type":"string","enum":["inspect-health","inspect-evidence"]},"parameters":{"type":"array","items":{"type":"string","enum":["commandId"]},"maxItems":1}}},"maxItems":2} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsRunbookActions.items |
| OpsRunbookExecute.reason | {"type":"string","minLength":1,"maxLength":256} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsRunbookExecute.reason |
| OpsRunbookExecute.mfaChallengeRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsRunbookExecute.mfaChallengeRef |
| OpsRunbookExecute.reauthTokenRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsRunbookExecute.reauthTokenRef |
| OpsRunbookExecute.commandId | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsRunbookExecute.commandId |
| OpsRunbookReceipt.operationId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsRunbookReceipt.operationId |
| OpsRunbookReceipt.status | {"type":"string","enum":["succeeded"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsRunbookReceipt.status |
| OpsRunbookReceipt.sourceOperationRef | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsRunbookReceipt.sourceOperationRef |
| OpsRunbookReceipt.outcome | {"type":"object","additionalProperties":false,"required":["status","reference"],"properties":{"status":{"type":"string","enum":["applied"]},"reference":{"type":"string","pattern":"^sha256:[a-f0-9]{64}$"}}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsRunbookReceipt.outcome |
| OpsRunbookReceipt.auditRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsRunbookReceipt.auditRef |
| OpsRunbookReceipt.correlationId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsRunbookReceipt.correlationId |
| AssistedActivationAction.scope | {"$ref":"#/components/schemas/AssistedActivationScope"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationAction.scope |
| AssistedActivationAction.enabled | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationAction.enabled |
| AssistedActivationAction.validUntil | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationAction.validUntil |
| AssistedActivationAction.reason | {"type":"string","minLength":1,"maxLength":256} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationAction.reason |
| AssistedActivationAction.confirmPhrase | {"type":"string","enum":["ENABLE ASSISTED TESTNET","DISABLE ASSISTED TESTNET"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationAction.confirmPhrase |
| AssistedActivationAction.mfaChallengeRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationAction.mfaChallengeRef |
| AssistedActivationAction.reauthTokenRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationAction.reauthTokenRef |
| AssistedActivationHistory.resourceId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationHistory.resourceId |
| AssistedActivationHistory.version | {"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$","maxLength":20} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationHistory.version |
| AssistedActivationHistory.totalCount | {"type":"integer","minimum":1,"maximum":4096} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationHistory.totalCount |
| AssistedActivationHistory.items | {"type":"array","maxItems":100,"items":{"$ref":"#/components/schemas/AssistedActivationEvent"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationHistory.items |
| AssistedActivationHistory.nextCursor | {"oneOf":[{"type":"string"},{"type":"null"}]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationHistory.nextCursor |
| AssistedActivationHistory.executionAuthority | {"type":"boolean","enum":[false]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationHistory.executionAuthority |
| AssistedActivationPage.items | {"type":"array","minItems":1,"maxItems":1,"items":{"$ref":"#/components/schemas/AssistedActivationView"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationPage.items |
| AssistedActivationPage.configVersion | {"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$","maxLength":20} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationPage.configVersion |
| AssistedActivationPage.nextCursor | {"type":"null"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationPage.nextCursor |
| AssistedActivationReceipt.schemaVersion | {"type":"string","enum":["quantos-current-c11-activation-receipt.v1"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationReceipt.schemaVersion |
| AssistedActivationReceipt.event | {"$ref":"#/components/schemas/AssistedActivationEvent"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationReceipt.event |
| AssistedActivationReceipt.readCurrentState | {"type":"boolean","enum":[true]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationReceipt.readCurrentState |
| AssistedActivationReceipt.executionAuthority | {"type":"boolean","enum":[false]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationReceipt.executionAuthority |
| AssistedActivationView.schemaVersion | {"type":"string","enum":["quantos-current-c11-activation.v1"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.schemaVersion |
| AssistedActivationView.resourceId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.resourceId |
| AssistedActivationView.tenantId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.tenantId |
| AssistedActivationView.workspaceId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.workspaceId |
| AssistedActivationView.accountId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.accountId |
| AssistedActivationView.mode | {"type":"string","enum":["assisted_live"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.mode |
| AssistedActivationView.featureKey | {"type":"string","enum":["execution.assisted-testnet"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.featureKey |
| AssistedActivationView.version | {"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$","maxLength":20} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.version |
| AssistedActivationView.enabled | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.enabled |
| AssistedActivationView.effective | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.effective |
| AssistedActivationView.targetPermitted | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.targetPermitted |
| AssistedActivationView.validFrom | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.validFrom |
| AssistedActivationView.validUntil | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.validUntil |
| AssistedActivationView.ceilingExpiresAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.ceilingExpiresAt |
| AssistedActivationView.source | {"type":"string","enum":["owner_reference_bootstrap","public_c11"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.source |
| AssistedActivationView.head | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.head |
| AssistedActivationView.canWrite | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.canWrite |
| AssistedActivationView.nativeActivationVersion | {"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$","maxLength":20} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.nativeActivationVersion |
| AssistedActivationView.nativeActivationEffective | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.nativeActivationEffective |
| AssistedActivationView.nativeStopped | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.nativeStopped |
| AssistedActivationView.runtimeWritable | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.runtimeWritable |
| AssistedActivationView.killGeneration | {"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$","maxLength":20} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.killGeneration |
| AssistedActivationView.unknownCommands | {"type":"integer","minimum":0,"maximum":4096} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.unknownCommands |
| AssistedActivationView.historyCount | {"type":"integer","minimum":1,"maximum":4096} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.historyCount |
| AssistedActivationView.checkedAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.checkedAt |
| AssistedActivationView.expiresAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.expiresAt |
| AssistedActivationView.unknownPreserved | {"type":"boolean","enum":[true]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.unknownPreserved |
| AssistedActivationView.executionAuthority | {"type":"boolean","enum":[false]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedActivationView.executionAuthority |

## 13. C12 Market/Candle

| wire 字段 / 计划字段 | 类型与序列化 | required | 领域源锚 | 领域→wire 映射 / 决策 | wire / 计划源锚 |
|---|---|---|---|---|---|
| MarketInstrument.instrumentId | {"type":"string"} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:MarketInstrument.instrumentId |
| MarketInstrument.canonicalSymbol | {"type":"string"} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:MarketInstrument.canonicalSymbol |
| MarketInstrument.venue | {"enum":["binance","coinbase"]} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:MarketInstrument.venue |
| MarketInstrument.productType | {"enum":["spot"]} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:MarketInstrument.productType |
| MarketInstrument.intervals | {"type":"array","items":{"type":"string"}} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:MarketInstrument.intervals |
| MarketInstrument.timezones | {"type":"array","items":{"type":"string"}} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:MarketInstrument.timezones |
| MarketInstrument.priceKind | {"enum":["top_of_book","last_trade"]} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:MarketInstrument.priceKind |
| MarketInstrument.topOfBook | {"type":"boolean"} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:MarketInstrument.topOfBook |
| MarketInstrument.lotSize | {"type":"string","pattern":"^[0-9]+(?:\\.[0-9]+)?$"} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:MarketInstrument.lotSize |
| MarketInstrument.minNotional | {"type":"string","pattern":"^[0-9]+(?:\\.[0-9]+)?$"} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:MarketInstrument.minNotional |
| MarketProvenance.source | {"type":"string"} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:MarketProvenance.source |
| MarketProvenance.venue | {"enum":["binance","coinbase"]} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:MarketProvenance.venue |
| MarketProvenance.asOf | {"$ref":"#/components/schemas/DateTime"} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:MarketProvenance.asOf |
| MarketProvenance.quality | {"enum":["passed","degraded"]} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:MarketProvenance.quality |
| MarketProvenance.license | {"type":"string"} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:MarketProvenance.license |
| MarketProvenance.approvalRef | {"type":"string"} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:MarketProvenance.approvalRef |
| MarketProvenance.approvalVersion | {"type":"string"} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:MarketProvenance.approvalVersion |
| MarketProvenance.dataSnapshotId | {"$ref":"#/components/schemas/UUID"} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:MarketProvenance.dataSnapshotId |
| MarketProvenance.latencyMs | {"type":"integer","minimum":0} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:MarketProvenance.latencyMs |
| VenueQuote.instrumentId | {"type":"string"} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:VenueQuote.instrumentId |
| VenueQuote.canonicalSymbol | {"type":"string"} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:VenueQuote.canonicalSymbol |
| VenueQuote.productType | {"enum":["spot"]} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:VenueQuote.productType |
| VenueQuote.bid | {"oneOf":[{"type":"string","pattern":"^[0-9]+(?:\\.[0-9]+)?$"},{"enum":[null]}]} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:VenueQuote.bid |
| VenueQuote.ask | {"oneOf":[{"type":"string","pattern":"^[0-9]+(?:\\.[0-9]+)?$"},{"enum":[null]}]} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:VenueQuote.ask |
| VenueQuote.mid | {"oneOf":[{"type":"string","pattern":"^[0-9]+(?:\\.[0-9]+)?$"},{"enum":[null]}]} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:VenueQuote.mid |
| VenueQuote.lastPrice | {"oneOf":[{"type":"string","pattern":"^[0-9]+(?:\\.[0-9]+)?$"},{"enum":[null]}]} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:VenueQuote.lastPrice |
| VenueQuote.priceKind | {"enum":["top_of_book","last_trade"]} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:VenueQuote.priceKind |
| VenueQuote.executable | {"enum":[false]} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:VenueQuote.executable |
| VenueQuote.feeEstimate | {"enum":[null]} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:VenueQuote.feeEstimate |
| VenueQuote.slippageEstimate | {"enum":[null]} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:VenueQuote.slippageEstimate |
| VenueQuote.estimates | {"enum":[true]} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:VenueQuote.estimates |
| VenueQuote.lotSize | {"type":"string","pattern":"^[0-9]+(?:\\.[0-9]+)?$"} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:VenueQuote.lotSize |
| VenueQuote.minNotional | {"type":"string","pattern":"^[0-9]+(?:\\.[0-9]+)?$"} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:VenueQuote.minNotional |
| VenueQuote.provenance | {"$ref":"#/components/schemas/MarketProvenance"} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:VenueQuote.provenance |
| VenueQuote.sequence | {"type":"integer","minimum":1} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:VenueQuote.sequence |
| CandleSeries.instrumentId | {"type":"string"} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:CandleSeries.instrumentId |
| CandleSeries.canonicalSymbol | {"type":"string"} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:CandleSeries.canonicalSymbol |
| CandleSeries.venue | {"enum":["binance","coinbase"]} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:CandleSeries.venue |
| CandleSeries.productType | {"enum":["spot"]} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:CandleSeries.productType |
| CandleSeries.interval | {"enum":["1m","5m","15m","1h","4h","1D","1W"]} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:CandleSeries.interval |
| CandleSeries.timezone | {"enum":["UTC","Asia/Shanghai"]} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:CandleSeries.timezone |
| CandleSeries.ohlcv | {"type":"array","maxItems":500,"items":{"type":"object","additionalProperties":false,"required":["t","o","h","l","c","v"],"properties":{"t":{"$ref":"#/components/schemas/DateTime"},"o":{"type":"string","pattern":"^[0-9]+(?:\\.[0-9]+)?$"},"h":{"type":"string","pattern":"^[0-9]+(?:\\.[0-9]+)?$"},"l":{"type":"string","pattern":"^[0-9]+(?:\\.[0-9]+)?$"},"c":{"type":"string","pattern":"^[0-9]+(?:\\.[0-9]+)?$"},"v":{"type":"string","pattern":"^[0-9]+(?:\\.[0-9]+)?$"}}}} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:CandleSeries.ohlcv |
| CandleSeries.gaps | {"type":"array","items":{"type":"object","additionalProperties":false,"required":["start","end"],"properties":{"start":{"$ref":"#/components/schemas/DateTime"},"end":{"$ref":"#/components/schemas/DateTime"}}}} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:CandleSeries.gaps |
| CandleSeries.eventMarkers | {"type":"array","items":{"type":"object","additionalProperties":false,"required":["kind","at"],"properties":{"kind":{"enum":["data_gap"]},"at":{"$ref":"#/components/schemas/DateTime"}}}} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:CandleSeries.eventMarkers |
| CandleSeries.provenance | {"$ref":"#/components/schemas/MarketProvenance"} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:CandleSeries.provenance |
| CandleSeries.sequence | {"type":"integer","minimum":1} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:CandleSeries.sequence |
| CandleSeries.replaceSeries | {"enum":[true]} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:CandleSeries.replaceSeries |
| CandleSeries.aggregation | {"enum":["trade_events"]} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:CandleSeries.aggregation |
| MarketWatchlist.instrumentIds | {"type":"array","items":{"type":"string"},"maxItems":100,"uniqueItems":true} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:MarketWatchlist.instrumentIds |
| MarketWatchlist.objectVersion | {"type":"string"} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:MarketWatchlist.objectVersion |
| MarketWatchlist.auditRef | {"$ref":"#/components/schemas/UUID"} | 否 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:MarketWatchlist.auditRef |
| MarketWatchlist.correlationId | {"$ref":"#/components/schemas/UUID"} | 否 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:MarketWatchlist.correlationId |
| SaveMarketWatchlist.instrumentIds | {"type":"array","items":{"type":"string","minLength":1,"maxLength":100},"maxItems":100,"uniqueItems":true} | 是 | none | BFF-FE-005: R01 immutable licensed trade event / R02 authorized snapshot projection; nullable book/estimate fields are unavailable, never fabricated | bff:SaveMarketWatchlist.instrumentIds |
| MarketCatalog.items | {"type":"array","items":{"$ref":"#/components/schemas/MarketInstrument"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:MarketCatalog.items |
| MarketCatalog.asOf | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:MarketCatalog.asOf |
| VenueQuotes.items | {"type":"array","items":{"$ref":"#/components/schemas/VenueQuote"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:VenueQuotes.items |

## 14. C13 Trade Preflight

| wire 字段 / 计划字段 | 类型与序列化 | required | 领域源锚 | 领域→wire 映射 / 决策 | wire / 计划源锚 |
|---|---|---|---|---|---|
| OrderCapabilities.accountId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OrderCapabilities.accountId |
| OrderCapabilities.mode | {"type":"string","enum":["paper","shadow"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OrderCapabilities.mode |
| OrderCapabilities.canSubmit | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OrderCapabilities.canSubmit |
| OrderCapabilities.canCancel | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OrderCapabilities.canCancel |
| OrderCapabilities.venueSubmit | {"type":"boolean","enum":[false]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OrderCapabilities.venueSubmit |
| OrderCapabilities.quantityScale | {"type":"integer","minimum":0,"maximum":18} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OrderCapabilities.quantityScale |
| OrderCapabilities.priceScale | {"type":"integer","minimum":0,"maximum":18} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OrderCapabilities.priceScale |
| OrderCapabilities.maxQuantity | {"$ref":"#/components/schemas/DecimalValue"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OrderCapabilities.maxQuantity |
| OrderCapabilities.maxNotional | {"$ref":"#/components/schemas/DecimalValue"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OrderCapabilities.maxNotional |
| OrderCapabilities.assistedTestnetAdmission | {"$ref":"#/components/schemas/AssistedTestnetAdmission"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OrderCapabilities.assistedTestnetAdmission |
| TradePreflight.proposalId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:TradePreflight.proposalId |
| TradePreflight.accountId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:TradePreflight.accountId |
| TradePreflight.mode | {"type":"string","enum":["paper","shadow"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:TradePreflight.mode |
| TradePreflight.contextHash | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:TradePreflight.contextHash |
| TradePreflight.objectVersion | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:TradePreflight.objectVersion |
| TradePreflight.asOf | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:TradePreflight.asOf |
| TradePreflight.expiresAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:TradePreflight.expiresAt |
| TradePreflight.verdict | {"type":"string","enum":["allow","approval_required","deny"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:TradePreflight.verdict |
| TradePreflight.hitRules | {"type":"array","items":{"type":"string"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:TradePreflight.hitRules |
| TradePreflight.executable | {"type":"boolean","enum":[false]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:TradePreflight.executable |
| TradePreflight.correlationId | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:TradePreflight.correlationId |
| TradePreflight.ticketContext | {"$ref":"#/components/schemas/TradeTicketContext"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:TradePreflight.ticketContext |
| AssistedTestnetAdmission.schemaVersion | {"type":"string","enum":["quantos-assisted-testnet-admission.v1"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedTestnetAdmission.schemaVersion |
| AssistedTestnetAdmission.policyVersion | {"type":"string","enum":["disabled-until-native-bridge.v1"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedTestnetAdmission.policyVersion |
| AssistedTestnetAdmission.actorId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedTestnetAdmission.actorId |
| AssistedTestnetAdmission.tenantId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedTestnetAdmission.tenantId |
| AssistedTestnetAdmission.workspaceId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedTestnetAdmission.workspaceId |
| AssistedTestnetAdmission.accountId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedTestnetAdmission.accountId |
| AssistedTestnetAdmission.mode | {"type":"string","enum":["paper","shadow"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedTestnetAdmission.mode |
| AssistedTestnetAdmission.serverFlagEnabled | {"type":"boolean","enum":[false]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedTestnetAdmission.serverFlagEnabled |
| AssistedTestnetAdmission.targetEnabled | {"type":"boolean","enum":[false]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedTestnetAdmission.targetEnabled |
| AssistedTestnetAdmission.executionAuthority | {"type":"boolean","enum":[false]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedTestnetAdmission.executionAuthority |
| AssistedTestnetAdmission.reasonCode | {"type":"string","enum":["EXECUTION_BRIDGE_UNAVAILABLE"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedTestnetAdmission.reasonCode |
| AssistedTestnetAdmission.checkedAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedTestnetAdmission.checkedAt |
| AssistedTestnetAdmission.expiresAt | {"$ref":"#/components/schemas/DateTime"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AssistedTestnetAdmission.expiresAt |

## 15. C14 Performance/Report

| wire 字段 / 计划字段 | 类型与序列化 | required | 领域源锚 | 领域→wire 映射 / 决策 | wire / 计划源锚 |
|---|---|---|---|---|---|
| PerformanceDownload.accountId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceDownload.accountId |
| PerformanceDownload.currency | {"type":"string","enum":["USD"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceDownload.currency |
| PerformanceDownload.method | {"type":"string","enum":["simple"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceDownload.method |
| PerformanceDownload.period | {"type":"string","enum":["custom","week","month","quarter","year"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceDownload.period |
| PerformanceDownload.periodMode | {"type":"string","enum":["rolling","calendar"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceDownload.periodMode |
| PerformanceDownload.asOf | {"type":"string","format":"date-time"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceDownload.asOf |
| PerformanceDownload.ledgerVersion | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceDownload.ledgerVersion |
| PerformanceDownload.valuationSnapshotId | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceDownload.valuationSnapshotId |
| PerformanceDownload.coverage | {"$ref":"#/components/schemas/PerformanceCoverage"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceDownload.coverage |
| PerformanceDownload.provisional | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceDownload.provisional |
| PerformanceDownload.reportId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceDownload.reportId |
| PerformanceDownload.status | {"type":"string","enum":["queued","succeeded"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceDownload.status |
| PerformanceDownload.reportVersion | {"type":"string","enum":["1"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceDownload.reportVersion |
| PerformanceDownload.createdAt | {"type":"string","format":"date-time"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceDownload.createdAt |
| PerformanceDownload.expiresAt | {"type":"string","format":"date-time"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceDownload.expiresAt |
| PerformanceDownload.correlationId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceDownload.correlationId |
| PerformanceDownload.auditRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceDownload.auditRef |
| PerformanceDownload.supersededBy | {"type":["string","null"],"format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceDownload.supersededBy |
| PerformanceDownload.downloadPath | {"type":"string","pattern":"^/v1/performance/reports/[a-f0-9-]+/content\\?ticket=[a-f0-9-]+$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceDownload.downloadPath |
| PerformanceDownload.sha256 | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceDownload.sha256 |
| PerformanceDownload.sizeBytes | {"type":"integer","minimum":1} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceDownload.sizeBytes |
| PerformanceDownload.mediaType | {"type":"string","enum":["application/json"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceDownload.mediaType |
| PerformanceDownload.downloadExpiresAt | {"type":"string","format":"date-time"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceDownload.downloadExpiresAt |
| PerformanceQuery.accountId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceQuery.accountId |
| PerformanceQuery.currency | {"type":"string","enum":["USD"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceQuery.currency |
| PerformanceQuery.method | {"type":"string","enum":["simple","twr","mwr"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceQuery.method |
| PerformanceQuery.period | {"type":"string","enum":["custom","week","month","quarter","year"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceQuery.period |
| PerformanceQuery.periodMode | {"type":"string","enum":["rolling","calendar"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceQuery.periodMode |
| PerformanceQuery.start | {"type":"string","format":"date-time"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceQuery.start |
| PerformanceQuery.end | {"type":"string","format":"date-time"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceQuery.end |
| PerformanceReport.accountId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceReport.accountId |
| PerformanceReport.currency | {"type":"string","enum":["USD"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceReport.currency |
| PerformanceReport.method | {"type":"string","enum":["simple"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceReport.method |
| PerformanceReport.period | {"type":"string","enum":["custom","week","month","quarter","year"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceReport.period |
| PerformanceReport.periodMode | {"type":"string","enum":["rolling","calendar"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceReport.periodMode |
| PerformanceReport.asOf | {"type":"string","format":"date-time"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceReport.asOf |
| PerformanceReport.ledgerVersion | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceReport.ledgerVersion |
| PerformanceReport.valuationSnapshotId | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceReport.valuationSnapshotId |
| PerformanceReport.coverage | {"$ref":"#/components/schemas/PerformanceCoverage"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceReport.coverage |
| PerformanceReport.provisional | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceReport.provisional |
| PerformanceReport.reportId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceReport.reportId |
| PerformanceReport.status | {"type":"string","enum":["queued","succeeded"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceReport.status |
| PerformanceReport.reportVersion | {"type":"string","enum":["1"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceReport.reportVersion |
| PerformanceReport.createdAt | {"type":"string","format":"date-time"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceReport.createdAt |
| PerformanceReport.expiresAt | {"type":"string","format":"date-time"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceReport.expiresAt |
| PerformanceReport.correlationId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceReport.correlationId |
| PerformanceReport.auditRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceReport.auditRef |
| PerformanceReport.supersededBy | {"type":["string","null"],"format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceReport.supersededBy |
| PerformanceReportDocument.metadata | {"$ref":"#/components/schemas/PerformanceReport"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceReportDocument.metadata |
| PerformanceReportDocument.performance | {"$ref":"#/components/schemas/PerformanceView"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceReportDocument.performance |
| PerformanceView.accountId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceView.accountId |
| PerformanceView.currency | {"type":"string","enum":["USD"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceView.currency |
| PerformanceView.method | {"type":"string","enum":["simple"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceView.method |
| PerformanceView.period | {"type":"string","enum":["custom","week","month","quarter","year"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceView.period |
| PerformanceView.periodMode | {"type":"string","enum":["rolling","calendar"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceView.periodMode |
| PerformanceView.asOf | {"type":"string","format":"date-time"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceView.asOf |
| PerformanceView.ledgerVersion | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceView.ledgerVersion |
| PerformanceView.valuationSnapshotId | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceView.valuationSnapshotId |
| PerformanceView.coverage | {"$ref":"#/components/schemas/PerformanceCoverage"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceView.coverage |
| PerformanceView.provisional | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceView.provisional |
| PerformanceView.pnl | {"$ref":"#/components/schemas/DecimalValue"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceView.pnl |
| PerformanceView.return | {"$ref":"#/components/schemas/DecimalValue"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceView.return |
| PerformanceView.drawdown | {"$ref":"#/components/schemas/DecimalValue"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceView.drawdown |
| PerformanceView.fees | {"$ref":"#/components/schemas/DecimalValue"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceView.fees |
| PerformanceView.series | {"type":"array","minItems":2,"maxItems":1000,"items":{"$ref":"#/components/schemas/PerformancePoint"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceView.series |
| PerformanceView.attribution | {"type":"array","items":{"$ref":"#/components/schemas/PerformanceAttribution"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceView.attribution |
| PerformanceView.precision | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceView.precision |
| PerformanceView.venueSubmit | {"type":"boolean","enum":[false]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:PerformanceView.venueSubmit |

## 16. C15 Reconciliation

| wire 字段 / 计划字段 | 类型与序列化 | required | 领域源锚 | 领域→wire 映射 / 决策 | wire / 计划源锚 |
|---|---|---|---|---|---|
| LedgerEntryPage.items | {"type":"array","items":{"$ref":"#/components/schemas/LedgerEntry"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:LedgerEntryPage.items |
| LedgerEntryPage.nextCursor | {"type":["string","null"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:LedgerEntryPage.nextCursor |
| ReconciliationBreak.breakId | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationBreak.breakId |
| ReconciliationBreak.runId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationBreak.runId |
| ReconciliationBreak.accountId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationBreak.accountId |
| ReconciliationBreak.mode | {"type":"string","enum":["shadow"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationBreak.mode |
| ReconciliationBreak.kind | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationBreak.kind |
| ReconciliationBreak.entity | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationBreak.entity |
| ReconciliationBreak.status | {"type":"string","enum":["open","acknowledged","closed"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationBreak.status |
| ReconciliationBreak.objectVersion | {"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationBreak.objectVersion |
| ReconciliationBreak.expectedJson | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationBreak.expectedJson |
| ReconciliationBreak.actualJson | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationBreak.actualJson |
| ReconciliationBreak.expectedSource | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationBreak.expectedSource |
| ReconciliationBreak.actualSource | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationBreak.actualSource |
| ReconciliationBreak.detectedAt | {"type":"string","format":"date-time"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationBreak.detectedAt |
| ReconciliationBreak.lastDetectedAt | {"type":"string","format":"date-time"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationBreak.lastDetectedAt |
| ReconciliationBreak.closureReportHash | {"type":["string","null"],"pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationBreak.closureReportHash |
| ReconciliationBreak.evidenceRefs | {"type":"array","items":{"$ref":"#/components/schemas/ReconciliationEvidenceRef"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationBreak.evidenceRefs |
| ReconciliationBreak.day | {"type":"string","format":"date","pattern":"^\\d{4}-\\d{2}-\\d{2}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationBreak.day |
| ReconciliationBreakPage.items | {"type":"array","items":{"$ref":"#/components/schemas/ReconciliationBreak"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationBreakPage.items |
| ReconciliationBreakPage.nextCursor | {"type":["string","null"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationBreakPage.nextCursor |
| ReconciliationRerun.reason | {"type":"string","minLength":1,"maxLength":256} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationRerun.reason |
| ReconciliationRun.runId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationRun.runId |
| ReconciliationRun.accountId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationRun.accountId |
| ReconciliationRun.mode | {"type":"string","enum":["shadow"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationRun.mode |
| ReconciliationRun.currency | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationRun.currency |
| ReconciliationRun.status | {"type":"string","enum":["succeeded"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationRun.status |
| ReconciliationRun.result | {"type":"string","enum":["clean","differences"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationRun.result |
| ReconciliationRun.objectVersion | {"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationRun.objectVersion |
| ReconciliationRun.reportHash | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationRun.reportHash |
| ReconciliationRun.inputHash | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationRun.inputHash |
| ReconciliationRun.asOf | {"type":"string","format":"date-time"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationRun.asOf |
| ReconciliationRun.expiresAt | {"type":"string","format":"date-time"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationRun.expiresAt |
| ReconciliationRun.provisional | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationRun.provisional |
| ReconciliationRun.breakCount | {"type":"integer","minimum":0} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationRun.breakCount |
| ReconciliationRun.correlationId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationRun.correlationId |
| ReconciliationRun.auditRef | {"type":["string","null"],"format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationRun.auditRef |
| ReconciliationRun.evidenceRefs | {"type":"array","items":{"$ref":"#/components/schemas/ReconciliationEvidenceRef"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationRun.evidenceRefs |
| ReconciliationRun.day | {"type":"string","format":"date","pattern":"^\\d{4}-\\d{2}-\\d{2}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationRun.day |
| ReconciliationRunPage.items | {"type":"array","items":{"$ref":"#/components/schemas/ReconciliationRun"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationRunPage.items |
| ReconciliationRunPage.nextCursor | {"type":["string","null"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:ReconciliationRunPage.nextCursor |

## 17. C16 Alert/Notification

| wire 字段 / 计划字段 | 类型与序列化 | required | 领域源锚 | 领域→wire 映射 / 决策 | wire / 计划源锚 |
|---|---|---|---|---|---|
| AlertSubscriptions.objectVersion | {"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AlertSubscriptions.objectVersion |
| AlertSubscriptions.severities | {"type":"array","items":{"type":"string","enum":["critical","warning","info"]},"maxItems":3} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AlertSubscriptions.severities |
| AlertSubscriptions.domains | {"type":"array","items":{"type":"string","enum":["risk","order","market","reconciliation","report","system"]},"maxItems":6} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AlertSubscriptions.domains |
| AlertSubscriptions.auditRef | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AlertSubscriptions.auditRef |
| AlertSubscriptions.correlationId | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:AlertSubscriptions.correlationId |
| OpsAction.reason | {"type":"string","minLength":1,"maxLength":256} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAction.reason |
| OpsAction.mfaChallengeRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAction.mfaChallengeRef |
| OpsAction.reauthTokenRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAction.reauthTokenRef |
| OpsAlert.readOnly | {"type":"boolean"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAlert.readOnly |
| OpsAlert.sourceEvidence | {"$ref":"#/components/schemas/AssistedReconciliationAlertEvidence"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAlert.sourceEvidence |
| OpsAlert.id | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAlert.id |
| OpsAlert.alertId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAlert.alertId |
| OpsAlert.sourceRef | {"type":"string","pattern":"^sha256:[a-f0-9]{64}$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAlert.sourceRef |
| OpsAlert.rule | {"type":"string","maxLength":64} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAlert.rule |
| OpsAlert.severity | {"type":"string","enum":["critical","warning","info"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAlert.severity |
| OpsAlert.domain | {"type":"string","enum":["risk","order","market","reconciliation","report","system"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAlert.domain |
| OpsAlert.accountId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAlert.accountId |
| OpsAlert.mode | {"type":"string","enum":["paper","shadow","assisted_live"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAlert.mode |
| OpsAlert.status | {"type":"string","enum":["unacked","acked"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAlert.status |
| OpsAlert.active | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAlert.active |
| OpsAlert.resolved | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAlert.resolved |
| OpsAlert.objectVersion | {"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAlert.objectVersion |
| OpsAlert.sourceVersion | {"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAlert.sourceVersion |
| OpsAlert.occurredAt | {"type":"string","format":"date-time"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAlert.occurredAt |
| OpsAlert.asOf | {"type":"string","format":"date-time"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAlert.asOf |
| OpsAlert.ackActor | {"type":["string","null"],"format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAlert.ackActor |
| OpsAlert.ackAt | {"type":["string","null"],"format":"date-time"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAlert.ackAt |
| OpsAlert.objectRef | {"type":"string","enum":["/operations/health","/orders"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAlert.objectRef |
| OpsAlert.auditRef | {"$ref":"#/components/schemas/UUID"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAlert.auditRef |
| OpsAlert.correlationId | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAlert.correlationId |
| OpsAlertPage.items | {"type":"array","items":{"$ref":"#/components/schemas/OpsAlert"},"maxItems":200} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAlertPage.items |
| OpsAlertPage.nextCursor | {"type":["string","null"],"format":"uuid"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAlertPage.nextCursor |
| OpsAlertPage.configVersion | {"type":"string","pattern":"^(0&#124;[1-9][0-9]*)$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:OpsAlertPage.configVersion |
| SaveAlertSubscriptions.severities | {"type":"array","items":{"type":"string","enum":["critical","warning","info"]},"maxItems":3,"minItems":1} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:SaveAlertSubscriptions.severities |
| SaveAlertSubscriptions.domains | {"type":"array","items":{"type":"string","enum":["risk","order","market","reconciliation","report","system"]},"maxItems":6,"minItems":1} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:SaveAlertSubscriptions.domains |

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
| SecuritySettings.availableMfaMethods | {"type":"array","items":{"type":"string","enum":["authenticator","passkey"]}} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:SecuritySettings.availableMfaMethods |
| SecuritySettings.firstFactorSetupRef | {"$ref":"#/components/schemas/UUID"} | 否 | none | 绑定五分钟内已验证首因素与当前 session；只允许注册或取消未验证注册，不能替代普通安全授权 | bff:SecuritySettings.firstFactorSetupRef |
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
| DownloadRecord.downloadPath | {"type":"string","pattern":"^/v1/exports/[0-9a-fA-F-]{36}/download$"} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:DownloadRecord.downloadPath |
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
| BrowserCapabilityPolicy.permissionState | {"type":"object","required":["notifications","clipboard","authority","requestedByServer"],"properties":{"notifications":{"type":"string","enum":["unknown"]},"clipboard":{"type":"string","enum":["unknown"]},"authority":{"type":"string","enum":["browser_runtime"]},"requestedByServer":{"type":"boolean","enum":[false]}}} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BrowserCapabilityPolicy.permissionState |
| BrowserCapabilityPolicy.fallbacks | {"type":"array","maxItems":4,"items":{"type":"string","enum":["notification_in_app","clipboard_manual","download_retry","online_only"]}} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BrowserCapabilityPolicy.fallbacks |
| BrowserCapabilityPolicy.downloadLinkTtlSeconds | {"type":"integer","enum":[300]} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BrowserCapabilityPolicy.downloadLinkTtlSeconds |
| BrowserCapabilityPolicy.downloadHistoryIncludesLinks | {"type":"boolean","enum":[false]} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:BrowserCapabilityPolicy.downloadHistoryIncludesLinks |
| MfaEnrollment.factorRef | {"$ref":"#/components/schemas/UUID"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:MfaEnrollment.factorRef |
| MfaEnrollment.delivery | {"type":"string","enum":["one_time","restart_required"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:MfaEnrollment.delivery |
| MfaEnrollment.uri | {"type":"string"} | 否 | none | 真实 Auth 的一次性 TOTP 注册材料；仅首次响应和内存消费；禁止日志、数据库或持久化 | bff:MfaEnrollment.uri |
| saveProfile.request.displayName | {"type":"string","minLength":1,"maxLength":80} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:saveProfile.request.displayName |
| saveProfile.request.title | {"type":"string","maxLength":120} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:saveProfile.request.title |
| saveProfile.request.team | {"type":"string","maxLength":120} | 否 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:saveProfile.request.team |
| saveProfile.request.locale | {"type":"string","enum":["zh-CN","en"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:saveProfile.request.locale |
| saveProfile.request.timezone | {"type":"string"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:saveProfile.request.timezone |
| saveProfile.request.theme | {"type":"string","enum":["system","dark","light"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:saveProfile.request.theme |
| saveProfile.request.numberFormat | {"type":"string","enum":["comma_dot","space_comma"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:saveProfile.request.numberFormat |
| saveProfile.request.timeDisplay | {"type":"string","enum":["utc_local","local"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:saveProfile.request.timeDisplay |
| saveProfile.request.defaultRoute | {"type":"string","enum":["/command","/research","/portfolio","/markets"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:saveProfile.request.defaultRoute |
| saveProfile.request.density | {"type":"string","enum":["compact","comfortable"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:saveProfile.request.density |
| saveProfile.request.highContrast | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:saveProfile.request.highContrast |
| saveProfile.request.reducedMotion | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:saveProfile.request.reducedMotion |
| saveNotificationPrefs.request.rules | {"type":"array","items":{"$ref":"#/components/schemas/NotificationRule"}} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:saveNotificationPrefs.request.rules |
| saveNotificationPrefs.request.quietHoursEnabled | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:saveNotificationPrefs.request.quietHoursEnabled |
| saveNotificationPrefs.request.quietHoursStart | {"type":"string","pattern":"^([01]\\d&#124;2[0-3]):[0-5]\\d$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:saveNotificationPrefs.request.quietHoursStart |
| saveNotificationPrefs.request.quietHoursEnd | {"type":"string","pattern":"^([01]\\d&#124;2[0-3]):[0-5]\\d$"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:saveNotificationPrefs.request.quietHoursEnd |
| saveNotificationPrefs.request.criticalBypass | {"type":"boolean"} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:saveNotificationPrefs.request.criticalBypass |
| saveNotificationPrefs.request.digestFrequency | {"type":"string","enum":["off","daily","weekly"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:saveNotificationPrefs.request.digestFrequency |
| setupMfa.request.method | {"type":"string","enum":["passkey","authenticator"]} | 是 | none | 页面模型新增/服务读模型；不声明同名 Proto 字段 | bff:operation:setupMfa.request.method |

## 19. 完备性与验收边界

- 共 946 行契约字段（展开后的 wire 属性与计划字段行）；共享 schema 摘要另计，不沿用旧144行口径。
- 必填字段、可选字段、请求与响应按真实 schema 区分；SSE 信封为共享 StreamEvent，载荷版本和实时恢复仍按各 operation 规则执行。
- 已发布部分只证明仓库契约；未配置生成式 MSW 返回501。本地参考 provider 不替代 staging、真实数据库/身份/对象存储或正式签署。
- 当前一期不包含原生控制面；原生接口独立见 [DESK-PRE-04 承接表](./DESK-PRE-04-interface-transfer.md)。
