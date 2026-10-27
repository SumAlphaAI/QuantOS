# SERVICE:L04 实际命令与结果

冻结候选 `4bf60cc109e337d618d8a0d73158cc2c8a3f505d`，最终 `attempt-02`。白名单工具环境、Cargo locked/offline，verifier env_clear；未读取 dotenv/生产凭据、未连接数据库/venue。

采集命令：`node scripts/service-l04-review.mjs --run docs/audit/evidence/service-l04-local-20261027/attempt-02`。

| 检查 | 实际命令 | 退出码 | 原始日志 |
| --- | --- | --- | --- |
| development | `node scripts/development-execution.mjs --development SERVICE:L04` | 0 | [log](attempt-02/development.log) |
| current-recovery | `cargo test --locked --offline -p quantos-evidence --test service_l04 --test service_l04_report` | 0 | [log](attempt-02/current-recovery.log) |
| packet-verifier | `target/debug/l04-evidence --verify-owned-local-archive docs/audit/evidence/service-l04-local-20261027/attempt-02/packet.json sha256:64ffa7fa7d5a83cbe08bbbcc1d6a90dd68fdcb2c18e6338cdfcae8568db35f66` | 0 | [log](attempt-02/packet-verifier.log) |
| legacy-evidence | `cargo test --locked --offline -p quantos-evidence --lib` | 0 | [log](attempt-02/legacy-evidence.log) |
| operations-regression | `cargo test --locked --offline -p quantos-operations --test service_x06` | 0 | [log](attempt-02/operations-regression.log) |
| reconcile-source-regression | `cargo test --locked --offline -p quantos-reconcile --test x05_sources` | 0 | [log](attempt-02/reconcile-source-regression.log) |
| reconcile-twenty | `cargo test --locked --offline -p quantos-reconcile --test x05_flow x05_twenty_differences_are_located` | 0 | [log](attempt-02/reconcile-twenty.log) |
| gate-tests | `node --test --test-reporter=tap scripts/service-l04-review.test.mjs scripts/development-execution.test.mjs` | 0 | [log](attempt-02/gate-tests.log) |
| script-lint | `pnpm exec eslint scripts/service-l04-review.mjs scripts/service-l04-review.test.mjs` | 0 | [log](attempt-02/script-lint.log) |
| rust-lint | `cargo clippy --locked --offline -p quantos-evidence --tests --no-deps -- -D warnings` | 0 | [log](attempt-02/rust-lint.log) |
| rust-format | `cargo fmt --check -p quantos-evidence` | 0 | [log](attempt-02/rust-format.log) |
| plans | `node scripts/check-development-plans.mjs` | 0 | [log](attempt-02/plans.log) |
| integration-refusal | `node scripts/development-execution.mjs --integration SERVICE:L04` | 1 | [log](attempt-02/integration-refusal.log) |
| next-development | `node scripts/development-execution.mjs --development CORE-GATE:L4-SERVICE` | 0 | [log](attempt-02/next-development.log) |
| secret-scan | `node scripts/service-l04-review.mjs --scan docs/audit/evidence/service-l04-local-20261027/attempt-02` | 0 | [log](attempt-02/secret-scan.log) |

Rust 35/35 = 新功能 8 + 旧 evidence 1 + SERVICE:X06 23 + X05 sources 2 + 20 类差异定位 1。Node 66/66，无失败/忽略/跳过。旧 evidence 测试的吞吐与耗时只是局部执行诊断，不是目标性能/SLO 或持久化验收。

integration-refusal 预期退出 1，实际 STAGE_NOT_READY；next-development 为 CORE-GATE:L4-SERVICE，allowed=true。没有运行全仓/覆盖率/数据库 campaign/递归上游 Gate；直接回归选择理由见规程。

只读重验：`node scripts/service-l04-review.mjs --verify`；证据封存完整性：`node docs/audit/evidence/service-l04-local-20261027/verify.mjs`。没有保存环境凭据或临时签名对象。
