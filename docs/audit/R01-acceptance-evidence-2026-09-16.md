# CORE:R01 验收证据（2026-09-16）

## 范围与基线

- 任务：`CORE:R01`
- 前置依赖：`F03=COMPLETED`、`F05=COMPLETED`
- 起始提交：`14a8576f3a83a9cf2dddf401913b456a13382df7`
- 起始工作树：clean
- 锁文件：`Cargo.lock`、`pnpm-lock.yaml`、`engines/uv.lock`、`apps/terminal-desktop/src-tauri/Cargo.lock` 均存在。
- 未使用生产/staging 凭据，未连接外部行情 provider，未部署或发布。

## 验收矩阵

| 标准 | 仓库证据 | 本地结果 | 目标环境 |
|---|---|---|---|
| 10 万条 replay 解析成功率 100% | 确定性 catalog、JSONL round-trip、batch ingestion test | PASS | NOT RUN / NO RECEIPT |
| 乱序/重复正确去重 | provider + source tick ID 去重；乱序/重复 fixture | PASS | NOT RUN / NO RECEIPT |
| symbol/时间/精度/来源/质量标准化 | 严格 symbol parser、UTC timestamp、Decimal、批准 provider metadata、quality enum | PASS | NOT RUN / NO RECEIPT |
| 只允许批准 provider | allowlist 与未知 provider fail-closed test | PASS | NOT RUN / NO RECEIPT |
| 异常五秒内发出 | 同步 anomaly emission wall-clock bound | PASS（本地） | NOT RUN / NO RECEIPT |
| 写 `MarketEvent` | `MarketEvent → RecordedEvent → AppendOnlyLedger` 与 correlation test | PASS | NOT RUN / NO RECEIPT |

## 命令与结果

```text
make r01-check
cargo fmt --all -- --check
cargo clippy -p quantos-market -p market-ingestor --all-targets -- -D warnings
cargo run -p market-ingestor -- generate-replay --output <temp>/market-replay.jsonl --count 100000
cargo run -p market-ingestor -- ingest-replay --input <temp>/market-replay.jsonl
bash scripts/check-lockfiles.sh
node scripts/check-secrets.mjs
node scripts/check-development-plans.mjs
git diff --check
```

结果：

- R01 Gate 与负向探针：`9/9 PASS`。
- `quantos-market`：`5/5 PASS`；100,000 tick 单测约 5.5 秒完成。
- CLI replay：生成并解析 `100000` 行；`unique=94737`、`duplicates=5263`、`market_events=96303`、`anomalies=1566`、`recorded_events=96303`。
- `market-ingestor` compile/test：PASS。
- rustfmt、clippy `-D warnings`、锁文件、secret-pattern、计划结构与 diff：PASS。

## Gate

- R01 仓库 Gate：`PASS`。
- 来源层开发验收：`PASS`。
- 真实 provider、broker、目标吞吐/延迟：`NOT RUN / NO RECEIPT`。
- GPT-6 Astra 功能复审：`NOT_STARTED`。

## 未决风险

1. allowlist 是仓库内参考配置，尚未验证生产配置治理和 provider 合同权限。
2. 10 万条 replay 验证解析与领域处理，不代表真实网络、broker backpressure 或生产吞吐。
3. 五秒 Gate 验证同步本地发出路径；跨进程投递延迟、告警消费与恢复仍需目标环境回执。
