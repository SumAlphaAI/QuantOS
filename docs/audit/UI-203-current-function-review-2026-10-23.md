# UI-203 当前功能验收报告（2026-10-23）

结论：`PASS_UI203_CURRENT_FUNCTION`，最终工程 `03ecbdfa31d075a821cabe6e278c65131e25cde9`，593输入/46产物/10命令。计划IMPLEMENTED_PENDING_ACCEPTANCE，[完整确认稿](./evidence/ui203-local-20261023/confirmation-draft.md)待项目用户确认；文档HEAD不冒充已验收工程。

交付：`/artifacts/:artifactId`与带父Research/Evidence的引用解析，Artifact元数据/假设/摘要、input/content/environment哈希、Engine/prompt/code版本、血缘引用、Evidence选中态、归档JSON安全文本预览；Research、Artifact/Evidence、Snapshot、Audit之间按已知对象类型交叉跳转。inputHash来源于验证归属的C03父任务或C04可选字段，未提供明确缺失。C10独立查询scope、分页/retention与关联引用。详见[规程](../operations/ui203-artifact-evidence-detail.md)、[原始回执](./evidence/ui203-local-20261023/receipt.json)、[范围](./evidence/ui203-local-20261023/scope.json)、[原始执行](./evidence/ui203-local-20261023/attempt-01/executions.json)、[历史](./evidence/ui203-local-20261023/README.md)。

同候选76单测（60 UI203+8 Research网关+8 Audit网关）、12Chromium、67门禁/路由、types/lint/build通过；客户端94文件检查通过。两主题×1440/390四截图、4次axe零violations、零新增incomplete。Codex查看了最终浅色桌面与预检深色小屏截图；UI-P04高保真图像比对、人工读屏/原生200%缩放/跨OS均NOT_RUN。

| 实际命令（使用固定pnpm10.20.0） | 结果 |
| --- | --- |
| `node scripts/development-execution.mjs --development FE:UI-203` | 通过（exit 0） |
| `pnpm exec vitest run apps/terminal/tests/ui203.test.ts apps/terminal/tests/research-gateway.test.ts apps/terminal/tests/audit-gateway.test.ts --reporter=verbose --reporter=json --outputFile=docs/audit/evidence/ui203-local-20261023/attempt-01/unit.json` | 通过（exit 0） |
| `pnpm --filter @sumalpha/terminal typecheck` | 通过（exit 0） |
| `pnpm exec eslint apps/terminal/src/artifacts apps/terminal/app/artifacts apps/terminal/app/research/detail.tsx apps/terminal/app/audit/workspace.tsx apps/terminal/tests/ui203.test.ts scripts/ui203-review.mjs scripts/ui203-review.test.mjs scripts/terminal-static-routes.mjs scripts/terminal-static-routes.test.mjs playwright.ui203.config.ts playwright.config.ts tests/e2e/ui203.spec.ts tests/e2e/fixtures/ui203-reference.ts` | 通过（exit 0） |
| `pnpm --filter @sumalpha/terminal build` | 通过（exit 0） |
| `pnpm exec playwright test --config=playwright.ui203.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=docs/audit/evidence/ui203-local-20261023/attempt-01/browser` | 通过（exit 0） |
| `node --test scripts/ui203-review.test.mjs scripts/terminal-static-routes.test.mjs` | 通过（exit 0） |
| `node scripts/check-development-plans.mjs` | 通过（exit 0） |
| `node scripts/development-execution.mjs --integration FE:UI-203` | 预期拒绝STAGE_NOT_READY（exit 1） |
| `node scripts/development-execution.mjs --development FE:UI-P04` | 通过（exit 0） |

变更文件组：

- 新增`apps/terminal/app/artifacts/{page,workspace}.tsx`、`workspace.css`，`src/artifacts/{policy,runtime}.ts`和`tests/ui203.test.ts`。修改Research详情与Audit事件详情的对象链接，不修改原运行时/网关；已有功能仅执行直接网关回归和本次跨页浏览器场景。
- `public/terminal-route-map.json`、`scripts/terminal-static-routes.mjs`及直接测试，严格artifacts家族UUID映射；`.gitignore`仅为新app/src源码开例外，生成artifacts仍忽略，门禁验证源文件纳入593输入。
- `playwright.ui203.config.ts`与默认排除、隔离reference夹具/12场景；`scripts/ui203-review.mjs`及测试；计划、规程、本报告、确认稿/范围/视觉核对/完整原始证据。`.gitattributes`仅精确保护一份生成失败上下文，不改写原字节。

整改与证据：首次74/75发现429冷却覆盖，当前已修；预检11/12的分页失败为合成游标被真实reference契约正确拒绝，修正夹具后单项通过再冻结。预检四条aria-prohibited-attr incomplete来自pre未有支持aria-label的role，当前命名region修正后四次扫描为0；原报告不改写。不存在将这四条误记为color-contrast或据此关闭历史6+2+12项的结论。源码通用忽略规则导致的版本管理缺口在冻结前修正。所有预检仅诊断，唯一同候选通过是03ecbdfa/attempt-01。

复用边界：UI-202工程baf91152、证据ec939e40、确认e5dcf095的579输入/48产物/125单测/13Chromium/66门禁与243原证据文件仅按原范围引用。原6图标+2表头+P03十二条incomplete原报告/哈希/来源及历史ledger保持原字节；245Rust输入未变，原e3776999 reference二进制复用，不重建/不重跑Rust或上游全链。

风险：reference身份cookie桥/CORS loopback/自签TLS替代，预置Artifact明确synthetic；父Research种子实际reference创建，但Artifact/Evidence成员与摘要映射只为标明合成覆盖，不冒充实际引擎完成。C10合成分页保留浏览器cursor与剔除后upstreamQuery，不等于真实签名游标验收。Artifact必须research.read，Audit另需audit:read；没有后端Evidence单项API，不把eventId当evidenceId，不反查所有任务。不可变哈希/版本/正文改变拒绝；附件只绑定服务端hash，未独立验签；预览最多262144字符、200个Evidence、20个Artifact解析、C10最多20页/2000节点，到期/超界/重复/循环拒绝。browser业务无POST，server可追加读取审计。读取失败清空事实，恢复只读元数据、不重放预览。Firefox/WebKit阻塞、全部历史NOT_RUN、真实IdP/Cookie/CORS/DB/Storage/provider/engine产物、生产host、远程同SHA CI、性能/长稳/发布均未验证；不授予业务/策略/交易用途许可。

Gate：159项stage_gate与基线e5dcf095比较保持NOT_ASSESSED，UI-203 INTEGRATION按预期拒绝STAGE_NOT_READY；G1/FEP-1 NOT_READY_GAPS_OPEN，formalAccepted=false、runtimeAdmission=DENIED、currentHeadAcceptance=NOT_CLAIMED。下一原任务 **I2 UI-P04：P04-Research-and-Artifact-Detail-High-Fidelity-v1.png**，开发允许，无G1辅助项前置。

本地工程提交03ecbdfa；本报告及证据由后续独立本地提交封存。未使用生产凭据、推送或部署。
