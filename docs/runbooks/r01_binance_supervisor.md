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

`health.json` 原子更新，包含 supervisor/worker PID、ready、最后游标、退避、最新实际提交告警和失败代码，并记录监控查询起止与成功/超时状态；只有真实 inserted=true 的事件携带 event_id，去重结果另记 alert_duplicate。`supervisor.jsonl` 按大小轮转，trace 使用 worker-BTCUSDT、worker-ETHUSDT、dispatch 独立 sink，只在前一写者退出后轮转。exporter 的完整序列化记录受跨进程文件锁保护；读者取得共享锁，避免读取半条记录。日志不写环境变量、凭据或原始不可信 stderr。watch 失效后健康文件可能陈旧，外部采集应同时检查 checked_at 和进程存活，陈旧记录中的 ready=true 不能视为当前健康。

native 与 supervisor 保留独立检测能力；有成功响应检查点时共用 `watchdog:freshness:v2:<symbol>:<UTC checkpoint 毫秒>` durable identity 与相同 immutable payload。数据库唯一约束决定哪一方插入事实；producer 只在回执中记录，重复尝试不生成第二条事实。新进程/另一生产者仍通过数据库确认，进程内缓存只抑制已经确认的同一检查点重复尝试；旧两条历史事实不删除。监控读失败、worker 停止与 startup 仍为独立种类/起点。

有界验收配置可设置 `capture_commit_evidence: true`：单写者 `commit-evidence.jsonl` 保存完整页 ACK、watchdog/监督 ACK、时钟探测与生命周期，不受普通日志轮转影响。上限 128MiB，超限或日志持久化失败立即停止并记录失败，不能丢弃 ACK 后继续宣称验收完整。该选项默认关闭；窗口和受控故障验收脚本显式开启。

监控 cursor 的 query_timeout 仍为 2s。pg 客户端超时不取消后端正在执行的查询，复用它可能使新读排在旧查询后；超时后先关闭旧只读连接，再建立相同目标/身份的新连接，成功读取真实 cursor 才恢复 ready。旧连接结束事件不能使替代连接误失败；恢复失败/连续次数上限仍停止，未确认写入不重试。Supabase 受控 `SELECT pg_sleep(3)` 验证了超时、换连接、真实读回和告警 ACK，此注入仅存在于验收 harness，没有生产配置旁路。

告警 RPC 的确认超时为 5s（含 pg 连接队列），与异常验收的 origin→ACK≤5s 分开。回执保留 remaining_origin_budget_ms、confirmation_timeout_ms 和实际 elapsed；晚到 ACK 产生 `alert_sla_missed`，指标仍判超限。重启后旧检查点不能改成“现在”起点：保留原 origin，允许有界补写事实以恢复摄取，并记录历史超限。确认失败记录 `alert_commit_unconfirmed` 的 attempted_event_id、SQLSTATE/受控错误分类和 UNKNOWN，停止本次运行，不重试结果不明的写入，也不以 ingested_at 补造 ACK。native watchdog 的 detected_at 是 timer observed（读 cursor 前）；该字段与 tick 页 SQL 前的检测时钟分别解释。

监督 worker 使用 owned stdin 管道停止协议；收到 `stop\n`、EOF 或读失败后停止新轮询，完成在途页提交并输出 ACK，再退出。监督最多等待 15s，超时强制停止并记录 R01_WORKER_STOP_TIMEOUT，不能给出窗口通过；dispatcher 与待确认告警收尾另行有界处理。截止时间仍为 1800s，请求停止后的在途提交/清理不算扩展摄取窗口。该机制不提供主机死亡通知或 actor 外部清理验收。


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

## 2026-10-04：30 分钟扩大窗口

本轮用户明确选择 30 分钟。[新版授权记录](../provider-approvals/20261004-binance-window-evaluation.md)与[机器范围](../provider-approvals/20261004-binance-window-scope.json)只扩展内部有界评估，原到期日不变。provider 严格 JSON 使用 v2 引用；旧 v1 和 10 月 3 日回执保留。

```bash
# 每次使用一个空的新证据目录；直接连接现有 Supabase，不创建本地数据库。
QUANTOS_R01_POOL_MODE=transaction QUANTOS_R01_EVIDENCE_DIR=artifacts/r01-window \
  node --env-file=.env.local scripts/r01-window-check.cjs \
  --scope docs/provider-approvals/20261004-binance-window-scope.json
```

启动器在创建具名 tenant/service actor 前核验 scope/provider 版本、标的、用途、权限、期限和 1800 秒预算；运行中持续重读。监督配置只运行 BTCUSDT/ETHUSDT 两个原生 worker，100 次迭代正常轮换，poll 1000ms；不注入交易所或进程故障，不自动部署/注册系统服务。每 15 秒目标读回两个游标、tick/event/outbox 计数及健康状态，同时采集自身监督/worker 的 CPU、RSS；这些进程快照不是宿主机容量验收。

计时以 supervisor_started 至 supervisor_stopped 为准，须 ≥1800 秒，采样数不得少于理论周期的 90%；连接/构建和最终 drain 分开记录。若任意 source 致命错误、监督失败、范围/批准变更撤销、过期、资源护栏或提前退出，保存 failure 并停止本次进程，不能以累计多个短跑替代完整 30 分钟窗口。健康状态和新鲜度告警如实报告，不将“进程持续运行”解释为“全程数据质量正常”。

停机后核验每个 symbol 从 initial_id 至 next_id 的 receipt 数量与 min/max；唯一键加完整区间证明已确认窗口连续。F05 outbox/applied/checkpoint 必须一致且 pending=0；actor 停用并读回后才写 PASS 回执。immutable facts 保留。父启动器 SIGKILL/主机故障不能执行 finally，仍需外部进程管理和人工检查 owned-scope；本轮未验证此类目标部署故障。

修订后的采样采用从 supervisor.started_at 起的固定 15s deadline，记录 due_lag/missed_periods、health_read、cursor/count 查询起止和 sample_completed；查询完成后不重新起算 15s。到 1800s 截止立即请求停止，本次最后 drain 属收尾。sample 完成时 health 年龄超过 2s、时间戳缺失或未来值均使 effective_health.ready=false，raw health 原样保留。回执 `PASS_BOUNDED_INTEGRITY` 仅确认有界运行/投递/生命周期；新鲜度、readiness 点样本和自然 ACK 必须由独立指标报告判定，不能外推连续 uptime。

使用固定 Node/pnpm 入口复核本地 Gate：`node scripts/with-pinned-toolchain.cjs make r01-check`、`node scripts/with-pinned-toolchain.cjs pnpm check:development-plans`。它使用当前工程 Node 目录中的固定 pnpm shim，不修改全局工具链或 lockfile。

新窗口结束后执行只读 target readback，再执行 `node scripts/r01-window-metrics.cjs NEW_WINDOW/attempt-01 NEW_READBACK NEW_METRICS.json`。所有输出目录/文件必须新建；指标脚本核验压缩读回事实 hash 与 receipt 绑定、全部 event_id/ACK、分段计时和 trace，缺测或损坏会拒绝给出通过。旧专项脚本与历史 progress 上界证据保持原样。整改结果见 [整改报告](../audit/R01-freshness-remediation-2026-10-04.md)。

1800 秒是本次窗口的授权上限。24h、更多标的、对外展示/商用和长期生产均不在这份 scope 内。源码与原生二进制 hash 在启动/结束校验，后续提交必须匹配；本轮不重跑或继承旧回执为新的远程同 SHA CI。结果见 [扩大窗口报告](../audit/R01-window-validation-2026-10-04.md)。

## 既有窗口专项评估（不启动摄取）

[专项报告](../audit/R01-freshness-assessment-2026-10-04.md)分别统计 source-age、processing 到检测、自然告警提交观测、readiness 点样本及采样缺口。source-age 使用 received_at/event_time；检测 age 使用 detected_at/event_time；processing 到检测不包含 SQL/COMMIT。progress 日志在 ACK 后记录，含 stdout 调度，只能作为观测上界；数据库 now()/ingested_at 不是 ACK。监督 source 告警的 origin 是 last_response_at+freshness 阈值，monitor 告警 origin 是监控读开始，都不能冒充故障发生时刻。最终 pending=0 不能使这些指标通过。

只读目标导出使用现有 DATABASE_URL（不打印连接信息），BEGIN REPEATABLE READ READ ONLY 后仅 SELECT，并 ROLLBACK；原 actor 不激活。新导出按完整唯一键和真实 numeric sequence 分批取 500 行，保持同一快照；不能按输出 text 别名排序后用数字翻页，行数/ACK 不一致即拒绝通过。输出目录必须为空，失败留下 failure.json，后续尝试使用新目录。离线分析会验证原压缩/解压 hashes、tenant/actor、actor inactive 和导出完整性；输出文件不得覆盖。

```bash
QUANTOS_R01_POOL_MODE=transaction node --env-file=.env.local \
  scripts/r01-freshness-readback.cjs \
  docs/audit/evidence/r01-window-20261004 \
  artifacts/r01-freshness-readback-new-attempt

node scripts/r01-freshness-assessment.cjs \
  docs/audit/evidence/r01-window-20261004 \
  artifacts/r01-freshness-readback-new-attempt \
  artifacts/r01-freshness-assessment-new.json
```

上述历史窗口保留检测到 progress >5s、native ACK 缺测与 trace 坏行的原始证据。新实现补齐精确 ACK、独立 trace 与采样边界，但不能回写历史缺测；health 与 SQL 仍不是同一瞬间快照，实际新鲜度健康须独立判定。专项整改状态见上方整改报告。复跑摄取仍必须走上方固定 1800 秒 scope 启动器，有效批准、预算覆盖期限、新具名 actor/空证据目录；提前退出保留 failure，结束停止本次进程、停用 actor并实际读回，不删除/重建 Supabase。24h/部署须新的范围授权，不改旧批准到期日；Linux/systemd、父启动器/主机死亡通知、商用许可、远程同 SHA CI 继续 NOT RUN / NOT VERIFIED。

失败窗口可用 `scripts/r01-freshness-readback.cjs WINDOW_BASE NEW_READBACK --failed-window` 保存 READ ONLY 快照，再用 `scripts/r01-window-metrics.cjs WINDOW_BASE/attempt-01 NEW_READBACK NEW_METRICS.json --failed-window` 量化部分测量。状态始终为 FAIL_WINDOW_PARTIAL_MEASUREMENT；目标已提交但没有 ACK 的事件保留为 UNKNOWN，不能累计短跑或用后续成功覆盖失败。
