# R01 摄取、拒绝与恢复 Runbook

## 配置

Supabase 连接使用现有 `DATABASE_URL`；本机不启动 PostgreSQL/Supabase 或容器。服务以受控 backend role 执行；配置的 `tenant` 与稳定 service `actor` 必须已存在且有效。读者/前端不能读来源回执或执行写入函数。

设置 `QUANTOS_TRACE_EXPORT_PATH` 为绝对可写路径；需要共享 health/ready/metrics/trace 端点时设置 `QUANTOS_OBSERVABILITY_ADDR=127.0.0.1:9090`，运维代理负责授权。业务日志输出 accepted/duplicates/rejected；质量、freshness、拒绝事实查询 MarketEvent/outbox，消费者投影延迟由 F05 metrics 记录。配置 exporter 的耐久卷、轮转与日志收集。

批准文件是 JSON array，字段见 `ApprovedProvider`，须由受控审批配置生成；`license_label` 本身不证明许可证。以 reference/version 指向真实审批记录；enabled=false 或 expires_at 到期阻止使用。标的 alias 必须显式映射到 BASE/QUOTE。不要将默认 replay 配置用于 live，也不要把样例占位审批引用改名后视为批准。

```json
[{
  "provider": "your-approved-provider",
  "dataset": "your-versioned-dataset",
  "license_label": "your-license-label",
  "approval_reference": "your-controlled-approval-record",
  "approval_version": "v1",
  "expires_at": "2099-01-01T00:00:00Z",
  "enabled": false,
  "instruments": {"BTCUSDT":"BTC/USDT","BTC/USDT":"BTC/USDT"},
  "freshness_sla_secs": 2,
  "max_future_skew_secs": 2
}]
```

此样例故意 disabled。批准文件、tenant、actor 用参数给出；URL 从 `QUANTOS_MARKET_SOURCE_URL` 读取，包含连接秘密时只保存在环境配置中。adapter 输出 RawMarketTick JSONL（provider/source_tick_id/provider_symbol/event_time/received_at/price/volume），数值为字符串，时间为 RFC3339。原生交易所协议必须先经获准 adapter 转换，不能直接把不兼容 API 填成 URL。

## 执行

```bash
export QUANTOS_TRACE_EXPORT_PATH=/private/tmp/quantos-market-traces.jsonl
cargo run -p market-ingestor --locked -- generate-replay --output /private/tmp/market-replay.jsonl --count 100000
cargo run -p market-ingestor --locked -- ingest-replay --input /private/tmp/market-replay.jsonl
# 以下占位参数必须替换为已配置值；凭据只从环境读取。
cargo run -p market-ingestor --locked -- ingest-source --input /path/source.jsonl --approvals /path/approvals.json --provider your-approved-provider --tenant '<tenant-uuid>' --actor '<service-actor-uuid>'
cargo run -p market-ingestor --locked -- poll-source --approvals /path/approvals.json --provider your-approved-provider --tenant '<tenant-uuid>' --actor '<service-actor-uuid>' --iterations 1000
cargo run -p market-ingestor --locked -- dispatch --tenant '<tenant-uuid>' --consumer market-facts-v2
```

source input 为至少一次交付：故障后重新提交完整未确认窗口，不用网络进程内游标跳过数据。supplied processing timestamp 仅在 `--fixture` 下用于历史数据验证；fixture 不能计入真实供应商验收。服务进程由部署 supervisor 重启，按同一稳定 tenant/actor 和批准配置恢复；receipt、序号、消费者 checkpoint 均在 PostgreSQL。

## 故障处理

- `MARKET_SOURCE_CONFLICT`：保留原事实，来源更正需新 ID；查询 source.quality_failed 的 frame hash/reason，回查获准来源的原始记录，不能删除 receipt 强行覆盖。
- 数值非法/非正/超精度：产生 Failed/QualityFailed；后续 tick 继续。身份或 JSON 错误隔离为 source.quality_failed，原文不进日志。
- 写入失败、锁 timeout、权限或 actor 失效：不得确认来源；完整重试，已提交内容会 duplicate，失败事务不留 source receipt。
- 断流/源错误：watchdog 恢复最近 tick commit，产生 source.freshness_degraded；检查 source、新鲜度事件、outbox backlog 和共享 readiness。重启不会抹掉断流状态。
- 死信：先修复 handler/数据权限，核对 dead_letter ID、租户与操作 actor，然后执行下述命令；F05 会一起恢复同事件的 inbox/outbox 并记录审计。

```bash
cargo run -p market-ingestor --locked -- requeue --tenant '<tenant-uuid>' --actor '<authorized-service-actor-uuid>' --dead-letter '<dead-letter-uuid>'
```

资源上限不是接受吞吐目标：拆分超限文件、暂停源并修复过大 frame，不能通过关闭限制或创建无限内存缓存解决。

## 部署、回滚、验证

部署先以 `node scripts/db-cli.cjs apply` 对配置的 Supabase 应用向前 migration，再部署 v2 service/consumer。不要 reset 目标 schema。回滚先停止摄取，保持 outbox/inbox 和不可变回执，保留 v2 兼容消费者；禁止删事实或降为 v1 进程内去重。

```bash
make r01-check
# node --env-file 读取现有配置，不打印变量值。
# 三次运行各用一个全新目录；mktemp 避免默认 artifacts/r01 已非空而拒绝。
r01_functional_dir=$(mktemp -d /private/tmp/quantos-r01-functional.XXXXXX)
QUANTOS_R01_EVIDENCE_DIR="$r01_functional_dir" node --env-file=.env.local scripts/r01-live-check.cjs
r01_stable_dir=$(mktemp -d /private/tmp/quantos-r01-stable.XXXXXX)
QUANTOS_R01_EVIDENCE_DIR="$r01_stable_dir" QUANTOS_R01_COVERAGE=1 node --env-file=.env.local scripts/r01-live-check.cjs
node scripts/check-r01-coverage.mjs "$r01_stable_dir/coverage.json"
r01_nightly_dir=$(mktemp -d /private/tmp/quantos-r01-nightly.XXXXXX)
RUSTUP_TOOLCHAIN=nightly QUANTOS_R01_EVIDENCE_DIR="$r01_nightly_dir" QUANTOS_R01_BRANCH=1 QUANTOS_R01_COVERAGE=1 node --env-file=.env.local scripts/r01-live-check.cjs
node scripts/check-r01-coverage.mjs "$r01_nightly_dir/coverage.json" --require-branches
```

目标 Gate 只创建具名 r01-check fixture 租户/actor，账本事实保留，结束停用本次 actor。不要删除 append-only 验收数据。真实 provider、许可证、source 断连补偿及部署端告警还需要独立回执；没有参数/批准记录时明确 NOT RUN，而不是复用 fixture PASS。

以上是独立验收入口，按变更影响选用，并非每次文档调整都需执行三轮。完成后把所需目录归档到本次审计证据，保留失败及 actor-cleanup 回执；不要清空旧目录后把重试伪装成首次通过。若需使用配置项目的 transaction pool，显式设置 `QUANTOS_R01_POOL_MODE=transaction`，不更换项目或凭据。
