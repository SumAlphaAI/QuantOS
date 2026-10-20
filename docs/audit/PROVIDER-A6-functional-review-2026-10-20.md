# PROVIDER:A6 当前功能汇总复核（2026-10-20）

冻结源码 **f367cfd887111fb3af5f288ac842995ad089f22b**、1306项输入；17/17限定检查、7/7实际入口通过。仅 **A6_SCOPE_LOCAL DEVELOPMENT READY**，新汇总确认PENDING，formalAccepted=false、runtimeAdmission=DENIED，完整INTEGRATION/RELEASE NOT_RUN。两计划、机器profile、严格入口及CI disposition同步；当前汇总不重授组件或上游READY。

当前范围只有四项：C02 `getCommandSummary`/`subscribeCommandEvents`，C17 `getPlatformCapabilities`/`listDownloads`，对应P02/P17。OpenAPI1.14.0仍134操作/113模型、六生成物精确一致、710行字段字典；C02两path/三schema与原3d86f2fb精确语义比较保持。本轮代码交付包括8项同provider Rust组合用例、真实生成consumer、限定汇总/拒绝Gate、CI及计划策略；原API功能经当前候选重新执行验证。

同一自有provider组合证明：浏览器策略与历史读取、导出创建/取消不改写Command revision/事件帧，不记录新risk decision或增加execution/venue提交；本机permission只缩小能力，server unknown，历史不带签名URL/存储字段或原私有reason。Token跨资源混用拒绝；当前成员撤销、隔离和会话到期先于旧流/游标恢复与下载签发。Shadow没有因浏览器读取或Command初始化而创建Paper执行/策略host；Viewer可读无敏感平台策略，不能取得C02或受控下载历史权限，不伪造其403。

独立期限分账：Command投影/租约至多30秒且不晚于ready来源最早失效；执行参考来源60秒。31秒时旧Command流已失效，执行来源仍有效、历史游标仍可续页；61秒即使独立observer更新，执行来源不能冒充fresh risk，历史游标到期422重载。会话更新不会复活旧流/游标。下载lease仍取now+300秒、文件保留期及会话期限最早值；来源/行/帧/游标上限及进程内恢复边界全部保留。

两个HTTP子probe在本候选重新执行，不调用组件Gate：C02 42条、C17 35条，父回执核对每条记录、源SHA、子命令/exit/signal/time、产物hash和各自当前控制；同provider混合链另由Rust8项和真实生成consumer验证。MFA、受控导出、治理/研究操作仅为当前API的直接前置，不表示A5完整58项重验或真实Engine worker完成。有限snapshot流、合成reference数据和不可实际消费的reference下载URL均不作为真实目标证据。

三个前置仅验证原确认、原Git输入、原技术日志/产物与入口字节：C02 116d076e/3d86f2fb；C17 a3524fdf/5cf6aa13；A5 5fb5b6aa/8a0ce81b。BFF011本次原用户确认另存[记录](evidence/bff-fe-011-confirmation-20261020/summary.md)，只批准原1278输入；当前独立Gate因共享输入变化撤回NOT_ASSESSED，原文稿/技术回执保持。A6不重跑其Gate、递归依赖链、全仓或三轮构建，不将原READY改绑当前候选。

| 验证 | 实际结果 |
|---|---|
| Rust | 70通过：新增组合8、C02 18、C17 15、直接Auth/导出29 |
| Node | 217通过：原确认/流程68、汇总Gate65、policy/CI84 |
| consumer/契约 | 75通过/10文件；含真实同provider生成客户端组合 |
| 覆盖率 | C02 helper行24/24、分支44/44；platform helper行18/18、分支49/49，均100%，仅两helper |
| HTTP/Chromium | 四API共77条当前HTTP，两次基本Chromium；所有当前schema/敏感字段检查通过 |
| 编译/静态 | generated、inventory、一次BFF build、types、lint、Clippy、plans通过 |
| 实际入口 | development、CI、C02/C17/A5原确认、前置metadata、plans共7/7，本机运行 |
| 历史保护 | 54,736份既有audit/gate逐字节保持 |

实际命令与exit/signal/timeout/log hash见[结果](evidence/provider-a6-local-20261020/review-results.json)，只有本次完整独立回执用于准入。

| 检查 | 命令 | 结果 |
|---|---|---|
| contract | `node scripts/check-provider-a6-boundary.mjs` | PASS / exit0 |
| generated | `node scripts/check-bff-generated.mjs` | PASS / exit0 |
| inventory | `node scripts/pre04-inventory.mjs` | PASS / exit0 |
| aggregate | `cargo test --locked --offline -p bff-gateway --lib a6_tests:: -- --test-threads=1` | PASS / exit0 |
| command | `cargo test --locked --offline -p bff-gateway --lib command::tests:: -- --test-threads=1` | PASS / exit0 |
| platform | `cargo test --locked --offline -p bff-gateway --lib platform::tests:: -- --test-threads=1` | PASS / exit0 |
| a2-boundary | `cargo test --locked --offline -p bff-gateway --test auth_settings_provider --test audit_export_provider` | PASS / exit0 |
| build | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS / exit0 |
| http | `node scripts/test-provider-a6-http.mjs docs/audit/evidence/provider-a6-local-20261020/function-attempt-01/aggregate-http.json` | PASS / exit0 |
| consumers | `pnpm exec vitest run apps/terminal/tests/a6-aggregate-consumer.test.ts apps/terminal/tests/command-provider-consumer.test.ts apps/terminal/tests/browser-platform-provider-consumer.test.ts apps/terminal/tests/ui104-settings.test.ts packages/api-client/tests/bff-response.test.ts packages/api-client/tests/bff-transport.test.ts packages/api-client/tests/sse-poc.test.ts tests/contract --coverage --coverage.provider=v8 --coverage.include=apps/terminal/src/command/gateway.ts --coverage.include=apps/terminal/src/settings/platform.ts --coverage.reporter=json-summary --coverage.reportsDirectory=docs/audit/evidence/provider-a6-local-20261020/function-attempt-01/consumer-coverage` | PASS / exit0 |
| types | `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal typecheck` | PASS / exit0 |
| lint | `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal lint` | PASS / exit0 |
| clippy | `cargo clippy --locked --offline -p bff-gateway --lib -- -D warnings` | PASS / exit0 |
| confirmation | `node --test scripts/bff-fe-002-confirmation-20261020.test.mjs scripts/bff-fe-011-confirmation-20261020.test.mjs scripts/provider-a5-confirmation-20261020.test.mjs scripts/user-acceptance-confirmation.test.mjs` | PASS / exit0 |
| gate-tests | `node --test scripts/provider-a6-functional-gate.test.mjs` | PASS / exit0 |
| plan-policy | `node --test scripts/development-plan-order-negative.mjs scripts/ci-stage-disposition.test.mjs` | PASS / exit0 |
| plans | `node scripts/check-development-plans.mjs` | PASS / exit0 |

HTTP各操作记录：`[{"operationId": "getCommandSummary", "status": "PASS", "records": 28}, {"operationId": "subscribeCommandEvents", "status": "PASS", "records": 8}, {"operationId": "getPlatformCapabilities", "status": "PASS", "records": 14}, {"operationId": "listDownloads", "status": "PASS", "records": 13}]`。本机debug延迟仅各子probe观测基线，不作目标负载性能验收。

预检失败原样保留：组合测试曾把31秒错误等同于60秒执行来源失效，已按实际独立期限改正；新consumer的联合类型未收窄且参数误用memberId，已按生成resourceId修正；汇总断言提取遗漏函数名数字，两个log重哈希拒绝探针发现后修正，并逐一增加8项组合断言遗漏拒绝；末尾空行修正。见[预检事实](evidence/provider-a6-local-20261020/preflight/preliminary-disposition.json)。本轮17组完整运行无失败，未拼接历史PASS或抹除旧失败。

未决风险／待执行：真实Supabase/PostgreSQL/RLS/新SQL、真实IdP/MFA/Storage及内容原子单次消费、真实feeds/observer/Engine worker、完整P02/P17/UI101/UI104/G1/FEP1业务链、跨实例/重启/持久恢复、实际部署CSP、目标安全/性能/容量/长稳/部署/同SHA hosted CI与正式发布全NOT_RUN，目标自动化NOT_IMPLEMENTED。历史仅接审计导出，C15报表另有owner生命周期；2000行来源上限超量拒绝，有限进程租约不承诺持久恢复。源数据本地fixture不能替代目标数据库、实际下载或完整业务联调。当前汇总不启用M5或交易/Engine/外部发布权限。

产物：[manifest](evidence/provider-a6-local-20261020/manifest.json)、[控制](evidence/provider-a6-local-20261020/control-matrix.json)、[环境](evidence/provider-a6-local-20261020/environment.json)、[历史](evidence/provider-a6-local-20261020/history-preservation.json)、[完整变更](evidence/provider-a6-local-20261020/changed-files.json)、[证据索引](evidence/provider-a6-local-20261020/evidence-index.json)、[完整确认稿](evidence/provider-a6-local-20261020/confirmation-draft.md)。下一可执行：原稿确认后 **PROVIDER:ALL 当前功能汇总复核**；本任务无生产凭据、push或部署。
