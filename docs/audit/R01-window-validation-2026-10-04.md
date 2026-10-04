# R01 扩大运行窗口与授权范围验证报告

日期：2026-10-04。对应用户“扩大运行窗口，明确授权范围，生成独立 Git 提交”，窗口明确选择 30 分钟。历史 [监督验证](./R01-supervision-validation-2026-10-03.md)与 v1 批准原样保留。

## 一、任务完成概况

本轮新增 [v2 内部评估授权](../provider-approvals/20261004-binance-window-evaluation.md)、严格 provider JSON 和独立 machine scope；有界启动器以同一已配置 Supabase 事务池、官方 Binance 实际公共数据、两个原生 symbol worker 执行 30 分钟窗口，fixture=false。范围仅涵盖 BTCUSDT/ETHUSDT 内部技术评估、market 事实与 F05 消费；不扩大为交易、客户展示、再分发、商用或长期生产权限，也不延长 2026-10-10T00:00:00Z 到期日。

已完成一段独立真实 30 分钟窗口：监督从 `2026-10-04T01:17:42.306Z` 至 `2026-10-04T01:47:43.779Z`，实际 1801.473 秒（北京时间 09:17:42.306–09:47:43.779，含正常停机收尾），记录 115 个样本。两个标的合计 6243 个唯一来源成交；正常 worker 轮换、完整 ID 窗口、F05 对齐和 actor 停用均通过。过程存在频繁新鲜度降级及 readiness 波动，因此此 PASS 只表示本轮有界窗口/完整性检查通过，不表示全程健康或整个 R01 验收。

本轮功能 3/3 完成：扩大有界窗口、明确可核验授权、归档并独立提交。R01 历史问题仍为 9/10 关闭，B01 OPEN/PARTIAL。

## 二、完成情况明细统计

| 检查 | 实际结果 | 口径 |
|---|---|---|
| 授权/范围负向检查 | 24/24 Node 检查通过 | 固定窗口/标的/用途/权限/资源护栏；版本、撤销与过期 fail closed |
| 单窗口运行 | PASS | ≥1800 秒；不累加失败短跑 |
| 来源/环境 | PASS | Binance 官方公共 REST，fixture=false，同一配置 Supabase 事务池 |
| 数据窗口与轮换 | PASS | 两标的 initial_id/next_id 与唯一 receipt count/min/max 对齐；各至少一次正常轮换 |
| 消费与 checkpoint | PASS | 停机后的 pending=0，outbox=applied，全部流 checkpoint 与 event 最大序号一致 |
| 生命周期 | PASS | 最终无本次 worker PID、ready=false；actor 停用并实际读回 |
| 本轮新故障注入/五秒 SLA | NOT RUN | 本轮为自然运行观测；不继承旧故障回执为新提交验收 |
| 24h、Linux 部署、外部父进程死亡通知、商用许可、远程 CI | NOT RUN / NOT VERIFIED | B01 保持 PARTIAL |

| 标的 | initial_id | next_id | 唯一成交数 | 正常退出 / starts |
|---|---:|---:|---:|---|
| BTCUSDT | 4080258040 | 4080261952 | 3912 | 5 / 6 |
| ETHUSDT | 2094300171 | 2094302502 | 2331 | 5 / 6 |

F05 outbox/applied：11195/11195，pending=0；checkpoint 流数 3。

采样 ready=35/115（30.43%），最高采样 pending=307；单进程最高观察 RSS=76784 KiB、CPU=4.3%。不把采样比例写成 uptime、不外推宿主机容量。

监督 source 告警提交 1172 次，配置 freshness threshold 后的最大 ACK 延迟 2558ms，仅作自然阈值观测，不能替代从故障发生计时的五秒验收。目标 event_kind 分布如下：

| 异常种类 | 事件数 |
|---|---:|
| market.source.freshness_degraded | 2327 |
| market.source.monitor_degraded | 2 |
| market.tick.freshness_degraded | 2623 |

开始/结束时间来自监督生命周期日志，连接、构建、最终 drain/actor cleanup 不并入运行目标。各 attempt 独立，不将短跑累加成三十分钟。健康与资源数据为十五秒间隔加实际数据库查询耗时的采样快照；样本比例不能等同墙钟 uptime/SLA。CPU/RSS 仅限具名监督/worker，本机没有本地 PostgreSQL、Docker 或 Supabase 服务。

## 三、问题清单与风险分析

| 优先级 | 模块/表现 | 影响与处理 |
|---|---|---|
| 高危 | 真实窗口新鲜度/readiness | ready 采样 30.43%，2623/6243（42.02%）tick 带 freshness 降级，存在频繁 source freshness 告警；持续运行不代表满足全程健康。下一步应分析源响应/写入/轮换耗时与批准阈值，不能隐藏告警或直接放宽五秒故障标准 |
| 中危 | F05 运行期积压 | 最高采样 pending 307，最终归零；证明窗口完整性，不证明每事件消费时延或 Web 投影业务 SLA |
| 中危 | 授权期限/商用边界 | 到期未延长，新增 v2 仅本轮内部评估；更多标的、24h 或外部用途需另行批准 |
| 低危 | 父启动器/主机死亡 | finally 无法处理 SIGKILL/主机掉线；本次有界结束与 actor 清理通过，外部故障通知/部署仍未验收 |
| 低危 | 样本与时间范围 | 查询耗时影响采样周期，CPU/RSS 是单进程快照；24h 稳定性、资源长期趋势和远程同 SHA 尚无回执 |


新来源范围校验由本轮启动器持续执行；原生 worker 继续按严格 provider 契约重读批准。仅新增 Node 启动器与范围/文档，不修改旧 supervisor 或 Rust 行情实现。旧 stable/nightly/故障回执是历史证据，不冒充新提交的远程同 SHA CI，也不由无故障窗口推导新增五秒故障注入验收。启动器在窗口两端核对 sourceHashes 与运行二进制 binarySha256；提交后核对源码 blob，二进制为本轮固定源码的构建结果，不作为 Git blob 保存。

## 四、整改建议

1. 对实际新鲜度、readiness、自然告警与采样缺口单独评估，保持 processing/source-age/异常提交时限的不同含义；不能以数据写入持续或 pending=0 掩盖新鲜度降级。
2. 24 小时或部署环境评估须新范围授权；当前 scope 固定 1800 秒，两标的及原用途，不在到期后自动延长。Linux/systemd、父启动器/主机死亡通知、商用许可、远程同 SHA CI 仍待验收，B01 保持 OPEN/PARTIAL。
3. 仅在有效批准与具名 actor 下复跑，使用空的新证据目录；提前退出保留 failure，结束停止本次进程并停用 actor。不可变事实保留，不删除/重建现有 Supabase。
4. [证据目录](./evidence/r01-window-20261004/README.md)与最终 index 联合复核；命令/范围和退出条件见[运行指南](../runbooks/r01_binance_supervisor.md)。

补充周期观测：BTCUSDT/ETHUSDT 的页提交 progress 间隔（含正常轮换）中位数分别 2866ms / 2859ms，P95 分别 3972ms / 4030ms。它是整个 polling/请求/数据库/正常轮换周期，不是独立 HTTP 或 SQL 耗时；相对于批准 freshness=2s 的频繁降级已有量化依据，尚不能归因到某一环节。
