# L02 固定候选命令与结果

候选：`379f624b5e45fa4c22231f25ac06ad54f7c049ec`；最终 attempt-02。

| 检查 | 命令 | exit | 日志 |
| --- | --- | --- | --- |
| development | `node scripts/development-execution.mjs --development CORE:L02` | 0 | [原始日志](./attempt-02/development.log) |
| host-build | `cargo build --locked --offline -p execution-gateway --bin execution-gateway` | 0 | [原始日志](./attempt-02/host-build.log) |
| host-unit | `cargo test --locked --offline -p execution-gateway --lib` | 0 | [原始日志](./attempt-02/host-unit.log) |
| zone-boundary | `cargo test --locked --offline -p quantos-execution --test l02_zone` | 0 | [原始日志](./attempt-02/zone-boundary.log) |
| zone-legacy | `cargo test --locked --offline -p quantos-execution --lib zone::tests::` | 0 | [原始日志](./attempt-02/zone-legacy.log) |
| mtls-process | `cargo test --locked --offline -p execution-gateway --test l02_mtls` | 0 | [原始日志](./attempt-02/mtls-process.log) |
| auth-impact | `cargo test --locked --offline -p quantos-auth --lib` | 0 | [原始日志](./attempt-02/auth-impact.log) |
| l01-impact | `cargo test --locked --offline -p quantos-execution --test l01_protocol` | 0 | [原始日志](./attempt-02/l01-impact.log) |
| dispatch-impact | `cargo test --locked --offline -p quantos-execution --test tp07_dispatch` | 0 | [原始日志](./attempt-02/dispatch-impact.log) |
| sql-network-static | `node scripts/core-l02-contract.mjs` | 0 | [原始日志](./attempt-02/sql-network-static.log) |
| gate-tests | `node --test --test-reporter=tap scripts/core-l02-review.test.mjs scripts/core-l02-contract.test.mjs scripts/development-execution.test.mjs` | 0 | [原始日志](./attempt-02/gate-tests.log) |
| script-lint | `pnpm exec eslint scripts/core-l02-review.mjs scripts/core-l02-review.test.mjs scripts/core-l02-contract.mjs scripts/core-l02-contract.test.mjs` | 0 | [原始日志](./attempt-02/script-lint.log) |
| rust-lint | `cargo clippy --locked --offline -p execution-gateway -p quantos-execution -p quantos-auth --tests --examples --no-deps -- -D warnings` | 0 | [原始日志](./attempt-02/rust-lint.log) |
| rust-format | `cargo fmt --check -p execution-gateway -p quantos-execution -p quantos-auth` | 0 | [原始日志](./attempt-02/rust-format.log) |
| plans | `node scripts/check-development-plans.mjs` | 0 | [原始日志](./attempt-02/plans.log) |
| integration-refusal | `node scripts/development-execution.mjs --integration CORE:L02` | 1 | [原始日志](./attempt-02/integration-refusal.log) |
| next-development | `node scripts/development-execution.mjs --development SERVICE:L03` | 0 | [原始日志](./attempt-02/next-development.log) |
| secret-scan | `node scripts/core-l02-review.mjs --scan docs/audit/evidence/core-l02-local-20261027/attempt-02` | 0 | [原始日志](./attempt-02/secret-scan.log) |

Rust 54 passed / 0 failed / 0 ignored：host-unit 12（L02 10 + 旧服务 2）、zone-boundary 3、旧 zone 6、真实 mTLS process 4、Auth 6、L01 protocol 15、TP07 dispatch 8。只在真实子进程 4 个测试内计算 13 行 TLS 场景、6 步轮换、一条实际签发链和服务会话过期；不是 13 个独立 Rust test。

Node 93 passed / 0 failed / 0 skipped：L02 receipt 46、SQL/network contract 23、development-execution 24。没有全仓/覆盖率/上游 Gate、目标 PostgreSQL 或外部 testnet 命令。

integration-refusal exit 1 是预期 STAGE_NOT_READY；其他当前命令 exit 0。secret-scan 内的合成负向扫描 exit 1、两项 finding 是预期拒绝；正向本任务扫描 exit 0 / report=[]。全局配置未修改，精确排除一个已核对基线的历史 F06 公共幂等值。

环境：webEnvironment 白名单、公有模板、Cargo locked/offline、当前证据与 fixture 路径；不继承私有 dotenv、数据库或 venue 凭据。owned child env_clear 后仅注入自有 TMPDIR。临时证书/私钥不进入仓库或证据包，已按测试生命周期清理。
