# F09 本地可观测性、容量阈值与故障注入全面复审

## 1. 任务完成概况

- **依据**：[`SumAlpha-QuantOS-Development-Plan.md`](../SumAlpha-QuantOS-Development-Plan.md#task-f09) 的 F09 技术要求、四项交付物和量化验收标准；同时核对 F0 Gate 的服务观测要求。
- **复审基线**：2026-09-27，`d0d81287664b5ab55515997481c9782b21455262`；复审开始时工作树无改动。仅审 F09，不继承 F05–F08 的验收结论。
- **结论**：`development_status=COMPLETED` 只能说明存在基础代码和定义文件。F09 **未达到验收**，建议保持复审未通过、整改后重审，F0 总 Gate 继续关闭。核心阻断是实际写操作的 trace 接线、九类指标的生产者与调度、真实故障恢复证据均缺失；现有容量回执还会将未经验证的脱敏标为 `true`。
- **完成率口径**：下表 22 个独立检查点，完全满足 **2**、部分满足 **15**、未满足 **4**、本轮不可验证 **1**。严格验收完成率 **2/22 = 9.1%**；若仅为开发进度估算，部分满足按半项计，为 **(2 + 15×0.5)/22 = 43.2%**。不可验证不计完成。两者均不是 F09 放行率；放行取决于全部必需检查点和同 SHA 回执。
- **问题数**：阻塞级 4、高危 5、中危 4、低危 1，共 14 项。严重度表示 F09 验收/运行风险，不表示已发生生产事故。

### 本轮执行与证据边界

| 检查 | 结果 | 边界 |
| --- | --- | --- |
| `cargo test -p quantos-observability --lib` | PASS，10/10 | 内存模型、序列化和 Rust HTTP 组件单测；未证明业务服务接线。 |
| `node ./scripts/test-f09-adr-input.mjs` | PASS | 固定 fixture 渲染；未证明真实监控回执可信。 |
| `make observability-check` | FAIL | 10 个 Rust 单测先通过，随后 PostgreSQL 集成测试在 `setup client connects` 因地址解析失败中止；Make 未执行后续 Python/Node 步骤。当前 `DATABASE_URL` 不能提供可用目标，不把连接失败归因于业务逻辑。 |
| `UV_CACHE_DIR=/private/tmp/quantos-f09-uv-cache uv run --offline --locked --project engines --all-packages pytest engines/tests/test_engine_observability.py` | NOT RUN（有效验证） | 1 个用例启动本地 HTTP 服务时被当前沙箱以 `PermissionError: Operation not permitted` 拒绝；不能判定 Engine 实现失败。 |
| F09 PostgreSQL、持续调度、实际告警、故障演练、目标回执 | NO RECEIPT | 仓库中未找到绑定本 SHA 的 F09 目标运行回执；现有集成测试使用人工回填时间和人工指标。 |

## 2. 完成情况明细统计

`满足`仅用于可由本轮源码和测试直接确认的局部交付；`部分`表示规则/接口存在但端到端行为未成立。编号是本报告的固定分母。

| # | 规格/验收检查点 | 状态 | 主要证据与判断 |
| --- | --- | --- | --- |
| 01 | 可持久化、按 correlation ID 查询的 Rust trace 基础件 | 满足 | `service.rs` 的 JSONL 写入及查询、Rust 单测通过。 |
| 02 | 每个 F0 写操作均可由 trace 找到 correlation ID | 未满足 | `runtime-gateway` 写路由未调用 `ServiceObservability::record_trace`；`bff-gateway` 未接入该组件；批处理仅记录命令级随机 ID。 |
| 03 | 各服务 metrics | 部分 | 共享 HTTP 端点只暴露 ready、HTTP 请求和错误计数；BFF 未接入，业务指标未接线。 |
| 04 | 各服务结构化日志/错误 | 部分 | 错误 envelope 与内存 sink 存在，真实业务路径和跨服务关联未完整证明。 |
| 05 | 各服务健康/就绪检查 | 部分 | 共享端点和部分服务健康检查存在；批处理设置观测地址时只运行 HTTP 服务器而不执行工作，Runtime 的观测线程失败被吞掉。 |
| 06 | 可用于 DB/消费者/Engine 的 test fault proxy | 部分 | `FaultProxy` 仅在 observability crate 内存测试引用；无真实依赖适配/代理接线。 |
| 07 | 注入 DB 故障后恢复且事件链完整 | 未满足 | 只有在内存 closure 上返回 injected error，之后另行构造事件；未经过真实 DB 故障与恢复。 |
| 08 | 注入事件消费者故障后恢复且事件链完整 | 未满足 | 同上；没有真实消费、重试、checkpoint 与重放演练。 |
| 09 | 注入 Engine 故障后恢复且事件链完整 | 部分 | F08 有独立 Engine 故障测试，F09 代理仍是内存模拟；未见绑定 F09 回执的整条写入事件链验证。 |
| 10 | 故障期间和恢复后无秘密泄露 | 未满足 | 内存 sink 对敏感字段脱敏；持久化 Rust trace 原样写入 `attributes`，且 F09 回执将验证位硬编码为 true。 |
| 11 | outbox 最老事件 >60s 持续 15m | 部分 | 阈值与状态表存在；窗口采样缺口不能证明连续，尚无调度/实际告警回执。 |
| 12 | DLQ >0.1% | 部分 | SQL 算 15 分钟内 DLQ/事件数；缺少实际负载定义、生产回执及完整分母核验。 |
| 13 | Realtime 投影延迟 >5s 持续 15m | 部分 | 规则存在；无实际投影 worker 指标生产者。 |
| 14 | Realtime 配额 >70% | 部分 | 规则存在；无实际配额指标生产者，规则还要求 15m，需与规格确认是否应立即告警。 |
| 15 | 风险查询 P95 >300ms 持续 15m | 部分 | SQL P95 和规则存在；无真实查询边界采样。 |
| 16 | 组合查询 P95 >300ms 持续 15m | 部分 | 同上；无真实组合查询采样。 |
| 17 | 风险 MV >1m 连续 3 次 | 部分 | 状态机和规则存在；无实际刷新/新鲜度生产者，三次检查可由任意间隔触发。 |
| 18 | 运营聚合 >5m 连续 3 次 | 部分 | 同上；无实际聚合刷新生产者。 |
| 19 | Storage 错误 >1% | 部分 | 平均 0/1 样本的算法存在；无 Storage 实际操作采样。 |
| 20 | 秘密轮换/读取失败告警 | 部分 | bool_or 规则存在；Execution Gateway 未调用指标写入，缺少真实失败探针。 |
| 21 | dashboards、alert rules、容量 ADR 模板及渲染 | 满足 | 两套静态 dashboard/规则文件和 ADR 模板存在；fixture 渲染测试通过。此项只计文件与模板交付，不计告警运行。 |
| 22 | 自动告警生成可信 ADR 输入及同 SHA 验收 | 不可验证 | `capacity-monitor` 可写 JSON/DB，但无真实目标回执；其故障字段固定，不能作为验收证据。 |

状态核对：满足为 01、21；部分为 03–06、09、11–20；未满足为 02、07、08、10；不可验证为 22。

## 3. 问题清单及风险分析

| ID / 优先级 | 所属模块 | 具体表现与证据 | 影响范围/风险 |
| --- | --- | --- | --- |
| F09-B01 阻塞 | Runtime / BFF / 服务观测 | `services/runtime-gateway/src/live.rs:113-120,192-260` 写路由无 trace 导出；`services/bff-gateway/src/main.rs:1-52` 无观测接线。`service.rs:436-440` 的 batch ID 是新建 ID。 | “每个 F0 写操作可追 correlation ID”未成立；跨服务审计与故障定位断链。 |
| F09-B02 阻塞 | 九类指标生产者 / 调度 | 全仓 `record_operational_metric` 仅在采集 API、SQL 和 F09 集成测试出现；`services/capacity-monitor/src/main.rs:26-61` 为一次性 CLI，文档要求每分钟调度，但仓库无相应任务定义。 | 正常环境缺采样时监控报 `MissingMetricCoverage`，阈值无法自动运行。 |
| F09-B03 阻塞 | 故障注入 / 事件链 | `FaultProxy` 只在 `crates/quantos-observability/src/lib.rs` 测试中使用；DB/消费者/Engine 测试是在 closure 上人工失败后独立追加事件。 | 无法证明真实 DB、消费链、Engine 故障的无泄密和恢复后完整性。 |
| F09-B04 阻塞 | 目标验收 / CI | `.github/workflows` 无 F09 专属同 SHA 持续/目标 Gate；本轮 live test 因连接地址解析失败、Python HTTP 测试因沙箱拒绝绑定，均无有效 PASS 回执。 | `COMPLETED` 缺可重放的目标证据，F0 Gate 不能放行。 |
| F09-H01 高危 | ADR 证据 | `capacity.rs:198-202` 固定填写三个故障结果、`secret_redaction_verified: true` 和空 traceEvidence；测试只断言 true。 | 未执行演练也可能生成貌似已验证的 ADR，误导容量/安全决策。 |
| F09-H02 高危 | 持久化 trace / HTTP | `service.rs:204-225` 原样持久化传入的 `attributes`，`service.rs:299` 和 trace 查询无鉴权；手册建议 `0.0.0.0:9090`。 | 上游误传凭据时可落盘并被可访问端点返回；需要明确网络隔离、鉴权及输出脱敏。未观察到实际泄露。 |
| F09-H03 高危 | 告警窗口 | `lib.rs:430-477` 仅保存首次越限时间/累计次数；`capacity.rs:207-222` 只要求 15m 内每类有一条样本。中间缺采样、作业停跑或旧样本复用不会清除越限。 | 15 分钟持续和连续 3 次可能被误判，亦可能延迟真实告警。 |
| F09-H04 高危 | 服务运行模式 | `service.rs:423-433` 设置观测地址会直接 `serve` 并跳过 batch command；执行网关设置该地址时同样只提供观测服务；Runtime 观测线程错误被忽略。 | 部署按手册配置后，部分服务不执行主业务或观测端失效不显性报错。 |
| F09-H05 高危 | 指标数据质量/权限 | `capacity.rs:140-148` 对缺失外部指标默认 `0/false`；覆盖检查只验证名称出现；SQL 允许任意非负值、任意过去 `observed_at`，无范围/来源/采样密度约束。 | 错误或稀疏采样可掩盖实际越限，测试人工回填也不能证明实时时效。 |
| F09-M01 中危 | Outbox/DLQ | `capacity.rs:135-139` 用 `available_at` 算最老年龄，重试延后会改变年龄；DLQ 以当前 15m `event_log` 为分母，与失败事件的队列进入时间未必同窗口。 | 容量比率和 backlog 年龄可偏离真实积压，阈值可能错报/漏报。 |
| F09-M02 中危 | 监控服务并发/持久化 | `capacity.rs:173-176,240-299` 读窗口、删除重写状态、逐条写告警不是同一事务，也无调度租约。 | 两个 monitor 并行或中途崩溃可丢状态、重复告警或留下部分结果。 |
| F09-M03 中危 | Dashboard/规则治理 | `docs/operations/f09_capacity_dashboard.json` 与 `f09_local_observability_dashboards.json` 只列指标名/表名；另有 `f09_alert_rules.yaml` 与 `f09_capacity_alert_rules.yaml` 两套不同格式，未见部署加载或双向一致性测试。 | 文件存在不能证明可查询、可显示、可通知；规则漂移风险。 |
| F09-M04 中危 | SQL 脱敏契约 | `record_operational_metric` 只查 `attributes::text` 的关键词；`source` 自由文本可含敏感值，Rust `record_metric` 先将属性替换为 `[REDACTED]`，与 SQL “敏感键拒绝”语义不一致。 | 无法保证所有持久化字段安全，且测试期望和运行期行为可能相反。 |
| F09-L01 低危 | 文档/测试入口 | `make observability-check` 混入依赖 `DATABASE_URL` 的 live 测试；未配置时测试主动跳过，配置无效时整条本地检查失败。 | 本地结果易被误读；应区分无需目标的快检和必须提供回执的 live Gate。 |

**风险判定**：当前可证实的是组件和规则的局部实现，并非 F09 端到端验收。尤其 B01–B04 任一项未关闭即阻断 F09；H01 的固定正面字段不能作为“无秘密泄露”证据。外部受限环境的连接/端口错误不被误报为代码缺陷，但也不能替代目标 PASS。

## 4. 整改建议与验收出口

1. **先补真实接线**：逐一列出 F0 写操作及其入口、持久化事件、correlation ID、trace 查询地址；Runtime、BFF、Execution Gateway 和批处理均用同一请求 ID 贯穿，增加真实 HTTP/DB 负向探针。让观测 HTTP 与业务任务并行，观测线程失败可见并影响就绪状态。
2. **补齐九类生产者和调度**：在 Realtime 投影/配额、风险与组合查询、MV/运营刷新、Storage、受控 Vault 路径写实际样本；部署每分钟 monitor 作业。为样本约束值域、来源、时间偏差和最低密度；缺样本应产生独立的 telemetry-missing 告警，而不是健康值。
3. **修正时间窗口与一致性**：按实际采样间隔验证每一分钟都越限；缺口重置/标记未知；三次检查要求不同且相邻的调度 tick。窗口状态、告警插入、幂等键在单事务内提交并设置租约。用时间前进、断采、重启、并发的负向测试覆盖。
4. **建立真实故障演练**：在隔离 PostgreSQL/事件 worker/Engine 目标上实施有边界的 DB 中断、消费失败、Engine 强杀与恢复；核查事件 ID、顺序、checkpoint、重复副作用、trace/log/secret 扫描。将原始日志、trace、事件查询与环境/源码 SHA 写入回执。
5. **让 ADR fail-closed**：删除固定 `secret_redaction_verified=true` 和占位故障结果；没有演练回执时输出 `NOT RUN / NO RECEIPT`，生成器不得把它呈现为通过。将 dashboard 查询、规则加载和通知目标纳入可执行验证。
6. **重跑验收**：分离 `observability-check`（本地纯单测）与 `test-f09-live`（必需真实连接）；在可绑定端口的环境运行 Python RPC/HTTP 检查，在隔离 DB 运行容量连续窗口、断采和并发探针；建立同一完整 SHA 的 CI、Nightly/持续监控及目标回执。所有 22 项完成后再更新计划的 F09 `review_status` 与 F0 Gate。

### 证据位置

- 规格：[`SumAlpha-QuantOS-Development-Plan.md`](../SumAlpha-QuantOS-Development-Plan.md#task-f09)；核心实现：`crates/quantos-observability/src/{service,lib,capacity}.rs`、`services/capacity-monitor/src/main.rs`。
- SQL：`supabase/migrations/20260811120000_f09_operational_metrics.sql`、`20260811130000_f09_metric_ingest_function.sql`；规则/看板：`docs/operations/f09_*`；模板/脚本：`docs/templates/f09_capacity_adr_template.md`、`scripts/generate-f09-adr-input.mjs`。
- 测试：`crates/quantos-observability/tests/postgres_capacity_monitor.rs`、`engines/tests/test_engine_observability.py`、`scripts/test-f09-adr-input.mjs`；本轮命令结果记录于本报告第一节。
