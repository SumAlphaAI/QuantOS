# R01 复审证据复现

源码 SHA：`296ffc2f1b98e6266a3a83e4716b8f6b99ecfa16`。

`boundary_probes.rs` 断言审计时观察到的缺陷。测试成功代表复现问题，不代表满足验收；修复后应改写为正确行为断言。本次覆盖率先于临时探针接线采集，只运行原有 5 个领域单测；后续独立 CLI 执行不计入覆盖率。

在仓库根目录、确认下列临时文件不存在后执行；不需要数据库或 provider 连接：

```bash
mkdir -p crates/quantos-market/tests
test ! -e crates/quantos-market/tests/r01_audit_boundary.rs
cp docs/audit/evidence/r01-review-20261002/boundary_probes.rs crates/quantos-market/tests/r01_audit_boundary.rs
trap 'rm -f crates/quantos-market/tests/r01_audit_boundary.rs' EXIT
cargo test -p quantos-market --locked --test r01_audit_boundary
```

主 Gate 与覆盖率：

```bash
make r01-check
cargo llvm-cov -p quantos-market -p market-ingestor --locked --json --summary-only --output-path /private/tmp/r01-coverage.json
```

CLI：

```bash
export QUANTOS_TRACE_EXPORT_PATH=/private/tmp/r01-audit-trace.jsonl
cargo run -p market-ingestor --locked -- generate-replay --output /private/tmp/r01-audit-replay.jsonl --count 100000
cargo run -p market-ingestor --locked -- ingest-replay --input /private/tmp/r01-audit-replay.jsonl
```

预期：input=100000、unique=94737、duplicates=5263、market_events=96303、anomalies=1566、recorded_events=96303。correlation ID 每次生成，不能作为确定性比较项。

锁检查使用临时 uv cache，并以临时 PATH wrapper 调用 `corepack pnpm`，得到项目指定 10.20.0；保留三次日志说明环境诊断。最终退出 0，但 npm 更新元数据查询因 DNS 不可用未成功。

没有执行数据库 migration、reset、RLS、真实 provider 或目标环境时限测试。`index.json` 保存统计口径与日志哈希。
