# UI-P14 Admin 治理高保真页面

依据 `SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md` I8/UI-P14 和 `design/P14-Admin-Governance-High-Fidelity-v2.png`，在 UI-602 真实 C01/C11 治理功能上交付契约支持范围的高保真适配。入口为 `/admin/members`、`/admin/roles`、`/admin/policies`、`/admin/capabilities`、`/admin/flags`。图中的示例人员、计数、历史和审批结果不作为业务数据。

## 布局与交互

- 沿用 Terminal 导航/工作区/账户/模式和主题 token，增加 Administration 面包屑、工作区范围带、五类治理标签及真实计数。1672/1440 展示四卡与左目录/本会话记录、右详情/受控变更；1024 收为纵向工作台，390 单列只读。主内容独立滚动，表格约束在面板内。
- 概览来自当前一致配置：有效成员、Owner 成员 actor 数、策略与有效策略、Engine 能力与配置启用数、开关与启用数。未核对时显示 `—`。Owner actor 数不代表独立用户数或当前有效管理员数量；Engine 启用配置不等于正式审批/生产准入。
- 资源表格支持名称/ID/治理字段搜索、启用/停用/保护/墓碑筛选、能力类型筛选及每页 10 条本地分页；仅筛选 runtime 已完整核对的目录，不改变后端请求过滤、权限或全局配置。筛选无匹配可显式恢复。选择资源后详情独立显示其 ID/版本，筛选不暗中改变当前编辑目标。
- 详情保留已读取对象/config 版本、当前状态、身份与权限边界、C01 读写能力、服务端最后管理员/职责分离要求及逐次 MFA/近期认证要求。保护 Owner/Service 基础身份按真实值显示，禁止误显示可选的 Operator。复制 ID 仅复制当前经过 schema 校验的资源 UUID，失败明确提示。
- 字段差异比较当前已读取 spec 与本地草稿，不冒充历史版本比较。所有编辑仍通过原类型化表单、字段审阅、原因、MFA、近期认证、CAS 和服务端授权；确认支持 Escape/焦点返回。具体 LAST_ADMIN/SELF_GOVERNANCE/SELF_APPROVAL/审查过期等已知拒绝以白名单说明补充通用拒绝，不回显任意服务端 message。
- 未知结果锁定刷新、目录筛选、分类导航及新意图；仅支持原方法/URL/body/If-Match/CSRF/Idempotency-Key/X-Request-Id 显式恢复，恢复遭 409 仍保留未知。C01 撤权/过期/离线/隐藏/焦点变化、非 JSON 401/403 沿用 UI-602 的清理规则。
- 本会话记录仅呈现当前存活会话最近 25 条实际验证提交的对象/config 版本、墓碑和 auditRef/correlationId。不新增客户端时间、虚构操作者或完整审批历史。C10 链接须当前 C01 独立授予 audit:read；Reference Owner 没有该能力，因此按钮禁用并说明原因。独立授权审计会话的真实回链由 UI602 provider-consumer 直接回归核对。

## 设计图与契约缺口

| 设计内容 | 实际实现与来源 | 未决状态 |
|---|---|---|
| 成员/角色/策略/能力/开关、版本冲突与受控变更 | 当前 C11 五类资源、spec、objectVersion/configVersion 与真实拒绝/回执 | 契约支持范围已实现 |
| 签名能力 | 只使用服务端有效审查目录并精确匹配 reviewId/name/version/description；启用仍由服务端校验有效期和审查者分离 | 不声称浏览器重新验证完整签名或生产准入 |
| Provider、risk tier、完整签名/制品摘要、SBOM、License、CVE、逐项审查报告/能力输入输出及副作用元数据 | C11 不提供；详情明确“未提供”，不展示伪造 Verified/0 CVE/Passed | **P14-C11-METADATA-01_OPEN** |
| 完整版本时间线、变更请求、操作者/审查者/时间、审批/补充信息工作流 | C11 不提供相应读取/审批端点；显示“本会话提交记录 / 非完整版本历史”，字段差异是草稿比较 | **P14-C11-HISTORY-01_OPEN** |
| 导出成员清单 | 未提供受控导出端点；按钮禁用，不能以本地下载绕过 C10 审计 | **P14-C11-EXPORT-01_OPEN** |
| Governance stream / 最后同步时间 | 没有持续治理流或服务端同步时间；底栏明确“未提供”，只显示实际配置版本 | **P14-C11-STREAM-01_OPEN** |

## 验证与 Gate

`node scripts/ui-p14-review.mjs --run docs/audit/evidence/ui-p14-local-20261024/attempt-NN` 在本地源码提交冻结后使用新目录；`node scripts/ui-p14-review.mjs --verify` 复核源码/输入、设计图、build/binary 哈希、命令退出码、日志、实际 browser network、截图、geometry 和 axe。runner 只执行页面与直接影响：13 例表现层测试 + UI602 policy/runtime/provider-consumer/既有 Operations consumer/shared navigation，类型/ESLint，单轮 Terminal 构建与 secret scan，P14 五场景、八个 dark/light×1672/1440/1024/390 截图/axe/geometry、五类页面截图、移动详情与确认截图，以及原 UI602 六场景回归。未改原生治理实现，不递归重跑原生依赖链；UI602 历史 22 例原生治理结果仅 ORIGINAL_SCOPE_ONLY。

浏览器实际连接本次源码构建的 Rust reference BFF，TLS/CORS 和 Cookie 身份是显式回环替代，数据/审查签名为既有 owned synthetic fixture。成功写入、回执、幂等恢复来自真实 BFF；429/409 是已标注的代理负向探针。截图页面的签名 Engine 能力通过真实 UI 创建，分页测试通过明确 control 请求创建 12 个合成角色，不伪造业务响应。

全部直接矩阵通过后工程 Gate 为 `PASS_UI_P14_ADMIN_HIGH_FIDELITY`，仅表示契约支持范围的高保真适配。功能状态 `IMPLEMENTED_PENDING_ACCEPTANCE`；正式 INTEGRATION `NOT_ASSESSED`、formalAccepted=false、runtimeAdmission=DENIED。

G4 IN_REVIEW、G4/FEP-4 NOT_READY_GAPS_OPEN、FEP-4 PARTIAL 保持；UI402-MARKER-SOURCE-01、P19-C10-EXPORT-01、C12→C14 valuation join、UI601 两项 HTTP 正向、P13-C11-SERVICE-01 与本页四项缺口均未闭合。真实 IdP/Cookie/CORS、Supabase/PostgreSQL/RLS/事务、外部源/venue、同 SHA 远程 CI、Firefox/WebKit、人工读屏/原生200%缩放、性能/容量/长稳、完整 I8 集成及 RELEASE 全部 NOT_RUN。自动 axe incomplete 原样保留，不冒充人工无障碍验收。

下一原计划任务：`FRONTEND-GATE:G6`，开展 FEP-6 有界功能组合与缺口评估；允许开始评估不代表 G6 READY。仅修改 QuantOS，在 main 本地提交；无生产凭据、推送、部署或发布。
