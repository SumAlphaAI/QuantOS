# UI-507 原稿范围确认（2026-10-22）

项目用户已在本会话确认[原完整稿](../ui507-local-20261022/confirmation-draft.md)。[原始答复](./raw-user-message.txt)、[结构化记录](./user-confirmation.json)、[approval](./approval.json)独立保存。确认工程 `9f7552a8305b1fb1b661676d1d67becf1ebb229b`、原文稿包 `b1ebfe7b3b464094a6e91fcb14a32b6e8ab5f146`、520项输入；原稿/receipt/scope/manifest及失败记录保持原字节，原PENDING不改写，由本次独立CONFIRMED叠加。

计划development_status为COMPLETED，仅表示原稿当前功能范围已确认；不是INTEGRATION READY或正式ACCEPTED。reference身份cookie与CORS替代边界、Firefox环境阻塞、WebKit拦截附件接收阻塞、原账本全部NOT_RUN及记录局限保留。G1/FEP-1 NOT_READY_GAPS_OPEN、159个阶段Gate NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED、当前HEAD接受NOT_CLAIMED。无生产凭据、推送、部署或外部发布授权。

当前确认门禁：`node scripts/ui507-confirmed-reference.mjs`，验证真实原始答复、确认/request/原稿摘要、原Git包96份摘要、520工程输入、32候选产物、11项原执行及阶段边界；只复核保存证据，不重跑原55单测/6 Chromium/39门禁、构建、浏览器、数据库或依赖链。旧`ui507-review.mjs`的PENDING评估属于原候选历史，当前确认入口使用本门禁，不将旧PENDING误读成新确认缺失。

门禁执行结果见[checks.json](./checks.json)与[closure-proof](./closure-proof.json)。下一原任务仍为I2 UI-P12，其开发无需先关闭G1-DEP-01等辅助项，也不因未执行的联调/发布义务阻塞。

## 本次执行结果与变更

本次7项有界检查全部符合预期：确认门禁exit0；39项确认/越界/计划测试通过；17项共享确认规程测试通过；两份新增门禁文件ESLint exit0；计划结构exit0（159个NOT_ASSESSED）；UI-507联调入口预期exit1/STAGE_NOT_READY；下一UI-P12开发入口exit0。原55项功能、6 Chromium、39项工程门禁只按原SHA证据复核，没有重新执行。命令、时间、退出码和原始日志摘要见checks.json。

变更仅包括前端执行计划的UI-507当前功能完成/确认元数据，`scripts/ui507-confirmed-reference.mjs`及对应测试，以及本独立确认目录的原始答复、结构化确认、摘要证明、检查日志与hash清单。未修改原文稿、技术回执、原报告、520个原工程输入或任何产品实现。

本次新增测试脚本首次语法检查和首轮修复仍有括号错误，分别保留tests.log、tests-repair-01.log；首轮lint发现Node测试全局声明问题，保留lint.log。均在最终确认检查前修正。tests-repair-02.log的56项通过只为修复记录，最终采用分开的39项确认测试和17项规程结果；未覆盖或删除原失败。不将这些测试工具修复触发功能或全链复验。

风险不消失：真实IdP/MFA、cookie/CORS、目标DB/storage、持久撤权、Firefox/WebKit附件、读屏/原生200%、跨OS/设备、远程CI、性能/长稳和发布仍按原NOT_RUN/阻塞范围保留；未知意图的跨页面恢复限制以及UI-P12高保真与路径映射范围不变。本次没有批准新HEAD、G1/FEP-1联调、运行、发布、推送或部署。
