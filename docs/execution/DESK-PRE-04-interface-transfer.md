# Desktop 二期：PRE-04 原生接口承接

> 日期：2026-10-02；需求输入，NOT ACCEPTED；不授权二期启动或发布。
> 依据：[Desktop 独立执行计划](../SumAlpha-QuantOS-Desktop-Development-Execution-Plan.md)、[原生需求承接](./DESK-PRE-01-requirements-transfer.md)。一期 C17 只覆盖 Web P15/P17。

| 原来源 | 二期能力 / 字段决策 | 承接任务 | 当前依据 / 状态 |
|---|---|---|---|
| 原 C17/GAP-17 P16 | 原生通知、窗口/多显示器与布局恢复；adapter capability 驱动 | DESK-PRE-01、UI-604 | 原生需求 ST-P16-01；未冻结原生接口，不声称 Web BFF 有此能力 |
| 原 C17 clearOfflineCache | 加密非敏感只读缓存清除；确认、权限与离线边界 | DESK-PRE-01、UI-604、DESK-QA-001 | ST-P16-02；本机行为不得改变服务端领域状态 |
| 原 C17 checkUpdate | 签名更新检查/应用；校验后安装 | DESK-PRE-01、UI-604、DESK-QA-001 | ST-P16-03；原生 candidate/签名/OS 回执待二期验收 |
| 原 C17 createDiagnosticJob | 不含秘密的诊断包及受控导出 | DESK-PRE-01、UI-604、DESK-QA-001 | ST-P16-03；路径、schema、transport 由二期预研冻结 |

责任角色为 Desktop TL 主责，安全 owner 审核秘密/签名边界，QA 负责原生目标回执；实际签署未发生。L02 的 Vault/mTLS/受限执行区安全职责不冒充原生更新、通知或缓存实现任务。

二期必须先确定本地 adapter 与远端 BFF 各自责任，给出字段/类型/required/错误/权限/版本/副作用与目标环境回执。上述待冻结项不是一期 Web PRE-04 的活动 Gap，也不能被标为已交付。
