# FRONTEND-GATE:G6：FEP-6 有界功能组合与缺口评估

2026-10-24，I8 原任务 FRONTEND-GATE:G6。基线 `032a7a659b7e37cca63cc45fba7d48d151f430b1`；仅 QuantOS/main，无生产凭据、数据库连接、推送、部署或发布。只评估已实现的运维治理组合，不关闭 FE:FEP-6 或 CORE:X06 全范围，也不把历史证据改绑为新候选通过。

## 当前组合范围

同一实际 Rust reference BFF 实例、同一 Paper 工作区/账户中，使用各自独立的 Operator/Owner/Approver 会话，依次验证 C01/F06、C16 收件箱与订阅/有限事件流、C11 Incident/Runbook/Admin 及 C10 审计根。角色切换是明确 reference Cookie 代入，禁止当作真实 IdP 或当前用户提权；后端实例在旅程各页面之间不更换。

| 组合 | 本轮证明 | 不代表 |
|---|---|---|
| Alerts → Operations → Incident | 规范深链、同 alertId/account/mode/sourceVersion，已读后 active/resolved/sourceRef 不变，创建/确认后时间线两项 | 已读/Incident确认不是故障修复 |
| 批准 Runbook | inspect-health 预检查、原因/MFA/近期认证/CAS、实际 succeeded 回执及审计；响应丢失原方法/body/key/If-Match/requestId恢复 | 不允许 shell/任意 action，不等于 health.ready |
| Admin → 当前会话撤权 | Owner 拒绝策略撤回 Operator 的 ops.operate；既有 Alerts/Operations 未知请求先核对新C01并清除，禁止原写重放；新会话保留读取但不能获得高风险写权限 | 不把治理策略等同原身份扩权 |
| 订阅 → 事件流 → 开关 | 订阅完整集合 CAS、租约重建、EOF disconnected；C11关闭 alerts-live-view / incident-timeline 返回真实 **409 FEATURE_DISABLED**，显式恢复后重读 | 开关关闭不是401/403撤权；有限读取不冒充持续Live/系统后台推送 |
| 签名能力/最后管理员/职责分离 | 服务端有效审查目录创建 Engine 能力、Owner 最后管理员保护409、Approver独立ops.approve与无ops.operate；活跃来源的解决尝试真实403，Incident仍acknowledged | 不声称HTTP修复/解决正向或完整生产签名审批 |
| C10 回链 | 同实例每项实际成功回执具有唯一 auditRef 对应事件；浏览器主旅程5根，HTTP组合7根；Owner无audit:read，由独立授权Operator读取 | 不声称Supabase持久审计或全组织历史完整 |
| 移动/离线/拒绝 | 移动高风险ack/Runbook/Admin写禁用；离线/C01变化与非JSON401/403清私有事实和未知意图；500保留未知 | 不将低风险C16个人订阅误当高风险管理写，或将代理负向当实际BFF错误输出 |

10项明确消费者探针验证 Alerts/Operations 非JSON 401/403（C01与业务响应）及500未知边界，现有实现已正确通过，未为制造修复而改动产品代码。新HTTP组合初次有一项失败源于探针把 FEATURE_DISABLED 错期望为403/清屏；修正到真实409并保留原范围已核对告警，随后4/4通过。首次浏览器4/5，主旅程使用完整UUID定位仅显示8位前缀的按钮而超时；改为展示标签定位后再核对完整来源UUID。原日志/截图/失败均保留，不将错误测试假设当作产品缺陷或修复成果。

## 本轮验证与源码边界

冻结本地源码后运行 `node scripts/frontend-g6-review.mjs --run docs/audit/evidence/frontend-g6-local-20261024/attempt-NN`，新目录不可覆盖；`node scripts/frontend-g6-review.mjs --verify` 复核。白名单公开环境隔离 DATABASE_URL/服务角色密钥；离线 Cargo、固定 pnpm；实际命令、退出码、输入、源码SHA、二进制/build哈希、网络、快照和历史摘要在独立attempt封存。

直接矩阵：G6新探针/同实例HTTP组合，UI603/P23/UI601/P13/UI602/P14的当前策略/消费者与C01 route monitor；C11原生模块22项直接正确性（包括明确内存新来源修复后的resolve及签名审查），一轮Terminal构建/类型/定向ESLint/secret scan；G6五项Chromium组合，原P23/UI601/UI602共17项直接功能回归（跳过未改布局的截图/合成展示用例）。未递归重跑所有核心/provider依赖，未执行完整X3/X06/FEP6/全仓或数据库campaign。

实际应用运行源码 `apps/terminal/app/`、`apps/terminal/src/`、`packages/`、`services/`、`crates/` 均未修改；本轮新增测试、机器可复核评估工具、文档及计划记录。既有G4/FEP4/UI603/P23/UI601/P13/UI602/P14证据按文件哈希保持不变，只作为 ORIGINAL_SCOPE_ONLY。旧完整视觉/axe/incomplete与人工验收不重新绑定当前候选；功能截图只作本轮旅程证据。

## 保留的 G6/FEP-6 缺口

| 范围 | 保留状态 / 后续关闭条件 |
|---|---|
| UI601 InspectEvidence HTTP 正向 | NOT_RUN_REFERENCE_SOURCE_UNAVAILABLE；需真实授权订单证据源；原生/消费者正向不能代替HTTP提供方 |
| UI601 resolve HTTP 正向 | NOT_RUN_NO_REPAIR_HTTP；当前未提供来源修复HTTP端点，真实活跃来源拒绝不冒充解决成功；不为验收增加产品可调用注入入口 |
| P13-C11-SERVICE-01 | OPEN；当前仅聚合与四组件，七独立服务实例健康、心跳和历史诊断未提供 |
| P14-C11-METADATA-01/HISTORY-01/EXPORT-01/STREAM-01 | OPEN；完整签名/制品/Provider/risk/SBOM/License/CVE/逐项报告、完整历史与审批流、成员导出、持续治理流未提供 |
| Web通知范围 | 已实现并验证应用内授权收件箱、有界手动SSE与显式重读；系统/后台推送及端到端外部通知渠道 NOT_PROVIDED_NOT_CLAIMED，不以应用内提示冒充 |
| 阶段/核心/provider义务 | G6九项依赖仍原阶段；六页面当前功能实现不等于正式确认/READY。CORE:X06完整 closes_core、CORE-GATE:X3-SERVICE/SERVICE:X06/PROVIDER:ALL新候选完整准入 NOT_CLAIMED |
| G4/FEP-4 | G4 IN_REVIEW、G4/FEP-4 NOT_READY_GAPS_OPEN、FEP-4 PARTIAL；UI402-MARKER-SOURCE-01同源阳性、P19-C10-EXPORT-01导出未实现、C12→C14估值join未声明全部保持 |
| 真实目标/恢复/RELEASE | 实际IdP/Cookie/CORS、Supabase/RLS/事务/持久审计、外部告警/订单/venue、跨进程/重启持久恢复、同SHA远程CI、Firefox/WebKit/跨OS、人工读屏/native200%、性能/容量/长稳、完整I8与RELEASE均NOT_RUN |

工程 Gate 仅 `PASS_G6_OWNED_LOCAL_COMPOSITION`。正式 G6 结论 **NOT_READY_GAPS_OPEN**，review_status=IN_REVIEW、stage_gate=NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。FE:FEP-6 development_status 保持 UNSPECIFIED，未在本检查点自动关闭里程碑；G4/FEP-4及P14未决项不提升。G6与FEP6的INTEGRATION CLI都须拒绝；下一原任务 `FE:FEP-6` 可开展前端范围收口与里程碑缺口评估，不能将该评估变成G6 READY或无关功能开发前置。
