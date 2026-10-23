# UI-202 当前功能验收报告（2026-10-23）

结论：`PASS_UI202_CURRENT_FUNCTION`，最终工程 `baf91152e556945ca6e83e6a8363980bd46081c9`，579输入/48产物/10条命令。UI-202计划为IMPLEMENTED_PENDING_ACCEPTANCE；[完整确认稿](./evidence/ui202-local-20261023/confirmation-draft.md)待项目用户确认，文档HEAD不冒充已验收工程。

交付：`/research/:runId`静态深链、`?runId`兼容与大小写UUID规范化；列表/创建回执入口；C03详情、共享SSE的sequence/eventId去重与gap回补、终态停流、显式恢复；取消前C01/C03重读与权限/CSRF、202受理、未知结果原key显式重试、撤权/离线清理。领域事件只通知重读，实际状态始终取GET；本机取消审计关联与重复key单一审计事实已验证。详见[规程](../operations/ui202-research-detail-stream-cancel.md)、[原始回执](./evidence/ui202-local-20261023/receipt.json)、[原始执行](./evidence/ui202-local-20261023/attempt-02/executions.json)、[证据历史](./evidence/ui202-local-20261023/README.md)。

125单测（49 UI202+59 UI201+8网关+9共享SSE）、13Chromium、66门禁/路由、types/lint/build通过；客户端88文件检查通过。两主题×1440/390共4截图、4次axe零violations、零新增incomplete。本轮不是UI-P04高保真比对，也不关闭P05六项图标、UI-201两项表头、P03十二条对比度incomplete。

| 实际命令（使用本机固定pnpm10.20.0） | 结果 |
| --- | --- |
| `node scripts/development-execution.mjs --development FE:UI-202` | 通过（exit 0） |
| `pnpm exec vitest run apps/terminal/tests/ui202.test.ts apps/terminal/tests/ui201.test.ts apps/terminal/tests/research-gateway.test.ts packages/api-client/tests/sse-safety.test.ts --reporter=verbose --reporter=json --outputFile=docs/audit/evidence/ui202-local-20261023/attempt-02/unit.json` | 通过（exit 0） |
| `pnpm --filter @sumalpha/terminal typecheck` | 通过（exit 0） |
| `pnpm exec eslint apps/terminal/src/research/detail-runtime.ts apps/terminal/src/research/detail-policy.ts apps/terminal/app/research apps/terminal/tests/ui202.test.ts scripts/ui202-review.mjs scripts/ui202-review.test.mjs scripts/terminal-static-routes.mjs scripts/terminal-static-routes.test.mjs playwright.ui202.config.ts playwright.config.ts tests/e2e/ui202.spec.ts tests/e2e/fixtures/ui202-reference.ts` | 通过（exit 0） |
| `pnpm --filter @sumalpha/terminal build` | 通过（exit 0） |
| `pnpm exec playwright test --config=playwright.ui202.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=docs/audit/evidence/ui202-local-20261023/attempt-02/browser` | 通过（exit 0） |
| `node --test scripts/ui202-review.test.mjs scripts/terminal-static-routes.test.mjs` | 通过（exit 0） |
| `node scripts/check-development-plans.mjs` | 通过（exit 0） |
| `node scripts/development-execution.mjs --integration FE:UI-202` | 预期拒绝 STAGE_NOT_READY（exit 1） |
| `node scripts/development-execution.mjs --development FE:UI-203` | 通过（exit 0） |

变更文件组：

- `apps/terminal/app/research/{page,entry,detail,workspace}.tsx`与`detail.css`；新增`src/research/detail-policy.ts`、`detail-runtime.ts`及`tests/ui202.test.ts`。原gateway/runtime/policy、共享SSE、Rust代码未改。
- `public/terminal-route-map.json`、`scripts/terminal-static-routes.mjs`及直接路由测试；严格research UUID映射，不扩大通用fallback。`playwright.ui202.config.ts`与默认测试排除登记、隔离reference fixture、13场景测试。
- `scripts/ui202-review.mjs`及测试、开发计划、规程、本报告、确认稿/范围/回执/视觉核对/证据清单。精确`.gitattributes`仅保护生成失败上下文/页面文本，不重写原字节。

历史与整改：preflight-01为119/120，发现重复ID撤权被共享去重吞掉；详情专用reducer先验证并处理撤权，原公共实现和历史不改写。原类型/空catch和测试括号问题已修。preflight-03单测/静态/构建通过、浏览器0/13：种子遗漏必需X-Request-Id与审计路径错误，真实owner正确拒绝；修复夹具契约。preflight-04浏览器11/13，发现遗漏列表详情入口和Next全局announcer导致测试alert定位冲突，均已修复并保存失败。preflight-05为124单测/66门禁通过。71e74cc4/attempt-01完整通过仍绑定原SHA；最后补充大小写UUID规范化与回归，最终baf91152/attempt-02为125单测/13Chromium完整通过。预检的GITHUB_SHA仅未提交工作区诊断标签，不代表原候选包含改动。

复用UI-P03工程9d8de103、证据6fd794bd与确认9688092c，仅原范围引用原562输入/54产物/78单测/11Chromium/52门禁/12图比对。原535证据文件、原6+2+12 incomplete报告及历史ledger全部保留。245Rust输入未变，原e3776999二进制直接复用，不重建、不重跑Rust/原P03全矩阵或上游全链。新功能只运行当前单测、13浏览器场景与直接静态路由回归。

风险：reference身份cookie桥/CORS loopback/自签TLS替代；gap/duplicate、wrong-resource、success/failure终态及409/429为标明合成故障，不代表实际引擎。reference流为有限响应，目标长连接/owner仍未验证。领域流有5次重连、30秒无确认事件暂停、2000确认事件/200可见记录与65536字符帧上限，越界拒绝而不推进游标；显式恢复不重发写入。事件失败时页面详情为最后成功GET，取消前仍重读；unknown key只内存，离开后先查任务/审计。reference标签/范围确认不授予用途许可。Firefox/WebKit阻塞、全部历史NOT_RUN、手工读屏/原生200%缩放/跨OS、真实IdP/MFA/Cookie/CORS、目标数据库/Storage、外部provider/引擎、生产host、远程同SHA CI、性能/长稳/发布均保留。

Gate：159项stage_gate与基线9688092c比较保持NOT_ASSESSED；UI-202 INTEGRATION预期拒绝STAGE_NOT_READY，G1/FEP-1 NOT_READY_GAPS_OPEN，formalAccepted=false、runtimeAdmission=DENIED、currentHeadAcceptance=NOT_CLAIMED。下一原任务 **I2 UI-203：Artifact/Evidence详情与交叉跳转** 开发允许，无G1辅助项前置。

本地工程提交71e74cc4（功能）及baf91152（最终受测工程，大小写UUID绑定修正）；本报告/证据由后续独立本地提交封存。未使用生产凭据、推送或部署。
