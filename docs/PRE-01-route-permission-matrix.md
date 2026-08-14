# PRE-01 产出物二：路由/权限矩阵

> 任务：PRE-01 需求拆解（FEP-0）
> 版本：1.0  日期：2026-08-14
> 依据：设计规格第 1.2、2.2、2.3、6.3 节；网站与终端设计方案第 6 节；执行计划第 1.1、4.2 节
> 配套文件：[页面台账与 Story 拆解](./PRE-01-page-ledger-and-stories.md)、[验收场景表](./PRE-01-acceptance-scenarios.md)

## 1. 路由守卫总则

守卫顺序固定为：**会话有效性 → tenant/主工作区上下文 → 角色/capability → 资源级授权 → mode/策略状态 → 页面数据加载**。任一步失败即停止后续请求。

- 403 返回"无权限"规范文案；404 不区分真实不存在与未授权；策略不允许时返回可解释的受限状态。
- 权限处理原则：多数受限功能"可见但不可用 + 原因说明"；涉及密钥、受限审计和高风险操作则完全不返回内容。
- 后端拒绝优先，前端隐藏/禁用只是体验层；UI 状态不被视为安全控制。
- 桌面深链 `quantos://` 与 Web 路径同语义，所有深链经 BFF 重新鉴权后加载，资源数据不放入 URL。
- Terminal 全部业务路由 `noindex, nofollow`；仅登录/访问申请可有受限元数据。

角色缩写：研=研究员、开=量化开发、交=交易员、风=风控/审批人、运=运维/SRE、管=管理员、审=审计员、访=访客。✔=可用、R=只读、–=不可见/不可达。

## 2. Terminal 路由 × 角色矩阵

| 路由 | 页面 | 深链 | 访 | 研 | 开 | 交 | 风 | 运 | 管 | 审 | 资源级 | 平台 | <768px | 离线（DT） | 风险 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `/login`、`/mfa`、`/auth/callback` | P01 | `quantos://login` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | 否 | W/D | 可用 | 不可用（需在线认证） | 高 |
| `/access-request` | P01/官网 | – | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | 否 | W/D/官网 | 可用 | 不可用 | 中 |
| `/unauthorized`、`/not-found`、`/maintenance`、`/offline` | P01 | 同路径 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | 否 | W/D | 可用 | 可用（状态页） | 中 |
| `/command` | P02 | `quantos://command` | – | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | 卡片按 capability | W/D | 只读 | 只读缓存 | 中 |
| `/research` | P03 | `quantos://research` | – | ✔ | ✔ | R | R | R | R | R | 是 | W/D | 只读 | 只读缓存 | 中 |
| `/research/new` | P03 | `quantos://research/new` | – | ✔ | ✔ | – | – | – | – | – | 是 | W/D | 不可用（高风险创建隐藏） | 禁用 | 中 |
| `/research/:runId` | P04 | `quantos://research/:runId` | – | ✔ | ✔ | R | R | R | R | R | 是 | W/D | 只读 | 只读缓存（终态摘要） | 中 |
| `/artifacts/:artifactId` | P04 | `quantos://artifacts/:artifactId` | – | ✔ | ✔ | R | R | R | R | ✔ | 是 | W/D | 只读 | 只读缓存（非敏感） | 中 |
| `/data-snapshots`、`/:snapshotId` | P05 | 同路径 | – | ✔ | ✔ | R | ✔ | R | R | R | 是 | W/D | 只读 | 只读缓存 | 中 |
| `/strategies` | P06 | `quantos://strategies` | – | R | ✔ | R | R | – | R | R | 是 | W/D | 只读 | 只读缓存 | 中 |
| `/strategies/new`、`/:strategyId/lab` | P06 | 同路径 | – | R | ✔ | – | – | – | – | – | 是 | W/D | 不可用 | 禁用（草稿本地缓存除外） | 中 |
| `/backtests/:runId` | P07 | 同路径 | – | R | ✔ | R | R | – | R | R | 是 | W/D | 只读 | 只读缓存 | 中 |
| `/releases`、`/:releaseId` | P07 | 同路径 | – | R | ✔ | R | R（可审批） | – | R | R | 是 | W/D | 只读（审批操作隐藏） | 禁用 | 高 |
| `/portfolio` | P08 | `quantos://portfolio` | – | R（授权） | R | ✔ | ✔ | R | R | R | 是（账户级） | W/D | 只读 | 只读缓存 | 高 |
| `/risk`、`/risk/rules/:ruleId` | P08 | 同路径 | – | – | R | R | ✔ | R | R | R | 是 | W/D | 只读 | 只读缓存 | 高 |
| `/proposals`、`/:proposalId` | P09 | 同路径 | – | R（授权） | R | ✔ | ✔ | R | R | R | 是 | W/D | 只读 | 只读缓存 | 高 |
| `/approvals`、`/:approvalId` | P10 | 同路径 | – | – | – | R | ✔ | – | R | R | 是 | W/D | 不可用（无审批操作） | 禁用 | 高 |
| `/orders`、`/:orderId` | P11 | 同路径 | – | R（授权） | R | ✔ | R | R | R | R | 是 | W/D | 只读（无撤单） | 只读缓存 | 高 |
| `/trade`、`/trade/:symbol` | P20 | `quantos://trade` | – | – | – | ✔ | R | – | R | R | 是 | W/D | 不可用 | 禁用 | 高 |
| `/audit`、`/:correlationId`、`/exports/:exportId` | P12 | 同路径 | – | R（授权） | R | R | ✔ | R | ✔ | ✔ | 是 | W/D | 只读 | 禁用导出 | 高 |
| `/operations`、`/operations/incidents/:incidentId` | P13 | 同路径 | – | – | – | – | R | ✔ | ✔ | R | 是 | W/D | 只读（无 Runbook 动作） | 禁用 | 高 |
| `/admin/members`、`/policies`、`/capabilities`、`/flags` | P14 | 同路径 | – | – | – | – | – | – | ✔ | R | 否（工作区级） | W/D | 不可用 | 禁用 | 高 |
| `/settings/profile`、`/notifications`、`/security` | P15 | 同路径 | – | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | 否（个人级） | W/D | 可用 | 禁用 | 中 |
| `/settings/desktop` | P16 | 同路径 | – | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | 否 | DT（Web 受限态） | 不可用 | 可用（本机设置） | 中 |
| `/settings/browser` | P17 | 同路径 | – | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | 否 | Web（DT 不显示） | 可用 | 不可用 | 低 |
| `/markets`、`/markets/:symbol` | P18 | 同路径 | – | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | 行情许可证级 | W/D | 只读 | 只读缓存 | 中 |
| `/markets/:symbol/chart` | P19 | 同路径 | – | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | 行情许可证级 | W/D | 只读 | 只读缓存 | 中 |
| `/performance`、`/performance/reports/:reportId` | P21 | 同路径 | – | R（授权） | R | ✔ | ✔ | R | R | R | 是（账户级） | W/D | 只读 | 只读缓存 | 中 |
| `/reconciliation`、`/:runId` | P22 | 同路径 | – | – | – | ✔ | ✔ | ✔（受控重跑） | R | R | 是 | W/D | 只读 | 只读缓存 | 高 |
| `/alerts`、`/alerts/:alertId` | P23 | 同路径 | – | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | 事件授权级 | W/D | 只读（禁确认写） | 只读（禁确认） | 中 |

注：
1. `/trade` 进入页面本身不创建订单也不授予交易权限；风控/审批人按权限只读。
2. `/settings/desktop` 在 Web 访问时渲染受限说明页（P16 规范）；`/settings/browser` 在桌面端不渲染入口（P17 规范）。
3. 审批、签发、撤单、策略发布、kill switch、Runbook 动作、Admin 变更为"高风险操作"：小屏（<768px）一律隐藏，桌面离线一律禁用。

## 3. 官网路由 × 角色矩阵

| 路由 | 页面 | 访客 | 已登录用户 | SEO | 优先级 | 风险 |
|---|---|---|---|---|---|---|
| `/` | 首页 | ✔ | ✔ | index | P0 | 低 |
| `/product` | 产品 | ✔ | ✔ | index | P0 | 低 |
| `/architecture-security` | 架构与安全 | ✔ | ✔ | index | P0 | 低 |
| `/use-cases` | 使用场景 | ✔ | ✔ | index | P1 | 低 |
| `/docs` | 文档中心 | ✔ | ✔ | index | P1 | 低 |
| `/access-request` | 访问申请（防滥用+隐私告知） | ✔ | ✔ | 受限元数据 | P0 | 中 |
| `/login` | 登录入口（跳 Terminal SSO） | ✔ | ✔ | 受限元数据 | P0 | 中 |
| `/developers`、`/status` | 开发者/状态页 | 后续阶段（M2+/M4+），本期不交付 | – | – | – | – |

## 4. 角色 × 领域权限矩阵（默认范围）

| 领域能力 | 研 | 开 | 交 | 风 | 运 | 管 | 审 |
|---|---|---|---|---|---|---|---|
| 发起/取消 Research | ✔ | ✔ | – | – | – | – | – |
| 查看 Research/Artifact/快照 | ✔ | ✔ | R | R | R | R | R |
| 编辑策略草稿/静态检查/回测 | R | ✔ | – | – | – | – | – |
| 创建 Release/提交发布审批 | – | ✔ | – | – | – | – | – |
| 审批发布物 | – | 禁自批 | – | ✔ | – | – | – |
| 查看 Portfolio/Performance | R（授权） | R | ✔ | ✔ | R | R | R |
| 请求风险评估 | – | – | ✔ | ✔ | – | – | – |
| 审批/拒绝 Approval（MFA 签名） | – | – | 禁自批 | ✔ | – | – | – |
| 提交已批准 TradeCommand ref | – | – | ✔ | – | – | – | – |
| 撤单请求 | – | – | ✔ | – | – | – | – |
| kill switch | – | – | – | ✔（MFA+签名） | – | – | – |
| 受控重新对账 | – | – | – | R | ✔（Runbook） | – | – |
| Audit 检索/受控导出 | R（资源级） | R（资源级） | R（资源级） | ✔ | R | ✔ | ✔ |
| Runbook 受控动作 | – | – | – | – | ✔ | ✔ | – |
| 成员/策略/能力/flag 治理 | – | – | – | – | – | ✔（禁删最后管理员） | R |
| 告警确认（ack） | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| 个人设置/MFA/会话管理 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

全员禁止：读取明文密钥、绕过风险/审批/审计链路、手工改账、客户端拼装 TradeCommand、直连 venue/Engine/数据库。

## 5. 平台差异与模式约束

| 维度 | Web | Desktop |
|---|---|---|
| 业务路由/权限 | 与桌面端完全一致（共享实现与 E2E） | 与 Web 完全一致 |
| 窗口 | 单窗口/标签页，URL 恢复 | 多窗口/多显示器，布局本地加密保存 |
| 通知 | 用户手势授权浏览器通知，拒绝后页面内降级 | 原生系统通知 |
| 文件 | 浏览器选择/下载，上传统一扫描 | 系统文件对话框，上传统一扫描，禁止直接传给 Engine |
| 离线 | 提示断开，默认无领域缓存，全部禁写 | 加密非敏感只读缓存；禁创建/审批/签发/撤单/导出 |
| 更新 | 灰度刷新 | 同 release manifest，签名更新+可控重启 |
| 小屏 | <768px 只读，隐藏全部高风险主操作 | 最小窗口 1180×760，无小屏只读档 |
| 模式 | Research/Paper/Shadow；M5 testnet 入口仅服务端 flag 放行；Guarded Live 不存在 | 同 Web |
