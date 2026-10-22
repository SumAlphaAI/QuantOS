# F05/F07 日常门禁取消与数据库膨胀修复

2026-10-22，从 `a57ca5f0` 的 main 开始；此前 `09e452da`、`a57ca5f0` 为已有本地提交。本轮按用户新指令调整日常策略，生成本地提交，不推送。新指令取代旧报告“恢复数据库后必须补跑完整覆盖率”的后续工作安排；原失败、只读及磁盘耗尽证据保持原样。

## 原因与实际修改

[旧库只读盘点](database-test-fixture-cleanup-plan-2026-10-22.md)显示数据库约 1.52 GiB，event/audit/inbox/outbox 合计约 1.31 GiB，指标约 163 MB，存在 642 个 F05 fixture 租户。这些是旧目标的历史实测，不是新库当前状态。当前代码核对得到：

- 部分 F05/F07、F06、Portfolio 测试只要有 DATABASE_URL 就写真实库；反复创建唯一 fixture，而 retirement 主要停用 actor/终止任务，append-only 事实仍保留。
- F07 完整入口执行 100 次恢复后，又为覆盖率重复 100 次；投影完成还逐事件写指标，进一步复制高规模事件的存储负担。
- 既有 F09 前缀清理工具不是统一按时间的有界保留策略，正常 fixture retirement 也不调用该工具；仅降低覆盖率阈值不能解决这些新增量。

F05 原 Nightly 使用 CI disposable PostgreSQL，数据库在结束时销毁，不会直接膨胀共享 Supabase；共享库增长来自连接该目标的测试/上游调用、F07 共享 campaign 及指标保留方式。本轮没有推断每种调用的精确历史增长占比。

本轮移除主 CI 的完整 F05 DB Gate、f05-check 的覆盖率依赖；两个 F05/F07 工作流改为仅手工触发且默认不确认。Make/Node/旧聚合入口要求显式 `QUANTOS_MANUAL_F05_F07=1`，push/PR/schedule 即便传开关也拒绝；Rust 真实数据库用例要求模块开关，连接串本身不再授权执行。F07 恢复与覆盖率拆开，覆盖率缺席明确 NOT_RUN。

投影指标改为每批每租户最大延迟及 sample_count，单 correlation 保留、混合 correlation 为空；保守反映最慢事件，不能解释为逐事件分位分布。新增七天瞬时指标保留工具，默认只读，明确 --apply 时单次最多删除 5,000 条、语句超时 15 秒；不删除业务事件/审计/任务/Artifact/告警。F07 手工新增 fixture 前设置 256 MiB 数据库预算。同步 AGENTS、机器策略、开发计划、操作及验收边界；不重写历史验收。

## 最新目标与验证

所有本轮目标连接均从最新 `.env.local` 读取并严格验证 CA/TLS。新旧目标不同，新目标标识只保存 SHA256 截断摘要 `2037eede650f243c`。实际 PostgreSQL 17.11、默认可写，库约 10.84 MB；业务 schema 尚未初始化，指标表不存在，无需删除业务数据。本轮未初始化、迁移、reset、建立本地数据库，也未停用 append-only 保护。

| 检查 | 结果及范围 |
| --- | --- |
| Node 负向/覆盖率检查器/手工门禁/聚合证据/计划回归 | 124 PASS；含 Make/Node 入口无开关拒绝、CI 事件拒绝、最新本地配置覆盖旧导出、有界清理默认只读 |
| make f05-check | PASS；事件 11、存储 23 个测试；真实数据库用例未启用 |
| 受影响 Rust 四包功能与无开关不连接检查 | PASS；HTTP stub 实际执行，F05/F07 真实数据库用例 NOT_RUN；不把 Rust 跳过后返回的 ok 算作数据库验收 |
| F06/Portfolio 额外隐式写入防护 | PASS；故意使用无效连接串、关闭模块开关，未连接数据库 |
| 实际 Supabase TEMP SQL 组件检查 | 1 PASS：执行从 Rust 提取的真实 SQL，300 事件得到 2 个批次指标，最大值 250/300 秒、sample_count 250/50、单/混合 correlation 正确；单事件 correlation 兼容；5,007 条过期临时指标仅删 5,000 条，3 条近期指标和 300 条事件/outbox 保留，事务回滚且临时表消失 |
| 新目标只读盘点 | PASS_READ_ONLY；业务指标清理 NOT_APPLICABLE_UNINITIALIZED，实际删除业务行 0 |
| fmt、6 个受影响 Rust 包 Clippy --all-targets -D warnings、JS 语法、计划结构/顺序、diff whitespace | PASS |
| Git 历史秘密扫描 | PASS（731 commits，约 1.77 GB）；暂存扫描结果见 evidence-files.json 同目录日志 |
| 完整 F05/F07 覆盖率、1 万事件/100 次持久恢复、业务 schema/RLS/Storage 验收、托管 CI、部署/发布 | NOT_RUN；本轮不产生新的全量验收 READY |

保留初轮 Rust HTTP stub 因沙箱禁止监听而失败、编辑中 fmt/语法修正及文档链接尚未落盘的失败记录。放开 HTTP stub 监听权限及完成文件后聚焦复验通过；没有通过真实 DB 重跑修复离线测试。

## 远程配置待授权

GitHub 上现有 `F07_DATABASE_URL`、`F07_SUPABASE_URL`、`F07_CA_PEM` 仍为九月配置，F07/R01/F09 的手工数据库任务共享这些 secrets。已准备仅更新这三个 secret 的命令（值走标准输入、不输出、不进入 Git），但自动批准审查拒绝，理由是用户尚未明确授权向具体远程仓库 `SumAlphaAI/QuantOS` 发送新数据库敏感凭据。没有绕行，三个 secrets 未修改，状态 BLOCKED_APPROVAL。

代码、工作流与本地最新配置验证已完成；远程 secrets 同步须单独明确授权。本地提交未推送，远端工作流定义也尚未更新，取消 schedule 的实际生效需后续用户推送。新库完整业务初始化及候选发布验收另行组织，不能把 TEMP 组件测试提升为业务数据库验收。

[维护规程](../operations/f05-f07-manual-maintenance.md)与[证据目录](evidence/f05-f07-manual-20261022/)包含命令、失败及最终日志、目标只读结果、生产 SQL 摘要和源码清单。本轮状态：功能/策略修复 PASS；SQL 组件验证 PASS；完整业务数据库验收 NOT_RUN；GitHub secrets 同步 BLOCKED_APPROVAL。
