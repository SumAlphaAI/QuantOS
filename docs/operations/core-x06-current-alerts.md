# CORE:X06 DEVELOPMENT 当前 X05 Alert 与公共审计接续

本轮范围是当前 native/X01/X05 的同源 OPEN 证据进入公共应用内只读收件箱及 C10。身份仍为 Assisted Live，C01/F06 为原显式 reference 适配；独立 books 仅为另一个进程签名的原始协议观察，不代表完整 venue 账户 books/marks。不得用历史 Shadow READY 替代当前业务联调。

现有 `/v1/alerts` 和 `/v1/alerts/{alertId}` 在 owned Assisted profile 直接接收经过认证恢复的 X05 outbox，不初始化 Paper/Shadow OperationsHost。每个 evidenceId 只消费一次，alert UUID、audit UUID 与 correlation 稳定绑定原证据；有 binding 的事件接在原 request C10 链末尾，无 binding 的账户级差异使用独立告警 correlation。旧审计事件不改写，消费事件只包含证据/报告/ledger/books hash 和原 command/request 绑定，不输出完整协议 body、证书私钥或凭据。

`alerts.json` 通过现有 DurableStore HMAC、稳定 OS 锁、fsync 和原子替换保存完整证据与 append-only 消费链；`approvals.json` 保存消费锚点。恢复重算消费链，对比当前 X05 重建的完整来源，拒绝来源消失、修改、错 scope、非法状态、回滚/分叉、损坏或缺失非空账本。同机审批事务锁串行化跨 BFF 进程，写后崩溃可从原已认证前缀继续；不宣称数据库事务或跨主机一致性。

投递通过当前授权读取发生，P23 显示 X05 evidence/report/ledger/books/command 和 UNKNOWN 保留提示，可读取对应 C10 消费事件并跳转审计。公共 list 按当前账户过滤，排序/分页游标绑定会话、筛选条件、页大小，分页快照不混入后续新项；进程重启后旧游标需重新读取。当前最大源/收件箱 20,000 项，分页最多 100 项；容量超限拒绝，禁止删除业务义务换取空间。

当前 profile 的 ack/unack、订阅、实时流、Operations/Admin 写入和未知动作保持拒绝；UI 即使被伪造 operator capability 也不会发送这些变更。GET 身份核对失败、撤权或 scope 变化清除私有证据；本地只读策略拒绝保留已授权快照。SourceEvidence 的条件约束由 OpenAPI 3.1 `if/then/else` 及前端 `fact` 交叉字段验证共同执行；生成 Zod 负责基础结构，不能单独替代条件语义验证。

UNKNOWN 即使独立观察有已成交 Fill 仍不入账、不重发、不关闭。X05 恢复匹配、刷新、重复投递或 BFF 重启都不会解决已消费 OPEN 告警，阅读与业务关闭也不得混同。本轮没有关闭 API 或隐式清理。真实异步成交查询、非报价币换算、估值和新风险输入仍待相应模块接续。

验证入口：

```sh
node scripts/core-x06-current-review.mjs --audit
node scripts/core-x06-current-review.mjs --run docs/audit/evidence/core-x06-alert-local-20261029/attempt-NN
node docs/audit/evidence/core-x06-alert-local-20261029/verify.mjs
```

实际执行必须新目录、冻结 main 源码；环境由脚本白名单构造，不读取 dotenv/数据库/生产凭据。Rust 模型、既有 Paper/Shadow C11 回归、实际 loopback BFF→mTLS→native/X01/X05→Alert/C10 和 P23 浏览器分别记账；历史 X05 212 文件保持原 SHA/范围，不在新源码上重授历史 PASS。失败尝试、信号和未执行项不能删改为通过。

工程 Gate 目标 `PASS_CURRENT_X05_ALERT_PUBLIC_INBOX_COMMON_AUDIT`；完整 Gate `NOT_READY_GAPS_OPEN`，stage `NOT_ASSESSED`，正式确认待用户，runtimeAdmission `DENIED`，M5 `PREPARED_NOT_READY`。19 gap、8 义务保持 OPEN。外部通知、阅读确认/明确审批关闭、完整 books/marks、原生 kill/C11 版本化启用、真实身份/目标 Supabase/Vault/RLS、跨主机、真实 testnet、性能/安全/长稳/同 SHA CI、完整无障碍及发布均未验收。

下一可执行：`CORE-GATE:L4 DEVELOPMENT`，评估当前 X02/X04/X01/X05/X06 组合与剩余缺口。此评估不自动提升 INTEGRATION/RELEASE；不得使用生产凭据、推送或外部发布。
