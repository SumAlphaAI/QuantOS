# R01 新鲜度、readiness、自然告警与采样缺口专项评估

日期：2026-10-04。评估基线：`a129ca31943d1f0461f89cf726cbdc6bcb958730`。对象为既有[30 分钟窗口](./R01-window-validation-2026-10-04.md)，不是新摄取、24h 或部署验收。历史报告、压缩原始证据和 Supabase 不可变事实全部保留。

## 一、任务完成概况

**结论：实际新鲜度显著降级，不能以持续写入或最终 pending=0 宣布健康通过；R01 保持 FIX_VALIDATION，B01 保持 OPEN/PARTIAL。** 四个专项评估已完成，缺失的精确异常提交测量明确保留为待补证。新增可重放分析脚本和具备 READ ONLY 事务的目标读回脚本，未修改摄取、告警或批准阈值。

分析窗口仍为 `2026-10-04T01:17:42.306Z–01:47:43.779Z`，授权运行预算 1800 秒；历史实际 1801.473 秒含停止收尾。只读连接现有配置 Supabase 事务池，确认原 tenant 的 11195 个事件、F05 outbox/applied=11195/11195、pending=0 及原 actor inactive；没有创建/激活 actor，也没有写入、删除或重建数据库。本次未启动新的 supervisor/worker，原运行的无 owned worker、ready=false 由历史结束回执记录；本次没有再次验证历史 PID 的当前存在性。

范围保持 BTCUSDT/ETHUSDT、内部工程评估与现有 Supabase，批准到期日保持 `2026-10-10T00:00:00Z`。24 小时、部署环境、更多标的或新用途均须新范围授权。交易、提现、客户展示、再分发、商用、长期生产仍被排除。Linux/systemd、父启动器/主机死亡通知、商用许可、远程同 SHA CI 均未验收。

## 二、完成情况明细统计

本轮 4/4 专项完成评估，范围保持及只读事实复核通过。这里的完成率是**评估工作完成率**，不是健康通过率；历史复审问题仍为 9/10 关闭，B01 未关闭。新鲜度健康、自然 tick 告警精确 ACK、完整请求/SQL 分段测量均不能记为验收通过；条件性复跑本次 NOT RUN。

| 专项 | 证据与结果 | 判定 |
|---|---|---|
| 新鲜度 | 6243/6243 recorded tick 有 event/received/detected 时间并唯一关联页 progress；2623 degraded | 已评估，健康降级 |
| readiness | 115 历史样本；剔除 1 个启动前样本后 35/114 ready（30.70%） | 已评估，不能推导 uptime |
| 自然告警 | 2623 tick、2327 source freshness、2 monitor；监督 1172 个 ACK 与目标 event_id 全部关联 | 已评估，部分提交时限缺测 |
| 采样缺口 | 113 个运行期间隔、健康文件年龄、窗口首尾缺口独立量化 | 已评估，无法捕获所有短时波动 |
| 目标事实与生命周期 | 只读事务 `transaction_read_only=on`，ROLLBACK；原 actor inactive，事实数不变 | 目标读回通过 |
| 有界授权与退出约束 | 1800 秒、两标的、原用途与期限不变；现有 scope 的负向测试通过 | 保持有效约束；未执行新窗口 |
| 新故障注入、24h/部署、商用、远程同 SHA | 无新回执；旧故障注入证据仍仅属历史 | NOT RUN / NOT VERIFIED |

### 2.1 四种时钟分别解释

所有分位数均为 nearest-rank、按事件加权；不把页内多个事件当成独立 HTTP/SQL 请求。Rust 亚毫秒时间参与阈值比较，展示值四舍五入到 0.001ms。provider 的 event_time 与本机 UTC 属跨时钟估计，本次未验证双方 NTP/偏移，不能声称其精度达到微秒。

| 度量（毫秒） | 起止与实际含义 | P50 | P95 | 最大 | 超过 2s / 5s |
|---|---|---:|---:|---:|---:|
| source-age | received_at − event_time；源成交到 HTTP 响应头返回；received 在响应 body 读取之前取时 | 1697.621 | 3686.049 | 9138.705 | 2620 / 102 |
| processing 到检测 | detected_at − received_at；响应头后 body/decode/逐条领域处理，止于页 SQL 前 | 2.784 | 17.437 | 46.264 | 0 / 0 |
| 检测时数据年龄 | detected_at − event_time；实际批准 freshness=2s 的 tick 质量判断 | 1701.190 | 3695.533 | 9139.085 | 2623 / 102 |
| 检测到页 progress | progress.at − detected_at；SQL/提交及 stdout/监督日志调度的观测上界 | 1238.634 | 3581.725 | 5279.354 | 930 / 45 |
| 响应到页 progress | progress.at − received_at；包含检测之后的实际写入链 | 1241.346 | 3583.721 | 5280.610 | 930 / 45 |
| 页 progress 时数据年龄 | progress.at − event_time；页提交后的观察值 | 3075 | 6702 | 12165 | 5288 / 792 |

不能用 processing 到检测的 46ms 最大值证明“端到端行情实时”；这段时钟不包含 SQL/提交。`event_log.ingested_at` 默认 `now()` 是事务开始时间，不能用作 COMMIT ACK。worker 先完成页提交，再打印 progress，监督记录其时间，因此 progress 只能提供包含日志调度延迟的上界，无法拆分 SQL、网络 ACK 与 stdout 调度。

| 标的 | 成交数 | 降级数 / 比例 | source-age P95 | processing 到检测 P95 | 检测到 progress 最大 | progress 数据年龄最大 |
|---|---:|---:|---:|---:|---:|---:|
| BTCUSDT | 3912 | 1674 / 42.79% | 3721.890 | 20.334 | 5279.354 | 12165 |
| ETHUSDT | 2331 | 949 / 40.71% | 3686.049 | 13.036 | 4365.890 | 10588 |

合计降级 2623/6243=42.02%。其中 2620 条在收到响应头时已经 >2s，另外 3 条在处理至检测时跨过阈值；质量记录与高精度计算完全相符。源聚合/发布、轮询等待、网络、时钟偏差及本地提交各有影响，现有证据不能唯一归因给 Binance 或数据库。

### 2.2 readiness 与采样缺口

历史 35/115=30.43% 保留；运行期有健康记录的样本为 114，其中 ready=35、unready=79，无未知 health。35/114=30.70% 仍只是点样本比例。readiness 基于已提交 cursor 的 last_response_at≤2s 且两个 worker 存活；它与单条成交质量、F05 delivery 是不同条件。

| 观测 | 结果 | 限制 |
|---|---|---|
| 实际运行期采样间隔 | 最小 15597、P50 15714、P95 16255、最大 16561ms | 113/113 间隔均超过标称 15s，额外间隔累计 85456ms；不等于服务故障时长 |
| 显著间隔缺口 | >30s 为 0 | 仍遗漏约 15–16.6s 间的状态变化；不能据此声称无缺口 |
| 运行首尾未采样区间 | 启动后首样本 13400ms；末样本至停止 7617ms | 启动前样本不计入运行期 readiness |
| health.checked_at 到 sample.at | P50 845、P95 1580、最大 2546ms；2 个 >2s | health 与 SQL 读回不是同一瞬间快照 |
| BTC/ETH cursor 年龄在 sample.at | P95 4035/4738ms，最大 5050/8698ms；>2s 为 67/69 个样本 | SQL 返回 cursor 后到 sample.at 又经过计数查询；非精确取样瞬间年龄 |
| ready health 但随后 SQL cursor 年龄 >2s | 22 个样本 | 先读 health、再查 cursor/count，时间边界不同；提示健康消费需 age 检查，不直接判为逻辑矛盾 |
| F05 采样积压与最终状态 | 最大 pending=307，最终 0 | 不证明逐事件消费时延，也不能覆盖新鲜度/readiness 失败 |

未作时间加权 uptime 外推，也未补插模拟样本。监督日志的页 progress 中位周期约 2.86s，原报告 P95 约 4s；相对于 2s freshness 的频繁阈值穿越有证据，单环节瓶颈仍须分段测量。

### 2.3 自然告警与提交时限

| 来源/种类 | 目标事件数 | 可核验 ACK | 时钟与结果 |
|---|---:|---:|---|
| 监督 source freshness | 1170 | 1170 | last_response_at+2s 阈值→ACK，P95 1162ms、最大 2179ms；检测→ACK 最大 1754ms |
| 原生 source freshness | 1157 | 0 | 事实存在，缺精确提交 ACK；不能以 ingested_at 替代 |
| 监督 monitor_degraded | 2 | 2 | 同一自然读超时针对两标的各一事件；读开始→ACK 为 2315/2558ms，超时检测约 2003ms |
| tick freshness_degraded | 2623 | 0 个专用精确 ACK；2623 个可关联页 progress | 检测→progress P95 4313.769ms、最大 5279.354ms，44 条 >5s |

监督 1172 个 ACK 均有目标 event_id，elapsed 字段与日志时间差一致。此前合并描述的最大 2558ms 实际来自 monitor 读开始时钟，source freshness 的阈值时钟最大为 2179ms；二者不能混为一个“故障发生→提交”指标。本轮没有故障发生时刻或新故障注入，不确认新的异常 ≤5s 正式验收。

44 条 tick 告警 >5s 的观测值来自同一 BTC 页（next_id=4080259416，progress=`2026-10-04T01:26:30.491Z`）；该页共 45 条 recorded tick 的检测→progress >5s。由于 progress 晚于 ACK，**这是需追查的超限观测/证据缺口，不能确认为 44 次独立 SQL 故障，也不能直接判定实际 ACK 超时或宣称全部 ≤5s**。陈旧输入的五秒异常时限应从到达/实际异常起点衡量，不能用源成交的 T 或仅用 detected_at 替换。

两套生产者使用不同 durable source identity：native=`watchdog:binance:*`，监督=`watchdog:supervisor:*`。2327 个 source freshness 事件按 symbol+last_response_at（毫秒精度）关联为 1171 个响应检查点：1156 个两者均告警、14 个仅监督、1 个仅原生，同生产者没有多次事件。该关联会截断 Rust 亚毫秒精度，**不是实际断线次数或独立降级事件数**；2 个 startup 无响应告警归入各自 startup 检查点。历史事实不去重删除。

### 2.4 证据完整性与可重复性

原 receipt、compression-manifest、samples/supervisor/trace gzip 的 index SHA256 及解压原始 SHA256/字节数全部匹配。samples 115 行与 supervisor 2857 行均可解析；trace 510 行中 507 个对象、3 个坏行（第 1–3 行），首行存在多个进程 JSON token 交错。坏行的行号/字节数/hash 已归档，没有清洗或改写原件。有效子集既非完整 trace，也不提供完整 HTTP/SQL 分段，因此不能借其推导请求/写入 P95。

JSONL exporter 的 Mutex 仅在单进程共享；各子进程打开同一个 append 文件，`serde_json::to_writer` 和后续 newline 分多次 write，允许跨进程交错。现场坏行和源码机制相符；跨进程修复与目标复跑仍待执行，原记录保留。

新[证据目录](./evidence/r01-freshness-20261004/README.md)提供完整派生指标、只读选定事件字段与 source receipts、目标元数据、测试日志及哈希索引。新增脚本支持空目录且失败保存 failure，离线结果拒绝被篡改的输入、active actor、写入事务或不匹配的 tenant/receipt。测试只证明分析/范围逻辑，目标执行由独立 Supabase readback 回执证明。

本地 Node 分析/范围/监督测试 16/16 通过，离线重放与归档结果全等；摄取及批准关键源码 hashes 均未改变。pnpm 计划检查入口因 `@pnpm/exe.darwin-arm64` 缺少 lock 身份而退出 1，直接执行同一 `node scripts/check-development-plans.mjs` 通过；未修改依赖/lock，也未将包管理器入口失败记为完整 Gate PASS。gitleaks 对新增源码、文档及解压后的新证据扫描通过。本次未更改 Rust/摄取实现，因此未启动完整写入 Gate 或新的 provider SLA 运行。

## 三、问题清单及风险分析

本次专项待办共 7 项：阻塞级 1、高危 2、中危 3、低危 1。它们是 B01 的运行健康/测量与验收子项，不回写历史已关闭问题为未修复，也不把专项评估当成再次独立全面验收。

| ID / 优先级 | 所属模块与具体表现 | 影响范围 / 当前状态 |
|---|---|---|
| B01 / 阻塞级 | provider 正式验收缺 24h/部署、Linux/systemd、父启动器/主机死亡通知、商用许可、远程同 SHA CI | 阻塞 R01 ACCEPTED 与扩大用途；OPEN/PARTIAL，须新范围授权后执行相关评估 |
| FA-H01 / 高危 | REST 新鲜度与 readiness：42.02% tick 检测时 >2s，运行期 ready 仅 30.70% 点样本 | 两标的内部研究可读到降级行情；写入与消费完整性不能覆盖健康问题；OPEN |
| FA-H02 / 高危 | 自然 tick 异常提交：44 条检测→progress >5s，1157 个 native source 告警缺 ACK 测量 | 无法闭合自然运行的完整五秒上界；精确提交与请求阶段待测，禁止 PASS 推导；OPEN |
| FA-M01 / 中危 | observability：共享 trace 有 3 坏行且缺完整 HTTP/body/decode/SQL/ACK 分段 | 瓶颈归因及故障复盘能力受损；保留原件，后续修复共写并补测；OPEN |
| FA-M02 / 中危 | 告警身份：1156 个响应检查点同时产生 native/监督两条事实 | 把 2327 事件当成独立故障会夸大告警次数，增加存储/消费与运营噪音；未删除事实，OPEN |
| FA-M03 / 中危 | sampler/health 消费：15s 计划在查询完成后重置；最大 health age=2546ms，22 个点跨健康/SQL边界 | 不能计算连续 uptime、精确 readiness 时长或短时丢采样；需独立采样和时间戳；OPEN |
| FA-L01 / 低危 | 时间基准：provider event_time 与本机 UTC 未有时钟偏移/NTP证据，亚毫秒取时与毫秒日志混用 | source-age 精确归因与边界计数解释受限；已保存亚毫秒阈值比较，跨机偏差未验证；OPEN |

## 四、整改建议

1. 优先补分段观测与精确 ACK：request_start、headers/body 完成、decode/领域处理、SQL 开始、COMMIT ACK、日志观察分开；采用 monotonic 测本地时长，保留 UTC 对齐与 source T，输出页关联及异常 event_id。对上述 BTC 页进行定向分析，异常验收逐项按最大值核验，不能用 P95、检测 46ms 或监督 source 部分 ACK 替代全部链路。
2. 修复 trace 共写：采用每进程独立 sink 后离线汇总，或经验证的单写者/跨进程同步；序列化完整记录后单次写仅是候选，不能未经多进程和轮转验证就承诺原子性。旧坏行不修补为“原始证据”。
3. 在有效批准内优化轮询/处理/轮换路径，先用分段证据确认瓶颈。保持批准 freshness=2s 与五秒异常标准，不直接放宽阈值、删除告警或将 pending=0 用作健康通过。下游必须尊重 quality 降级和 health 时间戳。
4. 明确两套 watchdog 的告警所有权、fallback 和观测 producer；可在派生视图按响应检查点关联，保留两条不可变事件及来源。监控失效时不得因为合并而失去独立通知能力。
5. sampler 记录 health_read/cursor_query_start/end/count_query_start/end/sample_completed，独立记录采样 deadline/missed periods；health 的陈旧性单独评估，按 scope 固定截止时间停止。若需要精确 uptime，必须新增连续状态变化证据，不能补插现在缺失的状态。
6. 后续复跑必须满足现有 v2+scope 有效且剩余期限覆盖预算，采用新空 attempt 目录、新具名 actor；保持 runtime_seconds=1800、两标的及原用途。提前退出保存 failure，不累计短跑/复用目录；finally 停止本次进程并停用 actor、读回确认，保留 immutable facts。父进程/主机无法执行 finally 的情况须独立外部通知和人工 owned-scope 核对。不得删除/重建现有 Supabase。
7. 24h/部署与商用评估分别取得新授权/许可；Linux/systemd、父启动器/主机死亡、远程同 SHA CI 各保留独立目标回执。在这些回执与运行健康子项闭合之前，B01 继续 OPEN/PARTIAL。当前仅完成专项评估，没有扩大窗口或自动续期。
