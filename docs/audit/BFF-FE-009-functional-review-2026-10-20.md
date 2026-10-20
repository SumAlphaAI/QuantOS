# BFF-FE-009 / A5：Reconciliation与账本API当前功能复核（2026-10-20）

冻结源码 **007040fd3848f583d7534464cdc50724099ea6f4**，1082输入、15/15组当前功能及直接影响检查、5/5实际入口通过。仅 **BFF009_SCOPE_LOCAL DEVELOPMENT READY**；完整业务INTEGRATION与RELEASE均NOT_RUN，formalAccepted=false、runtimeAdmission=DENIED，新确认PENDING。两计划/机器策略已同步，仅本节点1 READY、其余158 NOT_ASSESSED。

本轮修复两项领域边界：差异详情原先从全部历史报告按kind/entity取值，现runId/day、expectedJson/actualJson和证据统一绑定X05 exception.last_report指定的同一报告，避免同日新版本或跨日数值串用；原报告不在host时503，不回退同日其他报告。关闭后仍保留最后检测报告及独立closureReportHash。C15三个列表的后继cursor现继承最初五分钟deadline，翻页不能续期。四项真实host/HTTP回归覆盖同日更新/次日不同余额、缺失原报告拒绝和run/break/ledger三类页面到期前成功及恰好到期拒绝，并确认旧ledger与core journal不被读取修改。

HTTP探针另发现共享请求契约校验器只识别字段allowlist，错误拒绝已在C15 schema/policy声明的id:asc/id:desc。探针和服务器入口现均兼容完整排序表达式及字段列表，仍校验schema、方向/格式和登记范围；增加C15正反向及Order字段排序成功、未登记字段/非法方向/额外段拒绝两项契约回归。没有放宽运行时契约，也没有把其他A5任务列为当前通过。

C15七API仍为run list/get、break list/get、ledger entries、受控rerun和run stream。当前OpenAPI1.12.0共132操作/110schema，六类生成产物精确一致；去除旧1.10.0硬编码，固定七项归属、生成与兼容验证保留。页面只能传reason，不接受余额、Book、closure或执行payload；显式Shadow上下文、原生X05权限与默认live无host503保持。账本按run追加Decimal字符串与来源hash/revision/asOf/day，Order/Fill为source_record、Alert为x05_exception，独立于C16 Alert API；受控重跑F05闭链可定位。202仅受理，不乐观关闭差异；ack、可信新源、修复核验、day-close proof和有效期仍由X05负责。

A4用户原话与17项确认验证见[确认记录](evidence/provider-a4-confirmation-20261020/summary.md)。仅绑定原1297bc3b源码、4085bdef原稿/技术回执和1053输入，本地确认提交1745b8dd；原稿和manifest保持字节。五前置FE006/007、X05、X3-SERVICE、A4仅核对原manifest/源码/规范/日志/产物hash及存在的原入口元数据，NOT_REVALIDATED/referenceOnly；X05/X3原回执没有统一entrypoints文件，不虚构此记录。A4/FE006引用最新20261020/20261019原回执，其余保持原范围。共享输入变化后A4当前Gate撤回NOT_ASSESSED。未执行上游Gate、全仓或三轮独立构建。

| 当前验证 | 结果 |
|---|---|
| Rust | 65通过：C15 18、X05直接flow/source 18、共享Auth/audit 29 |
| Node | 158通过：A4原确认/流程34、Gate48、policy/CI76 |
| consumer/契约 | 46通过 /7文件；generated client丢回复恢复、事实与F05闭链、共享排序正负向 |
| HTTP / Chromium | 七API、147条本轮HTTP，逐项成功401/403/schema、100次原键重试与一个基本Chromium通过 |
| 覆盖率 | C15 helper行20/20、分支23/23均100%，实际计数见review-results.json |
| 生成与静态 | generated、build、types、lint、Clippy、plans通过 |
| 实际入口 | development、CI、A4原确认、直接前置metadata、plans，5/5通过 |
| 历史保护 | 54,147份原audit/gate文件逐字节保持 |

以下为本轮实际完整命令。时间、退出码、日志hash见[逐组结果](evidence/bff-fe-009-local-20261020/review-results.json)。

| 检查 | 命令 | 结果 |
|---|---|---|
| contract | `node scripts/check-bff-fe-009-boundary.mjs` | PASS |
| generated | `node scripts/check-bff-generated.mjs` | PASS |
| reconciliation | `cargo test --locked --offline -p bff-gateway --lib reconciliation::tests:: -- --test-threads=1` | PASS |
| x05-direct | `cargo test --locked --offline -p quantos-reconcile --test x05_flow --test x05_sources` | PASS |
| a2-boundary | `cargo test --locked --offline -p bff-gateway --test auth_settings_provider --test audit_export_provider` | PASS |
| build | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS |
| http | `node scripts/test-bff-fe-009-http.mjs docs/audit/evidence/bff-fe-009-local-20261020/function-attempt-04/reference-http.json` | PASS |
| consumers | `pnpm exec vitest run apps/terminal/tests/reconciliation-provider-consumer.test.ts packages/api-client/tests/bff-response.test.ts packages/api-client/tests/bff-transport.test.ts packages/api-client/tests/sse-poc.test.ts tests/contract --coverage --coverage.provider=v8 --coverage.include=apps/terminal/src/reconciliation/gateway.ts --coverage.reporter=json-summary --coverage.reportsDirectory=docs/audit/evidence/bff-fe-009-local-20261020/function-attempt-04/consumer-coverage` | PASS |
| types | `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal typecheck` | PASS |
| lint | `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal lint` | PASS |
| clippy | `cargo clippy --locked --offline -p bff-gateway --lib -- -D warnings` | PASS |
| confirmation | `node --test scripts/provider-a4-confirmation-20261020.test.mjs scripts/user-acceptance-confirmation.test.mjs` | PASS |
| gate-tests | `node --test scripts/bff-fe-009-functional-gate.test.mjs` | PASS |
| plan-policy | `node --test scripts/development-plan-order-negative.mjs scripts/ci-stage-disposition.test.mjs` | PASS |
| plans | `node scripts/check-development-plans.mjs` | PASS |

HTTP状态分布：`{"200": 22, "202": 101, "204": 1, "401": 8, "403": 7, "404": 1, "409": 5, "422": 2}`。直接X05 flow/source回归验证当前调用的差异定位/来源/ack/closure/CAS与十进制适配，A2回归覆盖共享会话/CSRF/撤权/审计/恢复；不等于这些组件或整链重新验收。消费端由真实run事实更新状态，保留幂等、权限、冻结页、流去重/gap/过期与注销恢复拒绝。

保留[首轮失败](evidence/bff-fe-009-local-20261020/function-attempt-01/disposition.json)：a06b46bb源码6组PASS，HTTP在12条记录后因契约排序校验失败，HTTP=FAIL，后8组NOT_RUN；未发布READY。第二轮138a3446通过探针，但服务器共享input_contract仍拒绝相同合法排序，13条记录后HTTP FAIL，后8组NOT_RUN；[第二轮记录](evidence/bff-fe-009-local-20261020/function-attempt-02/disposition.json)完整保留。第三轮5376a8e6的Rust/HTTP已PASS，但新增Order排序正向测试漏accountId，consumer/契约45 PASS/1 FAIL、后7组NOT_RUN，见[第三轮记录](evidence/bff-fe-009-local-20261020/function-attempt-03/disposition.json)。007040fd修正正负向fixture的必需账户，避免负向用例因缺账户提前拒绝；仅function-attempt-04独立完整结果准入，不拼接前三轮或历史PASS。历史失败与中断也全部保留。

文档收尾后 `pnpm check:bff-fe-009:development`、`node scripts/check-development-plans.mjs`、三处Rust格式与 `git diff --check` 均退出0，见 `final-checks.json`；只复核当前准入和文档一致性，不重跑功能或上游闭包。

未决风险：可信合成Shadow/观察Paper输入和进程内租约不等于真实feed、许可/撤权或持续10个实际交易日Shadow。真实Supabase/Auth/MFA/RLS/Storage、审计与账本持久事务/跨实例/重启恢复、P11/P21/P22/G5/FEP5完整UI业务链、目标安全/容量/性能/长稳/部署和同SHA hosted CI及正式发布均NOT_RUN，目标专用自动化NOT_IMPLEMENTED。保留X01 f64、固定quote与非零异币费用拒绝边界，Decimal投影不提升上游精度。未使用生产凭据、未连接目标库或创建本地PG/Supabase、未push或部署，无venue submit。

证据：[manifest](evidence/bff-fe-009-local-20261020/manifest.json)、[28控制点](evidence/bff-fe-009-local-20261020/control-matrix.json)、[完整稿](evidence/bff-fe-009-local-20261020/confirmation-draft.md)、[变更文件](evidence/bff-fe-009-local-20261020/changed-files.json)、[索引](evidence/bff-fe-009-local-20261020/evidence-index.json)。下一可执行：**FE:BFF-FE-008 / A5：Performance与报表API当前功能复核**，按实际影响选择回归。
