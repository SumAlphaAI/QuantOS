# UI-P12 原稿确认记录（2026-10-23）

项目用户在本会话确认原完整稿。工程范围绑定 `8f1f376372a2b5b12a5e2477b746f5940e78a06d`；校验工具修复单独绑定 `6bb2d19a924692f0a48c39e3c903a59b6596c452`；原文稿与技术证据包绑定 `db5faf89464cdab768c3fee731b2bc1427e8f240`。确认时间按收到用户答复记录为 `2026-10-22T16:25:15Z`（北京时间 2026-10-23）。唯一确认人为 ProjectUser；Codex 记录并核对，未代用户批准。

- [原始答复](./raw-user-message.txt)、[确认记录](./user-confirmation.json)、[记录摘要](./approval.json)。
- [原完整稿](../ui-p12-local-20261022/confirmation-draft.md)、[原范围](../ui-p12-local-20261022/scope.json)、[原工程回执](../ui-p12-local-20261022/receipt.json)、[原清单](../ui-p12-local-20261022/manifest.json)。
- [确认门禁](../../../../scripts/ui-p12-confirmed-reference.mjs)、[拒绝测试](../../../../scripts/ui-p12-confirmed-reference.test.mjs)、[确认闭合证明](./closure-proof.json)。

原稿、回执和 PENDING 历史不改写。确认只关闭原稿当前页面功能的人工确认条件：计划 UI-P12 `development_status=COMPLETED`；全部 159 个阶段 Gate 保持原值，G1/FEP-1 `NOT_READY_GAPS_OPEN`、INTEGRATION `NOT_ASSESSED`，`formalAccepted=false`、`runtimeAdmission=DENIED`、当前 HEAD 验收 `NOT_CLAIMED`。当前提交只保存记录和门禁，不改变产品源码。

本轮读取并核对 540 个原输入、182 个原清单摘要、52 个原产物和 10 条原命令；单独核对工具修复只改校验器。复用原 46 单测、14 Chromium、49 门禁路由、6 图及 6 次 axe 的已有证据；六项 axe incomplete 保留。本轮不重跑这些功能测试、构建、浏览器、数据库或全链。

reference 身份 `EXPLICIT_REFERENCE_COOKIE_BRIDGE`、CORS `LOOPBACK_PROXY_SUBSTITUTION` 保留。Firefox `BLOCKED_ENVIRONMENT`、WebKit 附件接收 `BLOCKED_ENVIRONMENT_TEST_INTERCEPTION` 保留；历史 NOT_RUN 原值、失败、中断、ENOBUFS 修复历史及前置探测原样保留。真实 IdP/MFA、Cookie/CORS、目标数据库、生产托管路由、原生 200% 缩放、人工读屏、跨系统、同 SHA 远程 CI、性能/长稳和发布仍未验收。没有生产凭据、推送或部署。

本轮只执行确认门禁、针对记录与计划越界的拒绝测试、静态检查及开发/联调入口核对。七条命令均得到预期退出码；确认相关测试 58/58 通过。命令、时间与日志摘要保存于 [checks.json](./checks.json)。

| 命令 | 结果 |
| --- | --- |
| `node scripts/ui-p12-confirmed-reference.mjs --write` | 0，生成确认闭合证明 |
| `node --test scripts/ui-p12-confirmed-reference.test.mjs scripts/user-acceptance-confirmation.test.mjs` | 0，58/58 |
| `pnpm exec eslint scripts/ui-p12-confirmed-reference.mjs scripts/ui-p12-confirmed-reference.test.mjs` | 0 |
| `node scripts/check-development-plans.mjs` | 0 |
| `node scripts/development-execution.mjs --integration FE:UI-P12` | 1，预期拒绝 STAGE_NOT_READY |
| `node scripts/development-execution.mjs --development FE:UI-204` | 0，允许开发 |
| `node scripts/ui-p12-confirmed-reference.mjs` | 0，复核闭合证明 |

初次探测曾因本轮 README 尚未落盘而退出 1；见 [原始探测说明](./initial-attempt-note.md)。未将该失败记作通过，后续七条检查另行留档。

下一原任务为 **I2 UI-204：DataSnapshot 目录/详情、质量/许可/时效**，开发入口应允许；G1-DEP-01 等辅助项不作为开发前置。UI-P12 联调入口仍必须拒绝。
