# SERVICE:L03 本地服务验收证据

2026-10-27，main。冻结实现候选 `c276e947d8d326484d1a1f1284272ba20dc7405b`；[receipt.json](receipt.json) 将输入、18 项命令/退出码/时间/原始日志、binary SHA256 和机器矩阵绑定到该候选。后续证据提交不把结果改绑到新 HEAD。开发计划已同步当前工程完成/评审中状态。

工程 Gate：`PASS_OWNED_LOCAL_SERVICE_L03_APPROVALS`。完整 Gate：`NOT_READY_GAPS_OPEN`；stage `NOT_ASSESSED`、review `IN_REVIEW`、formalAccepted=false、runtimeAdmission=DENIED。正式确认保持 PENDING；工程结果不能推出 stage READY、ACCEPTED、真实 MFA、testnet 或交易权限。

- Rust **28/28**，Node **80/80**；严格 Clippy、fmt、ESLint、编译及计划检查通过。
- **50** 个自有参数化审批流程，在内存服务和实际 loopback HTTP 子进程两面验证，各 **100** 条 HMAC 审计；不是 100 个独立场景。
- 默认 flag 关闭 **50/50** 次实际业务请求均 403、零审计/订单；另 **10** 类 HTTP 拒绝，失败第二人保留第一条合法审计。
- 32 并发同键、丢响应恢复、body 冲突、当前会话/策略/subject 失效与锁内时钟验证；所有批准仍 `executionAuthority=false`。实际 X03 AssistedLive 提交拒绝，kernelCalls=0。
- 因 binary 入口变更，当前 L02 mTLS 进程测试 **4/4** 作为直接影响回归；不重新验收整个上游 Gate。
- 任务差异和当前 attempt 的秘密扫描 0 findings；精确公共值例外有 2 条真实反例验证。不是全仓安全审计。

[命令与结果](commands.md) · [变更文件](changed-files.md) · [原始采集](attempt-01/executions.json) · [开发期原始失败与范围](development-notes.md) · [待确认文稿](confirmation-draft.md) · [确认状态](confirmation-status.json) · [功能规程](../../../operations/service-l03-current-assessment.md)

身份/MFA/来源使用明确受控可信端口；HTTP 是实际 owned loopback。HMAC 由当前进程验证，不是用户公钥签字、公共持久审计或跨重启恢复。真实 IdP/MFA、实际来源/风险组合、持久审批审计与多副本恢复、Supabase/RLS、公共 BFF/UI/testnet/真实执行、部署 TLS/CSRF/网络/秘密管理、性能长稳/同 SHA CI/发布均 **NOT_RUN**。没有生产凭据、外部交易、push、部署或发布。

下一可执行原项 **SERVICE:L04**；CORE:L03/G8 与 RELEASE 仍按原准入执行。历史结果不改绑。只读校验：

```sh
node docs/audit/evidence/service-l03-local-20261027/verify.mjs
```

manifest.json 对证据包逐文件记录 SHA256；它是内容完整性索引，不是外部签署。preflight 日志保留原事实，不纳入冻结候选测试计数。
