# TP01-D_LOCAL 拟议准入范围（2026-10-12）

本文件定义下一轮实现边界，不注册 profile、不发布 Gate。本轮执行接口/fixture/R02 合成输入必要前置预检；`TP01-D_LOCAL` 为 **PROPOSED_NOT_REGISTERED**，TP01-D 和 R1-SERVICE 均保持 NOT_ASSESSED。唯一 owner 为 `CORE:TP01-D`。

## 必要闭包与本地检查

直接依赖固定为 `CORE:TP01-C`、`CORE:R02`、`CORE-GATE:F0`。递归闭包严格 16 节点：F01、F02、TP01-A、F03、F04、F05、F06、F07、TP01-B、F08、F09、F0、TP01-C、R01、R02、TP01-D。不包含 R03/R04、其他 TP 或 R1-SERVICE 整体准入。

现有策略可映射 **53 组唯一必要本地检查**；完整逐节点映射及命令见 [scope.json](./evidence/tp01-d-preflight-20261012/scope.json)。F07 使用本地 Runtime/gateway 功能测试；TP01-A 使用固定本地 readonly/controlled fork、锁与许可证摘要检查，跳过远程治理。本轮预检执行聚焦组件/接口和必要前置检查，不宣称已经执行完整 53 组闭包。

正式实现时必须注册单消费者 `TP01-D_LOCAL`，新增专用范围、同候选、日志/制品、依赖、发布回滚及发布拒绝负向检查，按最终策略重新计算检查总数，然后从新的干净冻结提交完整复验全部 16 节点。53 是现有命令映射数量，不能在新增检查后照抄为最终组数。

所有必要节点必须绑定同一冻结源码、规范任务输入、实际文件/Git link、命令、时间、退出状态、日志和支持制品摘要。失败、超时、信号终止、缺失/重复/跳过必要场景均不能记 PASS。仅在完整递归验证成功后发布 TP01-D 的 DEVELOPMENT READY；依赖为该消费者专属 LOCAL_READY 投影，不把 F0/R01/R02/TP01-C 全局授予 READY。旧 TP01-C 的 bacc3b60 回执可核对当前内容，不能拼接进新候选准入。

## 本地接口与 fixture

仅保留 workflow decomposition、streaming phase projection 两项已锁定设计；queue 是 adapter-side equivalent rewrite，不应用上游 patch、不导入上游运行时。

20 个具名 fixture 每个实际调用 Execute 两次、StreamExecute 两次，共 80 次 RPC。验证稳定输出/Artifact 引用与读回、三阶段序列、审计身份与幂等、无上游 session/event/auth ticket 泄漏；18 类坏合约经双 RPC 在 Artifact/owner/input 副作用前拒绝。实际 Python 子进程禁止导入 vibe_adapter 后，Runtime→Manager→UDS→RD-Agent 的十次研究及取消功能仍须通过。

## R02 合成输入边界

只使用测试中构造的 `InMemoryDataSnapshotCatalog` / `DataSnapshotRecord` 和合成 payload/hash/lineage；验证质量、hash、租户、时间、用途与审计边界拒绝，以及实际本地 Engine 消费。fixture 内 `approved.binance.spot` / `internal-approved` 等字符串是测试标签，不构成真实来源批准或新用途许可。

不读取已退役的 32 条历史行情事实、不新采集数据、不连接数据库、不执行保留来源持久消费链。R01/R02 的真实来源/用途、平台持久链及失效授权仍待实际目标验收，不通过合成输入恢复为全局 READY。

## 测试与发布移交

下列 14 组必要检查明确 NOT_RUN，归 `RELEASE-GATE:BETA` 首次发布前实际验收：f02-database、tp01-baseline（远程治理）、f05-database、f05-volume、storage-database、storage-target、rls-target、f06-target、f07-recovery、f07-coverage、f07-service、f09-target、r01-target、r02-target。机器清单保留原命令，不以删除检查代替移交。

Supabase 可写性/迁移/RLS/事务/Auth/Storage、持久 Artifact/audit/取消恢复、实际 BFF/Runtime/JWT/真实 provider、GitHub 远程治理、OS egress、代表性性能/容量/长稳及完整平台矩阵、适用数据用途、候选同 SHA hosted CI 和 ProjectUser 发布确认均保留。没有目标或未执行为 NOT_RUN，不升级订阅、不使用生产凭据或外部发布。

本地取消/deadline 与拒绝副作用属于功能语义检查，不授予发布性能 SLO。`formalAccepted=false`；预检 PASS 不构成 TP01-D_LOCAL READY、R1-SERVICE、数据库或生产验收。
