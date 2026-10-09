# R02 原 13 项发现关闭复核台账

日期：2026-10-09；复核 HEAD `137c1aa1a42c6bd93fda96673b7ac11464a3c45a`。逐项阅读当前实现、对应回归/迁移、原实际目标证据；本轮无数据库执行。原报告逐字归档为[重构前原件](./archive/R02-comprehensive-review-before-recheck-2026-10-09.md)，其相对链接按原 `docs/audit` 目录解释。原始坏行为及失败日志见[初审证据](./evidence/r02-review-20261007/README.md)。

**13/13 CLOSED：阻塞1、高危5、中危6、低危1；没有重开原工程缺陷。** 原 M05 是错误测量入口，修复后不等于 C25 发布数值目标通过。B01 是组件成员读取故障，其部署 HTTP/JWT 部分继续由 C26 承接。

| ID / 原优先级 | 模块 | 当前关闭依据 | 回归/验证 | 剩余边界 |
|---|---|---|---|---|
| B01 / 阻塞 | [PostgreSQL 成员查询](../../crates/quantos-storage/tests/r02_boundaries.rs) | 受限 API schema/function 提供成员正向读取，非成员/跨租户及直接表访问拒绝；没有广泛开放表权限。 | `real_snapshot_permissions_invariants_and_atomic_audit` | 真实 SQL role/claims 路径通过；部署 HTTP/JWT 留 C26 |
| H01 / 高危 | [快照 hash / serde / 冷读](../../crates/quantos-storage/src/snapshot.rs) | 只读 Record、受控反序列化、canonical 重算和派生 expiry；写入/冷读/Gate 均验证。 | `regression_forged_wire_hash_quality_and_expiry_are_rejected` | 旧不可验证事实保留并拒读 |
| H02 / 高危 | [策略/交易质量规则](../../crates/quantos-storage/src/snapshot.rs) | Rust 规则校验和数据库 r02_trading_floor 双侧强制 Passed、license、freshness 底线。 | `regression_strict_floor_duplicate_and_mixed_tenant_rules_reject` | Research 例外不授予交易或商用许可 |
| H03 / 高危 | [时间窗与 source-age](../../crates/quantos-storage/src/snapshot.rs) | start≤end≤capture≤created；可信 observed/DB clock 拒绝未来时间，来源窗口时效独立检查。 | `regression_future_capture_window_and_overflow_are_errors` | 保留数据仍 Degraded；新 capture 不恢复来源新鲜度 |
| H04 / 高危 | [来源/血缘/元数据](../../crates/quantos-storage/src/provenance.rs) | Gate 拒绝空来源身份、无效血缘、缺严格用途依赖；受控 policy 解析实际事件/批准/用途。 | `regression_metadata_source_age_and_input_budget_reject; actual_identity_time_quality_and_purpose_are_required` | 仅原批准内部 Research 范围；R01 B01/FA-H01 独立 |
| H05 / 高危 | [租户/schema/对象引用](../../supabase/migrations/20261007183000_r02_reference_read_guard.sql) | 写入与读取验证 tenant/name/version/schema、完整 artifact 和 market 范围，不再只依赖全局 FK。 | `real_snapshot_permissions_invariants_and_atomic_audit` | 跨租户、缺对象和失效历史引用拒绝 |
| M01 / 中危 | [规则配置冲突](../../crates/quantos-storage/src/snapshot.rs) | 同 usage 重复或混 tenant 返回 RuleConflict；不同排列均拒绝。 | `regression_strict_floor_duplicate_and_mixed_tenant_rules_reject` | 不再静默后项覆盖 |
| M02 / 中危 | [age/资源预算](../../crates/quantos-storage/src/snapshot.rs) | age 0–86400、checked_add、向量≤1024、输入≤1MiB；极值返回错误。 | `regression_future_capture_window_and_overflow_are_errors; regression_metadata_source_age_and_input_budget_reject` | 有界无效输入回归；未声称容量压测 |
| M03 / 中危 | [Storage 登记与恢复](../../crates/quantos-storage/src/supabase_storage.rs) | HTTP 前 durable prepared intent、create-only、重复对象读回校验；登记失败保留对象并显式 reconcile。 | `real_storage_registration_failure_preserves_existing_object_and_reconciles` | 实际目标故障注入证明既有对象仍存在；未删除原事实 |
| M04 / 中危 | [行为 Gate / 生产覆盖](../../scripts/r02-behavior-negative.cjs) | 6 类变异须编译成功且被行为测试拒绝；排除 tests 的六生产文件逐项 line≥90%/region≥85%。 | `6 MUTATION_DETECTED; check-r02-coverage.mjs; r1-functional-artifacts.test.mjs` | 本轮重跑组件/变异；目标覆盖复核原实际执行，未冒称重采 |
| M05 / 中危 | [SQL P95 测量](../../crates/quantos-storage/tests/postgres_persistence.rs) | 取消快照缓存，ID/hash/标的列表直接 SQL；发布 opt-in 各25次 nearest-rank，开发明确 NOT_RUN。 | `uncached SQL measurement cannot become a cache hit; release handoff and dependency checks` | 仅关闭缓存误测缺陷；C25 数值目标仍 DEFERRED_RELEASE |
| M06 / 中危 | [写入 context / 原子审计](../../supabase/migrations/20261007180000_r02_snapshot_boundaries.sql) | 活跃 actor/capability、tenant/correlation/causation/reason 校验；成功写入与 audit 同事务、规则 revision 递增。 | `real_snapshot_permissions_invariants_and_atomic_audit` | 目标幂等不重复成功审计，拒绝不产生成功审计 |
| L01 / 低危 | [运维/环境/交付指引](../../docs/runbooks/r02_snapshot_operations.md) | 禁止本地数据库、默认功能 Gate 去除 DATABASE_URL；目标空目录/actor收尾/事实保留/向前恢复有明确规程。 | `default Gate live-test regression is rejected; 本轮 make r02-check` | 本轮发布独立的当前准入与命令勘误；历史 summary/受控 README 的旧说明见勘误 |

当前真实目标证据为[7f18b8b / attempt-05](./evidence/provider-a1-remediation-20261004/r02-current-admission-20261008/attempt-05/supporting/r02-target/receipt.json)：source inventory、嵌套日志/覆盖、成员正负/存储恢复/原子审计、chain 32 个来源事实与4来源/2reader/4wire拒绝、actor inactive/Engine停止均严格核验。当前工程回执内容与范围未变；本轮不将原数据库执行时间改为复核时间。

本轮[机器关闭矩阵](./evidence/r02-closure-recheck-20261009/closure-matrix.json)、[验证记录](./evidence/r02-closure-recheck-20261009/verification.json)及原始日志单独保存。原13项详细整改过程见[10月7日整改](./R02-remediation-2026-10-07.md)和[10月8日续修](./R02-partial-remediation-2026-10-08.md)，当前活跃结论见[全面复审](./R02-comprehensive-review-2026-10-07.md)。
