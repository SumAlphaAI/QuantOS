# FE:BFF-FE-010 / A5：Operations、Admin与Alert API当前功能复核（2026-10-20）

冻结源码 **3152db47dbe1f7a56805bf95c4f897b79e384ee3**，1146输入、18/18组当前功能与直接回归、7/7实际入口PASS。仅 **BFF010_SCOPE_LOCAL DEVELOPMENT READY**；完整INTEGRATION/RELEASE均NOT_RUN，formalAccepted=false、runtimeAdmission=DENIED，新稿PENDING。两计划/机器策略同步，全图仅本节点1 READY、其余158 NOT_ASSESSED。

本轮完成五处修正。共享分页后继cursor继承最初五分钟deadline，读取清理过期cursor；alert stream清理过期租约后可恢复容量，但仍先要求30秒内真实可信观察，陈旧来源不放行，旧stream拒绝。治理tombstone可读但PUT/DELETE不可恢复或再次删除，404且版本/config/回执不变，同名重建仍409。合法列表过滤按端点声明校验，不依赖是否存在结果行：alerts允许status/domain/severity/active，incidents允许status，admin不接受这些过滤；组合条件为空或空incident列表应200空items，非法跨端点字段仍422。

AlertFacts先校验账户/结构/stream一致性和序列，只有实际apply才提交首个stream绑定；错误账户和gap首帧不改变stream/rows/sequence，后续正常首帧可恢复。已通过opened(header)建立的服务端租约仍绑定，其他stream拒绝，revoke继续清空事实。参考种子另将自有合成portfolio event/mark及started_at统一到调用方给定时钟，避免冷图像hash制备后另取时钟导致种子最后事件晚于观察时间；确定性用早于制备10秒的时钟验证初始化及31秒后仍拒绝陈旧。未修改核心clock/30秒TTL或live来源，也未改变全局X03 fixture。

C11/C16仍为43个操作：health/metrics、incident list/get/timeline/open/ack/resolve、安全Runbook list/precheck/run、五类member/role/policy/capability/flag CRUD，以及alert list/get/ack/unack/subscriptions/SSE。当前OpenAPI1.12.0共132操作/110schema，六类生成物、固定归属与兼容一致；去除旧精确版本硬编码，保持v1兼容与精确生成校验。F06为权限上限，租约不是目标治理表写回。最后管理员须同时保留admin.read/write，本人/同user别名治理、protected/in-use资源、typed deny和安全flag边界保持。签名Engine review仍须tenant范围、独立Approver、元数据精确匹配与期限；浏览器不能提交key/endpoint或启动Engine。

高风险mutation使用CSRF/MFA/近期认证/If-Match与原键恢复，当前权限先于重放；ack不resolve，incident须新鲜修复和独立用户才能关闭。F09只授权observer可提交结构化来源，页面不输出raw detail/labels；Runbook仅inspect-health/evidence，不执行任意命令、改账或交易。live无host503，审计/commit不确定后quarantine；真实持久事务尚未验收。

已保存C14原稿用户确认，17项通过，见[记录](evidence/bff-fe-008-confirmation-20261020/summary.md)，本地提交c4b1792e；仅绑定b20efc30/5f82e72a和1109原输入。C15确认限007040fd/1e1ca813，A4确认限1297bc3b/4085bdef。七直接前置F06页面、audit页面、C15、F09、X3-SERVICE、X06、A4只核对原Git blob/源码输入/规范/日志和产物hash，F09沿用原legacy PASS结构，全部NOT_REVALIDATED/referenceOnly；不重授独立READY，也不执行上游Gate/全仓/三轮独立构建/无关交易回放。C14共享输入变更后独立当前Gate撤回NOT_ASSESSED，原稿与回执保持。

| 当前验证 | 结果 |
|---|---|
| Rust | 53通过：C11/C16 20、X06四项直接4、Auth/audit 29 |
| Node | 194通过：原确认/流程68、Gate50、policy/CI76 |
| consumer/契约 | 46通过/7文件；真实治理丢回复恢复、权威告警和无效首帧恢复 |
| HTTP / Chromium | 43API、342条当前HTTP；逐项成功401/403/schema、100原键Runbook重试/唯一F05根、真实观察修复/独立resolve、基本Chromium |
| 覆盖率 | operations helper行27/27、关键分支46/46均100%；原始计数见review-results.json |
| 生成与静态 | generated、build、types、lint、Clippy、plans通过 |
| 实际入口 | development、CI、C14/C15/A4原确认、前置metadata、plans，共7/7通过 |
| 历史保护 | 54,289份原audit/gate文件逐字节保持，历史失败/中断不重写 |

以下是实际完整命令，起止/exit/signal/timeout/日志hash见[结果](evidence/bff-fe-010-local-20261020/review-results.json)。仅function-attempt-03完整结果用于当前准入。

| 检查 | 命令 | 结果 |
|---|---|---|
| contract | `node scripts/check-bff-fe-010-boundary.mjs` | PASS |
| generated | `node scripts/check-bff-generated.mjs` | PASS |
| operations | `cargo test --locked --offline -p bff-gateway --lib operations::tests:: -- --test-threads=1` | PASS |
| core-alerts | `cargo test --locked --offline -p quantos-operations --test service_x06 service_x06_real_f09_alerts_keep_ack_until_repaired -- --test-threads=1` | PASS |
| core-incidents | `cargo test --locked --offline -p quantos-operations --test service_x06 service_x06_incident_ack_repair_independent_close_and_recurrence -- --test-threads=1` | PASS |
| core-runbook | `cargo test --locked --offline -p quantos-operations --test service_x06 service_x06_no_arbitrary_runbook_ledger_write_and_copy_queries_are_safe -- --test-threads=1` | PASS |
| core-observer | `cargo test --locked --offline -p quantos-operations --test service_x06 service_x06_observer_authority_staleness_empty_health_and_redaction -- --test-threads=1` | PASS |
| a2-boundary | `cargo test --locked --offline -p bff-gateway --test auth_settings_provider --test audit_export_provider` | PASS |
| build | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS |
| http | `node scripts/test-bff-fe-010-http.mjs docs/audit/evidence/bff-fe-010-local-20261020/function-attempt-03/reference-http.json` | PASS |
| consumers | `pnpm exec vitest run apps/terminal/tests/operations-provider-consumer.test.ts packages/api-client/tests/bff-response.test.ts packages/api-client/tests/bff-transport.test.ts packages/api-client/tests/sse-poc.test.ts tests/contract --coverage --coverage.provider=v8 --coverage.include=apps/terminal/src/operations/gateway.ts --coverage.reporter=json-summary --coverage.reportsDirectory=docs/audit/evidence/bff-fe-010-local-20261020/function-attempt-03/consumer-coverage` | PASS |
| types | `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal typecheck` | PASS |
| lint | `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal lint` | PASS |
| clippy | `cargo clippy --locked --offline -p bff-gateway --lib -- -D warnings` | PASS |
| confirmation | `node --test scripts/bff-fe-008-confirmation-20261020.test.mjs scripts/bff-fe-009-confirmation-20261020.test.mjs scripts/provider-a4-confirmation-20261020.test.mjs scripts/user-acceptance-confirmation.test.mjs` | PASS |
| gate-tests | `node --test scripts/bff-fe-010-functional-gate.test.mjs` | PASS |
| plan-policy | `node --test scripts/development-plan-order-negative.mjs scripts/ci-stage-disposition.test.mjs` | PASS |
| plans | `node scripts/check-development-plans.mjs` | PASS |

HTTP状态分布：`{"200": 230, "201": 7, "202": 1, "401": 45, "403": 47, "409": 11, "422": 1}`。四项X06直接测试只涉及alert确认、incident修复/独立关闭、白名单Runbook、observer权限/陈旧/脱敏，不重跑上游执行或risk campaign。容量循环为有界恢复/有效期语义，不作为负载/性能验收。

[首轮](evidence/bff-fe-010-local-20261020/function-attempt-01/disposition.json)：11b4c2e9的operations17 PASS/1 FAIL，源为参考种子冷启动时钟晚于观察，后15组NOT_RUN，未发布READY。[第二轮](evidence/bff-fe-010-local-20261020/function-attempt-02/disposition.json)：247e3e37的18组/7入口原始结果PASS，但Codex在最终发布复核结束前开始补已发现的空集过滤缺陷，输入drift被门禁拒绝，manifest和计划原子回滚，整体FAIL，不称为当前准入；原日志/候选回执/失败保留。3152db47冻结后独立完成第三轮，在完整进程退出0后才整理文档，不拼接前轮或历史PASS。

文档收尾后 `pnpm check:bff-fe-010:development`、`node scripts/check-development-plans.mjs`、四处Rust格式及 `git diff --check` 均退出0，见 `final-checks.json`；只核对当前准入与文档一致性，不重跑功能或上游闭包。

未决风险：owner注入的单账户Paper/Shadow进程租约及typed治理，不等于Supabase/F06成员写回、多实例传播和持久worker。真实数据库/Auth/MFA/RLS/私有Storage、F05/outbox持久原子性/崩溃与跨实例恢复、真实F09/X05来源、远程Engine运行、完整P02/P13/P14/P23 UI/G6/FEP6、安全/性能/容量/长稳/部署与同SHA hosted CI及正式发布全部NOT_RUN，目标专用自动化NOT_IMPLEMENTED；1000资源/回执/游标/stream与10000事件上限保留，不承诺无限运行。无生产凭据、未连目标库或建立本地PG/Supabase、无venue submit、未push或部署。

证据：[manifest](evidence/bff-fe-010-local-20261020/manifest.json)、[38控制点](evidence/bff-fe-010-local-20261020/control-matrix.json)、[完整确认稿](evidence/bff-fe-010-local-20261020/confirmation-draft.md)、[变更文件](evidence/bff-fe-010-local-20261020/changed-files.json)、[索引](evidence/bff-fe-010-local-20261020/evidence-index.json)。下一可执行：**PROVIDER:A5当前功能汇总复核**，按009/008/010最新原回执与直接组合选择验证，不递归所有上游。
