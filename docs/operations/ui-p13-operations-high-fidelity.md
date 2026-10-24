# UI-P13 Operations / Incident 高保真页面

I8、FEP-6，设计依据 `design/P13-Operations-and-Incident-Detail-High-Fidelity-v2.png`，路由 `/operations`、`/operations/health`、`/operations/incidents/<UUID>`。仅在QuantOS/main实现、验证与本地提交；不使用生产凭据，不推送/发布。下一原开发任务FE:UI-602。

## 页面交付与契约适配

| 设计区域 | 实际交付与来源 |
| --- | --- |
| Shell / 标题 / 降级提示 | 当前C01账户、mode、权限；C11当前聚合健康及asOf，实际过期后标Expired；无伪造的Risk:Restricted、工作流限制、Live连接或全局通知计数。 |
| 七服务健康视图 | runtime-gateway、engine-manager、market-ingestor、risk-gateway、execution-gateway、event-consumer、audit-ledger七个可选视图完整呈现。当前C11没有这些实例的独立来源，全部明确NOT_PROVIDED；选择仅改变本地展示，不改变action/参数/权限或暗中筛选Incident。 |
| 当前观察 / 诊断 | 独立展示service-x06聚合及execution/portfolio/risk/reconciliation四组件、当前latencyMs与DLQ；不把组件Ready映射为七服务Healthy。P50/P95、error rate、DB pool、Vault、心跳、历史趋势及重启数标未提供，无虚构曲线或数值。 |
| 活动告警与Incident目录 | 当前已读取范围的搜索和severity筛选，来源活跃/解决、阅读状态、版本、创建来源与现有Alerts导航；不能把本地筛选当全账户查询或批量写。Incident保留冻结分页及显式重读。 |
| Incident详情 / 时间线 | 规范UUID路径可直达/刷新，根页面对已有目录首项只读选择；C11前后head核对、不可变来源、状态版本和真实occurredAt。关联对象只使用当前账户/mode且alertId匹配的C16告警；不虚构workflow/engine instance/trace或影响订单。 |
| 审计入口 | 当前回执correlation优先；GET移除回执元数据后，可从已验证且同Incident/账户/mode的时间线末项取得correlation；仍要求C01 audit:read，拒绝外来URL/错链，不引入新C10请求。 |
| Runbook / 前置条件 | 批准目录、当前precheck及期限、桌面/权限与提交时MFA/原因/版本复核分别显示。只支持inspect-health、inspect-evidence+UUID；不把“目录已读取”冒充MFA已验证或签名材料齐备。 |
| 操作记录 | 只来自当前已验证Incident时间线和本次Runbook回执；回执无时间时显示“回执未提供时间”，不从客户端时钟推断执行时间/Actor；非全局历史目录。 |
| 响应操作 | 保留UI601真实确认/解决/创建、原生dialog确认/取消/Escape/焦点返回、服务器MFA/CAS/审计、409/429/403与原键恢复；未知结果不自动重试、离线/失权清除、移动端禁写。事件注释无接口，明确不可用。 |

1672/1440为七卡一行、左概览右响应双栏；1024重排为分行服务卡和堆叠主要区，390两列服务卡（最后一项跨列）、纵向响应和局部表格横向滚动。截图为实际viewport，移动下方Runbook单独捕获；不把截图称为完整长页验收。无告警/Incident时显式empty，加载/错误/拒绝/恢复/过期状态不填入演示事实。

## P13-C11-SERVICE-01：保留开放

`OpsHealth`仅service-x06及最多四个component、单次延迟/DLQ，无七服务身份绑定、独立metrics/心跳或历史序列。七个视图的UI交付不等于七个服务数据已接通，`sevenServiceHealth=NOT_PROVIDED_C11_CONTRACT`、`serviceGap=P13-C11-SERVICE-01_OPEN`。未扩写契约或制造提供方数据，不关闭正式页面/集成/发布义务，也不将该辅助缺口作为下一UI-602开发前置。

UI601既有两项HTTP正向仍保持：InspectEvidence当前reference HTTP无订单证据源，修复后resolve当前reference HTTP无来源修复端点；native/明确内存模型不替代HTTP正向。现有Runbook和审批权限边界不变。

## 验证与Gate

冻结源码执行 `node scripts/ui-p13-review.mjs --run docs/audit/evidence/ui-p13-local-20261024/attempt-NN`，复核 `node scripts/ui-p13-review.mjs --verify`。输入包含原设计图、源码与规程；原命令、退出码、日志、fresh BFF与terminal构建、截图/axe/几何绑定源码。新增presentation单元、现有UI601单元与实际reference消费者、新Chromium及UI601当前8项浏览器直接回归；产品运行时/BFF代码未改，不递归全链或重跑无影响native/数据库campaign。UI601原生结果只作ORIGINAL_SCOPE_ONLY。

浏览器使用本机真实Rust reference C01/F06/C11/C16、受控X06/F09和明确cookie桥接/TLS CORS回环代理；短有效期的健康快照测试单独标SYNTHETIC，不作提供方Healthy证明。主布局截图使用实际创建/确认后的Incident与两项真实时间线，不填入示意图的六条历史。

工程Gate目标PASS_UI_P13_OPERATIONS_HIGH_FIDELITY，状态IMPLEMENTED_PENDING_ACCEPTANCE；只表示契约支持范围内的页面适配/交互，正式stage_gate=NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。INTEGRATION保持拒绝，下一FE:UI-602 DEVELOPMENT允许。保留所有失败/incomplete与NOT_RUN。

G4 IN_REVIEW、G4/FEP-4 NOT_READY_GAPS_OPEN、FEP-4 PARTIAL不变。UI402-MARKER-SOURCE-01真实C09→C12同源正向NOT_RUN、P19-C10-EXPORT-01蜡烛导出NOT_IMPLEMENTED、C12→C14估值join NOT_CLAIMED；历史UI601/UI603/P23/G4/FEP4包逐字节保留ORIGINAL_SCOPE_ONLY，不重绑为新候选。真实IdP/cookie/CORS、目标DB/RLS/事务、外部源、远程同SHA CI、Firefox/WebKit、人工读屏/原生200%缩放、完整I8、性能容量/长稳与RELEASE均NOT_RUN。

回退可按本地源码提交审阅git revert并重建terminal；本任务无数据库迁移、生产写入或外部发布状态，无需清理业务事实；原始证据保留。
