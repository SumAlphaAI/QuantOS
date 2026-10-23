# UI-P04 当前页面验收报告（2026-10-23）

结论：`PASS_UI_P04_CURRENT_PAGE`，工程 `1fb76f8667bb5e17b50ab8f4573f7eb7ef9d9403`；617输入/58产物/10条命令。[完整确认稿](./evidence/ui-p04-local-20261023/confirmation-draft.md)为PENDING，计划IMPLEMENTED_PENDING_ACCEPTANCE，不提升联调或发布状态。

交付Research 7/5时间线/证据面板、六状态规范提示与成本/预算/deadline、日志折叠/事件引用展开、面板固定、当前关联ID复制与原取消焦点回返；Artifact正文与哈希/版本、已知类型血缘、Evidence/归档预览/审计侧栏，深浅主题及三种宽度。复用Terminal组件与原授权/runtime，不改C03/C04/C10契约、BFF、Rust或共享SSE。未知标题、进度、模型、健康、原始日志及批准状态不填示例值。规程含[逐项设计映射与边界](../operations/ui-p04-research-artifact-detail.md)。

同候选119单测（10呈现+49Research详情+60Artifact）、14Chromium、77门禁/路由、types/lint/build通过，客户端93文件检查通过；12截图、12本轮建立的回归基线比较、12次axe零violations。本轮另有12条color-contrast incomplete扫描记录，共76个跨扫描节点出现次数，尚未去重，不作为独立缺陷数。桌面每扫描8个共享导航glyph及1个背景/遮挡待定节点，小屏每扫描1个背景/遮挡节点；原6图标+2表头+P03十二条历史扫描记录保持。

Codex已查看设计原PNG及最终深色Research/浅色Artifact的1672和390截图，确认两栏/堆叠、引用与长哈希可读，无viewport横向溢出；不等于与设计逐像素相同或独立人工验收。基线动态遮罩与0.5%像素阈值用于当前源码回归；原图为功能/布局参考，固定Terminal tokens复用，未填设计示例业务事实。人工读屏、原生200%缩放、跨OS及完整浏览器矩阵均NOT_RUN。

| 实际命令（固定pnpm10.20.0） | 结果 |
| --- | --- |
| `node scripts/development-execution.mjs --development FE:UI-P04` | 通过（exit 0） |
| `pnpm exec vitest run apps/terminal/tests/ui-p04-presentation.test.ts apps/terminal/tests/ui202.test.ts apps/terminal/tests/ui203.test.ts --reporter=verbose --reporter=json --outputFile=docs/audit/evidence/ui-p04-local-20261023/attempt-01/unit.json` | 通过（exit 0） |
| `pnpm --filter @sumalpha/terminal typecheck` | 通过（exit 0） |
| `pnpm exec eslint apps/terminal/app/research/detail.tsx apps/terminal/app/research/p04-frame.tsx apps/terminal/app/artifacts/workspace.tsx apps/terminal/src/research/detail-presentation.ts apps/terminal/tests/ui-p04-presentation.test.ts scripts/ui-p04-review.mjs scripts/ui-p04-review.test.mjs playwright.ui-p04.config.ts playwright.config.ts tests/e2e/ui-p04.spec.ts tests/e2e/fixtures/ui-p04-reference.ts` | 通过（exit 0） |
| `pnpm --filter @sumalpha/terminal build` | 通过（exit 0） |
| `pnpm exec playwright test --config=playwright.ui-p04.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=docs/audit/evidence/ui-p04-local-20261023/attempt-01/browser` | 通过（exit 0） |
| `node --test scripts/ui-p04-review.test.mjs scripts/terminal-static-routes.test.mjs` | 通过（exit 0） |
| `node scripts/check-development-plans.mjs` | 通过（exit 0） |
| `node scripts/development-execution.mjs --integration FE:UI-P04` | 预期拒绝 STAGE_NOT_READY（exit 1） |
| `node scripts/development-execution.mjs --development FRONTEND-GATE:G2` | 通过（exit 0） |

原始命令、开始/结束时间和日志摘要见[executions.json](./evidence/ui-p04-local-20261023/attempt-01/executions.json)；[工程回执](./evidence/ui-p04-local-20261023/receipt.json)、[范围](./evidence/ui-p04-local-20261023/scope.json)、[视觉核对](./evidence/ui-p04-local-20261023/visual-review.json)与[预检历史](./evidence/ui-p04-local-20261023/README.md)单独保留。

变更文件：Research detail.tsx、共享页面p04-frame.tsx/p04.css、detail-presentation.ts及10项呈现测试；Artifact workspace.tsx；隔离UI-P04 Playwright配置/夹具/十四场景、默认测试排除、十二新基线；当前页面门禁及拒绝测试、规程、计划和本报告/证据/确认稿。工程提交26文件，完整列表由本轮changed-files.txt封存。没有修改原UI-202/UI-203实现中的runtime/policy/gateway或旧证据。

预检：preflight-01为119单测/lint通过、typecheck发现Research runtime无assertCurrent；页面改为传入既有route-access的assertCurrent，不扩大runtime。preflight-02 types/lint/build通过，但沙箱监听127.0.0.1:3190 EPERM，浏览器业务未开始。preflight-03在授权本机监听权限下14/14通过并初建12基线；发现指标div六次aria-prohibited-attr incomplete，修正group角色后冻结候选，最终12扫描无该规则。preflight-04 types/lint/67门禁/计划通过；preflight-05新增语义拒绝检查后77门禁/lint通过。全部预检是未提交源码诊断，GITHUB_SHA=be2b2332仅为启动标签，不作为该基线工程验收。最终唯一工程通过为1fb76f86/attempt-01；最终命令无update-snapshots，旧失败和未执行不转PASS。

复用：UI-202工程baf91152的579输入/48产物/125单测/13Chromium与UI-203工程03ecbdfa的593输入/46产物/76单测/12Chromium，仅原范围引用。UI-202原243文件、UI-203原119文件和两份确认包逐字节比对；原245Rust输入与e3776999 reference二进制保持，不重建、不重复全链。原确认不重绑本轮工程。新的119单测是呈现与受影响详情runtime直接回归，14浏览器也仅本次两页，非整个研究业务闭环复验。

风险：reference身份cookie桥、loopback CORS代理、自签TLS与3190/4010及动态reference端口替代。真实reference种子与取消执行，预置Artifact明确synthetic；其他运行/终态、SSE缺口通知及Artifact/Evidence关系有合成覆盖，不证明实际worker完成。沿用C10合成分页与签名游标未验收边界；UI-P04不重跑旧分页全链。哈希按owner事实绑定，未独立重算归档canonical bytes或密码学验签。无策略草稿写入、新导出契约或加密离线缓存，页面复用安全清空与Audit既有受控流程，不新增未绑定操作。

保留Firefox BLOCKED_ENVIRONMENT、WebKit附件BLOCKED_ENVIRONMENT_TEST_INTERCEPTION，历史6+2+12及本轮12条incomplete和历史ledger全部NOT_RUN。真实IdP/MFA/Cookie/CORS、目标DB/Storage、provider/引擎产物、生产host、远程同SHA CI、性能/长稳、人工读屏/原生缩放/跨OS及发布未验证。未使用生产凭据、推送或部署。

Gate：159项stage_gate与本轮基线be2b2332一致保持NOT_ASSESSED；UI-P04 INTEGRATION按预期STAGE_NOT_READY，G1/FEP-1 NOT_READY_GAPS_OPEN，G2/FEP-2阶段未评估，formalAccepted=false、runtimeAdmission=DENIED、currentHeadAcceptance=NOT_CLAIMED。下一原任务 **FRONTEND-GATE:G2：验收检查点** 可开始原范围/缺口核对，是否READY按实际证据决定；不新建默认开发前置，不以辅助整改阻塞FEP-2开发。

本地工程提交1fb76f86；文档和证据由独立本地提交封存。
