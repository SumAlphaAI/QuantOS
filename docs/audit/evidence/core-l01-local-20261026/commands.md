# L01 固定候选命令与结果

sourceCommit: `decf787ff12e1caa2917ad2fd9fcfa8b9496d0b9`；仅绑定本候选与原始 attempt-01。

| 检查 | 命令 | exit | 日志 |
| --- | --- | --- | --- |
| development | `node scripts/development-execution.mjs --development CORE:L01` | 0 | [原始日志](./attempt-01/development.log) |
| fixture-build | `cargo build --locked --offline -p quantos-execution --example l01_fixture` | 0 | [原始日志](./attempt-01/fixture-build.log) |
| protocol | `cargo test --locked --offline -p quantos-execution --test l01_protocol` | 0 | [原始日志](./attempt-01/protocol.log) |
| legacy-current | `cargo test --locked --offline -p quantos-execution --test l01_legacy` | 0 | [原始日志](./attempt-01/legacy-current.log) |
| process | `cargo test --locked --offline -p quantos-execution --test l01_process` | 0 | [原始日志](./attempt-01/process.log) |
| legacy-unit | `cargo test --locked --offline -p quantos-execution --lib venue::tests::` | 0 | [原始日志](./attempt-01/legacy-unit.log) |
| gateway | `cargo test --locked --offline -p quantos-execution --lib gateway::tests::` | 0 | [原始日志](./attempt-01/gateway.log) |
| dispatch | `cargo test --locked --offline -p quantos-execution --test tp07_dispatch` | 0 | [原始日志](./attempt-01/dispatch.log) |
| oms | `cargo test --locked --offline -p quantos-execution --test x04_oms -- --skip x04_one_hundred_thousand_mixed_kernel_events_replay_with_command_provenance` | 0 | [原始日志](./attempt-01/oms.log) |
| evidence-compile-only | `cargo test --locked --offline -p quantos-evidence --lib --no-run` | 0 | [原始日志](./attempt-01/evidence-compile-only.log) |
| rust-lint | `cargo clippy --locked --offline -p quantos-execution --tests --examples --no-deps -- -D warnings` | 0 | [原始日志](./attempt-01/rust-lint.log) |
| rust-format | `cargo fmt --check -p quantos-execution` | 0 | [原始日志](./attempt-01/rust-format.log) |
| gate-tests | `node --test --test-reporter=tap scripts/core-l01-review.test.mjs scripts/development-execution.test.mjs` | 0 | [原始日志](./attempt-01/gate-tests.log) |
| script-lint | `pnpm exec eslint scripts/core-l01-review.mjs scripts/core-l01-review.test.mjs` | 0 | [原始日志](./attempt-01/script-lint.log) |
| plans | `node scripts/check-development-plans.mjs` | 0 | [原始日志](./attempt-01/plans.log) |
| integration-refusal | `node scripts/development-execution.mjs --integration CORE:L01` | 1 | [原始日志](./attempt-01/integration-refusal.log) |
| next-development | `node scripts/development-execution.mjs --development CORE:L02` | 0 | [原始日志](./attempt-01/next-development.log) |
| artifact-scan | `node scripts/core-l01-review.mjs --scan docs/audit/evidence/core-l01-local-20261026/attempt-01` | 0 | [原始日志](./attempt-01/artifact-scan.log) |

Rust：protocol 15、legacy-current 6、process 1、legacy-unit 4、gateway 15、dispatch 8、oms 8，共 57 passed / 0 failed / 0 ignored。X04 的 100k 性能项被显式跳过，其他过滤项不计通过。Node 63 passed / 0 failed / 0 skipped（L01 39 + development-execution 24）。quantos-evidence 仅编译，不记行为通过。

integration-refusal exit=1 为预期 STAGE_NOT_READY；其他命令 exit=0。真实 testnet、外部 HTTP、数据库、全仓/上游 Gate、性能/长稳/远端 CI 和发布均 NOT_RUN。

采集环境仅从 webEnvironment 白名单派生：PATH/HOME/TMPDIR/LANG/LC_ALL、固定 public example、离线开关和本任务 fixture 路径。真实自有子进程 env_clear。未读取私有 dotenv、未传入连接或 venue 凭据。
