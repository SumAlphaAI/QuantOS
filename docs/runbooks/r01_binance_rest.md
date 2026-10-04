# Binance Spot REST 聚合成交接入与补偿

日期：2026-10-03。接口依据：[官方 Market Data Only](https://developers.binance.com/en/docs/products/spot/faqs/market_data_only)、[aggTrades 参数/字段](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market)。无需注册或 API Key。本命令不会交易、访问账户或提现。

## 数据契约与配置

`binance-rest` 是新增的原生 REST 命令；与接收 JSONL 的 `poll-source` 分开。默认 base `https://data-api.binance.vision/`；实际支持环境变量 `QUANTOS_BINANCE_REST_BASE_URL`，只允许该 HTTPS 官方域名/443/root path，不允许 userinfo、query、fragment 或重定向。回环 HTTP 仅用于显式 `--fixture` 测试。不要把 Binance 原生 URL 填入 `QUANTOS_MARKET_SOURCE_URL`。

- provider=`binance.spot.aggtrades`，dataset=`binance.spot.aggregate-trades.v1`；聚合数量不能当作单笔撮合数量。
- source identity=`<原始symbol>:agg:<a>`；a 是聚合成交 ID，各 symbol 独立游标。
- p/q 保持原始 decimal 字符串，映射 price/volume；T 固定毫秒→UTC event_time；received_at 为 HTTP 响应收到时的实际时钟，processing_time 为本次处理时钟。
- f/l/m 为解析验证的上游元数据，不属于当前 RawMarketTick 的 hash 或持久字段；持久合同覆盖 provider/ID/symbol/T/p/q，若研究需 maker/撮合范围须扩展契约，不能声称已保留这些字段。
- response ≤1MiB、page≤1000；要求 ID 顺序连续，出现 gap/结构错误/冲突不跳过，不推进游标。

使用现有 DATABASE_URL，仅连接 Supabase。批准文件、tenant、actor 用 CLI 参数；必须配置绝对可写 `QUANTOS_TRACE_EXPORT_PATH`。本次用户批准的内部技术评估文件是 [受控 JSON](../provider-approvals/20261003-binance-public-evaluation.json)，授权范围和到期日期见[记录](../provider-approvals/20261003-binance-public-evaluation.md)。有效期至 2026-10-10T00:00:00Z，不能当作商用/再分发许可或长期生产批准。

```bash
# 启动器应已安全加载 .env.local 的 DATABASE_URL；不在命令行写凭据。
export QUANTOS_TRACE_EXPORT_PATH=/private/tmp/quantos-binance-trace.jsonl
export QUANTOS_BINANCE_REST_BASE_URL=https://data-api.binance.vision/
cargo run -p market-ingestor --locked -- binance-rest \
  --approvals docs/provider-approvals/20261003-binance-public-evaluation.json \
  --tenant '<existing-tenant-uuid>' --actor '<active-service-actor-uuid>' \
  --symbol BTCUSDT --iterations 10 --limit 1000 --poll-ms 1000
```

首次没有游标时，从当前最新一条聚合成交开始定义验证窗口；不是全历史回填。需要固定历史窗口时只在首次加 `--from-id <id>`。已有游标优先恢复，禁止以不同 `--from-id` 重置它；重启正常省略该参数。ETHUSDT 另启动同样命令，使用独立 symbol 游标。

## 原子性、断线和运行边界

`quantos.binance_ingestion_cursor` 与全部 receipt/event/audit/outbox 在单 SQL 函数内提交。CAS 校验 expected_id，行锁串行化并发页；任意事件失败使整页回滚。来源分页 fromId 为包含式起点；提交成功后下一页从 next_id 开始。第二 worker 读到旧游标会拒绝并重启重读，不静默跳页。

HTTP timeout 3s；网络/HTTP 失败在本轮保留游标，后续轮次重试；最后一轮仍失败时退出非零。迭代 1–1000，poll-ms 1000–60000；完整响应中的连续已确认窗口才推进游标。数据积压不会回填/伪造 received_at 或隐藏 freshness 异常。

2026-10-04 修订：poll-ms 是轮询轮次开始之间的最小间隔，每轮包括批准重载、HTTP、解码、领域处理与提交；已超过该间隔时，不再额外等待一个完整 poll-ms。实际 HTTP 请求起点另行记录，批准重载耗时可使请求间隔产生微小偏移。启动从数据库载入 next_id，只有原子页提交 ACK 返回的 next_id 才能用于下一请求；并发 cursor 冲突、结果不明或写入失败仍停止，重启再读持久 cursor。没有跳过 source ID、追赶到最新成交或放宽 freshness=2s。

页 JSON 回执 `binance_page_committed` 包含 symbol、next_id、逐事件 event_id、event/received/detected 时间，及 HTTP headers/body/decode、领域 build、BEGIN/SET LOCAL/SQL/COMMIT/total 的 monotonic 毫秒。`write.commit_ack_at` 是客户端确认提交后的 UTC，`ingested_at` 或 progress 均不能替代。正常显式事务保留本地 statement/lock timeout；隐式路径 SQL 时间包含隐式提交，commit_ms=0 不能解释为没有提交成本。无成交页同样保留请求和持久 heartbeat 测量。

每次真实 worker 启动读取相同获准官方 endpoint 的 `/api/v3/time`，输出 `binance_clock_observation`；按请求本机起止与 serverTime 给出 RTT 偏移上下界，失败标记 UNMEASURED。该探测不校正原始时间、阈值或证明双方 NTP 同步。官方接口支持说明见 [market data only](https://github.com/binance/binance-spot-api-docs/blob/master/faqs/market_data_only.md?plain=1) 与 [REST server time](https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md?plain=1)。

独立 watchdog 使用另一条受限数据库连接/250ms timer，读取持久 last_response_at；成功且无成交也刷新 health，避免把正常无交易误判断网。进程停止时 timer 同样停止，必须由 supervisor 的进程存活检查补充告警；恢复时持久 last_response 状态不会清空。

429/418 立即停止请求，保留游标，输出有界 Retry-After 秒数。运维至少等待该时长（没有有效值则检查官方限制后恢复），不能让 supervisor 紧循环重启；原生命令将限流交给外部监督程序；[持续运行监督](./r01_binance_supervisor.md)按有效 Retry-After 等待后恢复，缺失/无效值退出 78 请求人工处理。其他暂时 HTTP/网络错误按配置 poll-ms 重试。数据库失败、schema/gap、审批失效则停止并检查根因；不要跳过 ID 或删 receipt 强行修复。

进程由 supervisor 重启，持续运行需要指定稳定 tenant/actor、日志持久化/轮转及受控网络。命令有界迭代完成后再启动会从数据库接续；不是已经部署的常驻服务。每个原生 worker 使用 writer/watchdog 两条 Supabase 客户端连接，部署并发数应计入共享 pool 容量。当前监督程序与事务池使用方式见[持续运行 Runbook](./r01_binance_supervisor.md)。

```bash
# F05 消费事实、推进 checkpoint；不是 Web 行情投影或交易执行。
cargo run -p market-ingestor --locked -- dispatch --tenant '<tenant-uuid>' --consumer binance-market-facts-v1 --limit 1000
```

## 检查与实际回执

```bash
make r01-check
node --env-file=.env.local scripts/r01-binance-target-check.cjs
# 独立真实源验证：创建具名作用域，运行真实 BTCUSDT、停止3s、重启补偿、重复重放与 dispatch。
node --env-file=.env.local scripts/r01-binance-live-check.cjs
QUANTOS_BINANCE_VALIDATION_SYMBOL=ETHUSDT node --env-file=.env.local scripts/r01-binance-live-check.cjs
# 覆盖：stable/nightly 顺序执行（共享 LLVM profile 不能并发清理/采集）。
QUANTOS_R01_COVERAGE=1 node --env-file=.env.local scripts/r01-binance-target-check.cjs
node scripts/check-r01-coverage.mjs artifacts/r01-binance/coverage.json
RUSTUP_TOOLCHAIN=nightly QUANTOS_R01_COVERAGE=1 QUANTOS_R01_BRANCH=1 node --env-file=.env.local scripts/r01-binance-target-check.cjs
node scripts/check-r01-coverage.mjs artifacts/r01-binance/coverage.json --require-branches
```

真实验证脚本先执行 `cargo build -p market-ingestor --locked` 并绑定二进制 hash；覆盖与验证 Gate 绑定生产源码 hash；R01 CI 的目标矩阵和同工作流执行串行，其他服务也应按共享池容量协调。脚本仅停用本次创建的 actor，保留不可变事实，不删除/重建数据。不将 loopback fixture 的故障注入声称为 Binance 实际事故；停止进程是受控断连补偿，非供应商 SLA 测试。结果见[本次接入验证报告](../audit/R01-binance-rest-validation-2026-10-03.md)。

上述专用 target 覆盖 Binance、新旧 CLI 和相关 unit；完整旧 R01 target 仍使用 `node --env-file=.env.local scripts/r01-live-check.cjs`，保留八线程竞争用例。初次接入时完整 Gate 在共享 Supabase session pool_size=15 下失败，历史回执保留。随后使用同一项目的官方事务池显式重跑完整 Gate，保留八并发；最终覆盖与持续运行结果见[后续验证报告](../audit/R01-supervision-validation-2026-10-03.md)，不以专用 Gate 替代。
