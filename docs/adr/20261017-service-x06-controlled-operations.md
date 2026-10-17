# SERVICE:X06：固定作用域的执行、审计与运维服务

状态：本地功能实现；真实消费者与目标持久化待验。依据最新 AGENTS.md 的 FUNCTION_AND_IMPACT 策略，不重跑无关依赖闭包。

选择将服务放在独立 `quantos-operations` crate，组合真实 X01/RiskGuard/AtomicCommandIssuer/SignedExecutionGateway 与 F09 类型。服务不直接拥有内核回调或签发能力，客户端没有任意凭据、改账、Runbook或实际 venue 工具。初始化检查 issuer/guard/gateway 实例身份和作用域，防止 kill 控制与真实执行器错接。

锁序 service→gateway→issuer→risk。提交前的服务账本与全网关事实 anchor 一致；anchor CAS 在网关锁内与当前签发/风险检查及内核调用连续执行。私有 staged 状态提交避免本地错误留下部分账本，prepare 在外部 IO 之前写入隔离记录。外部结果不能证明时保留 Uncertain，不把读取回执当成再次执行许可。

服务虚拟账本仅从可信 seed 与真实 Fill 构建；保存 hash链和 Fill→PortfolioEvent 关联，完整网关事实并集验证当前 source anchor。历史证据可查询但明确 `portfolio_source_current=false`，风险/下单必须拒绝不完整来源。F05 append-only 语义在本地服务 journal 实现，不声称已连接 F05 PostgreSQL ledger/outbox。

权限依赖精确账户能力，不使用 Owner 跨租户捷径。MFA断言和checkpoint锚不可反序列化；二者构造是可信宿主边界，Rust 类型不能替代真实 F06 身份提供方。恢复/incident关闭要求不同 actor 和 user；审批一次消费与版本CAS；当前身份/时效校验早于幂等回执读取。

F09完整健康与规则化告警输入只由固定 observer写入；源时间单调，新鲜度控制恢复，未知执行状态不能被外部greenwash。自由文本只做摘要，查询不暴露签名或任意内核原因。Runbook为只读封闭枚举，反序列化严格拒绝额外参数。

限制：本地同步锁与checkpoint锚不提供跨进程/跨组件数据库原子事务；同租约实例恢复不是跨进程崩溃恢复。多写者导致 fail closed，生产部署必须以可信durable权威统一写入和重建。X01 f64账本不是精确会计；容量/时限保护不是性能SLO。实际 F06 session/MFA、Supabase/RLS、F05/outbox、部署F09/X05、BFF/页面、OS隔离/敏感留存与性能/长稳/同SHA CI另验。
