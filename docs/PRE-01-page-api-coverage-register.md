# Page API Coverage 登记表（operationId 回填基线）

> 任务：PRE-01 遗留项 1 / 执行计划第 5.7 节"逐页接口覆盖 Gate"
> 版本：1.0  日期：2026-08-14
> 状态：**等待 BFF-FE-000 冻结后回填**

## 1. 回填前提与当前状态

- 执行计划 5.7 要求：每个页面开发前建立一行 Page API Coverage 记录；每个 `UI-Pxx` 必须可追踪到 operationId。
- **进展（2026-08-14）**：BFF-FE-000 基线提案已起草——[quantos-bff.v1.yaml](../bff/openapi/quantos-bff.v1.yaml)，42 个 operationId 已可用于 G0 冻结域（C01/C03–C09）的映射评审；**冻结前本表"待回填"状态不变**，冻结后按提案 operationId 直接回填。
- 仓库现状核查（2026-08-14）：[quantos.swagger.json](../proto/openapi/quantos.swagger.json) 仅含 F03 领域协议生成的 7 个 operation（`EngineService_*`、`EventLedgerService_*`），**不存在 P01–P23 页面级 BFF OpenAPI**。BFF-FE-000 未冻结，全部 operationId 字段标记 `待回填`。
- 回填规则：BFF 发布版本化 OpenAPI 后，按下表逐页填入 operationId、OpenAPI 版本、mock 版本与验证时间；任何一行 operationId 为空时，对应 `UI-Pxx` 不得进入 Sprint（DoR 阻断）。
- 权限/capability、错误码集合、数据新鲜度字段已按 C01–C17 与设计规格预登记，供 BFF 契约评审对照。

错误码集合统一基线（各页均适用，页面特有补充在备注列）：`401 / 403 / 404 / 409 / 422 / 429 / 5xx / stream-abort`。

## 2. 登记表

| 页面 | 路由 | Query operationId | Command operationId | Realtime channel/operationId | 权限/capability | 数据新鲜度字段 | OpenAPI 版本 | mock 版本 | BFF owner | 最后验证 |
|---|---|---|---|---|---|---|---|---|---|---|
| GS | 全局壳 | 待回填（session/context、capabilities） | 待回填（reauth/MFA/logout） | 待回填（authorized event stream；权限变更断开） | 全部登录角色 | expiresAt、asOf、sampledAt | 待回填 | 待回填 | 待指派 | – |
| 官网 | `/access-request` | – | 待回填（access request submit） | – | 访客（防滥用/限速） | – | 待回填 | 待回填 | 待指派 | – |
| P01 | `/login`、`/mfa`、`/auth/callback`、`/access-request`、`/unauthorized`、`/offline` | 待回填（session/context） | 待回填（MFA challenge、reauth、logout、access request） | – | 访客/已登录 | mfaState、expiresAt | 待回填 | 待回填 | 待指派 | – |
| P02 | `/command` | 待回填（command center summary） | – | 待回填（authorized event projection） | 卡片按 capability 裁剪 | sampledAt、dataFreshness、asOf | 待回填 | 待回填 | 待指派 | – |
| P03 | `/research`、`/research/new` | 待回填（research list/get） | 待回填（create、cancel） | – | 研/开创建；其他只读 | deadlineAt、capturedAt/maxAge（快照时效） | 待回填 | 待回填 | 待指派 | – |
| P04 | `/research/:runId`、`/artifacts/:artifactId` | 待回填（run get、artifact/attachment get） | 待回填（cancel） | 待回填（SSE stream/replay，sequence/afterSequence） | 资源级授权 | capturedAt、maxAge | 待回填 | 待回填 | 待指派 | – |
| P05 | `/data-snapshots`、`/:snapshotId` | 待回填（snapshot list/get） | – | – | 研/开/风；资源级只读 | capturedAt、maxAge、quality | 待回填 | 待回填 | 待指派 | – |
| P06 | `/strategies`、`/new`、`/:strategyId/lab` | 待回填（strategy list、draft get） | 待回填（draft save w/ expectedVersion、static check） | – | 开编辑；其他只读 | draftVersion、objectVersion | 待回填 | 待回填 | 待指派 | – |
| P07 | `/backtests/:runId`、`/releases`、`/:releaseId` | 待回填（backtest get、release list/get） | 待回填（backtest create、release create、approval submit） | 待回填（backtest stream） | 开；风/审批按动作 | reportHash、objectVersion、allowedTargets | 待回填 | 待回填 | 待指派 | – |
| P08 | `/portfolio`、`/risk`、`/risk/rules/:ruleId` | 待回填（portfolio/risk query） | 待回填（kill switch） | 待回填（authorized realtime） | 交/风；kill switch 授权风控+MFA | asOf、stale | 待回填 | 待回填 | 待指派 | – |
| P09 | `/proposals`、`/:proposalId` | 待回填（proposal list/get） | 待回填（request evaluation） | 待回填（proposal status stream） | 交/风/审；资源级 | expiresAt、contextHash、objectVersion | 待回填 | 待回填 | 待指派 | – |
| P10 | `/approvals`、`/:approvalId` | 待回填（approval list/get） | 待回填（decide、MFA challenge、reauth） | – | 风（审批人）；禁自批 | expiresAt、objectVersion、decidedAt | 待回填 | 待回填 | 待指派 | – |
| P11 | `/orders`、`/:orderId` | 待回填（order list/get） | 待回填（cancel request，command ref + Idempotency-Key） | 待回填（order event stream，sequence） | 交操作；运/风只读 | asOf、venue health、expiresAt | 待回填 | 待回填 | 待指派 | – |
| P12 | `/audit`、`/:correlationId`、`/exports/:exportId` | 待回填（audit search、evidence chain get） | 待回填（export create/poll/download） | – | 审/管/资源级；脱敏 | occurredAt、retention、export expiresAt | 待回填 | 待回填 | 待指派 | – |
| P13 | `/operations`、`/operations/incidents/:incidentId` | 待回填（health/incident query） | 待回填（approved runbook actionId） | 待回填（health/alert broadcast） | 运/管 | sampledAt、latency | 待回填 | 待回填 | 待指派 | – |
| P14 | `/admin/members`、`/policies`、`/capabilities`、`/flags` | 待回填（member/policy/capability/flag query） | 待回填（治理 CRUD w/ versioning、双人审批） | – | 管；最后管理员保护 | configVersion、objectVersion、effectiveAt | 待回填 | 待回填 | 待指派 | – |
| P15 | `/settings/profile`、`/notifications`、`/security` | 待回填（profile/session/device query） | 待回填（profile save、session/device revoke、MFA setup） | 待回填（撤销后实时失效） | 已登录本人 | session expiresAt | 待回填 | 待回填 | 待指派 | – |
| P16 | `/settings/desktop` | 待回填（platform capabilities query） | 待回填（cache clear、update check/apply、diagnostic job） | – | DT 已登录；Web 受限态 | update manifest version | 待回填 | 待回填 | 待指派 | – |
| P17 | `/settings/browser` | 待回填（browser capability policy/permission state、download record） | 待回填（notification permission 记录） | – | Web 已登录 | – | 待回填 | 待回填 | 待指派 | – |
| P18 | `/markets`、`/markets/:symbol` | 待回填（catalog/watchlist、venue quote query） | 待回填（watchlist save、alert subscription） | 待回填（quote realtime） | 行情许可证级 | source、asOf、latency、quality | 待回填 | 待回填 | 待指派 | – |
| P19 | `/markets/:symbol/chart` | 待回填（candle series/history） | – | 待回填（candle realtime；断流停最后确认） | 行情许可证级 | asOf、quality、gaps | 待回填 | 待回填 | 待指派 | – |
| P20 | `/trade`、`/trade/:symbol` | 待回填（order capabilities、preflight/risk refresh） | 待回填（request evaluation、submit command ref） | 待回填（quote/preflight refresh） | 交；风/审批只读 | quoteRef、asOf、objectVersion、mode、expiresAt | 待回填 | 待回填 | 待指派 | – |
| P21 | `/performance`、`/performance/reports/:reportId` | 待回填（performance query） | 待回填（report create/poll/download） | – | 交/风/研只读；账户级 | asOf、ledgerVersion、valuationSnapshotId、provisional | 待回填 | 待回填 | 待指派 | – |
| P22 | `/reconciliation`、`/:runId` | 待回填（recon list/get、break list/get、ledger entries） | 待回填（request rerun，幂等） | 待回填（status realtime） | 交/风/运；资源级只读 | ledgerVersion、window、asOf | 待回填 | 待回填 | 待指派 | – |
| P23 | `/alerts`、`/alerts/:alertId` | 待回填（alert list/get） | 待回填（ack/unack、subscriptions） | 待回填（alert stream；授权/去重/限速） | 事件授权级 | occurredAt、asOf | 待回填 | 待回填 | 待指派 | – |

## 3. 回填执行流程

1. BFF-FE-000 发布版本化 OpenAPI（含统一 envelope、cursor 分页、202 job、Idempotency-Key、ETag/objectVersion、SSE event envelope）。
2. BFF TL 与 Frontend TL 按本表逐页核对权限、错误码、新鲜度字段是否被 schema 覆盖；缺口回写 BFF-FE-001–011。
3. 逐行回填 operationId / OpenAPI 版本 / mock 版本 / owner / 验证时间，并将每行链接到对应 `UI-Pxx` 的 Page API Coverage 记录。
4. 回填完成后，同步更新 [验收场景表](../PRE-01-acceptance-scenarios.md) 第 6 节映射与 [风险登记](../PRE-01-summary-and-risks.md) R2 状态。
5. CI 加入生成 client diff 与 contract 检查后，本表"最后验证"列由联调流水线自动刷新。
