# UI-P04 原稿确认记录（2026-10-23）

项目用户在本会话确认原完整稿。记录时间2026-10-23T04:22:50Z；唯一确认人为ProjectUser，Codex负责核对、保存与执行门禁，不代用户批准。

工程仅绑定 `1fb76f8667bb5e17b50ab8f4573f7eb7ef9d9403`，原稿及技术证据包绑定 `7171d0318282d1f62e9d6e8000e8953ac082272c`。617输入摘要 `sha256:e1eb2ec2b5b4bcdad4ce8f6d5bfff2ed30e8bf7ef6f68d57a206fa2cf23a686e`。

- [原始答复](./raw-user-message.txt)、[确认记录](./user-confirmation.json)、[记录摘要](./approval.json)。
- [原完整稿](../ui-p04-local-20261023/confirmation-draft.md)、[原范围](../ui-p04-local-20261023/scope.json)、[工程回执](../ui-p04-local-20261023/receipt.json)、[原技术清单](../ui-p04-local-20261023/manifest.json)、[原视觉核对](../ui-p04-local-20261023/visual-review.json)。
- [确认门禁](../../../../scripts/ui-p04-confirmed-reference.mjs)、[拒绝测试](../../../../scripts/ui-p04-confirmed-reference.test.mjs)。

计划仅将UI-P04 development_status同步为COMPLETED，含义为原稿当前页面范围已确认；原稿、报告、scope/receipt中的PENDING保持历史原字节。159项stage_gate仍NOT_ASSESSED，G1/FEP-1仍NOT_READY_GAPS_OPEN，G2/FEP-2未评估；UI-P04 INTEGRATION预期拒绝STAGE_NOT_READY。formalAccepted=false、runtimeAdmission=DENIED、currentHeadAcceptance=NOT_CLAIMED。确认不授予业务、策略或交易用途许可，不证明文档HEAD已通过运行验收。

只读核对原617输入、169个技术清单摘要、144个原证据文件、58产物、10条命令；原119单测、14Chromium、77门禁/路由、12截图/12基线比较/12次axe及types/lint/build仍绑定1fb76f86，不重跑功能、浏览器、构建、Rust、数据库或全链。原UI-202/UI-203证据与确认、245Rust输入和e3776999 reference二进制按原范围复用。

保留原6项图标、2项表头、UI-P03十二条color-contrast incomplete，以及UI-P04本轮十二条color-contrast incomplete扫描记录。当前十二条含76个跨扫描节点出现次数，未去重，不能称作76个独立缺陷。逐项保留原SHA、哈希、主题、页面、宽度、规则与节点数；零violations不关闭任何incomplete。UI-202/UI-203四次零新增扫描分别保留原候选。UI-P04预检六次aria-prohibited-attr incomplete修复前报告及沙箱端口EPERM、typecheck失败原字节保留，未转为PASS。

reference身份cookie桥、loopback CORS/自签TLS、本机3190/4010及动态reference端口替代边界不变；Firefox环境阻塞和WebKit附件拦截接收阻塞、历史ledger全部NOT_RUN保留。真实reference种子和取消按原记录，状态/通知/Evidence成员关系的合成覆盖不等于worker或引擎实际完成；预置Artifact明确synthetic。原归档owner哈希绑定不等于独立canonical bytes重算或密码学验签。

本轮截图基线是当前源码回归基线，随机引用/时间/hash局部遮罩、像素差阈值0.5%，不等于与设计PNG逐像素一致或独立人工验收。真实IdP/MFA/Cookie/CORS、目标DB/Storage、provider/引擎产物、生产host、远程同SHA CI、人工读屏/原生200%缩放/跨OS、性能/长稳与发布仍NOT_RUN。无加密离线缓存、新策略或新导出API；复用安全清空与既有Audit流程，不批准未绑定写入或下载。

下一原任务 **FRONTEND-GATE:G2：验收检查点** 可执行范围与缺口核对，READY依据实际证据另评，不新增辅助开发前置，不以G1辅助整改阻塞FEP-2开发。本轮未使用生产凭据、推送或部署。

实际命令与日志摘要见[checks.json](./checks.json)，确认闭合证明见[closure-proof.json](./closure-proof.json)。确认工具独立验证COMPLETED及不可变证据，未放宽原工程工具中的待确认计划校验。

最终7项检查均得到预期退出码，129/129项确认及拒绝测试通过。原119项功能单测、14项浏览器场景、构建和基线比较仅只读核对，不重新执行。

| 命令 | 结果 |
| --- | --- |
| `node scripts/ui-p04-confirmed-reference.mjs --write` | 0，生成确认闭合证明 |
| `node --test scripts/ui-p04-confirmed-reference.test.mjs scripts/user-acceptance-confirmation.test.mjs` | 0，129/129 |
| 固定pnpm10.20.0 `exec eslint scripts/ui-p04-confirmed-reference.mjs scripts/ui-p04-confirmed-reference.test.mjs` | 0 |
| `node scripts/check-development-plans.mjs` | 0，159阶段仍NOT_ASSESSED |
| `node scripts/development-execution.mjs --integration FE:UI-P04` | 1，预期拒绝STAGE_NOT_READY |
| `node scripts/development-execution.mjs --development FRONTEND-GATE:G2` | 0，原范围核对允许 |
| `node scripts/ui-p04-confirmed-reference.mjs` | 0，确认闭合证明一致 |

固定包管理器实际路径 `/Users/anray/Library/pnpm/.tools/pnpm/10.20.0/bin/pnpm`；未安装依赖、运行数据库或触发外部发布。
