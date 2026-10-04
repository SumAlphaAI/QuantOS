# R01 新鲜度专项整改验证报告

日期：2026-10-04。依据[专项报告](./R01-freshness-assessment-2026-10-04.md)逐项整改。代码基线 `e4d2cfdd26f8a7b01838dce7bc1ccff67648d361`；本轮在修复工作区执行，回执保留 workingTreeModified=true 与逐文件 SHA256，最终提交以 blob/hash 绑定这些运行源码。没有把工作区回执改写成远程同 SHA CI。

## 一、任务完成概况

本轮完成 6/6 项可实施的摄取、ACK/分段、trace、告警身份、采样消费与时钟诊断整改，以及后续发现的 RPC/SLA 混用、在途页停止与读超时后复用旧连接排队问题。7 项专项问题严格关闭 **5/7=71.43%**；B01 与实际新鲜度健康仍保留，R01 **FIX_VALIDATION**，不能认定 ACCEPTED。

最终新窗口 `live-recovered/attempt-01` 为 `2026-10-04T05:20:36.863Z–2026-10-04T05:50:39.740Z`，授权摄取预算仍为 1800s，实际停止收尾 1802.877s；不是自动延长摄取。两标的 BTCUSDT/ETHUSDT、现有 Supabase、内部工程用途、poll=1000ms、v2+scope 与 `2026-10-10T00:00:00Z` 到期日均未改变。新空目录、新具名 actor，结束停用并只读确认；不可变事实保留，没有本地数据库、Docker、Supabase 重建或 reset。

最终窗口 **PASS_BOUNDED_INTEGRITY**，成交 8530，新鲜度降级 714（8.37%）；effective ready 109/120（90.833% 点样本）。自然提交独立判定为 **PASS_MEASURED_ORIGINS_LE_5S**，实际新鲜度仍 **DEGRADED**。持续写入、完整 ID 区间、pending=0 只确认完整性，不能覆盖降级或告警时限失败。

前三次自然失败与主动中止均保留，**没有累计短跑、删除失败或用最后的完整窗口覆盖前次失败**。24h、Linux/systemd、父启动器/主机死亡外部通知、商用许可及远程同 SHA CI 仍未验收。

## 二、完成情况明细统计

| 检查项 | 最终结果 | 证据边界 |
|---|---|---|
| 本地 R01 Gate | 42 Node、13 领域、5 native unit、3 Binance CLI、2 旧 CLI 通过；2 项编译 mutation 均被拒绝 | `r01-check-last-final.log`，不是目标验收替代 |
| observability | 19/19；六进程共写 360 条长 JSONL 均完整 | `observability-tests-unsandboxed.log`；初始 sandbox socket 失败保留 |
| Supabase stable/nightly | 各 24 个 test 通过，完整八写者 barrier、RLS/immutable、迁移 hash 与 actor 清理通过 | 最终 `target-stable-attempt-07 / target-nightly-attempt-05`；未降低并发或用模拟数据库替代 |
| 覆盖 Gate | 四个关键文件 line≥90%、region≥85%；nightly branch≥85% | adapter 最终 line 94.87%、branch 89.80%；完整 JSON/验证日志归档 |
| 受控异常与恢复 | 16/16，异常最大 2298ms；fault→ACK≤5000ms 按每项最大值判定 | `supervision-attempt-09`，含暂停/死亡/限流/恢复/在途页优雅停机；fixture 与真实窗口分开 |
| 最终有界窗口 | 120 样本，完整区间与正常轮换通过 | `live-recovered/attempt-01/receipt.json`，只声明 BOUNDED_INTEGRITY |
| 精确 ACK 关联 | 9461/9461 target event_id，tick 字段与源检测/阈值时钟逐项匹配 | 没有以 progress、ingested_at 或 now() 补造 ACK |
| 自然 watchdog 去重 | 215 非 startup 响应检查点，重复检查点 0 | 双检测器独立运行；producer 记录于回执，旧事实不删 |
| 采样 | missed periods=0，deadline lag 最大 455.000ms | 固定 deadline，保留每次 query 起止；不是连续 uptime |
| health 陈旧消费 | 最大 age=1543.000ms，raw ready=109，effective ready=109 | sample 完成时 >2s/缺失/未来时间戳不算 ready；非原子快照 |
| 时钟诊断 | 27/28 取得 RTT 偏移区间 | 不校正事实或阈值，不宣称 NTP/亚毫秒精度 |
| F05/actor | outbox/applied=9461/9461，pending=0，actor inactive | 独立 READ ONLY/ROLLBACK 读回；与健康验收分开 |
| 包管理器/计划 Gate | 固定 Node 24.12.0 的 pnpm 10.20.0 shim 通过 | `with-pinned-toolchain.cjs`；不修改全局 pnpm、依赖版本或 lock |

### 2.1 新鲜度、processing 与 ACK

毫秒；事件加权 nearest-rank，纳秒参与阈值判断，展示保留 0.001ms。received_at 是 HTTP 响应头时刻；processing 到检测只含 body/decode/领域处理，SQL 之前结束。ACK 是事务提交成功返回后的客户端 UTC。跨机器 source-age 为未校正估计，保留 RTT 不确定性，不能作唯一归因。

| 度量 | P50 | P95 | P99 | 最大 | >2s / >5s | 缺测 |
|---|---:|---:|---:|---:|---:|---:|
| source-age | 924.568 | 2461.408 | 5186.594 | 7854.476 | 655 / 117 | 0 |
| processing 到检测 | 1.054 | 10.114 | 17.073 | 23.335 | 0 / 0 | 0 |
| 检测时 age | 926.036 | 2464.766 | 5187.865 | 7854.960 | 714 / 118 | 0 |
| 检测到 ACK | 926.830 | 1642.091 | 2312.382 | 3453.589 | 197 / 0 | 0 |
| 响应头到 ACK | 929.013 | 1650.521 | 2320.079 | 3454.521 | 210 / 0 | 0 |
| ACK 时 age | 1981.277 | 3865.219 | 6754.872 | 10401.161 | 4177 / 222 | 0 |

与历史 42.02% 检测降级及 30.70% ready 点样本相比，最终降级 8.37%、effective ready 90.833% 有改善，但不同成交/网络窗口不是控制变量实验，不能把变化全部归因于代码。轮询去掉提交后额外等待，cursor 只复用已 ACK 的 next_id；SQL 原子冲突/未知写入仍 fail-closed。没有缩小 fromId 窗口、跳过成交、放宽 2s 或删告警。

### 2.2 已提交页阶段观测

2620 个提交页，一页一个观测；本地阶段使用 monotonic 时钟，不把页内事件当成独立 HTTP/SQL。UTC 起止全部存在，阶段顺序异常 0。以下统计范围是**已提交页**，未确认/失败请求不能补成零耗时，也不能由此宣称所有 HTTP attempt 的 latency 分布已知。隐式路径 SQL 包含提交成本；显式路径保留事务内 statement/lock timeout。

| 阶段 ms | P50 | P95 | 最大 | 缺测 |
|---|---:|---:|---:|---:|
| headers_ms | 260.526 | 728.785 | 2716.724 | 0 |
| body_ms | 0.119 | 0.348 | 2.224 | 0 |
| decode_ms | 0.060 | 0.205 | 1.159 | 0 |
| build_ms | 0.592 | 3.405 | 22.674 | 0 |
| begin_ms | 225.322 | 650.786 | 1604.114 | 0 |
| set_local_ms | 225.855 | 358.492 | 1382.817 | 0 |
| sql_ms | 229.066 | 652.560 | 2294.947 | 0 |
| commit_ms | 226.729 | 648.222 | 849.376 | 0 |
| total_ms | 911.445 | 1367.262 | 3428.297 | 0 |

独立 sink 与跨进程文件锁避免 token 交错；监督只在前一写者退出后轮转。完整 ACK/生命周期另存 128MiB 有界单写者文件，超限/IO 失败停止，不能轮转丢失后继续宣称完整。最终 trace 614 行，坏行 0；旧三条坏行原件与 SHA 保留。

### 2.3 自然告警时钟

自然 tick 告警 714 条，响应头→ACK 最大 3454.521ms，>5s=0，缺测=0；检测→ACK 最大 3453.589ms。陈旧输入时限从到达算，不能用成交 T 或检测时刻替换。

| 自然 source 种类 | 事件 | origin→ACK P95 | origin→ACK 最大 | >5s / 缺测 | detection→ACK 最大 |
|---|---:|---:|---:|---:|---:|
| market.source.freshness_degraded | 217 | 1051.000 | 1577.815 | 0 / 0 | 1560.277 |

source freshness 的 origin 是 last_response+2s；monitor 的 origin 是监控读开始；native detected_at 是读 cursor 前的 timer observed。它们都不是未测量的物理故障发生时刻。实际 producer 分布 `{"supervisor": 210, "native": 7}`；没有把没有新插入事实的 producer 计成已通过的自然事件。重复尝试 77 次另计，不是第二条异常事实或独立断线。

告警查询的最多 5s ACK 确认 timeout 与 origin→ACK 五秒验收独立；不会由于只剩几毫秒就丢弃刚到的 ACK，迟到实际 ACK 明确记录 FAIL，重启旧检查点保留原起点。未知结果只记录 attempted event_id，不重试、不伪造提交。监控读超时后关闭旧只读连接并换为相同目标/身份的新连接，恢复 ready 必须再次读到真实 cursor；真实 Supabase pg_sleep(3) 的受控测试验证了这一链路，没有提高 2s/连续失败阈值。监督停机发送 owned pipe 命令，停止新轮询、保留在途页 ACK；15s 未退出强制停止并失败，不能冒充正常完整窗口。

### 2.4 所有失败与中止保留

| 尝试 | 事实 | 精确 ACK / UNKNOWN | 结论 |
|---|---:|---:|---|
| 首次真实 `live` | 3648 | 3647 / 1 monitor | 1000.217s，监控读超时后告警确认失败，FAIL；health age 5428ms，effective false；actor inactive、pending=0 仍不改判 |
| 主动中止 `live-retry` | 1262 | 1260 / 2 | 为修复 RPC/停机而中止，FAIL；暴露旧 SIGTERM 截断在途 ACK；actor inactive，原事实保留 |
| 第三次真实 `live-final` | 1758 | 1758 / 0 | 681.893s，连续监控读超时触发 READ_CIRCUIT，FAIL；全 ACK 证明停止修复有效，但不能覆盖提前退出；actor inactive |
| stable 启动 attempt-04/05 | 未创建 owned actor/事实 | 不作通过 | 受限网络目标连接失败，原 failure 保留，授权连接 attempt-06 独立复验 |
| 首次 stable target | 覆盖行为完成但源码变化 | 无最终 target PASS | SOURCE_CHANGED failure 保留，4 个 actor 只读确认 inactive |
| 受控 attempt-04/07 | SLA/RPC 边界实现导致早退 | 不作通过 | 与其前后回归分别保存，最终实现撤回该耦合 |
| 最终只读导出 attempt-01/02/03 | 不改写事实 | 原失败保存 | 前两次整表导出环境失败（旧日志未分类错误类型）；首次分页以 text 别名排序、numeric keyset 比较不一致，计数护栏拒绝缺行；修正唯一键/numeric 排序后新目录完整核验 |
| 初始 observability | sandbox socket 权限失败 | 非代码通过 | 保留初始输出，授权环境重跑 19/19 |

旧 BTC 页仅有 progress 上界，44 条旧异常的真实 ACK 时限仍 UNKNOWN；没有追改旧事件时间或制造历史证据。后续完整窗口不提供这些失败/缺测时段的正式验收。

## 三、问题清单及风险分析

| ID / 优先级 | 所属模块与整改 | 影响范围 / 判定 |
|---|---|---|
| B01 / 阻塞级 | provider 正式验收范围 | OPEN/PARTIAL；24h/部署须新授权，Linux/systemd、父启动器/主机死亡外部通知、商用许可、远程同 SHA CI 未验；阻塞 R01 ACCEPTED |
| FA-H01 / 高危 | REST 轮询/游标/运行健康：去掉冗余 cursor 查询与提交后固定等待，完成分段测量与新窗口 | PARTIAL/OPEN；降级 8.37%、effective ready 90.833% 仍不等于全程健康；两标的研究消费者继续遵守 quality/health age |
| FA-H02 / 高危 | 页/原生/监督精确 ACK、目标 event_id、RPC/SLA 分离与在途页停止 | CLOSED（最终窗口测量/受控验证）；首次自然失败 UNKNOWN 与旧 progress 缺测保留，不能回写为历史全部≤5s |
| FA-M01 / 中危 | observability：跨进程文件锁、独立 sink、安全轮转、完整页分段/保留证据 | CLOSED（本轮实现/目标）；坏行 0、六进程与轮转负向通过；失败未确认请求不补0 |
| FA-M02 / 中危 | durable identity：共享 v2 检查点，两个检测器的 fallback 仍独立，producer 不进 immutable hash | CLOSED；最终同检查点重复事实 0；旧两条事实完整保留 |
| FA-M03 / 中危 | sampler/health：固定 deadline、missed periods、独立查询时间戳、effective age 检查、固定停止预算 | CLOSED（实现）；120 点样本不能推出精确 uptime，仍可能遗漏 15s 间短状态变化 |
| FA-L01 / 低危 | 时钟：同获准 endpoint serverTime 的 RTT 偏移诊断，高精度比较与未知标记 | CLOSED（观测/解释整改）；不是双方 NTP 或 provider 精度认证，不改时间戳/阈值 |

最终 stable/nightly、受控故障与真实窗口的 33 个源文件/授权 hash 均与当前提交内容匹配；后续仅调整只读导出和测试夹具，未改变已完成窗口的运行源码。全部 53 个本轮 owned actor 已独立 READ ONLY 确认 inactive，窗口 supervisor 已退出且 worker PID 清空。

另修复包管理器入口错误，保留固定 Node/pnpm 的可执行 Gate；不修改依赖/lock 来规避版本约束。本轮不是独立全面复审/正式签署，历史 10 项问题的 9/10 关闭统计与 B01 OPEN/PARTIAL 不变。

## 四、整改建议与剩余验收

1. 继续把 FA-H01 保留为高危健康风险，使用真实 headers/SQL/COMMIT 分段定位不同环境的延迟；保持 2s/5s 标准与降级事实。最终消费完整性不能宣称 source-age 或 readiness 通过。任何新协议、部署环境、24h/更多标的/新用途先取得独立 scope。
2. ACK/RPC 监测保留 `alert_commit_unconfirmed`、`alert_sla_missed` 和原始失败。实际源/数据库抖动造成的未知或超限不能靠多次尝试筛出一次绿色来销账；定期目标验收需逐次保存 failure、具名 actor 和读回。
3. 部署验收单独执行 Linux/systemd、父启动器 SIGKILL 与主机死亡通知、进程组清理、actor 外部核对/停用及事故后的不可变事实对账。当前 stdin 停机只证明受控前台退出，不证明这些场景通过。
4. 商用/对外展示/再分发须供应商相应许可；远程 exact-SHA CI 须授权发布后保存独立回执。本轮仅生成本地独立 Git 提交，不 push，不自动续期或扩大用途。B01 未闭合前不将 R01 或 R1-SERVICE 标为 ACCEPTED。

Clippy 的测试夹具忽略 read 字节数初始失败已保存，补充非空读取断言后全目标零 warning 通过；不改变运行逻辑。只读导出使用单个 REPEATABLE READ READ ONLY 快照内 500 行 keyset 分页，以真实 numeric sequence 与完整唯一键排序，完整计数/ACK 不一致即失败，未提高运行或告警阈值。

完整命令、逐尝试结果、目标读回、压缩/原始 SHA、失败与重放见[证据目录](./evidence/r01-freshness-remediation-20261004/README.md)；运行和退出约束见[监督 Runbook](../runbooks/r01_binance_supervisor.md)。
