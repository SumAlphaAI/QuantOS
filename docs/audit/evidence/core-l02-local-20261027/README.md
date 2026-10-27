# CORE:L02 当前本地受限执行区证据

2026-10-27，在 QuantOS/main 完成。实现 **8df7cea9d99dae73b8626b326954ea8a1c7e3485**；最终固定候选 **379f624b5e45fa4c22231f25ac06ad54f7c049ec**，正式结果 **attempt-02**；后续证据提交不改绑该候选。[规程](../../../operations/core-l02-current-function.md)、[变更文件](./changed-files.md)、[命令与结果](./commands.md)、[机器回执](./receipt.json)、[待确认文稿](./acceptance-draft.md)。

工程 Gate：**PASS_OWNED_LOCAL_L02_RESTRICTED_ZONE**。完整 Gate **NOT_READY_GAPS_OPEN**；DEVELOPMENT stage **NOT_ASSESSED**，development_status **IMPLEMENTED_PENDING_ACCEPTANCE**，formalAccepted=false，runtimeAdmission=DENIED。目标和正式确认未放行，上游历史状态不变。

| 验证 | 结果与范围 |
| --- | --- |
| 当前功能与直接回归 | Rust 54 passed / 0 failed / 0 ignored：host-unit 12、zone-boundary 3、旧 zone 6、mTLS process 4、Auth 6、L01 protocol 15、TP07 dispatch 8。过滤项不计通过。 |
| 真实 TLS | 自有子进程、临时 CA/客户端/服务端证书；13 行矩阵：2 成功/幂等、11 拒绝，包含未知研究类证书、缺失/过期/错误 CA 客户端、服务端 CA/hostname/pin、账户/会话/命令过期和 egress。不是目标部署验证。 |
| 真实签发组合 | 一个实际 X03 issuer/SignedExecutionGateway→自有 mTLS 宿主→L01 ProtocolKernel→X04 Fill；重复提交无新增远程 IO。下游 venue 是自有协议 fixture。 |
| 轮换/撤销 | 真实证书与合成随机 HMAC key 版本；受控时钟新版本立即可用、旧版本 299 秒可用/300 秒拒绝、active 撤销拒绝；独立真实 TLS 服务会话到期 0 协议写。不等于实际恢复 SLA。 |
| Node | 93 passed / 0 failed / 0 skipped：L02 receipt 46、SQL/network contract 23、development-execution 24。 |
| 秘密扫描 | Gitleaks 8.28.0，98 个本任务差异/当前 attempt 文件，0 泄露；1 个历史公共幂等值精确核验排除，2 条实际合成反例仍报错。不是全仓秘密审计。 |
| SQL/网络 | 新六参数、证书/版本/账户绑定 resolver、旧函数撤权与默认拒绝模板通过静态契约；没有数据库语法/执行、RLS 或部署/packet enforcement 通过声明。 |
| 编译/静态/准入 | 当前三包严格 Clippy --no-deps、fmt、局部 ESLint、计划校验通过；CORE:L02 INTEGRATION exit 1 / STAGE_NOT_READY 为预期拒绝；SERVICE:L03 DEVELOPMENT allowed=true。 |

代码与权限：真实 VerifiedPeer 来自要求客户端证书的 TLS stream，不接受 JSON 声明；逐次核对证书自身期限、可信服务会话/账户/版本，签名后重新采样时钟并检查 TTL。DatabaseVaultSigner 只走专用 Execution 登录和新 allowlist 函数；秘密不实现 Debug/Serialize，String Drop zeroize。wire 中的签名摘要仅为诊断；初始订单权限仍由 X03 提供。新框架没有新增普通 BFF/研究秘密路径。

自有模式显式启用，限制本机与专用临时目录，不读取数据库/真实 venue 配置。child env_clear 后仅白名单 TMPDIR；临时私钥目录 0700/文件 0600，测试结束清理，未复制到证据包。NetworkAllowlist 实际校验精确 DNS/端口/地址，再验证 CA/hostname/pin；不使用代理环境、重定向或 DNS 回退。JSON/systemd 默认拒绝模板未安装，目标地址为空。

[开发记录](./development-notes.md) 保留 preflight-01 的 3 个初始失败、证书/受控时钟和 expired fixture 的后续失败，以及 attempt-01 最后秘密扫描失败。历史 F06 固定幂等值不是凭据；排除只限 generic-api-key + 原文件 + 基线不变的精确值，生成配置/来源与实际负向报告均归档。没有改全局扫描配置，没有删除失败或拼接旧通过。

未决风险：新迁移/目标 PostgreSQL、Supabase Vault 正向解密与真实角色/RLS/平台 service_role 例外隔离、真实证书/秘密生命周期与 ≤5 分钟恢复、OS/网络/文件系统隔离与策略部署、生产宿主控制面、受限取消/只读恢复完整业务链、持久/多副本幂等、Binance HTTP/实际签名/testnet、全仓/远端 CI/安全/性能/长稳/正式验收和发布均 **NOT_RUN**。无本地数据库/容器，无生产凭据，无推送或外部发布。

下一可执行原项：**SERVICE:L03（服务层 MFA、双人职责分离、额度/白名单与默认关闭 Gate 评估）**；不能据此放行 CORE:L03 UI/testnet 完整联调。

只读复核：`node docs/audit/evidence/core-l02-local-20261027/verify.mjs`。会核对原候选输入、日志、证据清单、当前保留的 gateway 与 Gitleaks 二进制摘要；摘要失配应拒绝，不覆盖历史结果。
