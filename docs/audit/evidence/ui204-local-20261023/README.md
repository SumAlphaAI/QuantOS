# UI-204 当前功能证据索引

工程 `54ab042b14b973cbe4e37dfcefdfafa351cc893d`，功能门禁 PASS_UI204_CURRENT_FUNCTION，人工确认 PENDING。524项输入、33产物、12命令；Rust23、前端110、门禁/路由50、Chromium6通过，联调入口预期拒绝、UI-P05开发允许。

- [报告](../../UI-204-data-snapshots-2026-10-23.md)、[完整确认稿](./confirmation-draft.md)、[范围](./scope.json)、[工程回执](./receipt.json)。
- [当前候选输入](./attempt-02/inputs.json)、[当前命令](./attempt-02/executions.json)、[当前reference二进制](./attempt-02/binary.json)、[只读复核](./final-verify.log)。
- [失败/诊断说明](./preflight-notes.md)、[首候选失败日志](./attempt-01/browser.log)、[首候选已执行项](./attempt-01/executions.json)。所有原始附件、0测试误过滤及失败均保留。
- [有界截图查看](./visual-review.json)：仅布局检查，未替代UI-P05高保真、axe或无障碍验收。
- [清单](./manifest.json)、[变更文件](./changed-files.txt)、[清单校验](./packet-check.log)。清单覆盖本轮代码、文档、工具及原始证据；只排除清单自身与校验输出。

计划只记 IMPLEMENTED_PENDING_ACCEPTANCE。159阶段Gate不变，G1/FEP-1缺口保持；reference cookie身份/CORS代理替代、Firefox/WebKit阻塞、所有历史NOT_RUN不变。用途核对不创建业务命令、不授予策略/交易许可；无生产凭据、推送、部署。下一原任务I2 UI-P05开发无需G1辅助项前置。
