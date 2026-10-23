# UI-201 原稿确认记录（2026-10-23）

项目用户在本会话确认原完整稿，时间按收到答复记录为 `2026-10-23T00:11:10Z`（北京时间 **2026-10-23 08:11:10**）。唯一确认人为 ProjectUser，Codex 负责记录与核对，不代用户批准。

工程只绑定 `e3776999ad2aee625ec38faee5547a3b6ff9e68a`；原文稿与技术证据包绑定 `89da61eec288f090fce70cb4ce5528a5cdf42012`。

- [原始答复](./raw-user-message.txt)、[确认记录](./user-confirmation.json)、[记录摘要](./approval.json)。
- [原完整确认稿](../ui201-local-20261023/confirmation-draft.md)、[原范围](../ui201-local-20261023/scope.json)、[原工程回执](../ui201-local-20261023/receipt.json)、[原清单](../ui201-local-20261023/manifest.json)。
- [确认门禁](../../../../scripts/ui201-confirmed-reference.mjs)、[拒绝测试](../../../../scripts/ui201-confirmed-reference.test.mjs)。只读验证原证据，原稿/范围/工程回执/报告的 PENDING 保持历史原字节，不改写；当前确认使用本门禁，不放宽原工程门禁的待确认阶段校验。

计划仅将 UI-201 development_status 记为 COMPLETED，限原稿当前功能范围。159项 stage_gate 维持 NOT_ASSESSED，G1/FEP-1 仍 NOT_READY_GAPS_OPEN；INTEGRATION 与发布不准入，formalAccepted=false、runtimeAdmission=DENIED、currentHeadAcceptance=NOT_CLAIMED。元数据读取与创建页面检查不授予业务用途；未执行外部研究引擎。

本轮只读核对541个原输入、217个原清单摘要、44个成功产物及12条原命令；复用原122单测、24 Rust、8 Chromium、52门禁/路由、8截图和8次axe，不重跑功能/构建/Rust/浏览器/数据库或全链。失败候选7330aa2d、attempt-01及预检失败/中断/缺失附件保留原字节，不与成功attempt-02拼接通过。

保留原P05两份报告中的6项图标 color-contrast incomplete，以及当前UI-201报告中的2项表头 color-contrast incomplete（390宽度，深浅主题各4节点）。完整原报告、摘要、来源SHA、主题/宽度/路径和节点数均保留，不视作PASS。reference身份/CORS loopback替代、自签TLS、Firefox环境阻塞、WebKit附件拦截接收阻塞和历史ledger全部NOT_RUN保留；人工读屏/原生200%缩放/跨OS、真实身份/CORS/数据库/Storage、外部provider/引擎、远程CI/性能/长稳/发布仍未验证。

结果未知意图仅内存，离开/失效后先查询原任务；过期deadline/快照拒绝重发，恢复不重放。这些原稿风险不因用户确认而消失。

最终7条检查均得到预期退出码，87/87项确认/拒绝测试通过；实际命令、时间与摘要见 [checks.json](./checks.json)，证明见 [closure-proof.json](./closure-proof.json)。另保留 [首次核验输出](./gate-initial.log) 与 [初轮检查](./checks-initial.json)：初轮确认测试87/87通过，lint因从复用模板遗留的未使用导入失败，移除该导入后重新执行；失败 [lint.log](./lint.log) 保持原字节，不覆盖为PASS。

| 命令 | 结果 |
| --- | --- |
| `node scripts/ui201-confirmed-reference.mjs --write` | 0，生成确认闭合证明 |
| `node --test scripts/ui201-confirmed-reference.test.mjs scripts/user-acceptance-confirmation.test.mjs` | 0，87/87 |
| `pnpm exec eslint scripts/ui201-confirmed-reference.mjs scripts/ui201-confirmed-reference.test.mjs` | 0 |
| `node scripts/check-development-plans.mjs` | 0 |
| `node scripts/development-execution.mjs --integration FE:UI-201` | 1，预期拒绝 STAGE_NOT_READY |
| `node scripts/development-execution.mjs --development FE:UI-P03` | 0，允许开发 |
| `node scripts/ui201-confirmed-reference.mjs` | 0，核对确认闭合证明 |

下一原任务 **I2 UI-P03：P03-Research-List-and-New-Research-High-Fidelity-v1.png** 可继续开发，无G1辅助项前置。无生产凭据、推送或部署。
