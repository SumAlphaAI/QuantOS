# I2 UI-507：Audit Explorer 与受控导出

UI-507 当前功能实现及本机reference范围验证完成，工程Gate `PASS_UI507_LOCAL_FUNCTION`。工程SHA `9f7552a8305b1fb1b661676d1d67becf1ebb229b`，520项输入、32份候选产物、11条命令。计划已同步 `IMPLEMENTED_PENDING_ACCEPTANCE`；159个原阶段Gate全部保持 `NOT_ASSESSED`。未代用户确认，G1/FEP-1完整联调与发布状态不提升。

只修改 QuantOS，直接在main完成本地提交；没有生产凭据、目标数据库操作、推送、部署或外部发布。复用旧原范围回执，不执行G1-DEP-01等开发前置，不重跑全链。[工程回执](./evidence/ui507-local-20261022/receipt.json)、[执行日志](./evidence/ui507-local-20261022/attempt-02/executions.json)、[完整确认稿](./evidence/ui507-local-20261022/confirmation-draft.md)、[范围摘要](./evidence/ui507-local-20261022/scope.json)。

## 变更

| 文件 | 功能 |
|---|---|
| `apps/terminal/app/audit/page.tsx`、`workspace.tsx`、`workspace.css` | 实际审计搜索、过滤、游标分页、因果链、脱敏载荷、导出表单/状态、显式短时下载及移动查询 |
| `apps/terminal/app/exports/page.tsx` | 独立受控导出入口和query资源引用 |
| `apps/terminal/src/audit/runtime.ts` | 身份/权限/期限、MFA/reauth/CSRF、幂等/未知结果/取消读回、429、撤权/关闭、分页和下载保护 |
| `apps/terminal/src/audit/gateway.ts` | 修正分页事件类型，并保留已校验retryAfter；复用生成C10和既有租约校验 |
| `apps/terminal/tests/audit-runtime.test.ts` | 新增18个当前功能成功/拒绝/恢复用例 |
| `tests/e2e/ui507.spec.ts`、`playwright.ui507.config.ts`、`playwright.config.ts` | 六个有界Chromium真实路由用例；专用入口，不加入无关日常浏览器全链 |
| `scripts/ui507-review.mjs`、`ui507-review.test.mjs`、`package.json` | 可复核门禁、39个门禁测试及功能/联调入口分离 |
| 前端执行计划、`docs/operations/ui507-audit-export.md` | 同步原任务状态、开发入口和分阶段边界 |
| 本报告、本轮证据目录、`.gitattributes` | 输入/二进制/日志哈希、确认稿、原始失败与截图；仅一个原始失败上下文的精确空白例外 |

完整文件清单见[changed-files.txt](./evidence/ui507-local-20261022/changed-files.txt)。

## 测试命令与结果

入口：`node scripts/ui507-review.mjs --run docs/audit/evidence/ui507-local-20261022/attempt-02`，环境仅白名单PATH/HOME等与工程公开模板，不加载私有dotenv。逐条命令和时间/退出码以执行日志为准。

| 命令 | 结果 |
|---|---|
| `node scripts/development-execution.mjs --development FE:UI-507` | exit0，功能开发允许，旧依赖只作阶段引用 |
| `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | exit0，单次reference构建；没有重跑Rust全链验收 |
| `pnpm exec vitest run apps/terminal/tests/audit-runtime.test.ts apps/terminal/tests/audit-gateway.test.ts apps/terminal/tests/g1-route-access.test.ts apps/terminal/tests/audit-provider-consumer.test.ts`（追加JSON报告参数） | 55/55：18新runtime、8既有C10、28复用访问监控、1真实reference消费者 |
| `pnpm --filter @sumalpha/terminal typecheck` | exit0 |
| `pnpm exec eslint`（本轮audit页面/runtime/测试、配置与门禁文件） | exit0，路径见执行日志 |
| `pnpm --filter @sumalpha/terminal build` | exit0，`terminal-9f7552a8305b1fb1b661676d1d67becf1ebb229b`，客户端秘密扫描通过 |
| `pnpm exec playwright test --config=playwright.ui507.config.ts --project=chromium --retries=0 --workers=1 --reporter=list,json --output=docs/audit/evidence/ui507-local-20261022/attempt-02/browser` | 6/6，retry/skip/flaky=0 |
| `node --test scripts/ui507-review.test.mjs` | 39/39 |
| `node scripts/check-development-plans.mjs` | exit0，159阶段Gate保持NOT_ASSESSED |
| `node scripts/development-execution.mjs --integration FE:UI-507` | **预期exit1**，STAGE_NOT_READY，未提升联调 |
| `node scripts/development-execution.mjs --development FE:UI-P12` | exit0，下一原任务开发允许 |

浏览器范围：服务端筛选及5/3条实际游标分页、8节点因果链、浏览器MFA/reauth创建、queued→ready及实际下载、内容哈希/大小/关联审计、取消终态、丢失创建响应同键恢复、断流/离线清屏与显式恢复、实际403/404/401、expired作业禁止下载、390px基本查询。附件4743字节，SHA-256 `1249ede6fecd77353e3fb5330d9f5fc92bfa4d53560a2193912633199548b6bc`，与服务端租约及内容响应一致；租约URL未留在DOM或应用存储。页面仅报告下载交接，测试单独验证真实附件落盘。

## 原证据复用与保留

5份历史引用（DL、REC-01、REC-02、FEP-1回执及原保留账本）仅校验原字节摘要，源码SHA与原范围不变，不递归重跑旧工程门禁或改绑历史PASS。见回执`reusedEvidence`和[保留账本](./evidence/g1-journey-local-20261022/retained-boundaries.json)。本轮新增UI创建reference证据，不把历史`fullExportCreationUiJourney`或完整未替代旅程改成PASS。

[预检说明](./evidence/ui507-local-20261022/preflight-notes.json)记录未冻结诊断：分页类型/fixture契约、429冷却延长、lint、编辑错误及错误水印断言等均已纠正。最初类型检查和计划快照辅助调用只有工具输出/摘要，未冒称有完整原始文件。首次计划检查因新报告尚未创建而失败，后续补齐文档链接；错误调用`nodesFromPlans`造成误导性newline诊断已按准确Git快照修正。失败、单场景重试与最终候选独立，不拼接预检PASS。

## 风险与Gate

- 运行拓扑是 Terminal3190 → HTTPS loopback4010 → 当前Rust reference临时端口；cookie身份和CORS明确由代理替代，供应方API/附件原字节透传，无URL重写。真实IdP/MFA、真实cookie/CORS、目标数据库/storage、持久跨进程撤权仍NOT_RUN。
- Firefox `BLOCKED_ENVIRONMENT`、WebKit `BLOCKED_ENVIRONMENT_TEST_INTERCEPTION` 以及原账本全部NOT_RUN和附加未执行项原字节保留。读屏、原生200%、跨OS/设备、同SHA远程CI、性能/容量/长稳、目标TLS、发布均未提升。
- 当前功能入口为 `/audit`、`/exports`，静态资源引用 `/audit?correlationId=<UUID>`、`/exports?exportId=<UUID>`。原UI-P12的高保真、资源路径映射及其浏览器/视觉范围属于下一原任务，不声称本轮交付。
- 未知结果只在当前授权页面内保留原幂等意图；关闭/失效会清除，不声称跨重载自动恢复。离开页面后先查询审计确认服务端事实再创建。服务端仍最终控制范围、有效期、下载一次性消费与审计。
- 工程功能：`PASS_UI507_LOCAL_FUNCTION`；人工确认：PENDING；原INTEGRATION：`NOT_ASSESSED`；G1/FEP-1：`NOT_READY_GAPS_OPEN`；formalAccepted=false、runtimeAdmission=DENIED。功能开发继续允许，不把这些阶段义务作为无关任务开发前置。

下一可执行任务为原 I2 **UI-P12：P12-Audit-Explorer-and-Export-Jobs-High-Fidelity-v1.png**；复用本轮实现和证据，按其实际视觉/路径变更执行直接验证。
