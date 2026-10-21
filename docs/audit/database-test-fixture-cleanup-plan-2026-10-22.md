# QuantOS Test 测试数据清理：只读盘点与执行边界

用户在 CI 修复过程中授权清理大量测试数据并继续测试。本计划仅针对 `.env.local` 对应的 QuantOS Test 项目 `qevsaxihufhklrayckud`。原始观察：PostgreSQL 数据库约 1.52 GiB，默认事务只读；随后 SQLSTATE 57P03，无法接收连接。控制台确认状态 Unhealthy、磁盘 96%、FREE、没有列出的项目备份。没有据此推断现有数据库已清空或恢复。

只读盘点中，四张事实/投递表空间合计约 1.31 GiB：event_log 492,158,976 bytes、audit_entries 332,005,376、inbox_receipt 318,423,040、outbox_event 259,334,144。另 operational_metric_samples 162,996,224 bytes。原始分组发现 642 个 `f05-live-` 租户；这只是前缀统计，不是最终删除许可清单。

## 执行顺序

1. 恢复 SQL 连接。界面重启请求被自动审批拒绝，理由是共享测试项目会中断数分钟，原授权未明确包括重启。已单独向用户请求此项目重启授权；未获授权前不执行或绕行。
2. 只读冻结候选：slug 必须等于 `f05-live-<tenant uuid>`、name 等于 slug，所有 actor 均为 service 且 service_name 等于 `f05-test-<actor uuid>`。这些生成规则可在 `crates/quantos-event/tests/postgres_persistence.rs` 核对。输出具体 UUID 和所有关联表的精确行数，排除归属不明确的租户。
3. 在一致只读快照内导出候选租户及关联行，逐表保存 JSONL gzip、行数和 SHA256 至 Git 忽略的本地 `artifacts/db-cleanup/`。校验备份完整性后再删除。保留迁移、RLS、Auth、Storage 对象以及其他租户；数据库事件备份保留原始字段，Git 中只存摘要与执行结果。
4. 执行带候选清单绑定和数量断言的单事务清理，限制为已备份的测试租户。现有 event_log、audit_entries、market_source_receipt 的 append-only 删除触发器需要在受控事务内临时停用后恢复；所有 FK 保持有效。非 cascade 引用必须先显式核对与按租户清理。异常即回滚，不通过删除结构、schema reset 或清空全库解决。
5. 对受影响大表执行必要的空间回收，记录锁等待和容量前后差异。VACUUM FULL 会锁定整表；执行前必须确认维护范围。按 Supabase 官方流程，仅在清理会话内恢复可写，以便清理；空间回收后另建连接验证默认可写及真实写入/清理探针。不能将 SET 成功等同于平台容量问题解决。
6. 用新候选复跑 F05/F07 相关覆盖率与断言，保留所有失败/中断，不拼接旧托管结果成为新 PASS。完成后继续本地 Git 提交；不自动推送。

参考：[Supabase Database Size and Read-Only Mode](https://supabase.com/docs/guides/platform/database-size)。只读模式、会话恢复可写与空间回收的约束以该官方页面为依据；实际项目的健康/容量以本轮控制台与 SQL 记录为准。

当前状态：READ_ONLY_PLAN；未删除数据、未停用触发器、未重置 schema、未修改数据库默认配置、未重启项目。完整清理和覆盖率复验仍待执行。

## 2026-10-22 重启授权后的执行追加

用户明确答复“允许重启此测试项目”。控制台随后进入 Restarting，并返回项目页，重启流程已经执行。前述重启审批阻断已解除；原始拒绝与随后授权均保留为历史。

重启未恢复 SQL：只读连接先返回 08006 timeout，结束后返回 57P03。控制台 PostgreSQL 日志 2026-10-22 07:54:06 Asia/Shanghai 明确报 SQLSTATE 53100：`could not write to file "pg_wal/xlogtemp.2566": No space left on device`，随后 startup process 失败并关闭数据库。因此无法在当前状态下执行备份、DELETE、VACUUM 或任何清理 SQL。

Infrastructure 页面显示 Free/Nano，磁盘扩容控件 disabled，Scaling 提示仅 Pro 及以上可用。不可用容量指标显示为 0，不据此声称数据库已清空。没有升级付费、删除项目或重置数据。现有只读备份程序保持待执行。

当前状态更新为 **BLOCKED_DATABASE_BOOT_DISK_FULL**。需先由平台恢复可启动空间，或由用户自行完成付费扩容，再执行上面的备份/定向清理/覆盖率复验顺序。[报障草稿](supabase-disk-recovery-support-draft-2026-10-22.md)已准备但未发送；[恢复证据](evidence/ci-recovery-20261022/)包含用户原始重启授权、SQL 探测和控制台观察记录。原 CI 修复提交 `09e452da` 保持原有范围与阻断状态，不改记为完整 Nightly PASS。

用户随后选择“我自行联系支持”。Codex 未发送报障请求，也未执行付费升级。待用户/平台恢复 PostgreSQL 连接与启动空间后，继续只读备份、定向清理、空间回收及 F05/F07 覆盖率复验；目前清理与完整复验仍为 BLOCKED，不能宣称通过。
