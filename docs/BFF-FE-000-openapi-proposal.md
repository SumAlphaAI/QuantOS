# BFF-FE-000 OpenAPI 基线提案（评审稿）

> 状态：**待 BFF TL 评审冻结**（Frontend 起草，2026-08-14）
> 规范：[bff/openapi/quantos-bff.v1.yaml](../bff/openapi/quantos-bff.v1.yaml)（OpenAPI 3.1，42 operations）
> 结构校验：`node scripts/check-bff-openapi.mjs`（版本 / 本地 $ref 完整性 / operationId 唯一 / 命令幂等 / SSE afterSequence，全过）
> 依据：执行计划 3.2 G0 条件 1、5.2–5.6 节；[GAP list](./PRE-04-openapi-gap-list.md)；[字段字典](./PRE-04-field-dictionary.md)；[契约台账](./PRE-04-contract-ledger.md)

## 1. 范围

覆盖 G0 条件 1 最低冻结面（GAP-00 + C01/C03–C09）：

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

C02/C10–C17 在冻结后以 minor 版本追加（已在 GAP-02/10–17 登记，不在本稿）。

## 2. 关键设计决策（评审重点）

1. **统一基线（GAP-00）**：单资源裸返回；列表 `Page{items,nextCursor}`；错误一律 `ErrorEnvelope{code,message,correlationId,fieldErrors?,retryAfter?,currentVersion?}`；复用响应组件覆盖 401/403/404/409/422/429。
2. **幂等与并发**：业务命令 POST 一律要求 `Idempotency-Key`（uuid）；可变对象写要求 `If-Match: objectVersion`，409 返回 `currentVersion` 且客户端保留草稿不覆盖（校验脚本强制）。
3. **异步语义**：创建/取消/评估/提交等一律 `202 + AsyncAccepted{jobId,status,correlationId}`，终态以 SSE/详情为准，客户端不得乐观显示完成/成交。
4. **SSE 实时**：GET + `text/event-stream` + `afterSequence` 回补；事件信封 `StreamEvent{streamId,sequence,eventId,occurredAt,correlationId,payloadVersion,payload}` 与已通过 PoC 的 [sse.ts](../packages/api-client/src/sse.ts) 完全一致；权限撤销 = `payload.type=permission_revoked` 或重连 403 终态。
5. **安全边界**：BFF 注入 tenant/workspace/actor（schema 中不出现 actor 输入字段）；`TradeProposal.executable` 在 schema 层 `enum: [false]` 强制；404/403 不区分防存在性泄露；MFA/kill switch 决策要求 `mfaChallengeRef + reauthTokenRef`。
6. **数值与时间**：`DecimalValue` 字符串（pattern 校验）、`MoneyValue{currencyCode,units,nanos}`、RFC 3339 UTC——与 PRE-04 字段字典一致；proto 已有对象字段名与 proto 对齐（sourceDigest/imageDigest/venue+venueKind/counterViews 等）。
7. **版本策略**：路径 `/v1`；本稿 `0.1.0-draft`，冻结即 `1.0.0`；后续只加不破（新增 optional 字段/新端点走 minor；破坏性变更走 `/v2`）。

## 3. 评审检查单（BFF TL + 联签方）

- [ ] 42 个 operation 是否覆盖 G0 条件 1 全部域且无遗漏（对照 GAP-01/03/04/05/06/07/08/09）
- [ ] ErrorEnvelope/分页/幂等/版本/ SSE 信封是否与 BFF 实现栈可直接落地
- [ ] schema 字段与 proto（trading/strategy/research/common v1）语义一致，无重复 DTO 漂移
- [ ] 安全负向：无密钥/token/敏感载荷字段（对照敏感字段字典）；403/404 不泄露存在性
- [ ] counterViews minItems≥1 是否过严（R04 强制 vs 历史数据兼容）
- [ ] `executable: enum [false]` 的 schema 层强制是否保留
- [ ] venue/product/lot 相关字段是否需随 C12 行情契约统一（FEP-4 前复核）

## 4. 通过后动作

1. BFF TL 冻结为 `1.0.0` 并发布版本化 OpenAPI；GAP-00/01/03/04/05/06/07/08/09 转 Closed。
2. 生成 client 接入 packages/api-client（替换手写类型）；`check-bff-openapi.mjs` 入 CI；MSW handlers 由本 OpenAPI 生成替换自著 schema。
3. 回填 [Page API Coverage 登记表](./PRE-01-page-api-coverage-register.md)（operationId 已全部就绪，可直接映射）。
4. G0 条件 1 达成，进入六方签署（条件 5）。
