# CORE-GATE:L4-SERVICE 当前聚合评估

2026-10-27，main。本轮工程结果为 `PASS_OWNED_LOCAL_L4_SERVICE_AGGREGATE`，以冻结候选回执采集成功为准；完整 Gate `NOT_READY_GAPS_OPEN`，review `IN_REVIEW`、DEVELOPMENT stage `NOT_ASSESSED`、formalAccepted=false、runtimeAdmission=DENIED。当前完成本地聚合检查，不宣称六项依赖阶段就绪或 I10 放行。下一可执行原项是 `FRONTEND-GATE:G8` 的 DEVELOPMENT 条件入口评估/缺口整改，INTEGRATION 仍须拒绝。

## 范围与当前发现

本 Gate 汇总 L01 协议映射、L02 秘密权限/mTLS/受限区、SERVICE:L03 MFA/职责分离/默认关闭和 SERVICE:L04 恢复观测机制，同时消费 CORE-GATE:X3 与 FE:FEP-7 的原始状态。六项原回执都不是当前 stage READY；X3/FEP-7 的共同事实源、完整页面/治理和完整 TP07/TP12 等缺口保留。不得把多个不同源码/身份/端口的工程 PASS 相加成为完整业务链或 I10/RELEASE 准入。

新增 `l4-service-components.mjs` 将六份 receipt 与固定基线 `8c9a4ba55c6a1961d891d24c7891eb8396734404` 中的原字节核对，验证原候选祖先关系、输入的原 Git blob、artifact/log 摘要、实际退出码/信号/时间以及拒绝状态。不会运行旧 Gate、旧 binary、旧导出目录构建或重新签署旧回执。输出 `ORIGINAL_SCOPE_ONLY / ORIGINAL_CONTENT_INTEGRITY_VERIFIED / NOT_INFERRED_FROM_HISTORY`。selectedCurrentDrift 只比较每项明确列出的一个代表文件，绝不是全量源码未变化证明；当前证据由独立选择的本轮检查绑定新候选。

新增聚合器拒绝缺少/重复依赖、来源漂移、receipt/log 变更、READY/运行授权误提升以及审批/执行关系伪造。各子系统的 scope/matrix 校验使用现有 owner validator；实际 native 拒绝矩阵由真实测试写出，不补造替代成功。源码/输入变化后必须新候选、新 attempt，不能改写原始失败或回执。

## 本轮直接功能检查

- L01：当前 15 项协议测试及实际 stdio 子进程，200 个自有样本分别在 direct/process 两面复核、每面 250 协议调用；不是 400 独立场景，也不是 exchange HTTP/testnet。固定 synthetic filters/规则没有变成 live exchangeInfo。
- L02：3 项 session/半开版本边界、4 项实际临时证书 mTLS 进程测试及 SQL/网络静态契约；包含一笔真实 X03 签发→owned mTLS→L01→X04 Fill。签名器为受控进程内端口，Vault adapter 仅编译，SQL/角色/网络模板未在目标执行。受控轮换边界不是实际 ≤5 分钟恢复 SLA。
- L03：13 项审批服务、3 项实际 owned HTTP、现有 native 模式拒绝以及新增同 subject 拒绝。50 个自有 workflow 两面验证、每面 100 audit；flag-off 50 次业务请求全部拒绝，另 10 类 HTTP 拒绝。身份/step-up 均为明确 owned 可信端口，不是实际 IdP/MFA；能力发现只返回 false，不属于业务动作放行。
- L04：8 项当前恢复/证据测试和实际新进程 archive verifier。F05 owned records→X01 重放、同 gateway 租约提交后恢复、实际 failing kernel 隔离、kill 独立审批/更新健康/CAS 恢复；33 次恢复查询保持一次提交、一个 Fill 链接。15 条安全 audit fsync 落盘并由新进程完整读取，F09 health/JSONL trace export/query。归档内 X05 report 是独立 owned golden books，不能冒充执行账户完整对账；此处未重新跑 X05 全 campaign。

当前聚合只重复上述直接门面及范围边界，不调用各组件的整套 --run，不运行历史 X3/FEP-7 浏览器矩阵、全仓、覆盖率、F05/F07 数据库 campaign 或全依赖闭包。没有生产 runtime 修改；新增 Rust 文件只在测试目标。严格 Clippy/fmt 只针对实际涉及的 execution/gateway/evidence 三包；前端没有变更，不重新构建浏览器。依赖源码输入哈希不等于依赖 Gate 重新验收。

## 同一 subject 的实际拒绝

新增 `l4_service_boundary.rs`：使用当前真实 X03 proposal 与当前 RiskGuard ApprovalRequired decision，tenant/workspace/account、proposal hash、decision ID、数量/价格/venue 完全对应。可信 owner 把此事实投影登记到 SERVICE:L03；会话 profile 使用 AssistedLive、服务 step-up attestor 使用临时随机 HMAC keys，独立 actor/user 两次审批后得到 approved/non-executable receipt、2 条当前进程可验证审计。source projection ID 为服务自己的 UUID，不伪称原 proposal ID；服务 profile 不改写原生 Paper release target。

receipt 不能反序列化为 SignedCommand；同 scope Paper issuer 仍因缺少原生 ApprovalToken 拒绝，AssistedLive issuer 也拒绝；issuer 审计没有 command_issued，过期读取拒绝。这是实际绑定的拒绝组合，不是正向 assisted 交易闭环。没有 token/Vault credential 转换或执行桥；完整审批→命令→受限执行→统一 audit/recovery 仍 `NOT_JOINED`。不能以“拒绝测试正确”勾选该正向业务联调完成。

## Gate、风险与移交

`node scripts/l4-service-review.mjs --run docs/audit/evidence/l4-service-local-20261027/attempt-NN` 在白名单环境、Cargo locked/offline 下采集，owned 子进程 env_clear，网络仅 loopback。回执核对实际 binary、命令、原始日志、输入与 artifact。`--components` 仅核对原记录完整性，`--verify` 复核当前工程回执；正式用户确认按统一规程单独 PENDING。任务执行授权不等于批准文稿。

当前 `--integration CORE-GATE:L4-SERVICE` 与 `--integration FRONTEND-GATE:G8` 均须返回 STAGE_NOT_READY；G8 DEVELOPMENT 可开展范围内整改。完整 Gate、运行/外部环境与发布分别记账，历史原失败/NOT_RUN不改绑、不提升。秘密扫描仅任务差异与当前 attempt；精确公共 F06 幂等值例外保持原路径/原值/原规则并拒绝两条实际反例，不是全仓安全审计。

未决功能组合：共同持久来源/审计、L03 到原生审批/签发与受限取消/未知恢复正向桥、公共 BFF/P10/P11/M5 同源审批/审计/恢复、X3/FEP-7/G8/FEP-8 原始缺口。它们不因服务功能 PASS 消失。

NOT_RUN 目标：真实 IdP/MFA、Vault/目标数据库事务/角色/RLS/独立 head 与锚、实际业务 audit/outbox/跨进程多副本去重恢复、OS/目标网络强制与秘密轮换恢复 SLA、实际账户独立账本、真实 venue HTTP/signing/testnet、主机死亡通知/部署、目标容量/全面安全/持续窗口/同 SHA CI与正式 RELEASE。真实 testnet 运行仍需有效环境/范围授权；没有生产凭据、外部交易、push、部署或发布。未来 `CORE:L03/CORE:L04`、G8/I10 与 `RELEASE-GATE:LIVE-READINESS` 继续承担原完整业务及目标义务。

[证据包](../audit/evidence/l4-service-local-20261027/README.md)。
