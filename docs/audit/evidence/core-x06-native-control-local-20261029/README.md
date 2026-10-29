# CORE:X06 DEVELOPMENT / L4-NATIVE-CONTROL-01

冻结源码 `a9c94709a1b222a273f16c05c2b4e22ec7074820`；输入摘要 `sha256:44b4f921b7324fdf72b72a49ef62d302ff1b958e443f9a6d2c05dd34d993f144`；实际执行 `attempt-02`。当前公共全局/账户 kill → 当前 X02 generation → 原生持久停止 → 共同 C10 已在 owned 单机配置域接续，P11 提供显式 MFA 控制与原请求恢复。当前 profile 仅一个账户，不代表所有部署账户/主机。

工程 Gate `PASS_CURRENT_PUBLIC_KILL_X02_NATIVE_DURABLE_STOP_C10`。23 项命令达到预期退出；Rust 31（native9/control7/当前来源9/实际进程6），前端消费者 77、契约 27、Node 43、Chromium 2 通过，无重试/跳过/flaky；axe 零 violation、0 incomplete。build/Clippy/fmt/lint/类型/契约生成/计划及纯域无 submit 检查通过。

实际 BFF 在控制事务落盘后、原生 ack 前被杀死，重启先恢复停止 generation1；12 并发同键请求只产生一条决定，双层停止与独立解除保持代次顺序，旧审批保持失效。实际 UNKNOWN 场景：预留不改、X01 入账0/隔离1、OPEN Alert2、协议调用1；控制 engage/release 后均不补发、不自动关闭。冷启动缺失、损坏及独立回退拒绝，原生永久停止不能被受控解除清除。

完整 Gate `NOT_READY_GAPS_OPEN`，stage `NOT_ASSESSED`，formalAccepted=false，runtimeAdmission=DENIED，M5 PREPARED_NOT_READY；19 gap/8 义务仍 OPEN、159 规范阶段不提升。真实身份/目标 Supabase/RLS/Vault/venue/testnet、多账户跨主机/外部单调锚点、C11版本化启用、完整 books/估值、外部通知/明确关闭、目标安全容量时延长稳/同 SHA CI/发布 NOT_RUN。无生产凭据、推送或外部发布。

[结果](./result.json) · [原始命令/日志/输入哈希](./receipt.json) · [源码提交变更清单](./changed-files.json) · [封存文件清单](./manifest.json) · [剩余缺口](./remaining-gaps.json) · [移交](./handoff.json) · [待确认文稿](./review-draft.md) · [发布未执行](./release-checklist.json) · [历史完整性](./history-integrity.json) · [规程](../../../operations/core-x06-native-control.md)。原 L4 87 个封存文件及公共 kill 403 结果原 SHA 保留，不改绑本轮 PASS。

预检79文件含原失败记录，均为 UNFROZEN_DIAGNOSTIC_ONLY；修复情况见 [索引](./preflight-index.json)，不计当前验收。首轮 attempt-01 在源码 0ffe58b54e6b628b889fa5ea3f99ab0a98177d7c 因网络幂等摘要文件未覆盖分类而 FAIL，44 原始文件保持原样；[修复记录](./gate-repair.json)仅证据工具窄修复，当前 attempt 绑定新 SHA，未改绑历史。当前功能与直接影响回归只围绕共享持久恢复/P11/C10，不递归全部上游或 F05/F07。复核 `node docs/audit/evidence/core-x06-native-control-local-20261029/verify.mjs`；重跑须使用新的 attempt。

| 检查 | 实际命令 | 退出码 |
|---|---|---|
| development | `node scripts/development-execution.mjs --development CORE:X06` | 0 |
| scope | `node scripts/core-x06-native-control-review.mjs --audit` | 0 |
| build | `cargo build --locked --offline -p bff-gateway -p execution-gateway` | 0 |
| native | `cargo test --locked --offline -p quantos-execution --test core_l04` | 0 |
| control | `cargo test --locked --offline -p bff-gateway --lib assisted::control::tests::` | 0 |
| current-source | `cargo test --locked --offline -p bff-gateway --lib assisted::tests::` | 0 |
| process | `cargo test --locked --offline -p bff-gateway --test core_l04` | 0 |
| consumers | `pnpm exec vitest run apps/terminal/tests/native-kill-control.test.ts apps/terminal/tests/core-l03-hardening.test.ts apps/terminal/tests/core-l4-audit.test.ts apps/terminal/tests/core-x06-alerts.test.ts apps/terminal/tests/core-x05-reconciliation.test.ts --reporter=json --outputFile=docs/audit/evidence/core-x06-native-control-local-20261029/attempt-02/consumers.json` | 0 |
| contracts | `pnpm exec vitest run tests/contract/native-kill-control.test.ts tests/contract/core-x05-reconciliation.test.ts tests/contract/core-x06-alerts.test.ts --reporter=json --outputFile=docs/audit/evidence/core-x06-native-control-local-20261029/attempt-02/contracts.json` | 0 |
| gate-tests | `node --test --test-reporter=tap scripts/core-x06-native-control-review.test.mjs scripts/development-execution.test.mjs` | 0 |
| openapi | `node scripts/check-bff-openapi.mjs` | 0 |
| generated | `node scripts/check-bff-generated.mjs` | 0 |
| typecheck | `pnpm --filter @sumalpha/terminal typecheck` | 0 |
| lint | `pnpm exec eslint apps/terminal/src/kill apps/terminal/src/assisted apps/terminal/tests/native-kill-control.test.ts apps/terminal/tests/fixtures/native-kill-control.ts tests/contract/native-kill-control.test.ts tests/e2e/native-kill-control.spec.ts playwright.native-kill.config.ts scripts/core-x06-native-control-review.mjs scripts/core-x06-native-control-review.test.mjs` | 0 |
| rust-lint | `cargo clippy --locked --offline -p bff-gateway -p quantos-execution --all-targets --no-deps -- -D warnings` | 0 |
| rust-format | `cargo fmt --check -p bff-gateway -p quantos-execution -p quantos-risk` | 0 |
| plans | `node scripts/check-development-plans.mjs` | 0 |
| no-submit | `python3 scripts/check-x05-no-submit.py` | 0 |
| web-build | `pnpm --filter @sumalpha/terminal build` | 0 |
| browser | `pnpm exec playwright test --config=playwright.native-kill.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=docs/audit/evidence/core-x06-native-control-local-20261029/attempt-02/browser/cases` | 0 |
| integration-refusal | `node scripts/development-execution.mjs --integration CORE:X06` | 1 |
| release-refusal | `node scripts/development-execution.mjs --release CORE:X06` | 1 |
| secret-scan | `node scripts/core-x06-native-control-review.mjs --scan docs/audit/evidence/core-x06-native-control-local-20261029/attempt-02` | 0 |

下一可执行：`CORE:X06 DEVELOPMENT / L4-C11-ACTIVATION-01`，scoped/versioned 启用/历史接运行时条件；继续保留 UNKNOWN 与原 generation，不补发或自动关闭。
