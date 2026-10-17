# TP12_LOCAL 功能准入

执行入口：`make tp12-check` 静态核对；`make tp12-assess-local` 在新 function-attempt-NN 目录保存当前源码输入和20组检查；`make tp12-local-check` 重验源码/输入/日志/规则/阶段并检查已发布计划摘要。只修改 QuantOS，不用生产凭据，不执行外部发布。

记录器过滤数据库/token/secret/key环境，离线运行；本机 Agent UDS 需要允许本地 socket 的执行环境。日志保留失败、超时和中断。每次检查必须实际退出0；源码输入必须与观测到的不可变 Git commit 一致；记录器拒绝未提交源码/输入漂移。发布 manifest/两份计划失败会回滚。记录器不会递归调用依赖任务门禁。

规则/差异/threat 为 `third_party/nautilus-agents/x3-boundary-review.json`；脚本 `scripts/tp12-boundary-review.py` 验证固定参考、当前源码与无上游依赖。全生产图只做静态排除扫描，不执行全仓测试。实际研究 Agent 仍是自有 fixture，工具名允许不意味着执行真实 snapshot 查询。

TP12_LOCAL READY 仅为 functionImplementation=PASS。businessIntegration/releaseAcceptance 和 postTp07IntegrationFullReview 必须 NOT_RUN；F07/TP07/S2 为 NOT_REVALIDATED/referenceOnly，不授予上游 READY。原 S2 评估保持其旧范围，无历史收据拼接。

`make tp12-release-check`、`node scripts/tp12-target-check.mjs` 和 `python3 scripts/tp12-boundary-review.py --runtime` 必须拒绝（exit2）。目标阶段需要独立实际证据，不能提升本地 receipt。正式确认按 [用户确认规程](../gate-records/user-acceptance-confirmation-workflow.md) 起草、保存原答复后执行；Codex 不自行批准。
