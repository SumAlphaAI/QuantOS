# UI-601 Operations / Incident / Runbook 功能规程

I8，C11/C16；仅QuantOS/main本机功能实现、直接影响回归、文档和证据。不使用生产凭据，不连接目标数据库，不推送/部署/发布。下一任务为FE:UI-P13高保真页面。

## 交付与数据边界

- 路由 `/operations`、`/operations/health`、`/operations/incidents/<UUID>`；静态映射只允许声明的health/UUID详情，不映射任意action/命令路径。C01要求ops.read、Paper/Shadow、完整身份/账户/权限/最短有效期一致。权限流/轮询和离线/隐藏/焦点变化关闭运行时，清除私有事实与恢复意图；目标页面独立重鉴权。
- 健康/metrics分别读取并逐字段一致，再接受account/mode、sourceHash/metricsHash、版本、asOf、30秒有效期、组件唯一性。过期标记不展示为当前Ready；不把有限当前观察当性能/容量验收。当前C11仅提供service-x06聚合和execution/portfolio/risk/reconciliation四组件，不虚构7个独立服务；UI-P13设计适配须保留该契约边界。
- Incident和告警冻结分页：100条/页，最多10页/1000条，configVersion一致、顺序/重复ID/过滤/cursor循环拒绝。原子发布本次dashboard，不混入半次读取；当前计数只对应已加载范围。无alerts.read时不读取C16。
- 创建Incident需先读取当前active告警，绑定alertId/sourceVersion和列表configVersion；确认Incident仅open→acknowledged，解决仅acknowledged→resolved并要求ops.approve。MFA verified、近期认证未过期、显式原因/确认、desktop>=768与即时权限复核后，重读对象/配置再CAS。新建201不当queued；回执需审计引用、对应alert/来源及增量版本；Incident确认不解决告警。
- GET详情→timeline→再次GET详情，验证同一Incident/账户/mode、不可变来源、时间/事件ID/版本顺序及时间线head一致。创建/更新回执后时间线标记未重读；保留原始事件，不用回执替代完整历史。服务端新来源可重开已解决Incident，UI按新事实显示。
- Runbook只接受服务端目录中的 `inspect-health`（无参数）与 `inspect-evidence`（仅commandId UUID）。目录/参数重复或变更拒绝；没有shell、脚本、自由JSON、改账、交易或任意actionId入口。检查allowed/reason、sourceVersion与健康一致、expiresAt有效，再允许显式确认；MFA后重读目录、健康及原参数precheck，变更须重新审阅。If-Match绑定precheck.sourceVersion；检查成功不代表业务恢复。
- Runbook回执仅接收200/succeeded/applied及sourceOperationRef/outcome.reference/auditRef/correlationId结构；operation摘要和outcome引用是不同含义，不能强制相等或冒充来源join。审计链接按audit:read显示；不把返回引用当作任意可执行路径。
- 原键、body、验证proof、CSRF、If-Match与requestId仅存在当前内存。未知结果锁定其他操作，手动恢复复用原请求，不重新验证/改变请求或自动重发；失权/过期/离线清除。首次已知409/429等拒绝释放意图并清掉旧审阅，须重新读取；恢复遇拒绝仍保持未知（401/403按失权清除）。429按1..3600秒retryAfter冷却。原错误message不展示。
- C11解决条件包含独立Approver/不同人员、Incident已确认、新来源修复、health.ready、告警inactive且已读；服务端最终验证。当前真实拒绝码为403/FORBIDDEN，客户端撤回访问并清除上下文，不改写为409或“已解决”。
- Alerts详情已有ops.read时增加Operations健康入口；保留P23原证据不改绑。C02旧 `/operations/alerts/:id` 引用未作为本任务的新路由交付。

## 必要修复与验证范围

reference C01冷启动应保持ops.approve默认禁用；Owner在明确受控fixture中启用后，原C01只做retain而不补回权限，Approver仍无法进入解决流程。已改为Governance有效权限与原角色能力的交集双向同步；不向Operator/Owner/Viewer扩权，不修改live授权。新增原生角色交集回归、HTTP实际C01启用后声明与角色拒绝。测试中的Owner治理bootstrap仅回环reference fixture，不代表生产授权。

运行 `node scripts/ui601-review.mjs --run docs/audit/evidence/ui601-local-20261024/attempt-NN`，在冻结本地源码上执行直接矩阵；`--verify`核对源输入、命令/退出码/日志、fresh binary、terminal build、浏览器产物及历史摘要。直接回归包括C11原生模块、当前C16/P23消费者和P23页面（Alerts→Operations入口）。额外只跑一项实际X06 InspectEvidence原生测试，因reference HTTP未注入订单证据，不递归全上游或全仓验收。

真实HTTP组合覆盖C01/F06/C11/C16/C10、health/metrics、Runbook inspect-health成功/原请求恢复、inspect-evidence预检查拒绝、Incident创建/确认/时间线/恢复、独立审批声明与解决拒绝。原生C11模块覆盖新来源修复后解决、复发重开与职责分离；一项X06实际批准订单证据测试覆盖InspectEvidence核心成功。前端明确内存fixture覆盖两种动作和resolve成功的请求/回执策略，不能替代HTTP提供方正向。

保留边界：当前reference HTTP无修复来源端点、无注入的X04订单证据，因此 `resolveHttpPositive=NOT_RUN_NO_REPAIR_HTTP`、`inspectEvidenceHttpPositive=NOT_RUN_REFERENCE_SOURCE_UNAVAILABLE`；不为验收增加可被产品调用的修复/注入接口。cookie身份桥接和回环TLS/CORS代理为明确替代，故障注入标签与真实字节分开记录。

## Gate及后续

工程Gate目标PASS_UI601_OPERATIONS_FUNCTION；开发IMPLEMENTED_PENDING_ACCEPTANCE，正式stage_gate=NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。INTEGRATION应拒绝，下一FE:UI-P13 DEVELOPMENT允许。UI-P13高保真、真实IdP/CORS/cookie、目标DB/RLS/事务、外部源/venue、远程同SHA CI、Firefox/WebKit、人工读屏/原生200%缩放、完整I8、性能容量/长稳和RELEASE均NOT_RUN。

G4 IN_REVIEW、G4/FEP-4 NOT_READY_GAPS_OPEN、FEP-4 PARTIAL不变。UI402-MARKER-SOURCE-01真实C09→C12同源正向NOT_RUN、P19-C10-EXPORT-01蜡烛导出NOT_IMPLEMENTED、C12→C14估值join NOT_CLAIMED；UI603/P23/G4/FEP4证据逐字节保留ORIGINAL_SCOPE_ONLY，不重绑新候选。回退可按本地源码提交有审阅git revert并重建terminal/BFF；无DB迁移和外部事实清理，保留失败证据。
