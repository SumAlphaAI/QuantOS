# F09 指标生产与目标演练续修记录（2026-09-27）

## 1. 本轮交付与验收边界

本轮继续处理 [F09 整改实施记录](F09-remediation-2026-09-27.md) 中的 B02/B03/B04。遵循仓库 `AGENTS.md`：数据库迁移及 live 测试只连接现有测试 Supabase PostgreSQL；F09 专属 CI/Nightly 工作流不创建本地、容器或临时 PostgreSQL。旧的可丢弃数据库 Gate 已移除，新的目标回执继续绑定完整源码 SHA。

目前有五类指标具备实际业务路径中的采样代码，其中投影消费者、风险/组合查询与受限 Runtime Storage 四类已在测试 Supabase PostgreSQL 中验证落库；Execution Gateway 秘密读取仍需完成目标探针。Realtime 配额、风险 MV、运营聚合及秘密轮换四类缺少业务数据源，不能以人工回填代替生产接线。**F09 继续不满足完整验收。**

| 指标族 | 实际路径 | 当前证据与限制 |
| --- | --- | --- |
| Realtime 投影延迟 | outbox 消费事务成功后，以事件入库至投影完成的时间写样本 | 测试 Supabase 消费失败、重试后同一事件的投影样本 PASS。Realtime 仅是唤醒通道。 |
| Realtime 配额使用率 | 尚无配额采集 API/worker | 无生产者；保持缺采样。 |
| 风险查询耗时 | `PgPortfolioStore::account_state` 风险输入查询 | 测试 Supabase 已验证样本落库；未覆盖完整风险决策链。 |
| 组合查询耗时 | `PgPortfolioStore::positions_for_account` | 测试 Supabase 已验证样本落库；异步有界队列避免同步指标写入拖慢请求。 |
| 风险 MV 新鲜度 | 仓库无风险 MV 刷新任务 | 无生产者；保持缺采样。 |
| 运营聚合新鲜度 | 仓库无运营聚合刷新任务 | 无生产者；保持缺采样。 |
| Storage 错误率 | Runtime artifact 上传和读取，成功/失败均记 0/1 | 受限 Runtime 角色在测试 Supabase 已验证 0/1 落库；其他 Storage 调用路径待接线。 |
| 秘密轮换失败 | 仓库无轮换作业/失败状态 | 无生产者；保持缺采样。 |
| 秘密读取失败 | `ExecutionSecretStore::resolve_for_command` 的受控 Vault 读取结果 | 已接线，仅写数值，不写名称、会话哈希或明文；仍缺带真实授权会话的目标探针。 |

## 2. 调度、故障与性能实测

- `capacity-monitor --watch` 每 60 秒重新连接 Supabase 执行一次；失败的 tick 清除旧 ADR JSON。测试 Supabase 上的独立 scope 实测 **2 次缺采样告警 PASS**，旧 ADR 输出未残留；结果保存在忽略目录 `artifacts/f09/scheduler.json`。它验证调度和失败关闭，不验证九类生产者齐全。
- 提交 `7897104` 的首轮完整 SHA Gate 因 125 秒上限内只观察到 1 次 tick 而 FAIL，回执保留在 `artifacts/f09/target.json`。调度探针增加真实 tick 间隔断言、失败回执及网络抖动诊断后，独立复测 2 次 tick PASS；仍需在新完整 SHA 下重跑整套 Gate。
- 在测试 Supabase 上只终止本探针自己的 PostgreSQL 会话，重新连接后同一 correlation ID 的 2 条事件仍按序可查询：PASS。消费者注入失败、重试及同一事件投影样本的组合探针，在仅调整自身 outbox fixture 优先级后 PASS；此前本机连接地址不可用及共享队列竞争的失败记录不计作通过。
- Engine 管理器真实子进程三次崩溃并由监督器恢复的测试，在允许 Unix 套接字绑定的本机运行 PASS。该测试仍是本机 mock Engine，不等同于目标 Supabase 上的跨服务同链演练。
- 原有组合查询端到端 P95 `<300ms` 测试从本机访问测试 Supabase 时 **FAIL，约 890ms**。异步批量指标写入后已从同步写入阶段的约 2.6s 降低，但仍不能标为性能达标。同地域服务端请求或网络诊断需要另行执行并留回执。

## 3. 权限、迁移与回执

新增三条前向迁移：Runtime 角色只可插入 Storage 错误样本，Runtime/Execution 指标函数 `INSERT … RETURNING id` 所需的列级 `id` 读取权限及对应 RLS 策略。迁移均已直接应用于测试 Supabase PostgreSQL；无凭据写入仓库。目标 Gate 会负向尝试由受限 Runtime 角色写其他指标族，并在事务中回滚。

F09 专属工作流的 PR 作业只执行无需数据库的静态检查；push/Nightly/手动目标作业要求 `F09_DATABASE_URL`、`F09_RUNTIME_DATABASE_URL`、`F09_EXECUTION_DATABASE_URL`、`F09_SUPABASE_URL`、`F09_CA_PEM` secrets 并直连同一 Supabase 项目。当前尚无远程 CI/Nightly 回执，也没有看板通知、全部写入口及完整跨服务事件链回执。目标 Gate 的 `PASS` 仅代表列出的组件探针，回执的 `f09Accepted` 固定为 `false`。

## 4. 下一步

先确认四类缺失指标的真实数据源或交付其业务任务，再把 Runtime 之外的 Storage 入口、风险决策查询及秘密轮换路径接线。之后在同地域目标运行查询 P95 和三类故障同链演练，取得同完整 SHA 的 CI、Nightly、目标回执，复审 22 个检查点后方可考虑打开 F09/F0 Gate。
