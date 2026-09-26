# F08 Engine SDK、Manager 与 Mock Engine 全面复审报告

> 复审日期：2026-09-25
> 依据：[开发计划 F08](../SumAlpha-QuantOS-Development-Plan.md#task-f08)、[技术方案 4.2/6.1](../SumAlpha-QuantOS-Technical-Solution.md)、[架构 7.3/8.2](../SumAlpha-QuantOS-Architecture.md)
> 源码基线：`1a28d9dc6b3c1811d15635d8b7acbffa76b3e8dc`；开始检查时工作树干净。
> 判定口径：`PASS` 为条目完整实现并有本轮自动化证明；`PARTIAL` 为基础实现存在但关键路径或验收证据不足；`FAIL` 为要求的能力未实现。完成率仅计算 `PASS`，不把 `PARTIAL` 折算为已完成。

## 一、任务完成概况

**结论：F08 已有可运行的最小版本，但不满足完整开发验收；复审状态 `CHANGES_REQUESTED`。** 开发计划保留 `development_status: COMPLETED` 作为历史开发标记，本轮已把 F08 复审状态、结论及 11 项活动问题同步到复审入口。该状态不等于验收通过。

Rust Manager、Python SDK 和 Mock Engine 均已交付；UDS 跨语言调用、五个 RPC 的基础正向行为、并发槽与部分故障测试可运行。按下表 **24 项检查点，12 项完整、6 项部分、6 项缺失，严格完成率 12/24＝50.0%**。F08 三条专属量化验收均未达到完整证明，**0/3**；其中五 RPC 正向调用为 5/5，不能替代包含错误码、未知 capability/版本/输入、幂等、取消和恢复的 100% contract。

本结论仅代表所列本地源码与测试核验。未发现 F08 专属、绑定当前源码 SHA 的 CI/目标环境验收回执；本地 PASS 不等于远程部署或生产准入。F03、F06、F07 的既有验收范围和 SHA 各自独立，本报告不重判其状态。生产远程 mTLS 是技术方案中的后续服务形态；F08 任务明列的本地 UDS 范围已单独核查，不能以其证明远程模式。

## 二、完成情况明细统计

### 2.1 逐项检查表

| # | 要求/检查点 | 状态 | 本轮依据与边界 |
|---:|---|---|---|
| 1 | `quantos-engine-manager` 交付 | PASS | [crate](../../crates/quantos-engine-manager/src/lib.rs) 可编译，定向测试通过。 |
| 2 | Python common SDK 交付 | PASS | [SDK](../../engines/engine-sdk/sdk_src/quantos_engine_sdk/grpc.py) 包含通用服务注册和客户端。 |
| 3 | Mock Engine 交付 | PASS | [Mock 服务](../../engines/mock-engine/src/mock_engine/service.py) 及 CLI 存在，UDS 集成测试通过。 |
| 4 | manifest 基本格式审核 | PASS | [review_manifest](../../crates/quantos-engine-manager/src/lib.rs#L515) 检查名称、semver、重复 capability、非空 schema、绝对 socket 和正数 quota。 |
| 5 | 已签名/已审核 manifest 准入 | FAIL | manifest 无签名、审核状态、制品 digest 或可信来源字段；`register_engine` 仅调用格式校验。见 F08-B01。 |
| 6 | UDS gRPC | PASS | [connect_uds](../../crates/quantos-engine-manager/src/lib.rs#L563) 与真实 Python 进程往返测试通过。 |
| 7 | GetMetadata 基础 RPC | PASS | [跨语言契约测试](../../crates/quantos-engine-manager/tests/python_mock_engine.rs#L155) 返回名称/capability。尚无运行时 manifest 身份比对。 |
| 8 | Health 基础 RPC | PASS | 同一测试返回 `ready=true`；主动探测/心跳另列。 |
| 9 | Execute 基础 RPC | PASS | 同一测试返回 execution ID、Artifact 与输入 hash。业务拒绝/幂等另列。 |
| 10 | StreamExecute 基础 RPC | PASS | 同一测试接收两条事件及终态；流全过程 deadline/配额另列。 |
| 11 | Cancel 基础 RPC | PASS | 同一测试返回 `cancelled=true`；运行中取消效果另列。 |
| 12 | 主动 health、readiness、heartbeat 监督 | FAIL | Manager 仅按调用转发 `health`；无定期检查、就绪门槛、心跳失效摘流。见 F08-M01。 |
| 13 | sidecar 启停、进程崩溃监控与自动恢复 | FAIL | Manager 不持有子进程、无启动/停止/重启接口；真实崩溃测试由测试程序重启。见 F08-B02。 |
| 14 | 基础 capability 路由 | PASS | `capability_routes` 可按字符串定位引擎；仅证明单维静态路由。 |
| 15 | 租户、敏感度、成本、GPU、region、健康路由 | FAIL | manifest/路由键只有 capability；没有上述策略输入、健康过滤或候选选择。见 F08-H02。 |
| 16 | 请求速率限制 | FAIL | 仅有并发 `Semaphore`，没有时间窗口/令牌桶或租户限速。见 F08-H02。 |
| 17 | 熔断与退避 | PARTIAL | 3 次可重试失败设置 `backoff_until`；后续仍等待并尝试，无 open/half-open 拒绝策略，状态仅在 Manager 实例内。见 F08-M02。 |
| 18 | 并发配额 | PASS | `try_acquire_owned` 与真实并发拒绝测试通过。 |
| 19 | 内存资源配额 | PARTIAL | 仅靠外部调用 `report_rss_mb` 设置数值，无进程 RSS 采集/强制停止；CPU/GPU 无配额。见 F08-H03。 |
| 20 | 请求幂等与安全重试 | PARTIAL | retry 循环复用请求中的 key；Manager 无结果去重/持久请求队列，Mock 根据 key 拼 ID 但不缓存结果。见 F08-H04。 |
| 21 | 完整 deadline 与确定性错误 | PARTIAL | `Execute` RPC 等待有 timeout；连接、退避、流事件读取、Metadata/Health/Cancel 无同一绝对截止控制。见 F08-H01。 |
| 22 | 所有 Engine 共用五 RPC contract harness | FAIL | 有共同 SDK Protocol，但测试分别写在每个 Engine 的文件中；没有同一套可复用的五 RPC/错误/恢复 fixture 逐 Engine 执行。见 F08-M03。 |
| 23 | Python Engine 适配覆盖率 ≥85% | PARTIAL | 本轮定向 coverage 总计 85.04%，但 [Mock CLI](../../engines/mock-engine/src/mock_engine/server.py) 为 0%，[Mock 服务](../../engines/mock-engine/src/mock_engine/service.py) 综合覆盖 83%；总数掩盖组件缺口。见 F08-M03。 |
| 24 | 结构化观测、失败说明与部署/回滚文档 | PARTIAL | SDK 有观测封装和通用运行手册；Manager 缺主动生命周期/路由/熔断指标及 F08 专属启动恢复回滚说明。见 F08-L01。 |

**计数核对：** PASS 12、PARTIAL 6、FAIL 6，合计 24；严格已完成率 50.0%，已着手覆盖率 `(12+6)/24＝75.0%` 仅用于描述，不是验收通过率。交付物 3/3 存在，技术能力与验收深度仍不足。上述 RPC PASS 限定为基础正向往返，不宣称全部 contract fixture 通过。

### 2.2 三条量化验收

| F08 原标准 | 本轮结果 | 证据及未闭合条件 |
|---|---|---|
| `GetMetadata/Health/Execute/StreamExecute/Cancel` 100% contract | PARTIAL，未验收 | 五个正向 RPC 5/5；Mock Python 合约 33/33、本地 Rust Mock 集成 6/6。缺统一逐 Engine harness，未知 capability/版本/输入稳定错误、请求与响应身份一致性、幂等和有效运行中取消矩阵。 |
| 连续 3 次崩溃触发退避且不丢请求 | PARTIAL，未验收 | [测试](../../crates/quantos-engine-manager/tests/python_mock_engine.rs#L342) 确有 3 次 OS 进程退出、同一请求最终成功；每次新进程由测试代码的 `spawn_python_mock_engine` 启动，Manager 无自动恢复与持久请求所有权。 |
| deadline 超时 ≤2 秒返回确定性错误 | PARTIAL，未验收 | [测试](../../crates/quantos-engine-manager/tests/python_mock_engine.rs#L243) 以 500ms deadline 验证单次 Execute `<2s` 且错误码稳定；其他 RPC、连接/退避与流读取未覆盖，不能证明全路径。 |

### 2.3 本轮执行记录

| 命令/范围 | 结果 |
|---|---|
| `cargo test -p quantos-engine-manager --locked`（允许 UDS 的本机环境） | PASS；3 个 crate 单元测试、6 个 Mock 集成测试、其余 6 组 Engine 适配集成测试与 doctest 全绿。 |
| `engines/.venv/bin/pytest engines/tests/test_engine_contract.py -q --tb=short` | PASS；33/33。 |
| `engines/.venv/bin/pytest engines/tests -q --cov=quantos_engine_sdk --cov=mock_engine --cov-config=engines/pyproject.toml --cov-report=term-missing:skip-covered --tb=short` | PASS；127/127；聚合覆盖率 85.04%。Mock CLI 0%，Mock 服务 83%。 |
| `cargo fmt --check`；`cargo clippy -p quantos-engine-manager --all-targets --locked -- -D warnings` | PASS。 |
| `engines/.venv/bin/ruff check engines/engine-sdk/sdk_src engines/mock-engine/src engines/tests/test_engine_contract.py` | PASS。 |
| `node scripts/check-development-plans.mjs` | 结构 PASS；工具明确返回 `platform_load: NOT_RUN`、`model_review: NOT_RUN`。 |

首次在受限沙箱内运行 UDS 测试时，Python 33 项因 socket 绑定被操作系统拒绝、Rust 跨语言测试因子进程 socket 不出现而失败；在允许绑定的本机环境重跑后均通过。这是测试环境限制，不计为 F08 产品缺陷。直接调用 venv 的 Pyright 未继承 uv workspace 解释器配置，出现大量导入解析错误；本轮未取得按项目标准命令运行的有效 Pyright 全绿证据，亦未运行完整 workspace/三语言 CI、Buf breaking、目标环境或专属 F08 覆盖率 Gate。代码质量的全局最低条件据此仍为 `NOT RUN / NO RECEIPT`，不由上述定向 PASS 推定。

## 三、问题清单及风险分析

| 编号 | 级别 | 所属模块 | 具体表现与证据 | 影响范围/风险 |
|---|---|---|---|---|
| F08-B01 | 阻塞级 | Manager manifest 准入 | [EngineManifest](../../crates/quantos-engine-manager/src/lib.rs#L49) 不包含审核/签名/制品绑定；[register_engine](../../crates/quantos-engine-manager/src/lib.rs#L198) 仅做字段格式审核。 | 任意调用方可注册格式合法的 UDS endpoint 并覆盖 capability 路由；无法证明受批准 Engine 身份，违反默认拒绝边界。 |
| F08-B02 | 阻塞级 | Manager 生命周期与故障恢复 | Manager 无子进程句柄和监督循环；[3 次崩溃测试](../../crates/quantos-engine-manager/tests/python_mock_engine.rs#L342) 中重启由测试程序执行。 | 运行时真实 sidecar 退出后不会由 Manager 自愈，等待中的请求可能耗尽尝试并返回 transport 错误，原量化验收无法由产品能力支撑。 |
| F08-H01 | 高危 | Manager deadline/取消 | [Execute](../../crates/quantos-engine-manager/src/lib.rs#L279) 在连接和退避之后才计算剩余时间；[流读取](../../crates/quantos-engine-manager/src/lib.rs#L348) 发生在 timeout 之外；Metadata/Health/Cancel 均无 deadline。 | 失联或不结束的引擎可使请求超过承诺时限并占住调用链；错误码可能成为 `ENGINE_TRANSPORT`，不是确定性的 deadline 错误。 |
| F08-H02 | 高危 | 路由、租户策略与限流 | [路由表](../../crates/quantos-engine-manager/src/lib.rs#L181) 只有 capability→单个 Engine；无租户/敏感度/成本/GPU/region/健康约束，也无请求速率限制。 | 不同租户和数据类别无法按声明策略隔离；突发请求可越过速率预算，健康异常仍被选中。 |
| F08-H03 | 高危 | 资源配额 | [RSS 限额](../../crates/quantos-engine-manager/src/lib.rs#L226) 仅比较调用方上报值；无监督采集、超额终止或 CPU/GPU 限制。 | 实际高耗资源 Engine 可在未上报或上报滞后时继续运行，配额不能作为隔离保证。 |
| F08-H04 | 高危 | 请求校验、重试与幂等 | [execute](../../crates/quantos-engine-manager/src/lib.rs#L279) 未比较路由 capability 与 `request.capability`，也未核对 schema、调用身份或响应 metadata；失败重试只复用 key。Mock [每次重新计算](../../engines/mock-engine/src/mock_engine/service.py#L71)，无结果去重。 | 错能力/错版本/错上下文请求可能到达 Engine；不确定的响应丢失后重试可能重复产生 Artifact 或副作用，不能声称“不丢请求且不重复”。 |
| F08-H05 | 高危 | 流式与运行中取消 | [stream_execute_collect](../../crates/quantos-engine-manager/src/lib.rs#L330) 不获取并发槽、不检查 RSS；`Cancel` 无 deadline。Mock [先 sleep 后查取消集](../../engines/mock-engine/src/mock_engine/service.py#L120)，且同步阻塞处理。 | 长流可无限占用资源；取消不能保证在运行中及时生效，无法满足完整恢复/取消 contract。 |
| F08-M01 | 中危 | 健康/就绪管理 | [health](../../crates/quantos-engine-manager/src/lib.rs#L260) 只在调用时透传；无定时探测、heartbeat 或摘流。 | 失效引擎直到用户请求才被发现，readiness 不参与路由决策。 |
| F08-M02 | 中危 | 熔断/路由状态 | [await_backoff](../../crates/quantos-engine-manager/src/lib.rs#L449) 只 sleep 后继续尝试；[register_engine](../../crates/quantos-engine-manager/src/lib.rs#L198) 重注册时不清理旧 capability，冲突注册静默覆盖；实例状态无持久化。 | 故障流量持续进入坏 endpoint；重配置后可能存在指向错误 Engine 的旧路由。 |
| F08-M03 | 中危 | 契约测试与覆盖率 Gate | Python 有 [Mock 专用测试](../../engines/tests/test_engine_contract.py)，其他 Engine 各自复制测试；`quantos-testkit` 未提供统一 Engine harness。聚合覆盖率掩盖 Mock CLI 0%、服务综合 83%。 | 新 Engine 可漏掉某个 RPC 的负向/恢复用例却仍因各自局部测试全绿；适配覆盖率要求无法逐组件证明。 |
| F08-L01 | 低危 | 运维文档与证据治理 | [Manager README](../../crates/quantos-engine-manager/README.md) 只有范围摘要；缺 F08 启动、探活、崩溃/熔断恢复、回滚步骤及专属可重放 Gate。 | 运维操作依赖隐含知识；后续验收容易把“已开发”或通用 CI 误读为 F08 完整验收。 |

**活动问题合计 11 项：阻塞级 2、高危 5、中危 3、低危 1。** 阻塞级直接影响受控 Engine 准入和真实故障恢复；高危集中在截止时间、隔离路由、资源控制及幂等/流式执行。当前 Mock 的成功测试使用固定本机输入，不能代表目标服务、真实多租户负载或发布安全边界。上述都是未关闭问题；没有因测试绿灯而自动降级。

## 四、整改建议

1. **先封闭准入与监督（B01、B02）。** 将已审核制品 digest、签名/批准状态与 endpoint 身份绑定到 manifest；注册时拒绝未批准来源，握手核对 `GetMetadata` 的名称/版本/capabilities/schema。由 Manager 持有 sidecar 启停、进程退出检测、就绪确认、重启退避和请求所有权；用生产同一监督代码重跑 3 次 OS 强杀与不丢/不重复请求测试。
2. **统一执行安全边界（H01、H04、H05）。** 在入口验证 metadata、actor/tenant、capability、schema、必填引用和 deadline；用一条绝对 deadline 包住连接、退避、RPC、整段流和 Cancel。为重试引入可查询的幂等状态/结果绑定，限定只在可证明安全的错误上重试；流式请求纳入同一并发/RSS 配额，验证运行中取消及超时 ≤2 秒。
3. **补齐策略和资源控制（H02、H03、M01、M02）。** 明确候选 Engine 与租户/数据敏感度/成本/GPU/region/健康策略，冲突路由拒绝或显式优先级，重注册清旧路由；引入真实 RSS/CPU 采集与限制、租户速率限制、周期健康探测和 open/half-open/closed 熔断。用负向测试证明超额拒绝、故障摘流和恢复。
4. **建立可执行 F08 Gate（M03、L01）。** 将统一的五 RPC、未知 capability/版本/输入、错误码、幂等、deadline、运行中取消、流中断与崩溃恢复 fixture 放入公共 harness，逐 Engine 运行；对 SDK、Mock 服务和 CLI 单独核算 Python 行覆盖率 ≥85%，对新增 Rust 代码按计划的适用门槛提供 line/region/branch 回执或逐项豁免。补齐 F08 运维 Runbook、失败说明和回滚演练，再收集同一源码 SHA 的完整 CI、覆盖率与目标环境证据。
5. **复审闭环。** 上述问题逐项修复并验证后，再更新开发计划 `review_status`、`review_conclusion`、`issues` 和 `fix_tracking`；在完整 24/24 检查点、3/3 量化标准及通用最低质量 Gate 同 SHA 通过前，不将 F08 标为 `ACCEPTED`，也不将 F0 阶段 Gate 放行。
