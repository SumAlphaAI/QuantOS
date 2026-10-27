# CORE-GATE:L4-SERVICE 命令与结果

冻结候选 `3b6e91d2e033c080a830ff05c4e4076fb46aa147`，当前采集 `attempt-01`。工具白名单环境、Cargo locked/offline，owned 子进程 env_clear，网络只使用 loopback。没有加载 dotenv/生产凭据、连接数据库/真实 venue 或外部发布。

采集：`node scripts/l4-service-review.mjs --run docs/audit/evidence/l4-service-local-20261027/attempt-01`。

| 检查 | 实际命令 | 退出码 | 原始日志 |
| --- | --- | --- | --- |
| development | `node scripts/development-execution.mjs --development CORE-GATE:L4-SERVICE` | 0 | [log](attempt-01/development.log) |
| component-history | `node scripts/l4-service-review.mjs --components` | 0 | [log](attempt-01/component-history.log) |
| fixture-build | `cargo build --locked --offline -p quantos-execution --example l01_fixture -p execution-gateway --bin execution-gateway` | 0 | [log](attempt-01/fixture-build.log) |
| protocol | `cargo test --locked --offline -p quantos-execution --test l01_protocol` | 0 | [log](attempt-01/protocol.log) |
| protocol-process | `cargo test --locked --offline -p quantos-execution --test l01_process` | 0 | [log](attempt-01/protocol-process.log) |
| zone | `cargo test --locked --offline -p quantos-execution --test l02_zone` | 0 | [log](attempt-01/zone.log) |
| mtls-process | `cargo test --locked --offline -p execution-gateway --test l02_mtls` | 0 | [log](attempt-01/mtls-process.log) |
| secret-contract | `node scripts/core-l02-contract.mjs` | 0 | [log](attempt-01/secret-contract.log) |
| approval | `cargo test --locked --offline -p quantos-execution --test service_l03` | 0 | [log](attempt-01/approval.log) |
| approval-http | `cargo test --locked --offline -p execution-gateway --test service_l03_http` | 0 | [log](attempt-01/approval-http.log) |
| approval-native | `cargo test --locked --offline -p quantos-execution --test service_l03_native` | 0 | [log](attempt-01/approval-native.log) |
| same-subject | `cargo test --locked --offline -p quantos-execution --test l4_service_boundary` | 0 | [log](attempt-01/same-subject.log) |
| recovery | `cargo test --locked --offline -p quantos-evidence --test service_l04 --test service_l04_report` | 0 | [log](attempt-01/recovery.log) |
| packet-verifier | `target/debug/l04-evidence --verify-owned-local-archive docs/audit/evidence/l4-service-local-20261027/attempt-01/packet.json sha256:a72e6959125f9d17cb5f4860a4dddf55f4484b39346295eb24736a66d22268c3` | 0 | [log](attempt-01/packet-verifier.log) |
| gate-tests | `node --test --test-reporter=tap scripts/l4-service-components.test.mjs scripts/l4-service-review.test.mjs scripts/development-execution.test.mjs` | 0 | [log](attempt-01/gate-tests.log) |
| script-lint | `pnpm exec eslint scripts/l4-service-components.mjs scripts/l4-service-components.test.mjs scripts/l4-service-review.mjs scripts/l4-service-review.test.mjs` | 0 | [log](attempt-01/script-lint.log) |
| rust-lint | `cargo clippy --locked --offline -p quantos-execution -p execution-gateway -p quantos-evidence --tests --no-deps -- -D warnings` | 0 | [log](attempt-01/rust-lint.log) |
| rust-format | `cargo fmt --check -p quantos-execution -p execution-gateway -p quantos-evidence` | 0 | [log](attempt-01/rust-format.log) |
| plans | `node scripts/check-development-plans.mjs` | 0 | [log](attempt-01/plans.log) |
| integration-refusal | `node scripts/development-execution.mjs --integration CORE-GATE:L4-SERVICE` | 1 | [log](attempt-01/integration-refusal.log) |
| i10-refusal | `node scripts/development-execution.mjs --integration FRONTEND-GATE:G8` | 1 | [log](attempt-01/i10-refusal.log) |
| next-development | `node scripts/development-execution.mjs --development FRONTEND-GATE:G8` | 0 | [log](attempt-01/next-development.log) |
| secret-scan | `node scripts/l4-service-review.mjs --scan docs/audit/evidence/l4-service-local-20261027/attempt-01` | 0 | [log](attempt-01/secret-scan.log) |

当前 Rust 49/49 = 协议 15 + stdio 1 + L02 zone 3 + mTLS 4 + L03 服务 13 + HTTP 3 + native 模式拒绝 1 + 同 subject 拒绝 1 + L04 恢复/报告 8。Node 98/98。无失败/忽略/跳过。历史组件测试计数不加入当前总计。

integration-refusal / i10-refusal 预期退出 1，实际均 STAGE_NOT_READY；next-development 为 FRONTEND-GATE:G8，allowed=true。拒绝检查通过不等于联调准入通过。

当前没有运行 X3/FEP-7 浏览器矩阵、全仓、覆盖率、上游完整 --run campaign、F05/F07 数据库或任何目标/发布操作。只读当前复核 `node scripts/l4-service-review.mjs --verify`；全部封存完整性 `node docs/audit/evidence/l4-service-local-20261027/verify.mjs`。
