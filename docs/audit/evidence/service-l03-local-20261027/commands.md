# SERVICE:L03 命令与结果

冻结源码：`c276e947d8d326484d1a1f1284272ba20dc7405b`。采集器使用 webEnvironment 白名单、Cargo locked/offline；实际 HTTP 子进程 env_clear。没有加载 dotenv、DATABASE_URL、生产凭据或外部网络。

主入口：`node scripts/service-l03-review.mjs --run docs/audit/evidence/service-l03-local-20261027/attempt-01`。

| 检查 | 实际命令 | 退出码 | 原始日志 |
| --- | --- | --- | --- |
| development | `node scripts/development-execution.mjs --development SERVICE:L03` | 0 | [log](attempt-01/development.log) |
| host-build | `cargo build --locked --offline -p execution-gateway --bin execution-gateway` | 0 | [log](attempt-01/host-build.log) |
| core | `cargo test --locked --offline -p quantos-execution --test service_l03` | 0 | [log](attempt-01/core.log) |
| legacy-boundary | `cargo test --locked --offline -p quantos-execution --test service_l03_legacy` | 0 | [log](attempt-01/legacy-boundary.log) |
| legacy-unit | `cargo test --locked --offline -p quantos-execution --lib dual::tests::` | 0 | [log](attempt-01/legacy-unit.log) |
| clock | `cargo test --locked --offline -p quantos-execution --lib assisted::clock_tests::` | 0 | [log](attempt-01/clock.log) |
| native-refusal | `cargo test --locked --offline -p quantos-execution --test service_l03_native` | 0 | [log](attempt-01/native-refusal.log) |
| http-process | `cargo test --locked --offline -p execution-gateway --test service_l03_http` | 0 | [log](attempt-01/http-process.log) |
| l02-binary-impact | `cargo test --locked --offline -p execution-gateway --test l02_mtls` | 0 | [log](attempt-01/l02-binary-impact.log) |
| evidence-compile-only | `cargo test --locked --offline -p quantos-evidence --lib --no-run` | 0 | [log](attempt-01/evidence-compile-only.log) |
| gate-tests | `node --test --test-reporter=tap scripts/service-l03-review.test.mjs scripts/development-execution.test.mjs` | 0 | [log](attempt-01/gate-tests.log) |
| script-lint | `pnpm exec eslint scripts/service-l03-review.mjs scripts/service-l03-review.test.mjs` | 0 | [log](attempt-01/script-lint.log) |
| rust-lint | `cargo clippy --locked --offline -p quantos-execution -p execution-gateway --tests --no-deps -- -D warnings` | 0 | [log](attempt-01/rust-lint.log) |
| rust-format | `cargo fmt --check -p quantos-execution -p execution-gateway` | 0 | [log](attempt-01/rust-format.log) |
| plans | `node scripts/check-development-plans.mjs` | 0 | [log](attempt-01/plans.log) |
| integration-refusal | `node scripts/development-execution.mjs --integration SERVICE:L03` | 1 | [log](attempt-01/integration-refusal.log) |
| next-development | `node scripts/development-execution.mjs --development SERVICE:L04` | 0 | [log](attempt-01/next-development.log) |
| secret-scan | `node scripts/service-l03-review.mjs --scan docs/audit/evidence/service-l03-local-20261027/attempt-01` | 0 | [log](attempt-01/secret-scan.log) |

integration-refusal 预期退出 1，原因 STAGE_NOT_READY；这项通过表示拒绝边界成立，不是业务联调通过。quantos-evidence 仅编译；未运行其宽范围演练。Rust 共 28 项，Node 共 80 项，均无失败/忽略/跳过。fmt、严格 Clippy、ESLint、计划与任务差异秘密扫描符合预期；后者 0 findings、1 条精确公共值排除、2 条实际负例拒绝，不是全仓安全审计。

只读复核：`node scripts/service-l03-review.mjs --verify`；整个证据包：`node docs/audit/evidence/service-l03-local-20261027/verify.mjs`。输入变更后不能重用本回执，应新候选、新 attempt；证据提交不改绑历史源码。
