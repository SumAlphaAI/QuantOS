# UI-P05 原稿确认记录（2026-10-23）

项目用户在本会话确认原完整稿。确认时间按收到用户答复记录为 `2026-10-22T23:31:21Z`，北京时间 **2026-10-23 07:31:21**。唯一确认人为ProjectUser；Codex记录并核对，未代用户批准。

工程仅绑定 `a76cca2194fa341bba3fb2e0883e8b137cb94bbd`；原文稿与技术证据包绑定 `35e07003f4aa75359e425a6d2750676609664beb`。

- [原始答复](./raw-user-message.txt)、[确认记录](./user-confirmation.json)、[记录摘要](./approval.json)。
- [原完整稿](../ui-p05-local-20261023/confirmation-draft.md)、[原范围](../ui-p05-local-20261023/scope.json)、[原工程回执](../ui-p05-local-20261023/receipt.json)、[原清单](../ui-p05-local-20261023/manifest.json)。
- [确认门禁](../../../../scripts/ui-p05-confirmed-reference.mjs)、[拒绝测试](../../../../scripts/ui-p05-confirmed-reference.test.mjs)。门禁生成closure-proof.json，原稿/范围/回执/报告的PENDING保留为历史事实，不改写。

计划只将UI-P05 development_status记为COMPLETED，范围限原稿当前页面功能。全部159阶段Gate维持NOT_ASSESSED，G1/FEP-1仍NOT_READY_GAPS_OPEN，formalAccepted=false、runtimeAdmission=DENIED、当前HEAD验收NOT_CLAIMED，联调和发布不准入。

本轮只读核对539项原输入、182项原清单摘要、56产物与10条原命令，复用原74单测、13 Chromium、50门禁/路由、6图和6次axe。不执行功能测试、构建、Rust、浏览器、数据库或全链。原始失败、hooks问题、aria incomplete修复历史和全部附件保持原字节。

六次axe每次1项color-contrast incomplete，合计6项，完整原报告、摘要及各宽度/主题/节点计数保留，未转为PASS或删除。reference身份EXPLICIT_REFERENCE_COOKIE_BRIDGE、CORS LOOPBACK_PROXY_SUBSTITUTION、Firefox环境阻塞、WebKit拦截附件接收阻塞、历史ledger和全部NOT_RUN保留。人工读屏/原生200%缩放/跨OS、真实身份/CORS/数据库、远程CI和发布仍未验证。

元数据下载只确认原482字节授权C04 JSON接收，不包含数据集或新增业务用途许可。原UI-204 reference二进制及245项Rust输入维持原54ab042b范围，不重建。

本轮仅执行确认门禁与拒绝测试、静态/计划检查、联调拒绝和下一开发入口核对，七条检查均得到预期退出码，79/79项确认测试通过；实际命令、时间与摘要见[checks.json](./checks.json)。

| 命令 | 结果 |
| --- | --- |
| `node scripts/ui-p05-confirmed-reference.mjs --write` | 0，生成确认闭合证明 |
| `node --test scripts/ui-p05-confirmed-reference.test.mjs scripts/user-acceptance-confirmation.test.mjs` | 0，79/79 |
| `pnpm exec eslint scripts/ui-p05-confirmed-reference.mjs scripts/ui-p05-confirmed-reference.test.mjs` | 0 |
| `node scripts/check-development-plans.mjs` | 0 |
| `node scripts/development-execution.mjs --integration FE:UI-P05` | 1，预期拒绝STAGE_NOT_READY |
| `node scripts/development-execution.mjs --development FE:UI-201` | 0，允许开发 |
| `node scripts/ui-p05-confirmed-reference.mjs` | 0，核对[闭合证明](./closure-proof.json) |

下一原任务 **I2 UI-201：Research列表、新建与表单校验**，开发允许，无G1辅助项前置。无生产凭据、推送或部署。
