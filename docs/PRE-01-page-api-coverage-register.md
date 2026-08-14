# Page API Coverage 登记表（operationId 回填基线）

> 任务：PRE-01 遗留项 1 / 执行计划第 5.7 节"逐页接口覆盖 Gate"
> 版本：1.1  日期：2026-08-14（1.1：BFF-FE-000 冻结后回填冻结域）
> 状态：**冻结域（C01/C03–C09）已按 OpenAPI 1.0.0 回填；C02/C10–C17 待后续 minor 版本**

## 1. 回填前提与当前状态

- 执行计划 5.7 要求：每个页面开发前建立一行 Page API Coverage 记录；每个 `UI-Pxx` 必须可追踪到 operationId。
- **BFF-FE-000 已冻结为 [quantos-bff.v1.yaml](../bff/openapi/quantos-bff.v1.yaml) 1.0.0（2026-08-14，BFF TL 评审通过）**，42 个 operationId 生效；本表已回填冻结域页面。
- 未冻结域（C02 聚合、C10–C17）保持 `待回填`，对应 UI 任务不得进 Sprint（DoR 阻断）；C02/C10–C17 随 BFF minor 版本发布后回填。
- 任何一行 operationId 为空时，对应 `UI-Pxx` 不得进入 Sprint（DoR 阻断）。

错误码集合统一基线（各页均适用，页面特有补充在备注列）：`401 / 403 / 404 / 409 / 422 / 429 / 5xx / stream-abort`。

## 2. 登记表

| 页面 | 路由 | Query operationId | Command operationId | Realtime channel/operationId | 权限/capability | 数据新鲜度字段 | OpenAPI 版本 | mock 版本 | BFF owner | 最后验证 |
|---|---|---|---|---|---|---|---|---|---|---|
| GS | 全局壳 | getSession、getContext | reauth、mfaChallenge、logout | subscribe*（各域流；权限变更以重连 403/permission_revoked 终态） | 全部登录角色 | expiresAt、asOf、sampledAt | 1.0.0 | 1.0.0 | BFF TL | 2026-08-14 |
| 官网 | `/access-request` | – | submitAccessRequest | – | 访客（防滥用/限速） | – | 1.0.0 | 1.0.0 | BFF TL | 2026-08-14 |
| P01 | `/login`、`/mfa`、`/auth/callback`、`/access-request`、`/unauthorized`、`/offline` | getSession、getContext | mfaChallenge、reauth、logout、submitAccessRequest | 无（认证页无实时通道；401 驱动） | 访客/已登录 | mfaState、expiresAt | 1.0.0 | 1.0.0 | BFF TL | 2026-08-14 |
| P02 | `/command` | 待回填（C02 command summary，minor 版本） | – | 待回填（authorized event projection） | 卡片按 capability | sampledAt、dataFreshness、asOf | 待回填 | 待回填 | BFF TL | – |
| P03 | `/research`、`/research/new` | listResearchRuns、getResearchRun | createResearchRun、cancelResearchRun | 无（创建后转 P04 订阅） | 研/开创建；其他只读 | deadlineAt、capturedAt/maxAgeSeconds | 1.0.0 | 1.0.0 | BFF TL | 2026-08-14 |
| P04 | `/research/:runId`、`/artifacts/:artifactId` | getResearchRun、getArtifact | cancelResearchRun | subscribeResearchRun（SSE，afterSequence） | 资源级授权 | capturedAt、maxAgeSeconds | 1.0.0 | 1.0.0 | BFF TL | 2026-08-14 |
| P05 | `/data-snapshots`、`/:snapshotId` | listDataSnapshots、getDataSnapshot | 无（只读；导出走 C10 待冻结） | 无（快照不可变） | 研/开/风；资源级只读 | capturedAt、maxAgeSeconds、qualityBlocked | 1.0.0 | 1.0.0 | BFF TL | 2026-08-14 |
| P06 | `/strategies`、`/new`、`/:strategyId/lab` | listStrategies、getStrategyDraft | saveStrategyDraft（If-Match→409）、runStaticCheck | 无（回测状态经 P07） | 开编辑；其他只读 | objectVersion、updatedAt | 1.0.0 | 1.0.0 | BFF TL | 2026-08-14 |
| P07 | `/backtests/:runId`、`/releases`、`/:releaseId` | getBacktest、listReleases、getRelease | createBacktest、createRelease、submitReleaseApproval、requestReleaseRollback | 过渡：getBacktest 轮询（v1.1 增补 backtest stream，见提案第 5 节） | 开；风/审批按动作 | reportArtifactId、objectVersion、allowedTargets | 1.0.0 | 1.0.0 | BFF TL | 2026-08-14 |
| P08 | `/portfolio`、`/risk`、`/risk/rules/:ruleId` | getPortfolio、getRiskView | engageKillSwitch、releaseKillSwitch | subscribePortfolio（含 kill switch 广播） | 交/风；kill switch 授权风控+MFA | asOf、stale | 1.0.0 | 1.0.0 | BFF TL | 2026-08-14 |
| P09 | `/proposals`、`/:proposalId` | listProposals、getProposal | requestRiskEvaluation | subscribeProposal | 交/风/审；资源级 | expiresAt、contextHash、objectVersion | 1.0.0 | 1.0.0 | BFF TL | 2026-08-14 |
| P10 | `/approvals`、`/:approvalId` | listApprovals、getApproval | decideApproval（+mfaChallenge/reauth） | 无（拉取式；操作前强制刷新） | 风（审批人）；禁自批 | expiresAt、objectVersion、decidedAt | 1.0.0 | 1.0.0 | BFF TL | 2026-08-14 |
| P11 | `/orders`、`/:orderId` | listOrders、getOrder | requestOrderCancel | subscribeOrder（SSE） | 交操作；运/风只读 | asOf、venue health、expiresAt | 1.0.0 | 1.0.0 | BFF TL | 2026-08-14 |
| P12 | `/audit`、`/:correlationId`、`/exports/:exportId` | 待回填（C10 search/chain） | 待回填（export create/poll/download） | 无（异步 job 轮询） | 审/管/资源级；脱敏 | occurredAt、retention、export expiresAt | 待回填 | 待回填 | BFF TL | – |
| P13 | `/operations`、`/operations/incidents/:incidentId` | 待回填（C11 health/incident） | 待回填（runbook actionId） | 待回填（health/alert broadcast） | 运/管 | sampledAt、latency | 待回填 | 待回填 | BFF TL | – |
| P14 | `/admin/members`、`/policies`、`/capabilities`、`/flags` | 待回填（C11 admin query） | 待回填（治理 CRUD w/ versioning、双人审批） | – | 管；最后管理员保护 | configVersion、objectVersion、effectiveAt | 待回填 | 待回填 | BFF TL | – |
| P15 | `/settings/profile`、`/notifications`、`/security` | 待回填（C17 profile/session/device） | 待回填（save/revoke/MFA setup） | 待回填（会话撤销推送） | 已登录本人 | session expiresAt | 待回填 | 待回填 | BFF TL | – |
| P16 | `/settings/desktop` | 待回填（platform capabilities） | 待回填（cache clear、update、diagnostic） | – | DT 已登录；Web 受限态 | update manifest version | 待回填 | 待回填 | BFF TL | – |
| P17 | `/settings/browser` | 待回填（browser capability/download record） | 待回填（notification permission 记录） | – | Web 已登录 | – | 待回填 | 待回填 | BFF TL | – |
| P18 | `/markets`、`/markets/:symbol` | 待回填（C12 catalog/quote） | 待回填（watchlist save） | 待回填（quote stream） | 行情许可证级 | source、asOf、latency、quality | 待回填 | 待回填 | BFF TL | – |
| P19 | `/markets/:symbol/chart` | 待回填（candle series/history） | 无（只读；受控导出经 C10） | 待回填（candle stream） | 行情许可证级 | asOf、quality、gaps | 待回填 | 待回填 | BFF TL | – |
| P20 | `/trade`、`/trade/:symbol` | 待回填（C13 capabilities/preflight） | requestRiskEvaluation（C07）、submitTradeCommand（C09，已冻结） | 待回填（preflight refresh；报价经 C12） | 交；风/审批只读 | quoteRef、asOf、objectVersion、mode、expiresAt | 部分 1.0.0 | 1.0.0 | BFF TL | 2026-08-14 |
| P21 | `/performance`、`/performance/reports/:reportId` | 待回填（C14 performance query） | 待回填（report create/poll/download） | 待回填（报表完成通知经 C16） | 交/风/研只读；账户级 | asOf、ledgerVersion、valuationSnapshotId、provisional | 待回填 | 待回填 | BFF TL | – |
| P22 | `/reconciliation`、`/:runId` | 待回填（C15 recon/break/ledger） | 待回填（requestReconRerun） | 待回填（recon status stream） | 交/风/运；资源级只读 | ledgerVersion、window、asOf | 待回填 | 待回填 | BFF TL | – |
| P23 | `/alerts`、`/alerts/:alertId` | 待回填（C16 alert list/get） | 待回填（ack/unack、subscriptions） | 待回填（alert stream） | 事件授权级 | occurredAt、asOf | 待回填 | 待回填 | BFF TL | – |

mock 版本说明：冻结域统一使用 OpenAPI `1.0.0` 生成的 TypeScript client、JSON Schema 与 MSW handlers；`pnpm check:bff-generated` 在 CI 中阻止生成漂移，不再维护 transition 自著 schema。

## 3. 回填执行流程（已完成首轮）

1. ~~BFF-FE-000 发布版本化 OpenAPI~~ 已完成（1.0.0，2026-08-14）。
2. ~~BFF TL 与 Frontend TL 按本表逐页核对权限、错误码、新鲜度字段~~ 冻结域已核对回填；未冻结域待 minor 版本。
3. ~~逐行回填 operationId / OpenAPI 版本 / mock 版本 / owner / 验证时间~~ 冻结域已回填。
4. 生成 client/schema/MSW 漂移检查与页面契约覆盖检查已进入 CI；后续 BFF minor 版本发布 C02/C10–C17 后回填剩余行。
