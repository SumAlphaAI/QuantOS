# R03 开发 Supabase 恢复与 fixture 收尾

**指定 fixture 已退役，pending=0；服务器默认只读尚未恢复，完整前置复验未运行，R03 Gate 仍 BLOCKED。** 所有目标操作仅连接既有开发 Supabase，严格 TLS/配置 CA；没有生产凭据、发布、推送或本地数据库。工程 formalAccepted=false。

2026-10-11 12:27 UTC 的[实际诊断](./evidence/r03-supabase-recovery-20261011/diagnosis.json)确认非 recovery、服务器配置文件 `default_transaction_read_only=on`，数据库1610894483 bytes，WAL184549843 bytes。事件/审计/inbox/outbox/metric 为主要空间占用。后续[控制台实测](./evidence/r03-supabase-recovery-20261011/control-plane.json)已确认同一QuantOS Test目标为FREE、EXCEEDING USAGE LIMITS、read-only/Unhealthy；Infrastructure显示1.85GB/2GB、磁盘图96%、容量调整控件disabled，仅Pro及以上可扩容。平台容量限制有明确证据；指标在只读期间可能陈旧，未取得精确触发时间/日志，不把500MB配额单独断言为唯一触发原因。

按 [Supabase 官方维护规程](https://supabase.com/docs/guides/platform/database-size#disabling-read-only-mode)，仅在维护连接执行 `SET SESSION CHARACTERISTICS AS TRANSACTION READ WRITE`，随后执行之前已准备的[精确租户退役 SQL](./evidence/r03-prerequisites-20261011/final/pending-fixture-retirement.sql)。用户明确授权恢复开发库并退役该 fixture；此操作没有改变服务器全局配置或平台容量保护。

[实际提交回执](./evidence/r03-supabase-recovery-20261011/retirement.json)：tenant `01a12acb-6530-7432-88b5-a71f4ee28668`，100个任务退役为failed，1个工具disabled，事务COMMIT，连接关闭。[独立新连接复查](./evidence/r03-supabase-recovery-20261011/after-retirement.json)确认100个历史任务保留、pending=0；普通新连接默认仍只读。保留审计、原始事实和历史tenant，没有DELETE/TRUNCATE、触发器绕过或批量历史清理。

[保留事实完整性](./evidence/r03-supabase-recovery-20261011/integrity.json)实际读取32条授权事实并调用现有策略校验：ID、aggregate/sequence、原始payload_hash与规范载荷hash全部匹配原清单。没有新采集/第三方模型调用；授权仍仅限北京时间10月14日08:00前的内部开发复验。

## 当前执行处置

| 项目 | 实际结果 |
|---|---|
| Supabase只读诊断 | OBSERVED，配置文件on，平台明确超限/磁盘压力告警 |
| 精确fixture退役 | PASS，retiredRuns=100、disabledTools=1、pending=0 |
| 独立连接复查 | PASS，pending=0持久；默认写入恢复仍BLOCKED |
| 32条事实完整性 | PASS，32/32精确匹配 |
| R03门禁负向/功能测试 | 16/16 PASS |
| `node scripts/r03-stage-check.mjs --verify` | exit0，engineering PASS / Gate BLOCKED |
| `QUANTOS_SKIP_ENV=1 make r03-admission-check` | exit2，当前前置未准入，正确拒绝 |
| 干净提交完整60组前置复验 | NOT RUN，普通服务连接仍只读；不复用上一轮53 PASS拼接准入 |

## 控制台与后续

现有配置无Supabase管理token。浏览器控制台需要登录；自动审批拒绝通过GitHub账户inrust登录，原因是多个账户可选且管理身份未明确。项目用户原始答复：**“我自行登录开发项目控制台”**。用户已自行完成sumalphai登录；Codex核对项目标识哈希与配置目标一致，并实际读取只读告警及磁盘设置。没有重试被拒绝的inrust账户，没有执行付款或订阅变更。

[实际普通写入探针](./evidence/r03-supabase-recovery-20261011/writability.json)在无维护覆盖的新连接对自有工具执行无变更UPDATE，返回SQLSTATE25006并ROLLBACK。需先解决平台实际限制，并用新的普通连接确认默认read-write及目标服务可写；不通过角色级永久覆盖隐藏平台保护。现有runbook要求保留append-only账本/验收历史，不删除或绕过触发器。保留全部证据的可执行方案是由项目用户完成Pro订阅/容量升级；[官方价目](https://supabase.com/docs/guides/platform/billing-on-supabase)为Pro起价25美元/月、每项目包含8GB磁盘，实际组织结算/其他项目/税费以控制台为准，未自行承诺费用。涉及付费升级或扩大历史数据删除范围须另行明确范围。完成后保存检查点为干净提交，在新证据目录从头运行R02/TP02必要15节点、60唯一命令组和R03 admission，不改旧失败回执，不迁移正式/CI/发布批准。

仍待验：F07调度P95 >200ms、R02代表性查询P95/部署HTTP-JWT、受限Storage身份、同SHA hosted CI、长稳、research heartbeat与真实模型费用。R03工程用户确认仍独立待办。完整历史见[前置复评报告](./R03-prerequisite-readmission-2026-10-11.md)。
