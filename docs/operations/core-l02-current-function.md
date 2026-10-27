# CORE:L02 当前功能与验收边界

2026-10-27，在 main 按当前功能与直接影响范围实现。工程 Gate 仅在固定候选机器回执验证后为 `PASS_OWNED_LOCAL_L02_RESTRICTED_ZONE`；完整 Gate `NOT_READY_GAPS_OPEN`、stage `NOT_ASSESSED`、formalAccepted=false、runtimeAdmission=DENIED。

## 当前实现

`execution_gateway::restricted_zone` 的 VerifiedPeer 只能从已完成验证、要求客户端证书的真实 TLS stream 构造，不反序列化 JSON。证书链与用途由 OpenSSL 校验；宿主另核对指纹、证书自身有效期、可信会话/账户/版本与撤销状态。服务会话最大 15 分钟、命令最大 5 分钟且不能超过会话，所有有效期半开；签名后重新采样可信时钟、重新校验，防止签名/秘密读取延迟穿透 TTL。可信 registry 不接受 wire 安装或控制更新，拒绝重复会话、版本回退、未来生效及超长会话；旧版本仅在轮换后 <300 秒可用，撤销立即拒绝后续授权。

`RestrictedHost` 组合上述检查、VaultSigner 与真实 L01 ProtocolKernel。DatabaseVaultSigner 使用已校验专用 Execution 数据库登录，调用新六参数证书/版本绑定函数，将 opaque secret 仅留在 Execution 进程计算 HMAC。ExecutionSecret 不实现 Debug/Serialize，并在 Drop 时 zeroize。回包仅携带签名摘要诊断和内核事件，不是用户/风险授权、Binance REST 签名或真实成交凭证。当前 X03 AtomicCommandIssuer/SignedExecutionGateway 仍负责初始业务权限；一个实际签发用例经真实 mTLS 子进程、L01 协议内核产生 X04 Fill。测试可信 constructor/自有进程不能代替生产 ingress 或普通用户权限边界。

ZoneRequest 只携带 opaque 会话摘要、版本和已净化 BoundaryCommand，拒绝顶层/嵌套 authority 字段，frame 有界。服务 binary 没有增加公开订单端口；显式 `execution-gateway --l02-owned-zone-fixture <临时目录>` 模式 仅供自有测试，使用 env_clear 后仅注入自有 TMPDIR、临时自签 CA/证书（私钥 0600、目录 0700，结束清理）、随机生成的非生产 HMAC key。fixture schedule 是可信合成时钟配置，不接受请求提供的 now。样本证明的是真实 TLS 与模块组合，不是真实数据库或 Binance HTTP。

NetworkAllowlist 在建立连接前检查精确主机、端口和预先批准的地址，并执行服务端 CA/hostname/pin 验证；没有代理、重定向、DNS 回退。默认拒绝的 JSON/systemd 模板没有目标地址且未安装。旧 zone.rs 的 caller enum、字符串身份与 host 集合仅是声明式 fixture helper，不能证明 TLS/身份或操作系统隔离；本轮修复其未来会话、签发前授权与 300 秒边界漏洞。

## SQL 与权限

新迁移 `20261027090000_l02_bound_execution_zone.sql` 加入受控 credential version 元数据、证书/版本绑定服务会话列，旧解密 API 对应用角色撤权。新 SECURITY DEFINER 函数设空 search_path，检查 tenant/service actor/account/workspace/capability、会话/命令 TTL、证书/版本、active/draining/revoked 与半开有效期后才参数化读取 Vault decrypted view。只给 quantos_execution_gateway EXECUTE，不给应用直读版本表/Vault。版本 active 禁止回退到已记录的更高历史版本以下；控制面负责原子轮换。

本地脚本只检查 SQL 契约与拒绝变异，不解析或执行 PostgreSQL。迁移 replay、目标权限/RLS、真实 Vault 解密、SQL 并发撤销与实际登录全部 NOT_RUN。没有本地 PostgreSQL、Docker 或 Supabase 服务，没有读取私有 dotenv/连接配置。目标只读探针必须另行授权；操作说明见 [轮换规程](../../supabase/OPERATIONS.md#l02-execution-secret-zone-rotation-runbook)。官方依据见 [ADR](../adr/20261027-l02-restricted-zone.md)。

## 验证和移交

入口 `pnpm assess:core-l02:local docs/audit/evidence/core-l02-local-20261027/attempt-NN`：先提交候选、白名单环境、locked/offline、不可覆盖 attempt。`pnpm check:core-l02:local` 核对原候选/输入/命令/日志/证据，`pnpm test:core-l02:gate` 验证 Gate 与 SQL/网络变异。真实 TLS 场景包括无证书、过期、错误 CA、未登记研究类客户端、服务端 CA/hostname/pin、会话/命令有效期、账户/会话绑定、重复命令、轮换与撤销。有效及拒绝路径都使用自有样本。

直接影响回归限定于修改的 Auth 库、旧 zone helper、Execution 服务单测、L01 协议映射和 TP07 signed dispatch；不复验完整 F06/X3/L01 Gate、不跑全仓/覆盖率/数据库 campaign 或三轮构建。不改前端，不执行浏览器测试。历史结果不改绑新 HEAD。

未决：目标 Supabase 新函数与角色/RLS、真实 Vault/平台 service_role 例外隔离、证书/秘密生命周期与 ≤5 分钟真实恢复、网络/文件系统/容器及 egress packet enforcement、生产宿主配置加载/控制面部署、受限取消/只读恢复完整业务链、持久/多副本去重、真实 venue HTTP/签名/testnet、人工/安全/性能/长稳/同 SHA 远端 CI 和正式验收全部 NOT_RUN。上述生产/环境义务保留；没有外部发布或推送授权。

下一可执行原节点：`SERVICE:L03`，当前服务层 MFA/职责分离/额度/默认关闭 Gate 评估；CORE:L03 的 UI/testnet 完整联调不因此放行。证据见 [本地包](../audit/evidence/core-l02-local-20261027/README.md)。
