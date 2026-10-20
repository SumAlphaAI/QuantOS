# FE:BFF-FE-008 / A5：Performance与报表API当前功能复核（2026-10-20）

冻结源码 **b20efc3054c51933a706b8ac4132dd4316b5c71d**，1109输入、15/15组当前功能/直接影响检查及6/6个实际入口PASS。仅 **BFF008_SCOPE_LOCAL DEVELOPMENT READY**；完整INTEGRATION/RELEASE均NOT_RUN，formalAccepted=false、runtimeAdmission=DENIED，新稿PENDING。两计划及机器策略同步，仅本节点1 READY、其余158 NOT_ASSESSED。

修复两项当前功能缺口。原票据缓存不清理，报告到期后票据仍占1000限额，现合法请求清理所属报告已到期的票据，使新报告下载可恢复。活动报告的过期票据仍保留，以保持已知授权60秒后DOWNLOAD_EXPIRED=410；报告到15分钟后，即使其票据被清理也由REPORT_EXPIRED=410拒绝。新回归实际生成1000张授权、确认429、验证60秒/15分钟边界与新报告恢复，旧job和原创建键回执不删除、不重算；两个job保留，票据恢复到1。此为有界功能/有效期验证，不是性能容量验收。

前端原校验已检查hash/长度、报告ID、ledgerVersion、valuationSnapshotId与财务元数据，但未比较状态、createdAt/expiresAt、correlationId/auditRef及supersededBy。现六字段必须与下载授权一致；consumer逐字段在文档端改值并重新计算hash/size、以及直接修改grant，合计12个schema-valid负向探针均拒绝，正常字节仍通过。reportVersion当前schema固定为1，非1版本原本已拒绝，本轮不将其描述为可复现版本漏洞，也未扩大schema。

C14八API：summary、series、attribution、report create/status/get/download grant/content。当前OpenAPI1.12.0共132操作/110schema，六类生成物一致；去除旧1.11.0硬编码，固定八项归属、兼容和生成精确核对保留。真实X01 projection校验并与C15 actual Book匹配，simple return/P&L/期间新增费用/观测峰谷回撤及符号归因+LEDGER_RESIDUAL黄金值保持。USD/simple、无外部cashflow、单调版本和原fill历史约束不放宽；缺覆盖、任一点未有匹配日结证明/已过期仍强制provisional。202为queued，轮询一次materialize后succeeded，未完成读取409；原键重试不重复生成或写F05根。没有浏览器改账、余额、估值和关闭证明注入。

首先保存本会话C15原稿确认，见[记录](evidence/bff-fe-009-confirmation-20261020/summary.md)，17项通过，本地提交e862b9c4；仅绑定007040fd原源码、1e1ca813原稿/技术回执与1082输入。A4确认仍限1297bc3b/4085bdef。五前置C15、X01、X05、X3-SERVICE、A4仅按原Git blob/输入/规范/日志/产物hash核对，referenceOnly/NOT_REVALIDATED，不重授READY。X01沿用原legacy→functionalManifest绑定。C15共享输入变化后当前独立Gate撤回NOT_ASSESSED；原稿、确认和所有历史失败原样保留。未递归上游Gate、不跑全仓、三轮独立构建或无关性能闭包。

| 当前验证 | 结果 |
|---|---|
| Rust | 57通过：C14 10、C15直接18、Auth/audit 29 |
| Node | 173通过：原确认/流程51、Gate46、policy/CI76 |
| consumer/契约 | 46通过 /7文件；真实client丢回复恢复、完整下载及12个新增元数据负向探针 |
| HTTP / Chromium | 八API、146条当前HTTP，逐项成功401/403/schema；100原键重试、实际下载hash/size及基本Chromium通过 |
| 覆盖率 | performance helper行21/21、关键分支32/32均100%，原始计数见review-results.json |
| 编译与静态 | generated、build、types、lint、Clippy、plans通过 |
| 实际入口 | development、CI、C15确认、A4确认、前置metadata、plans，共6/6通过 |
| 历史保护 | 54,236份原audit/gate文件逐字节保持 |

以下为实际命令；完整起止/退出码/signal/timeout/日志hash见[逐组结果](evidence/bff-fe-008-local-20261020/review-results.json)。function-attempt-01独立完成，未借用历史PASS。

| 检查 | 命令 | 结果 |
|---|---|---|
| contract | `node scripts/check-bff-fe-008-boundary.mjs` | PASS |
| generated | `node scripts/check-bff-generated.mjs` | PASS |
| performance | `cargo test --locked --offline -p bff-gateway --lib performance::tests:: -- --test-threads=1` | PASS |
| c15-direct | `cargo test --locked --offline -p bff-gateway --lib reconciliation::tests:: -- --test-threads=1` | PASS |
| a2-boundary | `cargo test --locked --offline -p bff-gateway --test auth_settings_provider --test audit_export_provider` | PASS |
| build | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS |
| http | `node scripts/test-bff-fe-008-http.mjs docs/audit/evidence/bff-fe-008-local-20261020/function-attempt-01/reference-http.json` | PASS |
| consumers | `pnpm exec vitest run apps/terminal/tests/performance-provider-consumer.test.ts packages/api-client/tests/bff-response.test.ts packages/api-client/tests/bff-transport.test.ts packages/api-client/tests/sse-poc.test.ts tests/contract --coverage --coverage.provider=v8 --coverage.include=apps/terminal/src/performance/gateway.ts --coverage.reporter=json-summary --coverage.reportsDirectory=docs/audit/evidence/bff-fe-008-local-20261020/function-attempt-01/consumer-coverage` | PASS |
| types | `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal typecheck` | PASS |
| lint | `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal lint` | PASS |
| clippy | `cargo clippy --locked --offline -p bff-gateway --lib -- -D warnings` | PASS |
| confirmation | `node --test scripts/bff-fe-009-confirmation-20261020.test.mjs scripts/provider-a4-confirmation-20261020.test.mjs scripts/user-acceptance-confirmation.test.mjs` | PASS |
| gate-tests | `node --test scripts/bff-fe-008-functional-gate.test.mjs` | PASS |
| plan-policy | `node --test scripts/development-plan-order-negative.mjs scripts/ci-stage-disposition.test.mjs` | PASS |
| plans | `node scripts/check-development-plans.mjs` | PASS |

HTTP状态分布：`{"200": 12, "202": 101, "204": 1, "401": 9, "403": 9, "404": 6, "409": 3, "422": 5}`。真实下载proof：`{"sha256": "sha256:8fb3f7b00465887df71d6eba6fc24782c9b7953226a44ae2aa5d04cb2ccc5f0f", "sizeBytes": 2804}`。本轮预检C15入口退出0仅作变更前原范围参考；C14旧当前入口退出2，未计通过。所有原历史失败/中断保持，不改绑为本候选。

文档收尾后 `pnpm check:bff-fe-008:development`、`node scripts/check-development-plans.mjs`、两处Rust格式及 `git diff --check` 均退出0，见 `final-checks.json`；仅复核当前准入与文档一致性，未重跑功能或上游闭包。

未决风险：进程内X01/C15租约，最多1000样本/jobs/历史replays，活动报告票据配额满后仍可429至报告到期；不声称无限持续worker。长周期可能partial，最大60秒完整覆盖，采样间未观察峰谷不推断；仅USD/simple，沿用X01 f64容差与固定quote/非零异币费用拒绝边界，Decimal输出不提升上游精度。真实Supabase/Auth/MFA/RLS/私有Storage、跨实例/重启持久worker与审计事务恢复、真实feed/许可/连续Paper/Shadow链、C16通知和完整P21 UI/G4/FEP4、安全/性能/容量/长稳/部署及同SHA hosted CI/正式发布全部NOT_RUN；目标专用自动化NOT_IMPLEMENTED。未使用生产凭据、未连目标库或建立本地PG/Supabase，未push或部署，无venue submit。

证据：[manifest](evidence/bff-fe-008-local-20261020/manifest.json)、[26控制点](evidence/bff-fe-008-local-20261020/control-matrix.json)、[完整稿](evidence/bff-fe-008-local-20261020/confirmation-draft.md)、[变更文件](evidence/bff-fe-008-local-20261020/changed-files.json)、[索引](evidence/bff-fe-008-local-20261020/evidence-index.json)。下一可执行：**FE:BFF-FE-010 / A5：Operations、Admin与Alert API当前功能复核**。PROVIDER:A5按所需当前范围另行汇总。
