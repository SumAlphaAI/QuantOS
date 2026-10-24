# UI-P22 Reconciliation 与 Funds Ledger

依据 `design/P22-Reconciliation-and-Funds-Ledger-High-Fidelity-v1.png`，路由沿用 `/reconciliation`、`/reconciliation/:runId` 与受校验的 breakId 深链接。布局采用统一SUMALPHA全局顶栏/权限可见导航、Orders下对账入口、面包屑与标题动作、Provisional告警、账户/日期/Run/来源上下文、四项摘要、左右BreakGrid/差异详情、Funds Ledger、运行事实、来源/证据栏及受控重跑。明暗主题、1440/768/390自适应；差异与账本均为命名、可聚焦的局部横滚区域。

BreakGrid支持全部/待调查/已确认调查/已解决分类、类型和Order/Fill/对象搜索。统计明确是当前返回记录，另展示报告breakCount；不把返回数与报告数或全期总量混同。选择差异只在已校验当前运行记录内更新本地详情及精确breakId URL，保留raw expectedJson/actualJson文本、sourceRef、状态/版本/时间/closure hash。右侧包含原值对比、关联Order/Fill/Audit来源、实际检测时间线和correlation；不计算差值/容差或伪造处置人。切换Run重置详情筛选/账本侧/理由，未知结果锁定换Run及新写。Funds Ledger金额保持Decimal原字符串，按Expected/Actual筛选，不计算或修改余额。

UI506运行时、C01双读/撤销和C15流/GET/有界分页/有效期/If-Match/幂等完全沿用：已知409不冒充成功，未知结果仅显式恢复原body/key/version/CSRF/RequestId；202回执按correlation/audit/day查实际Run，不猜jobId。失权/离线/隐藏/失焦/scope改变清空敏感事实与恢复意图；源过期或8秒未核对禁止新重跑。C14精确Run/actual sourceHash、C16 exception sourceRef/domain/scope、C10当前correlation/审计根和retention校验继续保留。没有手工改账、差异ack/close或客户端自动写重试。

参考图的示例Paper账户由实际授权Shadow上下文代替。C15没有matched总量/比例、缺失报告数量、venue标识/健康、严重度/资产、独立delta/容差、脱敏回报正文、处置动作历史；页面明确缺失，不以示例数字或当前列表推测。调查说明保存与差异清单导出没有契约，控件禁用并说明；Runbook是页内真实操作指引。Footer只显示当前访问/事实核对和只读来源，不把缺少worker健康源标Healthy。未实现的导航目标不补无效跳转。source_record订单只有canonical UUID提供现有详情链接，字符串ID原样显示。

实际C09参考是Paper、C15是Shadow且source-record ID不同，实际C09–C15同scope阳性join仍NOT_RUN；C16当前没有匹配reconciliation告警，实际C15–C16阳性join也NOT_RUN。closed/acknowledged多状态和大Decimal浏览器探针明确SYNTHETIC，不冒充真实venue或关闭证明。真实C15读取/重跑/审计以及C14来源关联由独立本机BFF消费者组合；C09/C10/C15契约1.16.0与owner均未改。

验证范围为当前高保真页面与直接影响：展示策略/范围/精度、UI506当前功能、实际reference消费者、C01失权与浏览器成功/拒绝/恢复/布局；不因CSS/展示变更重跑全仓/数据库campaign/全上游。冻结源码后运行 `node scripts/ui-p22-review.mjs --run docs/audit/evidence/ui-p22-local-20261024/attempt-NN`，`--verify`复核Git blob/参考图/输入/精确命令/原日志/binary/build/网络/截图hash。历史UI506证据保留原范围，不重绑新候选。

限定工程Gate `PASS_P22_HIGH_FIDELITY_FUNCTION`；计划IMPLEMENTED_PENDING_ACCEPTANCE。正式INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED；I6/G5窗口与FEP-5不自动接受。真实身份/DB/RLS/存储/venue、持久恢复、远程同SHA CI、性能容量长稳/完整I6/发布NOT_RUN；人工读屏/原生200%缩放/跨OS/其他浏览器未验证。下一可执行开发任务FE:UI-402。
