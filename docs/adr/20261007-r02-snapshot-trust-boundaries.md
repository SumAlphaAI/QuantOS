# R02 快照可信边界与对象恢复

日期：2026-10-07。工程设计决策；不构成用途批准或正式验收。

原 Record 可被字段赋值/serde 改写而保留 hash，规则可关闭交易底线，插入 FK 不验证跨租户引用，对象登记失败会删除既有对象。整改以模型、持久化、读取与消费各边界的独立拒绝保证可信事实。

Record 使用只读 Deref 视图，移除外部字段赋值；自定义 Deserialize、constructor、PG、catalog 和 Gate 重验 canonical hash、派生 expiry 和时间。UTC 时间按数据库微秒规范化，避免 PostgreSQL 冷读丢弃纳秒造成合法 hash 不一致。age/向量/payload 设置明确预算，未知 DataSnapshot schema 拒绝。Rust API 因校验增加 Result，调用者必须处理错误；wire 字段形状保留，已有错误 fixture 修正时间先后关系，不削弱 look-ahead 检查。

Strategy/Trading 的 Passed、license、freshness 为硬约束，Research 例外只在明确内部研究规则中允许；重复 usage 或混合 tenant 不再被顺序覆盖。source-age 按 window.end 验证，capture/expiry 不代替实际来源时效。许可证字串不证明批准，上游来源与用途仍由 R01 提供。

DB 向前迁移验证 canonical/hash/字段、时间、schema/对象/已提交 market 范围引用，context 要求活跃 actor/capability/correlation/causation/reason，成功事实与 audit 原子提交。成员受限 API 函数校验 tenant membership，拒绝直接表授权。缓存移除，读取重验关联与 canonical；无证据的历史行保留并拒绝，用新事实替代引用，不能偷偷补写 hash。

上传前 durable intent 与不可覆盖 HTTP 处理取代 DELETE 补偿。登记失败只保留对象/待恢复状态；显式恢复先 GET/hash 再登记。目标故障试验只对具名 fixture tenant 注入临时登记失败，最后停用 actor、移除临时触发器、清理自身对象，保留元数据/审计。

行为 Gate 包含真实编译并触发测试失败的四种 mutation；编译错误不算检测成功。LLVM clean 后排除 tests 独立核算五个生产文件。SQL P95 去除缓存，作为 RELEASE 基线，不延迟正确性/必要消费者联调。剩余真实 provider→可信快照→消费者、成员 HTTP部署、远程同 SHA CI、部署负载和正式验收由各阶段承接。

详见[运维规程](../runbooks/r02_snapshot_operations.md)与[整改报告](../audit/R02-remediation-2026-10-07.md)。
