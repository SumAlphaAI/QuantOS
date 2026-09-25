# F07 Runtime 最小可恢复工作流全面复审

> 复审日期：2026-09-24；源码基线：`3e3113995a80df5af0f2d8e3841ade712bb9659e`；范围：F07 需求、`quantos-runtime`、`runtime-gateway`、持久化 migration、相关测试与 CI 接线。结论仅针对该基线与本轮可获得的证据。

## 一、任务完成概况

**结论：`CHANGES_REQUESTED`，F07 不具备验收条件。** 开发计划的 `development_status: COMPLETED` 是原开发标记；其复审入口仍为 `NOT_STARTED`。本次独立复核按下表 18 个检查点统计：**完整通过 1/18（5.6%），部分实现 9/18（50.0%），明确未满足 5/18（27.8%），未运行或无有效回执 3/18（16.7%）**。严格验收完成率为 **1/18（5.6%）**；若只看存在实现的代码，10/18 有完整或部分实现，但不能折算为验收通过。三个量化标准 **0/3 有效通过**。

F07 的前置依赖是 F04–F06。F04、F05 有各自的历史同 SHA 验收记录；F06 当前仍在 `FIX_VALIDATION`，并非已验收依赖。F07 代码目前提供内存模型、PostgreSQL 数据访问和部分测试，但正式 `runtime-gateway` 没有启动鉴权、调度、worker 或 Artifact 服务。因而不能将 crate 可编译、内存测试通过或数据库表存在视为可恢复工作流交付。

### 本轮执行与证据边界

| 检查 | 结果 | 解释 |
|---|---|---|
| `cargo test -p quantos-runtime --lib --locked` | PASS，5/5 | 内存模型与 R03 单元测试；其中“重启”测试通过克隆内存结构模拟。 |
| `cargo test -p quantos-runtime --test postgres_runtime --locked -- --nocapture` | 2 reported passed、1 ignored；**数据库实际执行 0/2** | 两个普通测试均打印 `DATABASE_URL is not set` 后返回；helper 仅由真实数据库测试调用。进程未自动读取 `.env.local`。不可记作 PostgreSQL PASS。 |
| `cargo fmt --check`；`cargo clippy -p quantos-runtime -p runtime-gateway --all-targets --locked -- -D warnings` | PASS | 只证明本轮范围内格式和静态 lint。 |
| `node scripts/check-development-plans.mjs` | PASS | 仅计划结构；输出同时注明 platform load、model review 为 `NOT_RUN`。 |
| F07 专项数据库、覆盖率、正式服务、100 任务强杀、P95、同 SHA CI/目标回执 | **NOT RUN / NO RECEIPT** | 本轮未对目标库写入或部署；没有可核验的 F07 专项正式回执。 |

## 二、完成情况明细统计

判定口径：`通过` = 实现和本轮有效自动化证据均覆盖该项；`部分` = 有对应结构或代码，但关键拒绝/恢复/接入路径缺失；`未满足` = 代码明确缺少或与要求冲突；`未验证` = 有测试入口或主张，但没有实际执行回执。每项等权仅为透明统计，风险仍按问题优先级处理。

| # | 需求/验收点 | 状态 | 依据与缺口 |
|---:|---|---|---|
| 01 | `quantos-runtime` 交付与可编译 | 通过 | crate 存在；本轮库测试、fmt、定向 Clippy 通过。 |
| 02 | 持久任务基础表、租约/索引/RLS migration | 部分 | `20260730130000_runtime_workflows.sql` 定义 session、tool、run、checkpoint、artifact binding 与 RLS；本轮未执行数据库迁移和 RLS 负向验证。 |
| 03 | session 生命周期和主上下文 | 部分 | `create_session` 持久化上下文；调度只检查到期，未检查 `revoked_at`，正式入口也未绑定验证会话。 |
| 04 | tool registry 与能力授权 | 部分 | 可注册、禁用、按租户查找；调度没有校验请求 capability 等于注册 capability，也未验证 actor 的 capability/模式。 |
| 05 | 持久调度、幂等语义 | 部分 | PostgreSQL 唯一键防重复 ID；同 key 不同 `input_hash`/tool/session 直接返回旧 run，缺请求一致性拒绝。 |
| 06 | deadline 与确定性超时 | 部分 | claim 前 sweep 可写 timeout audit；调度允许已过期 deadline，`cancel_requested` 超时被排除，运行中副作用没有 deadline fencing。 |
| 07 | cancel | 部分 | 请求与 finalize 有数据库状态/audit；无正式 worker 执行取消，也缺终态与竞态保护。 |
| 08 | retry 与失败终态 | 未满足 | 内存 kernel 有 `fail_and_retry`；`PgRuntimeStore` 无对应持久方法，过期租约重复 claim 不检查 `max_attempts`。 |
| 09 | checkpoint 与恢复 | 部分 | 持久 checkpoint 可读写；写入未校验当前 lease/token、未阻止旧 worker 覆盖新 checkpoint。 |
| 10 | Artifact API 与去重 | 部分 | 可把 metadata/绑定写入数据库、按 hash 去重；没有正式 API/对象内容写入或读取路径，也未校验 manifest tenant 与 run tenant 相同。 |
| 11 | 成本限额 | 未满足 | `cost_budget_units` 仅在调度时取最小值并保存；没有消耗计量或超限拒绝。 |
| 12 | 速率限额 | 未满足 | `rate_limit_per_minute` 仅保存；没有窗口计数、并发领取限制或超限拒绝。 |
| 13 | 正式 worker 与服务接线 | 未满足 | `runtime-gateway` 的 main 仅输出 ready 或启动 observability；auth/store builder 均标记 dead code，未形成实际任务循环。 |
| 14 | worker 强杀后 100 任务恢复且无重复 Artifact | 未验证 | PostgreSQL 测试具备 kill/claim/计数断言，但本轮 0/2 数据库测试执行；内存 clone 测试不是进程强杀。 |
| 15 | cancel/timeout 事件均带 audit | 部分 | PostgreSQL 事务写 audit 的源码路径存在；真实数据库测试本轮未执行，且终态转换可重复写审计。 |
| 16 | 调度 P95 <200ms | 未验证 | 内存测试检查 100 次总耗时 <200ms；PostgreSQL 测试默认门槛为 **1500ms**，本轮没有数据库样本。 |
| 17 | workflow fixtures、输入/拒绝/恢复自动化覆盖 | 未满足 | 测试有内嵌构造器，未发现 F07 专属版本化 workflow fixtures；缺能力不匹配、撤销会话、超限、幂等冲突、旧 lease 与最大重试的负向测试。 |
| 18 | F07 专项 Gate、覆盖率、目标运维与依赖验收 | 未验证 | CI 有 workspace 通用测试但无 F07 fail-closed DB/强杀/P95 Gate；未见 F07 Rust line ≥90%、稳定 region ≥85%、nightly branch ≥85% 回执及部署/回滚 Runbook；F06 依赖未验收。 |

**分项统计**：技术/交付与开发规范 15 项：通过 1、部分 8、未满足 5、未验证 1；三项量化验收（#14–16）为未验证 2、部分 1，即 0/3 严格通过。表中总计通过 1、部分 9、未满足 5、未验证 3。#15 的“部分”只确认 audit 代码路径，不表示量化验收通过。通用 Python/TypeScript/浏览器、全 workspace 测试与供应链检查本轮未重跑，不能从定向 Rust PASS 外推为全任务最低标准通过。

## 三、问题清单及风险分析

| ID / 优先级 | 所属模块 | 具体表现与证据 | 影响范围 |
|---|---|---|---|
| F07-A01 **阻塞级** | `runtime-gateway` / 部署 | [`main.rs`](../../services/runtime-gateway/src/main.rs) 仅启动观测端口或打印 ready；builder 不调用，缺请求入口、worker 循环、恢复与 Artifact 服务。 | 无法对真实请求执行 F07 工作流；健康输出可能被误读为服务已就绪。 |
| F07-A02 **阻塞级** | 验收 Gate / 依赖 | [PostgreSQL 测试](../../crates/quantos-runtime/tests/postgres_runtime.rs) 在无 `DATABASE_URL` 时提前返回；无 F07 专项 CI Gate/目标回执；F06 尚处修复验证。 | 100 任务强杀、audit、P95 及权限隔离均未可重复验收，不能放行 F07。 |
| F07-A03 **高危** | session / tool 授权 | [`pg.rs`](../../crates/quantos-runtime/src/pg.rs) 调度 SQL 检查 `expires_at` 和 tool enabled，但不检查 `revoked_at`、session actor 的 capability，也未比较 `tool.capability` 与 `$3`。 | 内部调用者可通过传入不匹配 capability 排队；撤销会话仍可调度，服务接入后扩大权限风险。 |
| F07-A04 **高危** | worker 租约 / checkpoint / Artifact | `save_checkpoint`、`record_artifact` 仅按 run ID 写；`complete_run` 只比较 worker 名，不比较租约期限或唯一 attempt token（[`pg.rs`](../../crates/quantos-runtime/src/pg.rs)）。 | 旧 worker 可在 lease 过期/新 worker 接管后写入 checkpoint/Artifact 或误完成；强杀恢复不保证唯一副作用。 |
| F07-A05 **高危** | retry | PostgreSQL claim 增加 attempts，但不按 `max_attempts` 终止；未提供持久 `fail_and_retry`。 | 永久故障可无限领取；失败退避和最终状态不符合持久任务要求。 |
| F07-A06 **高危** | 成本/速率治理 | [`pg.rs`](../../crates/quantos-runtime/src/pg.rs) 仅把预算/每分钟限额存入 run；无用量账、原子配额、拒绝或测试。 | 成本和请求量可超过约定上限，故障时形成资源放大。 |
| F07-A07 **高危** | Artifact 隔离 | `record_artifact` 接受调用方提供的 manifest tenant 和 run ID，未核对两者租户；binding 表也缺租户一致性复合约束（[migration](../../supabase/migrations/20260730130000_runtime_workflows.sql)）。 | 使用高权限数据库角色时可把跨租户 Artifact 绑定到 run，破坏租户隔离。 |
| F07-A08 **中危** | 幂等调度 | `on conflict (tenant_id, idempotency_key)` 返回旧 run，不比较 input hash、tool、session；内存实现相同。 | 同 key 不同输入静默得到旧任务，调用方可能误认新任务已受理。 |
| F07-A09 **中危** | cancel / deadline | `finalize_cancelled` 无合法前态条件，`request_cancel` 对终态仍更新时间和写 audit；timeout sweep 排除 cancel requested，且调度允许过期 deadline。 | 终态可被后续取消覆盖，取消中的任务可能无限滞留；审计重复或状态含混。 |
| F07-A10 **中危** | TLS / 数据库连接 | `PgRuntimeStore::connect_client` 在 `sslmode=require/prefer` 时设置 `danger_accept_invalid_certs(true)`（[`pg.rs`](../../crates/quantos-runtime/src/pg.rs)）。 | 未来正式服务若沿用这些 URL，无法验证数据库服务身份；需与 F06 严格 TLS 基线一致。 |
| F07-A11 **中危** | 性能测试 | PostgreSQL 套件默认 P95 门槛 1500ms；内存测试用 100 次合计 <200ms，均不等于实际调度 P95 <200ms。 | 可能在远高于规格的数据库延迟下得到绿色结果。 |
| F07-A12 **低危** | 文档/测试资产 | F07 专属 workflow fixture、部署/回滚/恢复 Runbook、覆盖率豁免清单及复审入口尚未建立完整追踪。 | 后续维护与同 SHA 复验成本高，完成标记缺清晰边界。 |

风险集中在**服务未接线、权限与租户边界、租约 fencing、持久重试、预算/速率执行**。目前缺少正式流量入口，不能声称这些缺口已经在生产路径被利用；但若直接以现有 store 构建服务，它们会成为实际风险。F05 的事件消费者和目标数据库回执只覆盖 F05，不能替代 F07 的任务 worker、Artifact 与 P95 回执。

## 四、整改建议与复验顺序

1. **建立可运行闭环**：让 `runtime-gateway` 使用受验证的身份上下文、受控数据库角色和真实 worker，执行调度→claim→checkpoint→Artifact→完成/取消/超时/重试；ready 应在关键依赖可用后才报告。补部署、故障恢复和回滚 Runbook。
2. **先封闭安全边界**：调度校验 session 未撤销、成员/模式/capability、tool capability、deadline；Artifact run 与 manifest 租户一致；正式连接只接受严格证书校验。所有拒绝路径做负向测试。
3. **修复恢复语义**：为每次 claim 持久生成唯一 fencing token；checkpoint、Artifact、完成、失败、取消均校验 token、当前状态、租约与 deadline；实现 PostgreSQL 原子 retry/backoff、最大次数失败终态和可恢复取消。用旧 worker 迟到、双 worker 竞争与 kill 后重放验证。
4. **落实限额和幂等**：原子记录成本/速率用量并拒绝超限；同 idempotency key 仅对等价请求返回原 run，不等价输入返回稳定冲突错误。
5. **建立 F07 fail-closed Gate**：固定 workflow fixtures 与负向矩阵；隔离 PostgreSQL 中真实 OS kill 的 100/100 恢复、100/100 唯一 Artifact、cancel/timeout audit 和逐次调度 P95 <200ms；未提供 DB、样本不足或无回执必须失败而非返回通过。收集 line/region/branch 覆盖率与同完整 SHA 的 CI、目标数据库、服务烟测回执，并核验 F06 依赖验收后再更新计划状态。

复验通过条件：18/18 检查点有相应源码、自动化及目标证据，3/3 量化标准在同一完整源码 SHA 下通过，阻塞/高危问题关闭且回归不引入新的未豁免缺陷。本报告只记录复审发现；未修改 F07 的开发状态或实施代码。
