# F07 全面复审整改与验证记录

> 日期：2026-09-24。对应 [F07 全面复审](./F07-comprehensive-review-2026-09-24.md)。本记录描述本次修复工作树；正式验收仍须绑定修复提交的完整 SHA。按用户要求，F07 目标 Gate 直连隔离 Supabase PostgreSQL，不依赖本机 PostgreSQL。

## 整改概况

F07 已进入 `FIX_VALIDATION`，**未验收**。按复审建议的顺序完成可在源码中实施的服务入口、权限、恢复、限额、幂等和 fail-closed Gate。隔离 Supabase PostgreSQL 的前向迁移、RLS 与 3 项负向/审计测试已通过；独立诊断确认 100/100 强杀恢复和唯一 Artifact 绑定。正式 Gate 两次 100 次调度 P95 分别为 2630.54ms、2381.08ms（门槛 200ms）；恢复诊断中为 2336.39ms。10 项目标库恢复样本的 Rust 覆盖率为 line 66.49%、region 58.68%，低于 90%/85% 门槛。Storage、真实浏览器及同 SHA 目标回执未取得，F06 前置依赖也未验收。原报告的 `1/18` 与 `0/3` 是初审结果；本记录不把编译或静态检查折算成新的正式验收率。

| 问题 | 本地整改 | 验证状态 |
|---|---|---|
| A01 服务与 worker | `runtime-gateway` 现接入独立 BFF 会话校验、Runtime 数据库角色、session/tool/run/cancel/Artifact HTTP 路由、PostgreSQL 扫描 worker、Storage 读写；健康检查根据 worker 扫描状态返回。仅允许 `runtime.fixture.v1`。 | 定向编译与单测 PASS；正式 HTTP/Storage `NOT RUN`。 |
| A02 缺有效回执/前置依赖 | 新增 `make f07-db-check`，直连同项目隔离 Supabase，验证 CA、前向迁移、RLS 与 F07 PostgreSQL 测试，生成带完整 SHA/dirty 标记的回执；缺目标配置时直接失败。 | 迁移/RLS 通过；数据库套件 3/4 通过，100 任务用例因 P95 失败。正式回执未取得；F06 仍 `FIX_VALIDATION`。 |
| A03 session/tool 权限 | 创建 session 核对 actor/user/workspace/account；排队检查 session 未撤销、actor 活跃、workspace 成员、account 活跃和模式、actor grant 与 tool capability；HTTP 再核对 BFF 会话与 run 所属 actor。 | 目标数据库撤销、capability 与幂等冲突用例 PASS；正式 HTTP 未运行。 |
| A04 租约 fencing | 每次 claim 写持久 `attempt_id`；checkpoint/Artifact 写入先锁定 run，再核对 attempt、owner、状态、deadline 与租约；完成/失败同样校验。Artifact 绑定有同租户复合 FK。 | 目标数据库旧 worker 负向用例 PASS；100/100 强杀恢复诊断 PASS。 |
| A05 retry | PostgreSQL 实现退避、失败终态、最大次数领取限制；过期且已耗尽的 lease 标记 failed。 | 目标数据库负向用例 PASS。 |
| A06 成本/速率 | 按租户/工具/分钟原子计数，超过最小限额回滚排队；每个新 Artifact 绑定扣 1 cost unit，重复绑定不重复扣费；数据库约束防止超预算。 | 目标数据库超限用例 PASS。最小 fixture 的成本单位为一个 Artifact 绑定。 |
| A07 Artifact 隔离 | migration 增加 run/Artifact 的租户复合 FK；写入时核对 manifest tenant 与 run tenant；读取时同时限定租户、run 与 Artifact。 | 目标迁移与 RLS PASS；真实 Storage `NOT RUN`。 |
| A08 幂等 | 新请求完整字段计算持久指纹；相同 key 不同请求返回冲突。内存模型保留原请求并作完整比较。 | 内存测试 PASS；数据库冲突测试已编写、`NOT RUN`。 |
| A09 cancel/deadline | 已过期 deadline 拒绝排队；取消只从 queued/running 进入 pending，终态无重复 audit；worker 待原 lease 结束后 finalize；timeout 可覆盖长期 pending 并写 audit。 | 源码与单测 PASS；数据库审计测试 `NOT RUN`。 |
| A10 TLS | Runtime 远端数据库只接受 `sslmode=verify-full`，OpenSSL 校验证书和主机；正式服务必须使用只能 SET `quantos_runtime` 的独立登录，拒绝 BFF/Execution 交叉角色。 | 目标 CA 验证 PASS；独立 Runtime 登录 `NOT RUN`。 |
| A11 P95 | PostgreSQL 测试默认门槛改为 200ms，Gate 固定 100 个样本与 200ms，缺 URL 强制失败。 | 本机到 `ca-central-1` 目标库的 100 次调度 P95 为 **2630.54ms，FAIL**。应由与 Runtime 同区域的执行环境取得正式指标；不放宽门槛。 |
| A12 资产/运维 | 新增版本化 workflow fixture、[部署与恢复 Runbook](../runbooks/f07_runtime_recovery.md)、计划复审记录与专项 Gate。 | 文档/结构检查 PASS；覆盖率诊断 line 66.49%、region 58.68%，不达标；正式目标回执仍缺。 |

## 本轮可重放验证

| 命令 | 结果与边界 |
|---|---|
| `cargo fmt --check` | PASS。 |
| `cargo clippy -p quantos-runtime -p runtime-gateway --all-targets --locked -- -D warnings` | PASS，零 warning。 |
| `cargo test -p quantos-runtime --lib --locked` | PASS，5/5；只验证库/内存路径。 |
| `cargo test -p runtime-gateway --locked` | PASS，1/1；不证明 live 身份、HTTP 与 Storage。 |
| `make db-migration-check` | PASS，迁移命名与 38 表 RLS 静态检查；没有执行数据库迁移。 |
| `node scripts/check-development-plans.mjs` | PASS，计划结构；平台加载/模型复审仍 `NOT_RUN`。 |
| `QUANTOS_F07_DB_REQUIRED=1 cargo test -p quantos-runtime --test postgres_runtime --locked -- --test-threads=1` | 无进程 `DATABASE_URL` 时 4 项按预期失败、1 helper ignored，证明不再假绿。 |
| `QUANTOS_SKIP_ENV=1 make f07-db-check` | 缺目标 `DATABASE_URL`/`SUPABASE_URL` 时按预期失败；已移除本机 PostgreSQL 依赖。 |
| `make f07-db-check`（隔离 Supabase） | 两次前向迁移和目标 RLS PASS；4 项数据库测试中 3 项 PASS、1 项因 P95 分别为 2630.54ms、2381.08ms >200ms FAIL，回执 `artifacts/f07/database.json` 为 FAIL。 |
| `make f07-recovery-diagnostic`（首次） | 使用同一目标库诊断强杀恢复；发现批量领取 100 任务时 30 秒租约在跨区域链路中过期，触发 fencing 拒绝。已把正式 worker 调整为每次领取 1 项并给 120 秒租约；诊断批量测试改用 30 分钟租约与 2 小时 deadline。 |
| `make f07-recovery-diagnostic`（复跑） | PASS，100/100 进程强杀后恢复、100/100 唯一 Artifact 绑定，用时 635.62 秒；调度 P95 2336.39ms，诊断不作为 P95 Gate 通过证据。 |
| `make f07-coverage-diagnostic` | 目标库 10 项恢复样本及全部 4 项数据库测试 PASS；Rust 覆盖率范围含 `quantos-runtime` 的 `lib.rs`、`pg.rs` 与 `runtime-gateway/live.rs`，line 1238/1862 = 66.49%、region 1298/2212 = 58.68%，低于门槛。诊断不等于 100 项正式回执。 |
| `make f07-fixture-retire` / Gate 自动退役 | 发现 append-only `audit_entries`/`event_log` 阻止租户级联删除；因此保留审计证据，首次定向终止 206 项残留排队/运行的 F07 fixture 任务，Gate 复跑再终止 103 项。现有 14 个测试租户、15 个测试用户留在隔离项目，未完成任务 0；不得把这一结果称为完整清理。 |
| `cargo test -p quantos-runtime -p runtime-gateway --locked` | Runtime 5 项库测试通过；研究编排的 2 项集成测试因本机 `rd-agent` UDS 未出现而失败。此环境问题不能计为 F07 通过证据，也不能被忽略为全 workspace PASS。 |

## 待取得的正式回执

1. 以隔离 Supabase PostgreSQL 运行 `make f07-db-check`，核验所有 fixture 待处理任务已终止、100/100 强杀恢复、100 个唯一 Artifact、cancel/timeout audit、P95 <200ms，以及新增负向矩阵全部通过。append-only 审计记录与其租户不可直接删除。正式回执须绑定修复提交完整 SHA；当前没有此回执。
2. 在隔离 Supabase 上配好 `quantos_runtime` 独立登录、严格 CA 和 Storage bucket/key，执行同 SHA 的真实 HTTP 会话、取消、恢复、Artifact 取回及租户/RLS 负向烟测。当前没有这些目标回执。
3. 补齐 Runtime 与 gateway 的 HTTP/worker/失败路径测试，使 line ≥90%、稳定 region ≥85%、nightly branch ≥85%。目前目标库诊断为 line 66.49%、region 58.68%，nightly branch 未测，不能宣称达标。
4. F06 前置验收通过后，核对同 SHA CI、专项数据库、目标服务与覆盖率的全部结果，关闭 12 项 issue，才可将 F07 改为 `ACCEPTED`。
