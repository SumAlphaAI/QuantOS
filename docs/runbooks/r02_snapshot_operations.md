# R02 快照与对象恢复操作规程

日期：2026-10-07。适用范围：DataSnapshot/v1 组件开发、现有 Supabase 的具名 fixture 验证。遵循仓库 AGENTS.md，不建立本地数据库，不重建现有 Supabase。

## 可信快照创建与消费

1. 上游先确认实际来源、获准用途、数据窗口与质量。非空 license label 仅是元数据，不能替代 R01 的有效批准记录。R01 B01/FA-H01 与实时健康评估仍按开发计划追踪。
2. 注册本租户的 DataSnapshot/v1 schema 和 content-addressed artifact；血缘 kind 支持 `artifact`、`schema_registry`、`market_event_range`。market range 必须指向本租户已提交 market 聚合序列，写入校验完整范围；schema 与 artifact 校验租户、版本与实际 manifest 元组。
3. 构造 `DataSnapshotInput`，时间满足 start≤end≤capture≤created；Gate 还要求 capture≤可信 observed。时间先归一化至 PostgreSQL 微秒，再 canonical hash；age 为 0–86400 秒，单个向量≤1024、canonical input≤1 MiB。策略/交易必须包含标的、对象、来源身份、许可证、完整血缘且质量 Passed。
4. 使用具名活跃 actor 与相应 `snapshot.write`/`snapshot.rule.write` capability，提供 tenant、actor、correlation、causation 和 reason 的 `SnapshotWriteContext`。CommandMetadata 桥接缺失 causation 时使用有效 request UUID；缺失/无效身份 fail closed。snapshot/rule 与 atomic audit 在同一事务提交，幂等快照重复不重写事实或重复成功审计，rule 更新增加 revision。
5. 通过受限函数写入。`quantos_snapshot_writer` 为 NOLOGIN 角色，只获 schema usage/指定函数 execute，不获快照表 SELECT/INSERT；本次仅对已有 postgres→writer 身份启用 SET 授权，各 grantor 的 membership 分别保留，INHERIT 均为 false。回读需合并所有 grantor 条目的 SET 能力，不能仅取第一条。生产连接身份的开通与部署另行评审，不能把测试 SET ROLE 等同于生产凭据部署。
6. 成员读取使用 `quantos_snapshot_api.read_snapshot(tenant_uuid,snapshot_uuid)` / `read_quality_rules(tenant_uuid)`；函数校验真实 `auth.uid()` 的 tenant membership。authenticated/BFF 仅获 API schema usage/execute，PUBLIC/anon 拒绝；原表 force RLS 保留，不给前端 quantos schema/table 广泛 grant。目标验证使用真实 auth.users/membership + SQL role/claims，真实 HTTP JWT/BFF 路由部署尚未运行。
7. Rust 读取、反序列化、内存目录和 Gate 均重验 hash/expiry；DB 读取额外校验 canonical 内容、时间与关联引用，不使用快照缓存。不可验证的历史记录返回错误，保留事实；重新构造、审查并签发新 snapshot ID/hash 后更新消费者引用。

`expires_at=capture+age` 是快照有效期。策略/交易另检查 `window.end+age` 的实际来源新鲜度；处理时长、capture age 和 source age 分开，不能靠重新 capture 旧窗口恢复新鲜。Research 放宽仅适用于明确的内部研究用途；Strategy/Trading 的 quality/license/freshness 底线不可关闭。同 usage 重复规则或混合租户配置直接拒绝。

Wire DataSnapshot 是带 CommandMetadata 的身份/引用投影，不是 canonical input 的自足副本。服务必须按 tenant/snapshot ID/hash 载入可信持久化记录并执行 Gate；不能将客户端投影自行视为有效授权。

## 对象登记失败与恢复

`upload_and_register` 在 HTTP 前持久化 prepared intent，并要求 `artifact.write` actor。路径必须与 tenant/hash/bucket 一致；始终 x-upsert=false，409/重复响应后 GET 并验证已有 bytes。登记失败返回 `RecoveryPending { attempt_id }`，留下 prepared/reconcile 状态和原对象，**不执行补偿 DELETE**。

恢复人员先查该 attempt 的 manifest/tenant/actor/原因及 audit，再使用当前有效 actor 与 context 调用 `reconcile_upload`：GET→hash→幂等登记→registered。缺失、损坏、授权或网络失败继续保留待处理状态与 failure，不把失败标为成功。重新授权时创建/记录新 context；不长期保留测试 actor。未登记对象的清理需要独立的所有权、无引用与保留期评审，不能把恢复过程变成自动删除。

## 执行与证据

```sh
make QUANTOS_SKIP_ENV=1 r02-check
node --env-file=.env.local scripts/r02-forward-migration.cjs
QUANTOS_R02_EVIDENCE_DIR=artifacts/r02/new-empty-run make r02-live-check
QUANTOS_R02_EVIDENCE_DIR=artifacts/r02/new-empty-coverage make r02-target-coverage
```

迁移脚本仅执行本次七项向前迁移，带事务锁与 checksum ledger；已执行文件不可改写。功能入口不加载环境，目标入口只连接配置 Supabase，保留生成的 immutable metadata/audit/intent。每次空目录、新 run UUID、具名 actor；runner 有超时/进程组终止与 cleanup receipt。结束确认 actor inactive、临时 fault trigger=0、仅本次已识别对象 absent。失败目录保留，修复后另起目录。

覆盖口径为 lib/pg/snapshot/supabase_storage/wire 五个生产文件，排除 tests；clean profile 后行≥90%、region≥85%。默认目标报告按 ID/hash/标的列表各25次真实 SQL 的 nearest-rank P95，记录少量 fixture/列表limit5及 session/direct/transaction 连接模式；不代表生产容量。`make r02-release-performance` 才强制 <300ms，须在拟发布环境完成代表性数据规模、负载、网络和索引评估。

回滚采用向前修复及消费者新引用，不删除/UPDATE 快照和审计事实，不撤掉交易底线。完整 source digest、实际 Supabase/Storage回执、失败日志与清理记录见[整改证据](../audit/evidence/r02-remediation-20261007/README.md)。部署、真实成员 HTTP/BFF、R01真实可信快照链、远程同 SHA CI、发布性能和用户正式确认分别验收，本次不自动登记 READY/ACCEPTED，也不扩大此前行情运行授权。
