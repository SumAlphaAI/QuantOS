# UI-506 当前功能交付

源码冻结 `9847d568dd35eab57ab7582e735082fdaf367d88`；基线 `c38c2f2b7575d4c8338160a0d4132e50e5dd1f8f`。最终 attempt-01，限定工程Gate **PASS_UI506_RECONCILIATION_FUNCTION**。仅 QuantOS / main，本地提交；未使用生产凭据、未推送、未部署。工程范围是当前功能与直接影响回归，不递归重验全部依赖。

实现 `/reconciliation`、精确UUID详情/差异深链接、分页/本地筛选，C15 Run/Break/只读Ledger原子一致读取，有限连续SSE+GET核对，原始Decimal/JSON精度、当前/暂定/过期区分，审计重跑202与实际运行区分，响应丢失后的原版本/body/key/CSRF/RequestId恢复，未知锁定和失权清理。来源证据保留Order/Fill原始source_record，C14精确Run/actual sourceHash，C16按exception sourceRef/domain/scope匹配，以及C10当前correlation/audit根。没有手工改账/差异ack或close接口。

验证通过：**69**项前端/真实消费者、**18**项C15、**10**项C14、**20**项C16宿主、**25**项Node、**10**项Chromium（无重试/跳过/失败）。生成契约、types、lint、terminal build/client secrets、计划结构通过。4组明暗/1440与390 axe无violations；2组mobile color-contrast incomplete共132节点为横滚遮挡，待人工完整复核，不能记作通过。DOM主题及实际背景色断言已执行；键盘横滚通过。

C14/C16直接影响回归的原因是新页面实际消费其PerformanceView/OpsAlertPage与scope/精度/来源字段；C15验证不可变账本、幂等/CAS/有效期/关闭证明与只读HTTP边界。既有C01撤销以及P11只读C15消费者作直接回归。没有全仓/coverage/数据库campaign，也没有连接数据库。

| 检查 | 精确命令 | exit |
|---|---|---|
| `development` | `node scripts/development-execution.mjs --development FE:UI-506` | 0 (PASS) |
| `binary` | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | 0 (PASS) |
| `unit-consumer` | `pnpm exec vitest run apps/terminal/tests/ui506.test.ts apps/terminal/tests/ui506-provider-consumer.test.ts apps/terminal/tests/reconciliation-provider-consumer.test.ts apps/terminal/tests/performance-provider-consumer.test.ts apps/terminal/tests/operations-provider-consumer.test.ts apps/terminal/tests/g1-route-access.test.ts apps/terminal/tests/ui-p11-c15-consumer.test.ts --reporter=json --outputFile=docs/audit/evidence/ui506-local-20261024/attempt-01/unit.json` | 0 (PASS) |
| `c15` | `cargo test --locked --offline -p bff-gateway --lib reconciliation::tests::` | 0 (PASS) |
| `c14-impact` | `cargo test --locked --offline -p bff-gateway --lib performance::tests::` | 0 (PASS) |
| `c16-impact` | `cargo test --locked --offline -p bff-gateway --lib operations::tests::` | 0 (PASS) |
| `generated` | `pnpm exec node scripts/check-bff-generated.mjs` | 0 (PASS) |
| `types` | `pnpm --filter @sumalpha/terminal typecheck` | 0 (PASS) |
| `lint` | `pnpm exec eslint apps/terminal/app/reconciliation apps/terminal/src/reconciliation apps/terminal/tests/ui506.test.ts apps/terminal/tests/ui506-provider-consumer.test.ts tests/e2e/ui506.spec.ts tests/e2e/fixtures/ui506-reference.ts playwright.config.ts playwright.ui506.config.ts scripts/ui506-review.mjs scripts/ui506-review.test.mjs scripts/terminal-static-routes.mjs scripts/terminal-static-routes.test.mjs` | 0 (PASS) |
| `gate-tests` | `node --test scripts/ui506-review.test.mjs scripts/terminal-static-routes.test.mjs scripts/serve-static.test.mjs` | 0 (PASS) |
| `terminal-build` | `pnpm --filter @sumalpha/terminal build` | 0 (PASS) |
| `browser` | `pnpm exec playwright test --config=playwright.ui506.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=docs/audit/evidence/ui506-local-20261024/attempt-01/browser` | 0 (PASS) |
| `plans` | `node scripts/check-development-plans.mjs` | 0 (PASS) |
| `integration-refusal` | `node scripts/development-execution.mjs --integration FE:UI-506` | 1 (预期拒绝) |
| `next-development` | `node scripts/development-execution.mjs --development FE:UI-P22` | 0 (PASS) |

`receipt.json`保存上述argv、预期exit、时间、原始日志hash、完整输入sha256和Git blob绑定，另含binary/静态构建hash及浏览器网络与截图hash；`result.json`为摘要。复核：`node scripts/ui506-review.mjs --verify`。受理回执只查询actual correlation/audit/day，不推断jobId与runId相等；请求恢复的网络key/body/version hash相等。所有浏览器网络严格限定GET、C15 rerun POST，以及明确local控制logout。

计划 **IMPLEMENTED_PENDING_ACCEPTANCE**；正式 **INTEGRATION / NOT_ASSESSED**，formalAccepted=false、runtimeAdmission=DENIED。INTEGRATION命令exit1是预期拒绝，不能记成联调通过；FE:UI-P22仅开发准入allowed。确认稿PENDING，不代表用户已批准。

未决/NOT_RUN：实际reference C09为Paper且source ID不同于Shadow C15，未提供同scope同ID阳性join；C16 reference目前是system告警，没有匹配reconciliation异常，C15–C16阳性实际join也NOT_RUN。C14–C15精确账本来源和重跑–C10审计实际组合已测；C16精确匹配阳性仅显式SYNTHETIC单元探针，不升级实际集成状态。真实IdP/生产cookie-CORS、Supabase/RLS/事务、真实venue账本、持久/跨会话恢复、远程同SHA CI、Firefox/WebKit/读屏/原生200%缩放/跨OS、性能容量长稳、完整I6与发布均NOT_RUN。P22高保真尚未执行。

开发失败/诊断原始字节保留于development；browser-01的7/10及错误，unit-02的68/69，以及browser-02浅色主题诊断均ORIGINAL_SCOPE_ONLY。早期未独立保存raw的工具失败如实记录于development/README，不补造日志。既有历史证据未修改，不重绑为此source的PASS。变更全表`changed-files.txt`，仓库范围`repository-scope.json`，目录hash封存`delivery-manifest.json`。

下一可执行开发任务 **FE:UI-P22：Reconciliation 与 Funds Ledger 高保真页面**。未自动启动I6联调或更新任何窗口为READY。

原始浏览器错误上下文/page-state含尾随空格与tab，首次暂存diff-check exit2已保留whitespace-original.log；仅为这些精确raw路径及原日志增加.gitattributes -whitespace，不改证据字节或放宽源码检查。
