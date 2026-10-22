# G1-DL-01 / G1-DL-02 下载链整改与本机验证（2026-10-22）

**工程范围 PASS_REFERENCE_DOWNLOAD_SCOPE**，绑定 `71b26d54998c3117391f01cac9a7e8681c5880ac`、354 项冻结输入。reference 现可签发符合 C10/C17 的短时 URL 并实际交付附件；API 与内容采用同一显式 BFF HTTPS origin。**G1 / FEP-1 仍 NOT_READY_GAPS_OPEN、INTEGRATION NOT_ASSESSED，formalAccepted=false、runtimeAdmission=DENIED**。当前稿人工确认 PENDING，不自动接受整个 G1 或新 HEAD，不推送或部署。

依据[前端执行计划](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md)、[原缺口报告](./FRONTEND-G1-FEP1-local-gap-review-2026-10-22.md)及[原8项整改](./evidence/frontend-g1-gap-20261022/actions.json)。本轮仅实现 DL-01/02；原包59个hash在原adec1559提交核验，其原始文件（计划历史版本除外）保持原字节。见[机器回执](./evidence/g1-download-local-20261022/receipt.json)、[整改状态](./evidence/g1-download-local-20261022/remediation-status.json)、[源码定位](./evidence/g1-download-local-20261022/source-findings.json)、[实际字节证据](./evidence/g1-download-local-20261022/attempt-02/reference-delivery.json)、[完整确认稿](./evidence/g1-download-local-20261022/confirmation-draft.md)。

## 变更及行为

reference 原来的 downloads.invalid/query-ticket 占位租约改为真实内容端点 `/_bff/export-content/{opaqueTicket}/{HMAC-SHA256}`。签发只引用已生成的内存字节，ticket绑定当前fixture会话和导出，期限取会话/保留期/300秒最早值。内容GET在同一锁下重验会话、capability、资源状态、签名、期限与一次消费，先标记消费再读内容，核对SHA-256与长度。取消、登出、错会话/权限、篡改、过期与重放安全拒绝；HEAD/query不消费。读取/完整性失败消耗旧ticket，由用户显式申请新链恢复。512个未到期ticket上限及过期回收避免引用表无限增长。测试故障注入仅cfg(test)，没有新增HTTP测试后门。

live租约由显式 `QUANTOS_BFF_PUBLIC_ORIGIN` 生成，和前端 `NEXT_PUBLIC_QUANTOS_BFF_ORIGIN` 相同，Terminal origin仅管CORS。Host/Forwarded不能决定URL。默认二进制live启动现要求新配置；现有owner注入入口维持单origin语义（BFF=Terminal），分离origin的标准启动用新显式入口。此改变已编译并核对共享origin构造逻辑，**没有执行live DB/Storage/signer/外部部署**。

C10/OpenAPI更新URL形状与origin/TTL/消费/隐私语义，生成TS/Zod/schema/provider policy同步。C10审计consumer与C17浏览器consumer共用 `src/downloads/lease.ts`，拒绝非HTTPS、非配置BFF origin、userinfo/query/hash、路径/大小写/转义等隐式规范化、非opaque UUID路径、资源错配、过期/超300秒及保留期错配。当前历史、日志及审计不持久化租约；内容头共享attachment/no-store/nosniff/no-referrer。实际HTTPS代理配置要求写入[规程](../operations/g1-reference-downloads.md)与环境模板注释。

## 成功、拒绝和恢复结果

| 边界 | 本轮结果 | 证据范围 |
|---|---|---|
| CSV/JSONL/PDF、水印、长度、hash与内容头 | PASS | Rust内存provider；原水印hash脱敏规则保留 |
| TTL=min(session,retention,300s)、ticket到期、保留期 | PASS | Rust确定性时钟；目标数据库时间NOT_RUN |
| 原子一次消费、并发一成功一410、显式新链 | PASS | Rust锁 + 实际Node/TLS请求 |
| viewer403、invalid401、篡改/错签名/会话binding410、未知资源404 | PASS | fixture身份，非真实IdP/跨租户服务 |
| 取消/登出使旧票据失效 | PASS | reference；持久撤销NOT_RUN |
| 存储读取/缺失/完整性失败拒绝并重新申请 | PASS | cfg(test)内存故障，真实Storage失败恢复NOT_RUN |
| Host/Forwarded不影响issuer；C10/C17严格同BFF origin | PASS | 实际reference + generated consumer +共享纯函数；live拓扑NOT_RUN |
| generated runtime→真实内容与Chromium附件字节 | PASS | loopback HTTPS代理原字节；没有route.fulfill、没有租约URL替换 |

最终附件 **4,743字节**，SHA-256 `5c7588ac54674a38b836c64811c38831119eaaf9d4091e3d674066ac56814343`，本次generated runtime、Chromium与metadata消费一致。它仅绑定本次fixture/尝试（每次进程的审计ID/时刻不同，不要求跨运行hash相同），不称为完整P17页面或G1业务旅程。临时自签名TLS仅本机测试context忽略证书错误；真实TLS信任/代理配置仍NOT_RUN。

## 实际命令与结果

最终 **attempt-02 的16条命令全部exit0**：Rust 40（10下载+1origin+15平台+14审计）、Vitest 107（6真实组合/内容含1项Chromium +70消费者/运行时 +31契约）、门禁负向44（12既有C10+32本轮边界）。零失败/skip；Rust过滤掉的无关测试不是PASS。本轮只做必要BFF二进制构建、Terminal typecheck、生成物校验、ESLint/rustfmt与计划检查，不全仓campaign或递归验收上游。复核入口 `node scripts/g1-download-review.mjs --verify`；所有源输入Git blob、命令/log/hash、二进制绑定和结果在[回执](./evidence/g1-download-local-20261022/receipt.json)。

| 检查 | 命令 | 结果 | 原始记录 |
|---|---|---|---|
| rust-reference | `cargo test --locked --offline -p bff-gateway --lib reference_download -- --nocapture` | exit 0 | [日志](./evidence/g1-download-local-20261022/attempt-02/rust-reference.log) |
| rust-origin | `cargo test --locked --offline -p bff-gateway --lib download_contract -- --nocapture` | exit 0 | [日志](./evidence/g1-download-local-20261022/attempt-02/rust-origin.log) |
| rust-platform | `cargo test --locked --offline -p bff-gateway --lib platform::tests -- --nocapture` | exit 0 | [日志](./evidence/g1-download-local-20261022/attempt-02/rust-platform.log) |
| rust-audit | `cargo test --locked --offline -p bff-gateway --test audit_export_provider -- --nocapture` | exit 0 | [日志](./evidence/g1-download-local-20261022/attempt-02/rust-audit.log) |
| build | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | exit 0 | [日志](./evidence/g1-download-local-20261022/attempt-02/build.log) |
| reference-delivery | `pnpm exec vitest run tests/integration/g1-download-reference.test.ts --reporter=verbose --reporter=json --outputFile=docs/audit/evidence/g1-download-local-20261022/attempt-02/integration-vitest.json` | exit 0 | [日志](./evidence/g1-download-local-20261022/attempt-02/reference-delivery.log) |
| consumers | `pnpm exec vitest run apps/terminal/tests/g1-download-contract.test.ts apps/terminal/tests/browser-platform-provider-consumer.test.ts apps/terminal/tests/ui-p17-runtime.test.ts apps/terminal/tests/ui104-runtime.test.ts apps/terminal/tests/audit-provider-consumer.test.ts apps/terminal/tests/audit-gateway.test.ts --reporter=verbose --reporter=json --outputFile=docs/audit/evidence/g1-download-local-20261022/attempt-02/consumer-vitest.json` | exit 0 | [日志](./evidence/g1-download-local-20261022/attempt-02/consumers.log) |
| contract | `pnpm exec vitest run tests/contract --reporter=verbose --reporter=json --outputFile=docs/audit/evidence/g1-download-local-20261022/attempt-02/contract-vitest.json` | exit 0 | [日志](./evidence/g1-download-local-20261022/attempt-02/contract.log) |
| generated | `node scripts/check-bff-generated.mjs` | exit 0 | [日志](./evidence/g1-download-local-20261022/attempt-02/generated.log) |
| bff007-contract | `node scripts/check-bff-fe-007.mjs` | exit 0 | [日志](./evidence/g1-download-local-20261022/attempt-02/bff007-contract.log) |
| bff007-negative | `node --test scripts/bff-fe-007-gate-negative.mjs` | exit 0 | [日志](./evidence/g1-download-local-20261022/attempt-02/bff007-negative.log) |
| typecheck | `pnpm --filter @sumalpha/terminal typecheck` | exit 0 | [日志](./evidence/g1-download-local-20261022/attempt-02/typecheck.log) |
| lint | `pnpm exec eslint apps/terminal/src/settings/platform.ts apps/terminal/src/downloads/lease.ts apps/terminal/src/audit/gateway.ts apps/terminal/tests/audit-gateway.test.ts apps/terminal/tests/audit-provider-consumer.test.ts apps/terminal/tests/g1-download-contract.test.ts tests/integration/g1-download-reference.test.ts scripts/g1-download-review.mjs scripts/g1-download-review.test.mjs scripts/check-bff-fe-007.mjs` | exit 0 | [日志](./evidence/g1-download-local-20261022/attempt-02/lint.log) |
| format | `rustfmt --check --edition 2024 services/bff-gateway/src/download_contract.rs services/bff-gateway/src/reference_download.rs services/bff-gateway/src/lib.rs services/bff-gateway/src/main.rs services/bff-gateway/src/live.rs services/bff-gateway/src/live/audit.rs services/bff-gateway/src/live/f09_live_tests.rs` | exit 0 | [日志](./evidence/g1-download-local-20261022/attempt-02/format.log) |
| gate-negative | `node --test scripts/g1-download-review.test.mjs` | exit 0 | [日志](./evidence/g1-download-local-20261022/attempt-02/gate-negative.log) |
| plans | `node scripts/check-development-plans.mjs` | exit 0 | [日志](./evidence/g1-download-local-20261022/attempt-02/plans.log) |

首次编译因F09 gated test构造缺新字段失败（未执行目标测试）；早期两个Rust断言误把脱敏水印当原始值、logout204当202。拓展预检遇loopback EPERM、旧checker node-globals lint与旧正向fixture占位路径不合新schema；后续按真实契约修复测试/共享消费者，未放松安全要求。冻结前记录没有完整中间源码快照，preflight中的sourceCommit仅当时Git HEAD，不据此认定该SHA的源码通过。最终结果全部在工程71b26d54独立重跑，不拼接预检PASS。首次最终入口被自动审批以目录覆盖风险拒绝，未执行；确认新attempt-02不存在后获准执行。见[全部历史](./evidence/g1-download-local-20261022/attempt-history.json)。

## 状态、风险及下一项

DL-01/02状态为 **IMPLEMENTED_VERIFIED_LOCAL_REFERENCE**，人工确认PENDING，目标拓扑/实际live交付NOT_RUN。原8项缺口中的其余6项保持OPEN/P15待确认/环境或用途授权受阻；[逐项账本](./evidence/g1-download-local-20261022/remediation-status.json)没有以下载PASS关闭全部G1。159个节点stage_gate、development_status和规范依赖未改变；只更新G1评审引用、当前摘要与FEP-1状态范围。

Firefox BLOCKED_ENVIRONMENT、WebKit BLOCKED_ENVIRONMENT_TEST_INTERCEPTION和原全部NOT_RUN/历史失败/不完整项原样保留。此次Chromium实收不替代WebKit或Firefox；旧包的actualReferenceDownloadDelivery=NOT_RUN仍是原SHA事实，本次新SHA另记PASS_CURRENT_BOUNDED。[边界账本](./evidence/g1-download-local-20261022/retained-boundaries.json)嵌入原逐页账本与hash，不覆写原页面receipt或确认。

剩余风险：G1-REC-01实际路由授权事件/有界失效模型、G1-REC-02完整跨页面授权/审计/恢复组合未验证；P15原稿确认仍PENDING；依赖适用性仍需按受影响范围登记。live DB/Storage/signer、真实IdP/MFA、Cookie/CORS、目标headers/privacy、持久撤销、人工读屏/原生200%、原生通知、完整P17/跨OS/设备、远程同SHA CI、性能/长稳及RELEASE均未执行，不提升状态。HTTP local-integrated配置需显式HTTPS代理才能下载；live新配置缺项会启动失败，不能通过放开任意origin解决。未读取生产凭据、未连接目标DB/IdP/Storage，无数据库/本地数据库服务、推送或部署操作。

下一可执行任务 **G1-REC-01**：实际Command/Settings路由接入授权事件或明确评审的有界失效策略，补撤权、跨标签、迟到响应、最早期限及重连不重放；随后执行G1-REC-02同候选完整旅程。P15确认可独立组织，不拿当前执行授权替代用户确认。完整G1未READY，不直接授I2联调准入。

## 工程变更文件

以下27项绑定工程提交；本轮额外新增此报告、证据包并同步前端计划，均只在QuantOS。证据包完整文件/hash见[索引](./evidence/g1-download-local-20261022/manifest.json)。

- `.env.example`
- `apps/terminal/src/audit/gateway.ts`
- `apps/terminal/src/downloads/lease.ts`
- `apps/terminal/src/settings/platform.ts`
- `apps/terminal/tests/audit-gateway.test.ts`
- `apps/terminal/tests/audit-provider-consumer.test.ts`
- `apps/terminal/tests/g1-download-contract.test.ts`
- `bff/openapi/quantos-bff.v1.yaml`
- `docs/operations/g1-reference-downloads.md`
- `env/local-integrated.env.example`
- `env/staging.env.example`
- `packages/api-client/src/bff-gen/quantos-bff.ts`
- `packages/api-client/src/bff-gen/quantos-bff.zod.ts`
- `scripts/check-bff-fe-007.mjs`
- `scripts/g1-download-review.mjs`
- `scripts/g1-download-review.test.mjs`
- `services/bff-gateway/src/download_contract.rs`
- `services/bff-gateway/src/generated-input-policy.json`
- `services/bff-gateway/src/lib.rs`
- `services/bff-gateway/src/live.rs`
- `services/bff-gateway/src/live/audit.rs`
- `services/bff-gateway/src/live/f09_live_tests.rs`
- `services/bff-gateway/src/main.rs`
- `services/bff-gateway/src/reference_download.rs`
- `services/bff-gateway/tests/audit_export_provider.rs`
- `tests/contract/generated/quantos-bff.components.schema.json`
- `tests/integration/g1-download-reference.test.ts`
