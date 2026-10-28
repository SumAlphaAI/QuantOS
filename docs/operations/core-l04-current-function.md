# CORE:L04 当前本机功能与验收边界

日期：2026-10-28。接续 [CORE:L03 原 SHA 移交](../audit/evidence/core-l03-local-20261027/handoff.json)，基线为 `58ebf4a9ca96e71059b0d4c80427fcd1052b6e75`；历史 L02/L03/FEP-8 回执不改绑。

本轮接通公共 C01/F06 reference → SERVICE:L03 独立审批 → AssistedExecution → ZoneExecutionKernel → 现有 L02 ZoneClient/RestrictedHost → L01 ProtocolKernel 的同一 Command/Order。受限服务为真实独立进程，双向 TLS 使用临时自有 CA/证书；服务会话、账户、peer/version、命令期限与出网 allowlist 仍由 L02 检查。签名秘密留在受限进程；当前 signer 和 venue 回复均为 owned fixture，未访问外部交易所或 Vault。

`assisted-mtls-local` 是新增、显式、仅回环的 reference 启动 profile。必须同时提供私有临时 `quantos-l02-*` owner 目录；只有 `QUANTOS_BFF_OWNED_ASSISTED=enabled` 才能写。缺文件、错误密钥、错误权限/路径、身份或过期均拒绝，没有 live/default/数据库回退。普通 `assisted-local` 保留 L03 in-process 范围；live startup 没有挂载这条 reference 链。

审批服务的可信 checkpoint 包括原请求、Subject、独立证明、签名审计、已用 challenge 和幂等绑定；不包含 authority key，也不从磁盘恢复当前会话或当前 policy。BFF 使用原 createdAt/expiresAt 的 owner 会话及原 F06 窗口，恢复不会续期；登出同时使原 requester 原生会话失效。当前 scope、policy revision、请求者和两名审批者、原证明期限仍在原生 IO 前检查。Subject 撤销不会被旧 checkpoint 覆盖。

持久化为本机私有文件：700 目录、600 普通单链接文件，HMAC 域隔离校验，稳定 inode 的进程锁、临时文件写入/fsync、原子替换及目录 fsync。先落盘 Command/request/proposal 预留，再调用 mTLS；结果再落盘。相同 key 返回原结果，新 key 或同一不可变 proposal 的新请求拒绝。进程在受限端已执行、回执尚未提交时死亡，恢复保留原 Command 的 unknown，无自动补发、无自动提升 accepted。损坏、缺失、错误 authority 或权限的 store 拒绝启动/读写，不能当成空库。原生命令期限仍为最多 30 秒的半开区间；过期可只读事实，不恢复写权限。持久 kill switch 是单向 stop，其他本机副本和重启均继续拒绝，未提供自动 reset。

公共 C10 `/v1/audit/events` 和 `/v1/audit/evidence-chains/{requestId}` 现在投影同一持久请求、两次签名审批、Command reservation 与结果。事件 ID、causation、Subject hash、Command/Order 引用和 payload hash 确定性生成；原始 reservation 始终保留，未完成 IO 只有 reservation，未知结果单独记录 `assisted.command_unknown`。C10 的访问审计也保存；reference 原有 Paper seed 不混入该 profile。只放行已有 C10 GET，C10 export 与其他 legacy mutation 继续拒绝；只有当前同 scope 角色能读，未引入新 OpenAPI 操作或执行凭证。

当前检查入口：

```sh
node scripts/core-l04-review.mjs --run docs/audit/evidence/core-l04-local-20261028/attempt-01
node scripts/core-l04-review.mjs --verify
```

collector 使用既有 `webEnvironment()` 白名单与 pinned pnpm，不加载 `.env`；Rust locked/offline。22 个限定检查包含当前 native 持久化、真实 HTTP/mTLS/双副本/崩溃窗口、直接受影响 L03/L02/C10/Paper 回归、公共 C10 实际响应契约、前端消费者、生成物、clippy/fmt、计划和秘密扫描。未运行全仓覆盖率或数据库 campaign。四类受控机制分别由 replay、真实进程恢复、受限进程故障和原生持久 kill switch 测试承担；flag-off 另有公共 API 拒绝验证。12 个并发请求只证明本机去重机制，不是目标吞吐量。

完整命令、数量、源码 SHA、二进制和原始日志见 [本轮证据](../audit/evidence/core-l04-local-20261028/README.md)，以最终 result/receipt 为准。当前工程目标为 `PASS_OWNED_LOCAL_CORE_L04_MTLS_C10_DURABLE_RECOVERY`。开发状态 `IMPLEMENTED_PENDING_ACCEPTANCE`；完整 Gate `NOT_READY_GAPS_OPEN`，INTEGRATION stage `NOT_ASSESSED`，formalAccepted=false，runtimeAdmission=`DENIED`，M5=`PREPARED_NOT_READY`。19 项继承缺口保持 OPEN，仅添加本轮 progress，不自批正式验收。

未决范围：真实 F06/IdP、完整 R04/X02 同源适配、C11 激活、Supabase/Vault/RLS 与业务数据库事务/恢复、真实 venue 签名 HTTP/testnet、订单成交对账/Alert 的当前公共闭环、跨主机分布式 fencing、OS 隔离/出网、目标容量/四类部署演练/告警实际通知/持续窗口/安全审计、同 SHA hosted CI 和发布仍 NOT_RUN。本机 snapshot 不能抵御拥有目录及 key 的 owner 回滚整个存储，也不提供分布式数据库事务；崩溃后的 unknown 必须由获授权的只读 venue 对账另行解决。未引入 Supabase 生态外的生产基础设施。既有浏览器和 axe incomplete 保持原 SHA；本轮未改页面，不运行完整 UI/手工辅助技术矩阵。

下一原任务 `CORE-GATE:L4 DEVELOPMENT`：评估当前功能组合与剩余缺口，准备评审文稿；不得将该开发评估等同 INTEGRATION 准入或触发外部 testnet/发布。
