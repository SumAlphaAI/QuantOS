# FEP-6 前端范围收口与里程碑缺口评估

2026-10-24，I8 / FE:FEP-6，基线 `19bd1d777793ab6166b876ee87faf345a19de44f`。仅 QuantOS/main，本地提交，不使用生产凭据、不推送/部署/发布。

本轮完成**已实现前端范围的收口评估**。开发状态为 PARTIAL；工程 Gate `PASS_FEP6_FRONTEND_SCOPE_CLOSURE` 不代表完整 FEP-6、CORE:X06 或正式阶段完成。FEP-6/G6 保持 NOT_READY_GAPS_OPEN，G6 review_status=IN_REVIEW，全部159项stage_gate不提升，formalAccepted=false、runtimeAdmission=DENIED。下一原任务 FRONTEND-GATE:G7，可开始 I9 评估，不能直接宣称 Beta 候选通过。

## 六项交付范围

| 交付 | 路由 / 契约 | 已实现前端范围与限制 |
|---|---|---|
| UI-603 | `/alerts`、`/alerts/:alertId`；C16/C01 | 授权列表/详情、逐条 ack/unack、订阅CAS、有界有限SSE、恢复和清理；已读不等于解决，无系统/后台推送 |
| UI-P23 | 同上；C10/C11/C16 | 三栏/范围内计数搜索排序、确认弹窗、健康/审计预览与授权导航；缺少阈值、影响金额、批量确认等源字段不补造 |
| UI-601 | `/operations`、`/operations/health`、`/operations/incidents/:incidentId`；C11/C01 | 告警→Incident、确认/时间线、批准的inspect-health/inspect-evidence目录/预检查、MFA/CAS和恢复；HTTP证据正向与来源修复后resolve仍缺源 |
| UI-P13 | 同上；C11/C01 | 七服务视图、聚合观察/活动告警、Incident/Runbook/记录；七独立服务实例健康/心跳/诊断来源未提供，当前仅聚合+四组件 |
| UI-602 | `/admin/members`、`roles`、`policies`、`capabilities`、`flags`；C11/C01 | 五类类型化治理、最后管理员/职责分离、有效签名审查目录、原因/MFA/近期认证/CAS/墓碑/审计回执；服务端最终授权 |
| UI-P14 | 同上；C01/C11 | 概览/目录筛选分页/权限详情/草稿差异/本会话审计记录；完整高级元数据、审批历史、成员导出、持续治理流未提供 |

22项直接依赖逐一记录规范摘要、开发/阶段状态和原适用范围：BFF-FE-000–011、UI-P21、CORE-GATE:X3-SERVICE、SERVICE:X06、六项交付、G6。`closes_core=[CORE:X06]` 映射原样保留，但**不在此收口关闭核心完整功能复审**。UI-P21等跨里程碑引用、核心/provider义务不递归重验，也不被本轮授予READY。

## 当前验证与复用边界

未发现需要修改产品运行代码的当前缺陷。app/src、共享组件、后端、核心、契约、锁文件、构建配置及原G6测试均不改；工具白名单只允许本任务新增三份前端测试/模型、收口工具、文档与计划PARTIAL更新。

- `fep6-fixture.ts` 只响应 `https://fixture.invalid`，调用实际 Alerts/Operations/Admin runtime 与页面表现函数。内存状态、MFA/近期认证回包、提交/幂等/审查目录由模型定义；11项测试验证当前消费者的已读≠解决、诊断≠健康恢复、元数据≠验签、原请求恢复、原始权限边界与清理，不证明F06认证、真实签名、服务端治理/修复、C10持久审计或数据库。
- 新实际只读consumer在同一 owned reference BFF 实例中用 Operator/Owner/Viewer各自合成会话读取 C01/C16/C11/C10。校验源告警ID/sourceRef/sourceVersion/account/mode、有限流EOF、源风险未解决、健康degraded、InspectEvidence缺证据拒绝、Owner无Audit读权限、Operator无Admin写权限、Viewer不进入Admin、有效审查目录不等于已启用Engine。只允许回环GET，零业务写，未生成新的变更审计链；C10只核对授权目录schema/权限，真实变更回链保留G6原范围。
- 重用 G6 构建源码 `1cee533781312f684c4c5ac121a13a5922c689a0` 的原二进制，执行前核对其SHA256与产品源码未变；**binarySourceCommit**是原构建SHA，**fixtureSourceCommit**必须等于本轮冻结checkout SHA并由原来源守卫校验，不以旧构建SHA冒充当前运行时fixture来源。未重建二进制，不把原生/浏览器/build旧通过绑定到新提交。
- Node HTTP注入合成Cookie，不验证浏览器Cookie/CORS；runtime GET的cache记录为no-store，既有C10目录gateway的默认cache选项如实保留，不声称浏览器缓存行为验收。
- 当前执行11模型+1实际只读consumer+10项G6拒绝边界直接回归、Terminal typecheck、改动lint、门禁/执行策略反例、计划与预期阶段拒绝。未重新运行Chromium、Terminal build或Rust原生矩阵；旧G6的184测试/22原生/5组合+17浏览器回归及其命令/输入/原始产物哈希只作 ORIGINAL_SCOPE_ONLY。

运行：冻结源码后 `node scripts/fep6-function-review.mjs --run docs/audit/evidence/fep6-function-local-20261024/attempt-NN`；复核 `node scripts/fep6-function-review.mjs --verify`。新attempt不可覆盖，失败/诊断与NOT_RUN保留，公开环境白名单不传DATABASE_URL或服务角色密钥。

预检发现两项测试工具问题并保留日志：复用binary时误将旧构建SHA传给运行时来源守卫，实际reference首次领域读取正确拒绝并关闭；改为当前真实checkout SHA，二进制构建来源仍独立记录。其后测试将C10目录gateway默认cache误要求为no-store，修正断言并保留实际选项；未修改产品缓存/来源策略，不把工具修正记为产品修复。

## 未关闭的里程碑义务

| ID / 范围 | 当前状态与关闭条件 |
|---|---|
| UI601 InspectEvidence HTTP正向 | NOT_RUN_REFERENCE_SOURCE_UNAVAILABLE；需授权真实订单证据，消费者/原生正向不能替代 |
| UI601 resolve HTTP正向 | NOT_RUN_NO_REPAIR_HTTP；需要真实来源修复后健康/告警/独立审批闭环，当前403拒绝不是解决成功 |
| P13-C11-SERVICE-01 | OPEN；补充七独立服务健康/心跳/历史诊断的正式来源 |
| P14-C11-METADATA-01 | OPEN；签名/制品摘要、Provider/risk、SBOM/License/CVE、逐项报告和边界元数据未提供 |
| P14-C11-HISTORY-01/EXPORT-01/STREAM-01 | OPEN；完整历史/审批流、受控成员导出、持续治理流未提供 |
| Web通知 | 应用内授权收件箱/有界SSE已实现；系统/后台推送及外部通知渠道NOT_PROVIDED_NOT_CLAIMED |
| G6 / 核心 / provider与页面确认 | G6 IN_REVIEW/NOT_READY_GAPS_OPEN，CORE:X06完整关闭未声明，CORE-GATE:X3-SERVICE/SERVICE:X06/PROVIDER:ALL与六页正式确认/READY不提升 |
| G4/FEP-4 | G4 IN_REVIEW、G4/FEP-4 NOT_READY_GAPS_OPEN、FEP-4 PARTIAL；UI402-MARKER-SOURCE-01同源正向NOT_RUN、P19-C10-EXPORT-01导出未实现、C12→C14估值join未声明 |
| 目标与RELEASE | 实际IdP/Cookie/CORS、Supabase/RLS/事务/持久审计、外部源/venue、跨实例/重启持久恢复、同SHA远程CI、Firefox/WebKit/跨OS、人工读屏/native200%、性能/容量/长稳、完整I8与发布均NOT_RUN |

以上缺口不删除、不标为通过，也不变成无关功能开发的辅助前置。完成的是前端已实现范围收口与缺口评估，里程碑保持PARTIAL。
