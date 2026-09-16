# BFF-FE-000 页面 BFF OpenAPI 基线

> 状态：**A1 repository delivery complete（2026-09-16）**；GPT-6 Astra 复审与 staging/provider 验收未执行
> 发布规范：[bff/openapi/quantos-bff.v1.yaml](../bff/openapi/quantos-bff.v1.yaml)（OpenAPI 3.1.0 / API 1.1.0 / 55 operations / 41 schemas）
> 全量命名：[page-operation-catalog.yaml](../bff/page-operation-catalog.yaml)（C01–C17 / 一期 22 页 / 55 published + 51 planned operationIds）
> Gate：`pnpm check:bff-fe-000 && pnpm test:bff-fe-000`
> 依据：执行计划 3.2 G0 条件 1、5.2–5.6 节；[GAP list](./PRE-04-openapi-gap-list.md)；[字段字典](./PRE-04-field-dictionary.md)；[契约台账](./PRE-04-contract-ledger.md)

## 1. 范围

发布面覆盖 G0 条件 1 最低冻结面（GAP-00 + C01/C03–C09）及 C17 Web additive 面：

| 契约 | operations | 路径 |
|---|---|---|
| C01 Session/Context | getSession、getContext、reauth、mfaChallenge、logout、submitAccessRequest | `/v1/session`、`/v1/context`、`/v1/auth/*`、`/v1/access-requests` |
| C03 Research | listResearchRuns、createResearchRun、getResearchRun、cancelResearchRun、subscribeResearchRun | `/v1/research-runs*` |
| C04 Data | listDataSnapshots、getDataSnapshot、getArtifact | `/v1/data-snapshots*`、`/v1/artifacts/{id}` |
| C05 Strategy | listStrategies、getStrategyDraft、saveStrategyDraft、runStaticCheck、createBacktest、getBacktest、listReleases、createRelease、getRelease、submitReleaseApproval、requestReleaseRollback | `/v1/strategies*`、`/v1/backtests*`、`/v1/releases*` |
| C06 Portfolio/Risk | getPortfolio、getRiskView、engageKillSwitch、releaseKillSwitch、subscribePortfolio | `/v1/portfolio*`、`/v1/risk*` |
| C07 Proposal | listProposals、getProposal、requestRiskEvaluation、subscribeProposal | `/v1/proposals*` |
| C08 Approval | listApprovals、getApproval、decideApproval | `/v1/approvals*` |
| C09 Execution | submitTradeCommand、listOrders、getOrder、requestOrderCancel、subscribeOrder | `/v1/commands`、`/v1/orders*` |
| C17 Settings/Web Platform | profile、notification、security、session/device、download 与 browser capability 共 13 个 operation | `/v1/settings/*`、`/v1/platform/capabilities` |

C02/C10–C16 及 C04/C05 的补充 operation 已在 catalog 冻结稳定名称和 owner，但仍是 `planned`。它们不进入生成 client，不得被解释为 provider 已实现；由 A2–A6 对应任务发布 path/schema 后才转为 `published`。

## 2. 关键设计决策（评审重点）

1. **统一基线（GAP-00）**：单资源裸返回；列表 `Page{items,nextCursor}`；错误一律 `ErrorEnvelope{code,message,correlationId,fieldErrors?,retryAfter?,currentVersion?}`；复用响应组件覆盖 401/403/404/409/422/429。
2. **幂等与并发**：业务命令 POST 一律要求 `Idempotency-Key`（uuid）；可变对象写要求 `If-Match: objectVersion`，409 返回 `currentVersion` 且客户端保留草稿不覆盖（校验脚本强制）。
3. **异步语义**：创建/取消/评估/提交等一律 `202 + AsyncAccepted{jobId,status,correlationId}`，终态以 SSE/详情为准，客户端不得乐观显示完成/成交。
4. **SSE 实时**：GET + `text/event-stream` + `afterSequence` 回补；事件信封 `StreamEvent{streamId,sequence,eventId,occurredAt,correlationId,payloadVersion,payload}` 与已通过 PoC 的 [sse.ts](../packages/api-client/src/sse.ts) 完全一致；权限撤销 = `payload.type=permission_revoked` 或重连 403 终态。
5. **安全边界**：BFF 注入 tenant/workspace/actor（schema 中不出现 actor 输入字段）；`TradeProposal.executable` 在 schema 层 `enum: [false]` 强制；404/403 不区分防存在性泄露；MFA/kill switch 决策要求 `mfaChallengeRef + reauthTokenRef`。
6. **数值与时间**：`DecimalValue` 字符串（pattern 校验）、`MoneyValue{currencyCode,units,nanos}`、RFC 3339 UTC——与 PRE-04 字段字典一致；proto 已有对象字段名与 proto 对齐（sourceDigest/imageDigest/venue+venueKind/counterViews 等）。
7. **版本策略**：路径 `/v1`；当前 `1.1.0`；后续只加不破（新增 optional 字段/新端点走 minor；破坏性变更走 `/v2`）。
8. **全量追踪策略**：catalog 的 `publishedOperations` 必须与 OpenAPI/生成 manifest 精确相等；`plannedOperations` 必须出现在 Page API Coverage，且不得冒充已生成或已联调。

## 3. 评审检查单（BFF TL + 联签方）

- [x] 55 个 published operation 与 OpenAPI/生成 manifest 双向一致
- [x] C01–C17 与 P01–P15/P17–P23 均有稳定 operationId 和后续 owner
- [x] ErrorEnvelope、cursor、sort/filter、202、Idempotency-Key、ETag/If-Match、correlation ID 与 SSE envelope 已冻结
- [x] 生成 client/schema/MSW 漂移和页面覆盖进入 CI
- [x] 敏感字段、权限不变量、403/409/429/501 fixture 已有自动化负向证据
- [ ] A2–A6 planned operation 的 path/schema/provider contract 与 staging 回执
- [ ] GPT-6 Astra 功能复审及 BFF/Frontend/QA/安全/领域 owner 的本轮 A1 联签

## 4. 冻结后动作

1. ~~发布版本化 OpenAPI 并生成 client/schema/MSW。~~ 已完成；当前 1.1.0 / 55 operations / 41 schemas。
2. ~~冻结全量页面 operationId 与 owner。~~ 已完成；catalog 覆盖 17 契约和一期 22 页。
3. ~~回填 [Page API Coverage 登记表](./PRE-01-page-api-coverage-register.md)。~~ 已完成稳定命名；planned/published 明确分栏语义。
4. ~~将生成漂移、页面覆盖、依赖/基线与负向破坏检查接入 CI。~~ 已完成。
5. A2–A6 逐域交付 planned operation 的 OpenAPI/schema/provider/staging 证据；A1 不替代这些 Gate。

## 5. 未决边界

1. **51 个 planned operation 尚未发布。** 其中包括回测流、Command Center、审计导出、运维治理、行情、preflight、绩效、对账与告警；页面仍受各自 A2–A6/DoR Gate 阻断。
2. **provider/staging 未验收。** 当前证据是 repository/OpenAPI/generated/mock/consumer 层，不证明真实 BFF、身份、权限、限流、SSE 恢复或审计行为。
3. **外部评审未执行。** `development_status=COMPLETED` 与 `review_status=NOT_STARTED` 分开记录，不伪造 GPT-6 Astra 或组织联签。
