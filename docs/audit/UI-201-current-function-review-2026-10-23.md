# UI-201 当前功能审查与验收证据

结论：`PASS_UI201_CURRENT_FUNCTION`，工程候选 `e3776999ad2aee625ec38faee5547a3b6ff9e68a`，541 输入、44 产物、12 条有界命令。当前功能已实现并通过本机范围检查，计划为 `IMPLEMENTED_PENDING_ACCEPTANCE`，项目用户确认仍 `PENDING`。仅 main 本地提交，无生产凭据、推送或部署。

交付 `/research`、`/research/new` 的 Research 列表/分页筛选/排序、C04 快照选项、capability/question/budget/deadline 校验、后端422字段定位、202审计回执和未知结果显式幂等重试。复用 UI-204/UI-P05 的网关、快照策略和撤权/恢复机制。只补齐 current reference C01 的 research.read/write 声明，与其原有 C03 资源所有权一致；其他身份与 live authorizer 未扩权。静态服务支持同名目录与导出 `.html` 共存及尾斜杠，拒绝未知路由。

范围说明：[规程](../operations/ui201-research-list-create.md)、[回执](./evidence/ui201-local-20261023/receipt.json)、[范围](./evidence/ui201-local-20261023/scope.json)、[完整确认稿](./evidence/ui201-local-20261023/confirmation-draft.md)、[原始执行](./evidence/ui201-local-20261023/attempt-02/executions.json)、[原始失败与中断说明](./evidence/ui201-local-20261023/README.md)、[变更清单](./evidence/ui201-local-20261023/changed-files.txt)。

当前验证：122 单测（59 新增 UI201、8 研究网关、55 快照直接回归）、24 项 Rust C03/C04、8 个 Chromium 业务/恢复与布局场景、52 项门禁/路由、类型/lint/build及88文件客户端扫描通过。浏览器验证了真实本机 reference 创建、服务端列表、审计关联和重试同一任务；不启动真实外部研究引擎。字段拒绝、冷却、延迟、快照/能力收窄均以 SYNTHETIC 标签区分。截图/axe覆盖两主题×两个路由×1440/390，共8份截图、8次零violations；Codex检查了新建深色小屏、浅色桌面及列表深色小屏截图。未做 UI-P03 设计图基线比对、人工读屏或原生200%缩放。

本轮 axe 仍有 **2 项 color-contrast incomplete**：深/浅色 390 宽列表各一项，每项4个横向滚动视口外表头节点，自动检查无法确定被部分遮挡背景；需要人工核验。保留原 UI-P05 的 **6 项图标对比度 incomplete**，不以本轮扫描覆盖或关闭。两者是不同报告、不同范围。

| 命令 | 实际结果 |
| --- | --- |
| `cargo test --locked --offline -p bff-gateway --lib research::tests -- --nocapture` | 通过（exit 0） |
| `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | 通过（exit 0） |
| `node scripts/development-execution.mjs --development FE:UI-201` | 通过（exit 0） |
| `pnpm exec vitest run apps/terminal/tests/ui201.test.ts apps/terminal/tests/research-gateway.test.ts apps/terminal/tests/data-snapshot.test.ts --reporter=verbose --reporter=json --outputFile=docs/audit/evidence/ui201-local-20261023/attempt-02/unit.json` | 通过（exit 0） |
| `pnpm --filter @sumalpha/terminal typecheck` | 通过（exit 0） |
| `pnpm exec eslint apps/terminal/src/research apps/terminal/app/research apps/terminal/tests/ui201.test.ts scripts/ui201-review.mjs scripts/ui201-review.test.mjs scripts/serve-static.mjs scripts/serve-static.test.mjs playwright.ui201.config.ts playwright.config.ts tests/e2e/ui201.spec.ts tests/e2e/fixtures/ui201-reference.ts` | 通过（exit 0） |
| `pnpm --filter @sumalpha/terminal build` | 通过（exit 0） |
| `pnpm exec playwright test --config=playwright.ui201.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=docs/audit/evidence/ui201-local-20261023/attempt-02/browser` | 通过（exit 0） |
| `node --test scripts/ui201-review.test.mjs scripts/terminal-static-routes.test.mjs scripts/serve-static.test.mjs` | 通过（exit 0） |
| `node scripts/check-development-plans.mjs` | 通过（exit 0） |
| `node scripts/development-execution.mjs --integration FE:UI-201` | 预期拒绝：STAGE_NOT_READY（exit 1） |
| `node scripts/development-execution.mjs --development FE:UI-P03` | 通过（exit 0） |

本轮新增与变更文件按以下组列出，完整路径见变更清单：

- `apps/terminal/app/research/{page.tsx,new/page.tsx,workspace.tsx,workspace.css}`；`src/research/{gateway.ts,policy.ts,runtime.ts}`；`tests/ui201.test.ts`。
- `services/bff-gateway/src/{lib.rs,research_tests.rs}`：仅 current reference capability 声明和直接拒绝回归；因这两个 Rust 输入变化才重新构建/验证；其余243个 Rust 输入原样复用。
- `scripts/{ui201-review.mjs,ui201-review.test.mjs,serve-static.mjs,serve-static.test.mjs}`，`playwright.ui201.config.ts`、`playwright.config.ts`、`tests/e2e/{ui201.spec.ts,fixtures/ui201-reference.ts}`。
- 本报告、规程、前端开发执行计划、证据目录与保护不可改写失败上下文字节的精确 `.gitattributes` 条目。

历史/风险边界：失败候选 `7330aa2d17b86752e8a536fef6190d93a3b43af0` 的 attempt-01 为浏览器7/8失败，未签发通过回执；所有预检错误、EPERM、缺失附件及中断保留。最终只使用 e3776999 的 attempt-02 成功结果，不拼接旧轮次。UI-204/UI-P05 原工程与确认仅原SHA/hash引用，既有下载/用途阻断与原NOT_RUN ledger不改写。G1辅助项未作为开发前置，无递归上游/全仓/全业务旅程复验。

结果未知的 body/key 仅内存：离开/失效后先查询原任务，不能用新 key 直接重复新建；原deadline/快照失效则拒绝重发。快照许可标签和读取通过不授予实际业务用途。UI-P03高保真、UI-202详情/SSE/取消未冒充本轮交付。reference 身份cookie、CORS loopback/self-signed TLS替代保留；Firefox环境阻塞、WebKit附件接收拦截阻塞及全部历史NOT_RUN保留。真实IdP/MFA/Cookie/CORS、目标数据库/私有Storage、外部数据provider/研究引擎、生产host、远程同SHA CI、安全/性能/长稳发布矩阵等目标验收仍NOT_RUN。

Gate：159项阶段门禁逐项与基线 d167790c 比较保持 `NOT_ASSESSED`，G1/FEP-1 `NOT_READY_GAPS_OPEN`；UI-201 INTEGRATION 被 `STAGE_NOT_READY` 拒绝，formalAccepted=false、runtimeAdmission=DENIED、currentHeadAcceptance=NOT_CLAIMED。人工确认稿 PENDING，不自行批准；保存文档后的 HEAD 不冒充已验收工程。

本地工程提交：`7330aa2d17b86752e8a536fef6190d93a3b43af0`（初始功能）、`e3776999ad2aee625ec38faee5547a3b6ff9e68a`（小屏/空表修正，最终受测候选）。本报告和证据封存于后续独立本地文档提交。下一可执行原任务：I2 **UI-P03：P03-Research-List-and-New-Research-High-Fidelity-v1.png**，可直接开展开发，G1辅助项不构成前置。
