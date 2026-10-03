# R01 Binance REST 聚合成交接入验证报告

日期：2026-10-03。任务依据：用户采用 Binance 公共现货，并要求完成 REST 聚合成交接入、验证实时运行与断线补偿、生成 Git 提交。原 [2026-10-02 整改报告](./R01-remediation-validation-2026-10-02.md)保留历史结论，本报告记录新增交付。

## 一、任务完成概况

原生 `binance-rest` 命令、聚合成交身份/字段转换、实际 Supabase 原子页与持久游标、独立 transport watchdog、运行/恢复文档和目标 Gate 已实现。用户本次内部研发/真实链路验证授权已记录，原生 API 不需要账号或 API Key。没有启动本地 PostgreSQL、Supabase 或容器；向前应用 `20261003120000_r01_binance_cursor.sql`，无 schema reset。

真实公共行情与 loopback 故障注入分别执行，验证 scope 为本次具名 tenant/service actor；各脚本完成后停用自己的 actor，保留不可变事实。整体处于受控技术验证，不是已部署的长期服务；B01 的 native adapter/真实来源运行缺口已补齐，正式异常五秒 SLA、长期部署告警和商业使用许可仍未验收。R01 保持 FIX_VALIDATION，不改为 ACCEPTED。

## 二、完成情况明细

| 交付/验证 | 结果 | 实现与证据边界 |
|---|---|---|
| 公共网络入口、时间、标的与最小行情 | PASS | 实际 ping/time/BTCUSDT exchangeInfo/aggTrades 均 HTTP 200；[网络探测](./evidence/r01-binance-20261003/network-probe.json) |
| 原生聚合成交契约 | PASS | source ID=symbol:agg:a，p/q 字符串，T 毫秒→UTC；dataset 明确聚合语义；f/l/m 验证但未进入当前 tick hash/持久字段 |
| 原子页/持久游标 | PASS | expected-ID CAS + row lock；receipt、event/audit/outbox 与 next_id 同语句；任意页失败完整回滚，正确重试 |
| 重启与补偿 | PASS | 从持久 next_id 接续；实际停止进程期间来源继续产生成交，重启补回，验证整个选定窗口逐 ID 连续性 |
| 身份/结构/资源与授权拒绝 | PASS | 错序/gap/JSON、1MiB response、1000 row、配置范围、未知 symbol、无效 actor；不跳过来源 ID |
| HTTP 故障与健康 | PASS | fixture 503→恢复，429/418 停止请求不推进；独立线程/连接读取持久成功 poll，空响应为正常，fresh/stale/dedup 均有实际 DB 测试 |
| 重复与 F05 交付 | PASS | 真实已有事实再次投递无新增 tick；outbox/inbox/checkpoint 完成交付；不等同于 UI 投影或交易闭环 |
| 生产文件覆盖与行为 Gate | PASS | line≥90%、stable region≥85%、nightly branch≥85%，新增 binance.rs 全部纳入；真实编译 mutants 与相关 unit/CLI/target 自动测试 |
| 真实异常端到端≤5s、长期部署/告警、商用许可 | NOT ACCEPTED | 成功摄取与受控暂停补偿不是供应商异常 SLA；未执行长期部署及商业条款审核 |

当前新增交付的前八项通过（8/8）；正式 R01/B01 关闭条件仍有第九项，不能把开发完成率当作服务正式验收率。BTC/ETH 真实窗口的计数、连续性、延迟、duplicate、交付结果及二进制/源码 hash 见下列最终回执；所有成功/失败尝试的索引见 [证据目录](./evidence/r01-binance-20261003/index.json)。

| 最终真实源 | 窗口事实数 | ID/暂停补偿参考读回 | 重放新增 | outbox/inbox 完成 | 初始窗口 source-age P95 | 含补偿 source-age P95 |
|---|---:|---|---:|---:|---:|---:|
| BTCUSDT | 45 | PASS / PASS | 0（重放 3 条） | 72/72，pending=0 | 2.921s | 13.468s |
| ETHUSDT | 30 | PASS / PASS | 0（重放 3 条） | 51/51，pending=0 | 2.513s | 16.644s |

真实回执：[BTCUSDT](./evidence/r01-binance-20261003/verified-btc/receipt.json)、[ETHUSDT](./evidence/r01-binance-20261003/verified-eth/receipt.json)。source-age 从上游 T 到数据库 ingested_at 计算；ingested_at 是事务写入时间，**不等于 commit ACK 或消费终点**。这些小窗口 P95 不证明真实异常≤5s，也不外推长期生产 P95。停机及真实请求超时造成的补偿延迟保持原值。

补充只读验证确认 BTC/ETH 各两个事件流的 F05 checkpoint.last_sequence 等于实际事件流最大 sequence，测试 actor 均已停用：[BTC 检查点](./evidence/r01-binance-20261003/verified-btc/checkpoint-readback.json)、[ETH 检查点](./evidence/r01-binance-20261003/verified-eth/checkpoint-readback.json)。补充回执绑定原真实回执 SHA-256，保留原文件不覆盖。[时间探测](./evidence/r01-binance-20261003/clock-probe.json)三次 HTTP 样本的最小 RTT 为 482ms，中点估算偏移 +23ms、误差界 ±241ms；不是 NTP 同步或正式 SLA 证明。

| 生产文件 | stable line / region | nightly branch |
|---|---:|---:|
| crates/quantos-market/src/lib.rs | 96.15% / 95.77% | 85.83% |
| crates/quantos-market/src/durable.rs | 98.10% / 91.67% | 100.00% |
| services/market-ingestor/src/main.rs | 98.05% / 91.01% | 85.71% |
| services/market-ingestor/src/binance.rs | 96.15% / 92.49% | 97.06% |

最终 [stable target receipt](./evidence/r01-binance-20261003/verified-stable/receipt.json) 与 [nightly target receipt](./evidence/r01-binance-20261003/verified-nightly/receipt.json)对应相同最终生产/测试源码 hash。真实源回执还绑定实际执行二进制 SHA-256 和批准文件/记录 hash。执行时 HEAD 为基础提交、dirty=true；以源码 hash 绑定本次修复，不伪称已经执行远程最终提交验收。


覆盖率仅豁免 cli.rs 的 clap 生成声明（COV-R01-01），实际 handwritten main/binance/durable/market lib 按文件统计；stable branches count=0 表示未采集。采集前清理 LLVM profile，stable/nightly 顺序执行，不能混入旧二进制。

本地 `make r01-check`、相关 fmt/Clippy、quantos-event 回归、计划结构、secret-pattern 检查均通过。数据库 gated 用例在普通 cargo test 中 NOT RUN，仅目标脚本的实际执行计为 Supabase PASS。新依赖为零，cargo 全部使用 --locked。未推送/运行远程 CI，不声称 exact-SHA 远程验收。

额外调用仓库 Gitleaks Gate 时，本机未安装所要求的 8.28.0，记为 NOT RUN_TOOL_UNAVAILABLE（[日志](./evidence/r01-binance-20261003/gitleaks.log)）；secret-pattern 通过不替代完整 Gitleaks 扫描。

## 三、问题与风险分析

| 类型 | 本次发现/边界 | 处置与风险 |
|---|---|---|
| 共享目标连接池 | 旧 8-thread 并发回归以及一次新增测试遇到 session pool_size=15；其他旧 CLI 目标尝试瞬时失败 | 新旧测试释放闲置 store，数据库验证顺序执行；Binance 与旧 CLI 的最终五项目标用例通过。旧 8-thread 在释放闲置连接后再次执行仍报 EMAXCONNSESSION，完整 R01 target Gate 失败，保留 full-r01-target 日志；R01 CI 的目标矩阵和同工作流执行改为串行，未降低并发测试强度。未终止别人的会话、扩大池或改用本地数据库 |
| 测试作用域隔离 | 新旧 CLI 共用 tenant 导致旧 dispatch processed=4 断言受到新事件影响 | 单独创建 Binance 与旧 CLI 作用域；保留真实断言，未降低计数要求 |
| 延迟与数据积压 | 受控停止及网络超时导致补偿批次包含旧行情，延迟高于正常新成交 | 实际 event_time/received_at/processing_time 保留，生成 freshness 异常；回执单列初始运行和含补偿窗口延迟，不伪造五秒通过 |
| 进程与限流 | 进程停止时独立线程也停止；429/418 退出而非自动等待恢复 | supervisor 须检查进程存活并遵守 Retry-After；本次未部署此长期运维链路 |
| 许可与授权 | [用户授权记录](../provider-approvals/20261003-binance-public-evaluation.md)限本次内部技术评估，至 2026-10-10T00:00:00Z | 不是 Binance 商用/展示/再分发许可；扩展范围和持续生产使用前更新授权/条款审核 |
| 源语义与完整性 | 首次默认最新聚合成交起点；f/l/m 未持久化，非全历史/非逐笔撮合契约 | 已明确 dataset/窗口，缺 ID 不猜测跳过；需要历史、maker side 等研究字段时另扩契约 |

## 四、运行与后续建议

执行参数、恢复、上限和错误处理见 [Binance Runbook](../runbooks/r01_binance_rest.md)，技术决策见 [ADR](../adr/20261003-r01-binance-aggregate-trade-cursor.md)。原 JSONL poll-source 保留自有协议，不接原生 API；新增命令独立读取 QUANTOS_BINANCE_REST_BASE_URL，默认官方 base。

后续在实际部署环境验证正常稳态延迟、明确异常发生点→检测→持久提交→消费的时限；补 supervisor/采集与长期运行回执，并完成实际使用范围的授权审核。绑定正式提交 SHA 执行远程 Gate，独立复审后再关闭 B01；本次 REST 和受控真实补偿交付无需等待这部分未来验收才生成 Git 提交。
