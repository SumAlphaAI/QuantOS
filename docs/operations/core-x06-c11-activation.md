# CORE:X06 DEVELOPMENT / L4-C11-ACTIVATION-01

当前公共 C11 固定执行域启用、版本和历史实际控制审批服务与 native 提交。只接 `execution.assisted-testnet`，scope 固定为 C01 tenant/workspace/account/assisted_live；不创建 Paper/Shadow OperationsHost，不接任意 flag、权限提升或自动交易。

## 公共接口与权限

- `GET /v1/admin/feature-flags` 返回当前域唯一资源；GET `/{resourceId}` 返回当前状态、租约、target ceiling、native 同步版本、kill generation、UNKNOWN 数量及运行时条件。
- `GET /v1/admin/feature-flags/{resourceId}/history` 返回不可变版本/hash 历史。pageSize1..100；cursor 绑定前一条 version/hash，只追加、无删除，最多4096条。新版本并发产生时消费者拒绝混合快照并显式重读。
- `PUT /v1/admin/feature-flags/{resourceId}` 限当前 Owner，原 session 的 `security_change` MFA/reauth、Origin/CSRF、UUID idempotency key、canonical u64 If-Match 与精确 scope。body 包含 enabled、validUntil、reason、confirmPhrase 与原 proof 引用。公共创建/删除、未知资源或任意 feature/role/policy 路径拒绝。

确认短语 `ENABLE ASSISTED TESTNET` / `DISABLE ASSISTED TESTNET`。新租约最多10分钟，截止不超过原 owner ceiling 和当前 session；proof 期限为 challenge/grant/verified+120s/session 的最小值。原 actor/key/body/If-Match 只在原 proof 窗口内重放原不可变事件；改 body/If-Match 拒绝，新 key 重用 proof 拒绝，当前角色/身份仍须有效。恢复结果随后 GET 当前状态，不能把旧回执当成最新启用。租约到期不产生新历史、不自动续期；续期必须新的 Owner 显式 MFA 决定。

## Version 0 与实际运行边界

version 0 明确导入既有 owned 参考配置及原 createdAt/expiresAt，source=`owner_reference_bootstrap`、actorId=null。它保持已有组件测试的受控 fixture 前提，不冒充公共 MFA 决定或目标准入；target ceiling 默认关闭时，Owner 也不能公开启用。后续 source=`public_c11`，版本严格递增。私有启动 ceiling 或原窗口与持久 C11 origin 不一致时整笔请求拒绝503，不能用重启参数覆写现有 C11 历史。原目标迁移、真实身份和多主机激活另行验收。

控制 journal、proof 消费与来源事件写入同一认证审批事务，再同步审批服务和 native durable runtime lease，成功后返回；每次 durable 请求先认证、校验 scope/历史/native 预留锚点并同步后处理。实际 BFF 在提交后、native ack 前死亡可恢复同一已授权决定；不创建新 version 或延长原期限。私有 owner 临时目录 `pause-activation-after-commit` 是唯一故障钩子，没有公开注入 HTTP 路径。

native 在实际提交边界按当前时钟检查 lease，并把原 lease 截止并入 Command deadline；当前 Proposal/RiskDecision、两人审批、MFA/session、risk generation 和 kill 仍独立核对。C11 version 不改变 kill generation、审批策略/request revision、旧命令 signature/nonce/有效期、永久停止或手动 kill。C11 effective 只表示租约满足；runtimeWritable 还要求未停止，两者均 `executionAuthority=false`，不代表单独授予交易或正式运行准入。

禁用/到期保留已提交/UNKNOWN 事实；原生 inspect、账本、Alert/C10 查询与 C11 控制读取继续核对当前身份。P11 暂停时只读保留申请、命令及未知操作意图，不自动恢复写入；C11 的显式解除暂停不会补发 UNKNOWN。重新提交从未发出的旧审批也须仍在所有原期限内并通过当前源校验。

共同 C10 为同一资源 correlation，追加 `assisted.activation_bootstrap`（服务主体 `owned-c11-bootstrap`）与 `assisted.activation_changed`，路由 /admin/flags；旧请求/kill/Alert 审计前缀不改写。Owner 页面仅显示审计引用，具有 audit:read 的身份才显示 Audit Explorer 链接。

## 验收与移交

当前仅 owned 单机配置账户、参考 Cookie/MFA、临时 mTLS 与 HMAC/fsync/配合 OS 锁。不能抵抗管理员同时回滚全目录/密钥/宿主；没有分布式原子提交或外部单调锚点。真实 IdP、Supabase/RLS/Vault、venue/testnet、多账户/跨主机传播、安全时延容量长稳/同 SHA CI/发布，完整 books/估值、外部通知/明确关闭以及 Assisted 通用 C11 roles/policies/export/stream 均 NOT_RUN 或未接续。

[范围](../execution/core-x06-c11-activation-scope.json)保留19 gap/8义务 OPEN。工程 Gate 目标 `PASS_CURRENT_SCOPED_VERSIONED_C11_RUNTIME_ACTIVATION_HISTORY_C10`；完整 Gate `NOT_READY_GAPS_OPEN`，stage `NOT_ASSESSED`，formalAccepted=false，runtimeAdmission=DENIED，M5 PREPARED_NOT_READY。正式验收文稿待用户确认，不自批。[当前证据](../audit/evidence/core-x06-c11-activation-local-20261029/README.md)绑定冻结源 SHA；历史 native control 191份封存文件保持原范围，不改绑。

按当前功能与直接影响检查审批/native/C11/P11/P14/C10；不递归上游、全仓或 F05/F07 campaign。下一 `CORE-GATE:L4 DEVELOPMENT`，评估新增公共 kill/C11 后当前组合与剩余缺口，保留 UNKNOWN 和全部目标义务。
