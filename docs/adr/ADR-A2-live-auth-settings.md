# ADR：A2 live 身份、会话与设置实现（2026-10-03）

状态：工程整改实施；staging 与正式签署在 FINAL 评审执行。

BFF-FE-001 原 live 模式只有三个身份端点，参考 provider 的设置、幂等与 MFA 行为存在独立缺陷。本次沿用 F06 的真实 Supabase Auth 校验、唯一主上下文和不透明 HttpOnly session；补齐 C01/C17 的 20 个 operation。固定参考 cookie 与参考 MFA code 仅在回环 reference 模式可用。

## 数据与授权

`20261003090000_bff_a2_identity_settings.sql` 是新增迁移，不修改已应用 SQL。资料、通知偏好、会话详情、设备、命令意图、挑战、reauth grant、限流窗口、事件游标和审计引用落在现有 Supabase PostgreSQL。十张新表启用并强制 RLS；专用受限登录切换为 `quantos_bff`。该角色不能读 Vault 原始秘密，不能修改 session 的主体，不能更新/删除设置审计。服务端按真实主体过滤资源，不接受客户端指定 user/actor/tenant。

每个请求在入口加载当前会话和身份，再向处理器传递可信扩展；CSRF 校验 exact Origin、cookie/header 一致和数据库中的 token 摘要。CORS 使用明确 Origin、方法与 headers。资料和偏好写入、版本递增、幂等响应与审计在同一事务；按主体加 PostgreSQL advisory lock，幂等键同时绑定 operation 和完整请求意图。重复副作用只执行一次，不同意图返回 409。

SSE 使用独立受限连接和按主体分配的持续游标，每次查询重新检查 session TTL、actor、membership、account 和 capabilities。其他会话撤销发送 `session_revoked`；当前订阅权限失效发送终态 `permission_revoked` 并关闭。取消订阅时，在阻塞线程释放 PostgreSQL 的阻塞运行时。

下载列表只读取受控下载的持久化元数据；无记录时返回空列表。签名、导出生产与领域审计账本属于 BFF-FE-007。元数据不得持久化短时 download URL；本次联调用无 URL 的受控记录证明非空读取并在测试后删除该记录。

## MFA 与恢复

启用的方法为 Supabase TOTP，使用真实注册/challenge/verify/delete API；服务端重新校验验证返回 token 的身份和 `aal2`。方法能力在 `availableMfaMethods` 返回，未启用的 passkey 请求返回 422；不能据此宣称真实浏览器 WebAuthn 已验收。[Supabase TOTP 指南](https://supabase.com/docs/guides/auth/auth-mfa/totp)描述对应的注册和验证流程。

初次注册没有现成 MFA 因素，不能要求先验证不存在的因素。已由 Auth 验证的、五分钟内的首因素认证可生成绑定当前 session 的 `first_factor` grant，仅允许初次注册或取消未验证注册；不能用于 session/device 撤销或删除已验证因素。普通 security grant 只能来自绑定主体/session/purpose 的已验证挑战，挑战必须在五分钟内并只能消费一次。限流在验证码验证之前执行；发起 pending 挑战不记失败。

上游因素变更不与 PostgreSQL 共享事务：先持久化命令 checkpoint，注册使用 job UUID 派生的确定名称，吊销保存 `upstream_started`，随后保存单次 job/audit 结果。TOTP URI 只在首次响应发送，重放返回 `restart_required` 与因素引用。未验证注册可通过撤销后重试恢复。

原始 bearer 仅保留在进程内、绑定五分钟 BFF session 的 proof 中；不写数据库、日志或 Git。已有 session、资料、游标、幂等记录在重启后保留；需要 Auth proof 的 MFA/security 查询返回 `401 AUTH_REFRESH_REQUIRED`，必须重新走已验证的 session bridge。多实例部署需 sticky routing 或重新 bridge；本次没有声称跨实例 MFA proof 已验证。

## 契约版本与验收

API 1.5.0 增加可选 `MfaEnrollment`、方法能力和首因素注册引用，保留全部既有响应要求与 62 个 operation。既有 `allOf` 中新增可选属性按逐项 schema 比较；required/enum 等收紧仍须拒绝。A1 的 69 项历史安全修正保留逐项 digest，仅明确允许在 1.5.0 的兼容扩展中继承，正式 A1/G0 签署不由该登记代替。

A2 Gate 执行 reference Rust 与真实客户端运行时校验测试；独立临时源码副本的三项安全 mutation 必须使业务断言失败。结构、执行语义、现有 Supabase 联调、同 SHA P0/F06、托管 CI、staging 和正式签署分别记账。工程整改不能提前关闭 PROVIDER:A2/G1 或 Desktop 的验收边界。
