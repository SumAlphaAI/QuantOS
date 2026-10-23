# FEP-3 当前前端功能证据

- 工程：`1d9ae99a`；浏览器工具：`d37041c4`；回执工具及最终冻结：`0e30eb28509ee3adcf490350b65fe75d6e7ab331`；证据提交见本目录所在Git提交。
- [执行报告](../../FEP-3-function-closure-2026-10-23.md)、[独立范围核对](./scope-audit.json)、[Gate](./gate.json)、[源码变更](./source-changed-files.txt)。
- [最终回执](./receipt.json)、[机器核查摘要](./verification.json)、[完整命令/退出/日志](./attempt-03/executions.json)、[冻结输入](./attempt-03/inputs.json)、[单元/consumer结果](./attempt-03/unit.json)、[Chromium结果](./attempt-03/browser/report.json)。
- 当前159项策略测试＋151项门禁/路由反例＋23条Chromium均通过；类型、lint、构建、计划检查通过。12项命令中9项exit 0，3项阶段联调拒绝exit 1。18张既有P07基线比较，未更新基线；34次axe扫描零自动违规但34条incomplete未关闭。
- [预检及失败索引](./preflight-index.json)：preflight-01～05是未冻结探索；attempt-01是明确失败，保留1通过/1失败/21未执行及后续命令NOT_RUN；attempt-02全部命令通过但落盘回执复读失败，原回执/摘要保存在attempt-02-postrun；attempt-03是最终独立完整执行，另行序列化复读核查通过，不覆盖或拼接旧尝试。
- 回执保护8个已确认原范围包的2,090件文件，原确认原文/摘要/候选/文稿绑定均保留。历史incomplete、NOT_RUN和G3未放行状态不变。
- `PASS_FEP3_FRONTEND_FUNCTION_CLOSURE` / `COMPLETED_FRONTEND_SCOPE`仅当前前端功能执行；159项stage_gate仍NOT_ASSESSED，完整G3/CORE:S04未放行，formalAccepted=false、runtimeAdmission=DENIED；当前用户确认NOT_REQUESTED_FUNCTION_EXECUTION_ONLY。
- 内存模型不证明后端/worker/哈希/持久性；浏览器新用例明确注入应答，真实BFF原字节单独记录。复用原后端二进制并核对源码/摘要，不重授旧验收。无生产凭据、数据库操作、推送或发布。
- 手工核查：`node scripts/fep3-function-review.mjs --verify`。新执行必须先冻结源码，再使用新的attempt目录；仅本机端口运行需要执行环境允许监听localhost，不代表目标权限。
- 下一原计划任务：`FE:UI-401`，开发入口允许。

原始失败error-context含尾随空格；`.gitattributes`仅对该原文件和原始空白诊断日志设置精确路径例外，原字节不修改。
