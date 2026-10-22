# 执行命令与范围

- `node --test scripts/manual-database-policy.test.cjs scripts/f05-gate-negative.mjs scripts/f05-coverage.test.mjs scripts/f07-target-service.test.cjs scripts/fep0-development.test.mjs scripts/provider-a1-receipts.test.mjs`：最终 124 PASS。
- `make f05-check`：读取当前 .env.local，模块 DB 开关未启用，离线功能和门禁检查通过。
- `DATABASE_URL=invalid QUANTOS_RUN_F05_POSTGRES_TESTS=0 QUANTOS_F07_DB_REQUIRED=0 ... cargo test --locked --offline -p quantos-event -p quantos-storage -p quantos-runtime -p runtime-gateway --lib --bins --test postgres_persistence --test storage_http --test postgres_runtime -- --test-threads=1 --nocapture`：第一次 HTTP bind EPERM，取得沙箱外 HTTP stub 监听权限后成功。真实 DB 用例 NOT_RUN；无效连接串用于验证无隐式连接。
- `DATABASE_URL=invalid ... cargo test --offline --locked -p quantos-auth --test postgres_auth_context -p quantos-portfolio --test postgres_portfolio -- --nocapture`：模块开关为 0，验证不会隐式连接。
- `DATABASE_URL=invalid QUANTOS_RUN_F05_POSTGRES_TESTS=0 QUANTOS_RUN_R02_POSTGRES_TESTS=0 cargo test --offline --locked -p quantos-storage --test storage_http -- --nocapture`：最后调整后 4 PASS；仅离线 HTTP stub。
- `DATABASE_URL=invalid QUANTOS_RUN_PORTFOLIO_POSTGRES_TESTS=0 QUANTOS_RUN_F09_POSTGRES_TESTS=0 QUANTOS_RUN_X01_POSTGRES_TESTS=0 cargo test --offline --locked -p quantos-portfolio --test postgres_portfolio -- --nocapture`：最后调整后开关防护通过；真实数据库 NOT_RUN。
- `QUANTOS_HYGIENE_POSTGRES_TESTS=1 node --test scripts/database-hygiene-postgres.test.cjs`：当前 Supabase，TLS verify-full，TEMP 表、实际生产 SQL、回滚；1 PASS。
- `node scripts/database-hygiene.cjs`：当前 Supabase 只读；业务 schema 未初始化，不删除业务数据。
- `cargo clippy --locked --offline -p quantos-event -p quantos-storage -p quantos-runtime -p runtime-gateway -p quantos-auth -p quantos-portfolio --all-targets -- -D warnings`、`cargo fmt --all -- --check`、变更 JS 的 `node --check`、`node scripts/check-development-plans.mjs`、`git diff --check`：PASS。
- `GITLEAKS_BIN=artifacts/tools/gitleaks bash scripts/check-secrets.sh`：PASS；另以暂存 diff 经 stdin 扫描。
- `gh secret list --repo SumAlphaAI/QuantOS --json name,updatedAt`：只读核对现有三个 secret 为九月更新时间。更新这三个 secrets 的动作在进程创建前被自动审查拒绝，未发送值；完整 F05/F07 campaign、迁移/reset、远端 workflow dispatch 和 push 均 NOT_RUN。

Node 使用 24.12.0，CARGO_BUILD_JOBS=1。源文件摘要见 source-inputs.json；sourceState 是提交前实际工作树，不将检查冒充干净旧 SHA 的数据库验收。
