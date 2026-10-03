# R01 持续运行与五秒异常整改验证报告

日期：2026-10-03。对应 [R01 全面复审](./R01-comprehensive-review-2026-10-02.md)、[前次 REST 接入验证](./R01-binance-rest-validation-2026-10-03.md)。本报告保留历史失败，仅更新本轮整改结论；不构成新的独立 Astra 复审。

## 一、任务完成概况

本轮范围是用户指定的三项：解除完整 Gate 环境阻塞、补齐持续运行能力、验证异常 ≤5s，并生成独立 Git 提交。实现与目标验证以基线 `c676d29c91f50b8ef96ddf6d2dc8913be4eb97f1` 的工作树进行，回执保留 `workingTreeModified=true`、逐文件 sourceHashes 和原生 binarySha256；最终提交的文件须与这些 hash 对齐。回执不是提交后的远程同 SHA CI。

新增独立监督进程，原生 worker 有界迭代结束后自动接续；故障后按持久游标恢复，限流等待、审批撤销停止、人工处理退出码 78、监控读超时降级/熔断、F05 消费、日志轮转和健康状态均纳入实现。pg 沿用固定版本 8.16.3，归为运行时依赖；增加 Linux systemd 部署模板和 [Runbook](../runbooks/r01_binance_supervisor.md)，未在目标 Linux 安装部署。

实际 Supabase fixture 12/12、真实 Binance 进程故障 3/3 通过。异常发生至持久提交确认最大分别 **2164ms、1919ms**，均逐项小于 5000ms，并要求目标事件读回。完整 Gate/覆盖最终结果见下表。原 session 池仍饱和；显式使用同一项目的官方事务池解除本轮验收路径阻塞，未修改池容量、凭据或其他服务配置，也未削减八连接并发断言。

R01 历史 10 项问题仍为 9 CLOSED、B01 OPEN/PARTIAL，保持 FIX_VALIDATION。受控五秒提交测试已补齐；长期部署、24h 稳态、外部 supervisor/主机故障通知、商用许可和远程同 SHA CI 未完成，不宣布 R1-SERVICE 或整个 R01 ACCEPTED。

## 二、完成情况明细统计

| 本轮目标/检查 | 实际完成 | 证据/口径 |
|---|---|---|
| 解除完整 Gate 阻塞 | PASS | stable 与 nightly 各 22 个 Rust 测试；八独立连接并发用例未删减；各 27 receipts / 34 events / 34 outbox；RLS、不可变性通过 |
| 补齐持续运行能力 | PASS（实现与有界运行） | fixture 12/12，包括正常轮换、批准撤销、限流、致命错误停止与恢复；systemd 仅模板 |
| 异常 ≤5s | PASS（本次受控窗口） | fixture 八个时延场景、真实进程两个时延场景全部 ≤5000ms；最大 2164ms / 1919ms |
| 本轮功能完成率 | 3/3 = 100% | 只统计上述指定整改范围；独立提交为交付步骤，整个 R01/B01 不据此关闭 |
| 本地 Gate | PASS | 21 个 Node 检查、13 个 market 领域 unit、3 个 Binance unit；两个编译 mutant 被拒绝；本地未启用的 Supabase 用例不算 DB 验收 |
| 相关静态/单元检查 | PASS | quantos-event 10/10，fmt/clippy、计划结构、workflow YAML、锁文件一致性 |
| 秘密检查 | PASS | 工作树模式扫描、Gitleaks 8.28.0 历史与暂存变更扫描；官方 release/checksum 校验，历史公共 hash 精确误报忽略 |
| 正式 R01 全部问题关闭率 | 9/10 = 90% | B01 OPEN/PARTIAL；长期部署、24h、外部 supervisor 死亡通知、远程同 SHA CI、商用许可仍未验收 |

| Rust 生产文件 | stable line / region % | nightly line / region / branch % | 结果 |
|---|---|---|---|
| crates/quantos-market/src/lib.rs | 96.15 / 95.77 | 96.15 / 95.71 / 85.83 | PASS |
| crates/quantos-market/src/durable.rs | 98.57 / 92.28 | 98.57 / 92.09 / 100.00 | PASS |
| services/market-ingestor/src/main.rs | 98.09 / 91.21 | 98.06 / 90.97 / 86.36 | PASS |
| services/market-ingestor/src/binance.rs | 96.31 / 92.94 | 96.28 / 93.16 / 97.50 | PASS |

### 持续监督与异常用例

| 场景 | 环境 | 耗时 ms | 结果 |
|---|---|---:|---|
| 503_transport | fixture + Supabase | 2011 | PASS |
| timeout_transport | fixture + Supabase | 2164 | PASS |
| badprice | fixture + Supabase | 969 | PASS |
| stale | fixture + Supabase | 965 | PASS |
| rate_limit_exit | fixture + Supabase | 539 | PASS |
| retry_after_respected | fixture + Supabase | — | PASS |
| worker_suspended | fixture + Supabase | 2132 | PASS |
| worker_killed | fixture + Supabase | 248 | PASS |
| resume_identity_span | fixture + Supabase | — | PASS |
| malformed_quality | fixture + Supabase | 433 | PASS |
| normal_iteration_rotation | fixture + Supabase | — | PASS |
| approval_revocation_stops_workers | fixture + Supabase | — | PASS |
| worker_suspended | Binance + Supabase | 1919 | PASS |
| worker_killed | Binance + Supabase | 256 | PASS |
| resume_identity_span | Binance + Supabase | — | PASS |

`—` 为恢复/策略断言，不是时延样本。503/超时从受控模式切换、其他异常从响应发送、SIGSTOP/SIGKILL 从进程故障操作计时；结束时间为监督 SQL append ACK 或原生页事务 COMMIT ACK，且 event_id/异常事实需实际读回。没有使用数据库 ingested_at 代替提交确认，也没有以平均值或 P95 掩盖单项超限。陈旧 tick 保留上游 T；从抵达后测检测时限，不宣称上游延迟 ≤5s。

fixture 中 Retry-After=3 的等待不少于 3000ms；畸形 JSON 后退出 78 且不重启；正常有界迭代连续轮换两次；批准撤销后停止 worker、ready=false 并退出 78。真实 Binance 仅注入本次 worker 的进程暂停/退出，未模拟交易所 HTTP 故障或声称发生供应商真实事故。重启后原始 identity 连续，116 个唯一 tick，游标从 4080101430 接续至 4080101546，无跳页/重复事实。

| 层次 | outbox | F05 applied | pending | checkpoint |
|---|---:|---:|---:|---|
| 最终 fixture | 36 | 36 | 0 | tick/source 两流均与 event 最大序号一致 |
| 最终真实 Binance | 166 | 166 | 0 | tick=158、source=8，与 event 最大序号一致 |

两次最终监督作用域 actor 均已停用；最终只读核验本轮全部 20 个具名作用域 actor，active=0，保留不可变事实。真实窗口是有界受控验收，不是 24 小时连续运行。新 Node 监督路径以五项单元测试与十五项目标行为测试验证；Rust 原有四文件覆盖 Gate 单独报告，不将 Rust 覆盖百分比冒充 Node 覆盖率。

## 三、问题清单及风险分析

| 优先级 | 模块/问题 | 具体表现与影响范围 | 本轮处理/剩余风险 |
|---|---|---|---|
| 阻塞级 | Supabase 共享 session pool / 完整 Gate | 5432 会话池 pool_size=15 饱和，首条新连接即被拒；八写入验收无法启动 | 官方同项目事务池 6543 显式选择；实测八连接独立准入/并发，完整断言保留。原会话容量未修复；其他服务仍须协调 |
| 高危 | 持续运行生命周期 | 原生命令迭代有界，退出/暂停后原进程 watchdog 不再工作 | 独立 watch/alert、轮换、持久接续、退避/预算、退出 78；真实暂停和退出通过。监督自身/主机死亡需外部管理 |
| 高危 | 429/418 策略 | 宽松 Retry-After 解析可能取错误数字或缩短等待；反复重启会扩大限流 | 仅接受完整整数 0–604800 秒，不缩短等待；缺失/畸形/超范围人工处理，unit + 实际 3s 用例通过 |
| 高危 | 事务池写入 deadline | 全局 session SET 在复用后端可能污染其他连接或不在目标事务生效 | 市场写入独立事务内 SET LOCAL，提交后才返回 ACK；其他事务/服务不继承设置 |
| 中危 | 监控读超时及停机 | 一次读 timeout 曾使监督退出；有意停机的未完成读曾误判失败 | ready 降级、独立 monitor_degraded、只读有界重试与连续失败熔断；停机等待自身 dispatcher，保留早前失败回执。写入结果不确定时停止，不盲重试 |
| 中危 | 验证采样一致性 | 先读 cursor 再停进程可能拿到旧故障告警；分步 SQL 可能读到不同页 | 暂停后取快照，要求 detected_at≥fault_at；恢复 identity 与 cursor 单条 SQL 一致读取，目标事件逐项读回 |
| 中危 | 数据源准入/期限 | 内部技术评估批准于 2026-10-10T00:00:00Z 到期，未获得商用/再分发范围 | 持续重读批准，过期/撤销停止；B01 不关闭。扩大用途/长期运行前更新批准与许可证记录 |
| 低危 | 日志/运行时交付 | 长期日志增长、pg 仅 devDependency、手工启动不能覆盖父进程故障 | 大小/数量轮转、pg 运行时依赖、健康文件和 systemd 模板；Linux 管理器/外部告警尚未部署验收 |
| 低危 | Gitleaks 误报 | 前次证据 index 的 secrets.log 公共 SHA-256 被 generic-api-key 命中 | 对照实际文件验证 hash，仅加入精确历史 commit/file/rule/line fingerprint，不关闭扫描规则、不豁免整目录 |

完整 Gate 初次诊断虽完成 Rust target 用例，但因运行期间源码变更被 source guard 拒绝；不能作为最终 PASS。监督初始 SQL 读回列错误、过程中的监控读超时和早前停机失败均保留。最终回执只能选 final-fixture-v2、final-live 和 final-stable/final-nightly；其他 PASS 诊断不自动继承最终源码。

五秒证据仅覆盖已批准来源、目标数据库可用时的本次受控场景。数据库不可用/告警提交失败时内部程序无法保证五秒持久事件成功；需外部独立通知。F05 readback 证明交付完整性，不等于消费全链路五秒 SLA、Web 行情投影或交易业务验收。

## 四、整改建议与执行交接

1. 按 Runbook 部署监督程序，使用稳定 tenant/actor、有效批准与运行时依赖；验收 systemd 退出 78 禁止自动重启、外部进程/主机死亡通知、健康文件陈旧检测。模板当前仅可评审，未运行。
2. 经授权选择部署环境后做 ≥24h 持续观测，记录重启/限流/积压、CPU/内存/连接及日志上限，并独立验证正常行情 freshness 与消费延迟。批准到期前必须续期；不自动扩大评估用途。
3. 推送与远程同 SHA CI 需另行授权；目标矩阵顺序运行，保持八连接竞争和四文件覆盖阈值。其他任务仍需评估共享 Supabase 容量，勿将事务池可用描述为原 session 池修复。
4. 保留本报告、所有失败与最终回执；凭[证据索引](./evidence/r01-supervision-20261003/index.json)逐文件校验提交内容。长期环境、许可、正式独立复审完成前保持 B01 PARTIAL。
