# F05/F07 手工维护与数据库数据保留

2026-10-22，依据项目用户本会话指令：取消 F05/F07 日常全量覆盖率及数据库 campaign 强制执行；数据库正确性、恢复和权限例行检查由人工维护。该策略优先于旧任务卡、Nightly 规程的日常执行要求；历史原始记录不变，不以停止检查生成 PASS。

## 执行边界与入口

- push、PR、schedule 不运行完整 F05/F07 数据库/覆盖率 campaign；主 CI 保留 `make f05-check` 的静态、负向与离线单元测试。两个旧 `*-nightly.yml` 文件保留路径，名称改为 Manual Maintenance，仅允许 `workflow_dispatch`，且 `confirm_full_database_run` 默认 false。
- 所有完整 Make/Node 入口必须显式 `QUANTOS_MANUAL_F05_F07=1`。即使设此值，GitHub push/PR/schedule 仍拒绝。只读查询、覆盖率报告检查器本身不写数据库，仍可单独使用。旧聚合执行器涉及这些检查时也须显式手工启用。
- 原始 Rust 数据库用例另须模块开关：F05 `QUANTOS_RUN_F05_POSTGRES_TESTS=1`，F07 `QUANTOS_F07_DB_REQUIRED=1`。仅导出 `DATABASE_URL` 不再触发写库。同类 F06/Portfolio 隐式执行入口也改为显式模块开关；F06 使用 `QUANTOS_RUN_F06_POSTGRES_TESTS=1`，独立 BFF login 使用 `QUANTOS_RUN_F06_BFF_LOGIN_TESTS=1`；Portfolio 使用 `QUANTOS_RUN_PORTFOLIO_POSTGRES_TESTS=1`（也接受 F09/X01 的专用开关）。R01、R02、F09 等已有专用 opt-in 保留。
- `make f05-coverage` 为可选离线覆盖率；`make f05-db-coverage` 只在远程 CI 的 disposable PostgreSQL 执行。本机仍禁止 PostgreSQL/Supabase 服务或容器。
- `QUANTOS_MANUAL_F05_F07=1 make f07-db-check`：手工完整恢复/性能检查，覆盖率明确记 `NOT_RUN`，不再为覆盖率重复 100 次持久恢复。
- `QUANTOS_MANUAL_F05_F07=1 make f07-recovery-diagnostic`：100 次恢复诊断，不授予 P95 通过；`QUANTOS_MANUAL_F05_F07=1 make f07-coverage-diagnostic`：独立 10 次恢复的覆盖率诊断。两者均 `DIAGNOSTIC_ONLY`。GitHub F07 手工工作流只运行后者；需要完整恢复时另行手工组织。
- F05 target 工具保留原有隔离及 reset 双确认；这次维护策略不授予任何实际 reset/migration 操作。F07 手工数据库/服务 campaign 在新增 fixture 前检查数据库小于 256 MiB；这是共享测试库的保守写入预算，不是 Supabase 磁盘配额或精确剩余空间。
- 发布时按冻结候选组织适用矩阵，缺失证据仍 `NOT_RUN`。日常手工维护政策不构成实际数据库验收通过，也不更新历史 READY/ACCEPTED 的源码绑定。

## 膨胀原因与修复

F05 原 GitHub Nightly 在 CI 的 disposable PostgreSQL 内运行并销毁数据库，本身不会把数据积累到共享 Supabase。共享库的风险来自直接以其连接串执行的上游/手工测试、F07 共享目标 campaign 及正常业务遥测；不能把旧库全部增长归因于 F05 Scheduled。

1. F05 的 10,000 事件、1,000 次投递及 F07 恢复用例创建唯一租户/用户和持久事件、审计、任务、Artifact。append-only 事实不可当临时数据直接删除。fixture cleanup 主要停用 actor、终止运行，不释放这些数据。反复执行会线性积累；取消日常 campaign、强制显式开关及预算检查控制新增量。
2. F07 旧完整入口先测试 100 次恢复，再执行覆盖率重复 100 次。新入口将恢复和覆盖率分开，避免隐式重复。
3. 投影完成原来每事件追加一条 `operational_metric_samples`。现在每次 dispatch batch、每租户保存最大完成延迟及 `sample_count`，不会低估该批最慢事件；单一 correlation 保留原值，混合 correlation 留空。事件、outbox、inbox、checkpoint、审计写入流程不变。指标现在是保守批次最大值，不再代表逐事件分布，不能用于计算精确逐事件分位数。
4. 原有 F09 清理入口只按特定 fixture 前缀清理，不是统一按时间的保留策略，正常 fixture retirement 也不调用它。新增七天保留策略，仅清理 `operational_metric_samples`，单次最多 5,000 条，锁等待 2 秒，语句超时 15 秒，使用 SKIP LOCKED。事件、审计、任务、Artifact、capacity alerts 不在删除范围。保留策略由人工执行，未执行时仍会积累；业务事实须按容量趋势规划归档或重建已确认可丢弃的测试项目。

## 日常人工维护

```bash
# 自动读取最新 .env.local；默认只读，报告表体积、估计活/死元组、自动 vacuum 状态及过期指标数
make database-hygiene

# 明确执行单个有界批次；重复前查看 expiredBefore、deleted 和 remainingEstimate
node scripts/database-hygiene.cjs --apply

# 只验证本次 SQL，使用当前远程 Supabase 的 TEMP 表并回滚，无业务表写入
QUANTOS_HYGIENE_POSTGRES_TESTS=1 node --test scripts/database-hygiene-postgres.test.cjs
```

本地手工脚本读取 `.env.local` 的目标配置，覆盖 shell 中遗留的旧目标值；凭据及 CA 路径不进入提交或公开回执。GitHub 没有该文件，手工工作流从现有 `F07_DATABASE_URL`、`F07_SUPABASE_URL`、`F07_CA_PEM` secrets 读取。数据库重建后应同步这三个 secrets，不能仅更新本机文件。

`DELETE` 产生的空闲页由 PostgreSQL autovacuum 回收复用，数据库文件未必立刻缩小，不能把 deleted 行数视为磁盘缩小量。本工具不自动 VACUUM FULL、不改 schema、不重置数据库、不删除审计。新库未初始化时报告 `NOT_APPLICABLE_UNINITIALIZED`，不得伪装为完整业务测试通过；初始化和服务角色/Storage 配置需独立按项目规程执行。
