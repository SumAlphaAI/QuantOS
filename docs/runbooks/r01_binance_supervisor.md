# Binance 持续运行、异常提交与完整 R01 Gate

日期：2026-10-03。原生字段、窗口与游标契约沿用 [REST Runbook](./r01_binance_rest.md)。本轮实现独立前台监督进程 `scripts/binance-supervisor.cjs`；Node 使用工程已有固定版本 pg（已归为运行时依赖），无新增包或版本。本机与验收脚本均只连接工程配置的 Supabase。

## 配置与启动

使用工程已固定的 Node，执行 `pnpm install --frozen-lockfile` 和 `cargo build -p market-ingestor --locked`，部署时保留 pg 运行时依赖及其传递依赖。以下配置是模板，必须替换为获准 tenant、active service actor 和有效批准文件；配置文件不包含数据库凭据。

```json
{
  "schema": "quantos-binance-supervisor/v1",
  "tenant": "<existing-tenant-uuid>",
  "actor": "<active-service-actor-uuid>",
  "provider": "binance.spot.aggtrades",
  "approvals": "/absolute/path/approved-provider.json",
  "symbols": ["BTCUSDT", "ETHUSDT"],
  "log_dir": "/absolute/writable/quantos-market",
  "worker_iterations": 1000,
  "poll_ms": 1000,
  "max_failures": 5,
  "runtime_seconds": 0,
  "log_bytes": 1048576,
  "log_files": 5,
  "fixture": false
}
```

`runtime_seconds=0` 持续运行；1–86400 为有界运行。每个 worker 1–1000 次 poll 完成后正常轮换，由持久 next_id 接续。监督程序支持一个或两个已批准 symbol；SLA 验证模式要求批准文件 freshness_sla_secs 为 1–2，不能调大阈值隐藏失败。

```bash
# .env.local 仅由启动器注入。使用同一已配置 Supabase 的官方事务池时显式指定模式。
QUANTOS_R01_POOL_MODE=transaction node --env-file=.env.local \
  scripts/binance-supervisor.cjs --config /absolute/path/supervisor.json \
  --binary /absolute/path/market-ingestor
```

`QUANTOS_R01_POOL_MODE` 默认 configured，不改连接配置；transaction 只允许现有 `*.pooler.supabase.com:5432/6543`，将当前进程端口切至 6543，保留项目/身份/数据库/TLS。`.env.local`、其他服务和 Dashboard 池容量均不修改。[官方连接模式说明](https://supabase.com/docs/guides/database/connecting-to-postgres)区分 session 与 transaction；[超时说明](https://supabase.com/docs/guides/database/postgres/timeouts)要求注意 session 设置的适用范围。Rust 在事务池中用独立事务的 SET LOCAL 设置市场写入 deadline，保持无名 typed query；不会把全局 SET 留给其他客户端。

## 监督、异常与恢复

- 监督进程保持独立 watch 与 alert 数据库连接；原生 worker 的 writer/watchdog 两个连接仍保留。F05 dispatch 每次仅一个子进程。单 symbol 峰值约五条客户端连接，两个 symbol 约七条；事务池实际后端复用，仍需计入目标容量。
- 子进程异常退出产生 `market.source.worker_stopped`；结构/gap/资源/时间等致命来源错误产生 `market.source.quality_degraded`。watch 以持久成功响应为健康依据，worker 挂起/死亡后仍可生成 `market.source.freshness_degraded`。空成交响应正常；worker 无游标时记录启动阶段健康异常。
- watch 的一次读超时会使 ready=false，独立连接提交 `market.source.monitor_degraded`，只读请求有界重试，连续达到 max_failures 后熔断。写入结果不确定时停止，不自动重试该 append/commit；恢复后由持久 receipt/游标避免重复事实。
- 429/418 的 Retry-After 只接受完整非负整数秒（上限七天）；等待时长不缩短。无效/缺失/超范围值须人工处理，不猜测等待时间。其他可恢复源错误/worker signal 使用 1s 起步、最大 60s 的退避；有效页进度重置连续失败计数。
- 结构/gap、配置/批准错误、无效 actor、重启预算耗尽等以监督退出码 78 请求人工处理；外部 service manager 必须禁止自动重启该退出码。普通基础设施故障退出 1。正常 SIGTERM/SIGINT 或有界运行结束退出 0。
- 审批文件持续重读；过期/撤销停止 worker，不继续写未批准的来源事件。SIGTERM 停止本次直接创建的 worker，并允许当前 dispatcher 在二十秒 deadline 内完成；不扫描/终止其他任务进程。

`health.json` 原子更新，包含 supervisor/worker PID、ready、最后游标、退避、最新实际提交告警和失败代码；只有真实 inserted=true 的事件携带 event_id，去重结果另记 alert_duplicate。`supervisor.jsonl` 和共享 trace 按大小轮转，默认各保留五个历史文件；日志不写环境变量、凭据或原始不可信 stderr。watch 失效后健康文件可能陈旧，外部采集应同时检查 checked_at 和进程存活。

## 外部进程管理

[systemd 模板](../../deploy/systemd/quantos-binance-supervisor.service)用于 Linux 部署评审：设置真实安装路径、环境文件、运行用户、稳定 actor 和 `/var/lib/quantos-market` 配置后再部署。它使用 Restart=on-failure、30s 退避、五次启动限制、RestartPreventExitStatus=78 及进程组清理。本轮没有安装/启动该模板或执行 Linux 部署验收。

监督程序本身被杀、主机故障、数据库不可用或告警持久化失败不能靠其自身承诺五秒成功；需由独立 service manager/外部采集补充通知。退出 78 的服务应先修复批准/结构/游标问题再人工恢复。当前内部评估批准有效期至 2026-10-10T00:00:00Z，扩大用途或长期运行前更新批准范围。

## 验证命令与口径

```bash
make r01-check
QUANTOS_R01_POOL_MODE=transaction node --env-file=.env.local scripts/r01-live-check.cjs
QUANTOS_R01_POOL_MODE=transaction QUANTOS_R01_COVERAGE=1 \
  node --env-file=.env.local scripts/r01-live-check.cjs
node scripts/check-r01-coverage.mjs artifacts/r01/coverage.json
RUSTUP_TOOLCHAIN=nightly QUANTOS_R01_POOL_MODE=transaction QUANTOS_R01_COVERAGE=1 QUANTOS_R01_BRANCH=1 \
  node --env-file=.env.local scripts/r01-live-check.cjs
node scripts/check-r01-coverage.mjs artifacts/r01/coverage.json --require-branches
QUANTOS_R01_POOL_MODE=transaction node --env-file=.env.local scripts/r01-supervision-check.cjs
QUANTOS_R01_POOL_MODE=transaction node --env-file=.env.local scripts/r01-supervision-check.cjs --live
```

完整 Gate 保留八独立连接的 barrier 写入、全部旧断言、RLS/不可变 receipt、原子 rollback、重启和死信恢复；控制连接在测试期间释放。先准入全部八连接再启动线程，避免握手失败将其他线程滞留在 barrier。

监督 fixture 测试真实使用 Supabase 与原生进程，注入 503、超时、坏价格、陈旧数据、429、畸形 JSON；验证挂起/退出、退避、正常轮换、撤销、checkpoint。live 模式只访问官方 Binance，fixture=false，SIGSTOP/SIGKILL 仅作用于本次具名 worker；证明真实摄取进程故障与恢复，不冒充交易所真实事故。

五秒口径：受控故障发生/异常响应发送→监督 append ACK 或原生页 COMMIT ACK，且要求目标 event_id/异常事实读回。陈旧输入从到达时计检测时限，原始 T 保留；不能宣称其上游延迟低于五秒。各场景逐项按最大值判定，不用平均或 P95 掩盖超限。消费时限、正常行情 source-age 与异常提交时限分别记录。脚本创建自己的 tenant/actor，结束停用 actor、保留事实；结果索引及边界见 [本轮报告](../audit/R01-supervision-validation-2026-10-03.md)。
