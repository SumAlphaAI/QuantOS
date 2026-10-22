# UI-P17 原稿范围确认（2026-10-22）

项目用户已在本会话确认[原完整稿](../ui-p17-local-20261022/confirmation-draft.md)。[原始答复](./raw-user-message.txt)、[结构化确认](./user-confirmation.json)、[approval](./approval.json)与[范围摘要](./scope-summary.json)独立保存。

仅绑定工程 `dae4d0148439ea06d871caab74d7f2403a36a33a` 和原文稿证据提交 `cfb2dba32c96772cefc2d53efb4ed56000490101`，1328输入摘要 `sha256:38dacecae2942f76596f55d380366741f0e0005fcefc0fabb01a2880caeef500`。原稿、receipt、290份证据文件及其索引、失败/阻塞、首次预检日志覆盖局限全部保留；原receipt的PENDING是历史事实，不重写，新确认由独立closure-proof叠加。原报告和其他已冻结文档保持原字节，计划仅同步当前功能确认状态。

计划development_status为COMPLETED，仅表示原完整稿的当前页面功能范围已由用户确认。本机组合仍PASS_REFERENCE_FIXTURES_ONLY；Firefox BLOCKED_ENVIRONMENT，WebKit BLOCKED_ENVIRONMENT_TEST_INTERCEPTION，后者内容导航200不代表附件接收。16项NOT_RUN（含reference实际下载投递、WebKit拦截附件接收、真实IdP/目标BFF/DB/Cookie/CORS/通知、目标headers/privacy、人工读屏/原生200%、真实设备/跨OS、远程CI、性能长稳和发布）保留；参考下载URL与目标origin拓扑缺口不消失。INTEGRATION NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED、currentReady/currentHeadAcceptance=NOT_CLAIMED。没有给G1、FEP-1或后续源码/发布准入；P15仍待确认。

[门禁](./verify.mjs)验证原始答复、确认记录/原文稿/request摘要、提交字节与290文件hash、1328工程输入、66附件和实际执行、16前提原需求引用，并核对159个节点stage_gate不变及确认/越级负向探针。只复核保存证据，不重跑功能、构建、浏览器、数据库或上游链。原92单元、66门禁/边界、56浏览器与8图结果只保持原SHA范围。

命令 `node docs/audit/evidence/ui-p17-confirmation-20261022/verify.mjs --verify`；执行日志/命令及结果见[checks.json](./checks.json)、[门禁日志](./gate.log)、[closure-proof](./closure-proof.json)、[hash清单](./manifest.json)。下一可执行任务仍为FRONTEND-GATE:G1 / FEP-1本机联调缺口核对。不推送或部署。

实际结果：确认门禁与独立复核均退出0；32项确认拒绝/误提升探针、17项确认规程回归、计划结构及ESLint检查全部通过。未重跑原功能、构建、浏览器、数据库或依赖链。
