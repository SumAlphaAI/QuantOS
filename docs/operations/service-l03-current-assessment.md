# SERVICE:L03 当前服务功能检查点

2026-10-27，main。本轮按 SERVICE:L03 的本地开发范围实现并复核 feature/capability、双人职责分离、MFA 证明、额度/白名单、50 次审批签名审计及拒绝/恢复。机器回执通过后工程 Gate 为 `PASS_OWNED_LOCAL_SERVICE_L03_APPROVALS`；完整 Gate `NOT_READY_GAPS_OPEN`、stage `NOT_ASSESSED`、正式 review `IN_REVIEW`、formalAccepted=false、runtimeAdmission=DENIED。正式候选字段不提前填写；当前工程候选由 receipt 独立绑定。

## 当前实现与权限来源

`quantos_execution::assisted::AssistedApprovalService` 是每 tenant/workspace/account 的内存审批事务服务。服务拥有当前身份、不可覆盖的 subject、策略版本、challenge、一次性证明使用记录、幂等缓存和追加审计；clone 共享同一锁。可信 owner adapter 注册身份/当前研究风险投影，客户端只能提交 subject ID、expected revision 与证明，不接受自行声明 actor、capability、mode、金额或 enabled。

默认 Policy.enabled=false；业务 API 在反序列化 JSON 前检查关闭状态，服务在事务内再次检查。能力发现仅返回有效会话当前可用的 request/approve 与 executionAuthority=false，不能打开执行。申请者须 Owner/Operator，审批者须 Owner/Approver，同时有 `execution.assisted_testnet` 与对应操作 capability，账户必须明确匹配，mode 为当前审批 profile 的 AssistedLive。生产 BFF 没有连接此 adapter 或新增会话能力。

两名审批者的 actor 和 user 都必须不同，且均非发起人/申请者。MFA challenge 绑定会话及 generation、账户/租户/工作区、请求、不可变 subject hash、策略版本和半开有效期；可信 MFA adapter 在 provider 完成 step-up 后签发域隔离 HMAC。验证使用独立密钥材料和常量时间 MAC 校验，拒绝 `mfa-` 前缀、错误签名/上下文/时间、未登记 challenge 或证明重用。测试 adapter 只模拟可信完成事件；没有实际因素、IdP 或 Supabase MFA 通过声明。

数量、价格由 trusted subject 提供，from_str_exact Decimal 校验；当前单一 Binance Spot Testnet、USDT 报价、BTCUSDT/ETHUSDT 默认白名单、每请求 50000 USDT cap。拒绝非正/非有限字符串、超精度、乘法溢出、超额、错误币种/venue/symbol、Deny 风险投影、未来/过期 subject。这里的 subject 是自有可信投影，不是实际 R04/X02 来源集成或累计交易额度证明。

申请有效期最多 300 秒，step-up 最多 120 秒；一项审批后的有效期取请求、会话与证明最早期限。HTTP owner 传入时钟回调，在状态锁内采样，避免排队穿透 deadline。每次审批、缓存恢复和读取重新检查当前授权、旧审批者身份/证明、subject 撤销和策略；策略变更、关停再开启或会话 generation 变化都不能恢复旧审批。32 并发同键只推进一次 CAS，body 冲突拒绝；丢失响应只按原键/原 body 恢复。

每次成功审批原子地更新 request、消耗证明并写一条服务端 HMAC 认证的链式 Audit，绑定 scope、subject、actor/user、slot、策略/请求版本和前驱。第二人失败不删除第一条合法审计、不消耗第二人的证明；修正后可显式重试。50 次工作流得到 100 条审批审计；篡改、重排、截断、重复及公开 checksum 不能通过当前进程的验证。HMAC 是服务完整性证明，不是组织/用户公钥签字；密钥不进入证据，进程重启后独立验证/恢复未实现。密钥不 Debug/Serialize，Drop zeroize。

## 实际 HTTP 与替代端口

`execution_gateway::l03_http` 是私有 owner adapter；默认服务不监听该 router。显式 `execution-gateway --service-l03-owned-fixture off|owned-enabled` 只启动自有 loopback 测试实例，env_clear，标准 cargo test 自动构建 binary。该实例注册自有固定身份/subject，使用新随机临时 HMAC key 和受控时钟；`/_owned/step-up`、`/_owned/advance`、`/_owned/summary` 仅存在于这个 fixture，不属于可部署生产 API 或公共 BFF 契约。

真实 HTTP 验证五类业务端点 50 次 flag-off 请求（含伪造 header/body）全部 403、无审批审计/订单；能力发现明确 false。开启自有 profile 后 50 组两人审批，100 条审计在同一实际服务进程验证，提交成功后丢失响应可恢复且无额外审计。另验证角色、超额/白名单、Deny/过期 source、注入身份、MFA 伪造与半开过期拒绝。native 与 HTTP 是同类 50 参数化样本的两面验证，不宣称 100 个独立业务场景。

审批 receipt 始终 execution_authority=false，没有 RiskGuard token、SignedCommand 或 Vault credential 转换路径。一个实际 X03 command/gateway 用例验证切换 AssistedLive 身份后提交被拒、kernelCalls=0；DeploymentTarget 仍只有 Paper/Shadow。UI 与获准真实 testnet 的执行桥接归 CORE:L03/G8，不以服务审批结果授予交易权限。

旧 dual.rs 保留历史 fixture 兼容，前缀/公开 checksum 不再作为本 Gate 证据。本轮修复其 NaN/非正金额、未来审批和 Deny 决策接受问题。quantos-evidence 的旧 API 仅编译验证，不运行宽范围性能/演练组合。

## 当前验证与移交

入口：`pnpm assess:service-l03:local docs/audit/evidence/service-l03-local-20261027/attempt-NN`；先提交候选、显式白名单环境、locked/offline、不可覆盖 attempt。`pnpm check:service-l03:local` 只读复核原候选；`pnpm test:service-l03:gate` 验证范围/审计/矩阵变异。当前工程与正式 checkpoint、目标环境及运行准入分别记账，不递归重跑上游 Gate。

直接影响范围：新审批模块/HTTP adapter、旧 dual 的 3 项兼容单测与新增拒绝、锁内时钟与实际 X03 拒绝；binary 增加显式 fixture 分支，因此复验现有 L02 mTLS process 4 项，证明原模式仍可用。没有修改原 RiskGuard/issuer/dispatch 实现，不扩大为 X02/X03/L02 全闭包、数据库 campaign、覆盖率或全仓测试。前端未变，不重跑浏览器矩阵。历史证据保持 ORIGINAL_SCOPE_ONLY。

原始失败、机器矩阵、命令及确认文稿见 [证据包](../audit/evidence/service-l03-local-20261027/README.md)。秘密扫描仅当前任务差异与 attempt，沿用精确核对的 F06 公共幂等值排除并实际拒绝两条反例；不是全仓安全审计。

未决：真实 IdP/MFA/会话映射、实际 R04/X02 当前来源/风险组合、共同持久审批/audit 和跨重启/多副本恢复、生产 BFF/CSRF/TLS/部署/网络/秘密生命周期、Supabase/RLS、UI/M5 完整状态闭环、获准 testnet 审批到执行、性能/长稳/远端同 SHA CI 与正式用户确认/发布验收均 NOT_RUN。没有生产凭据、外部交易或发布。下一可执行原项 SERVICE:L04；CORE:L03/I10 完整联调仍需其原准入。
