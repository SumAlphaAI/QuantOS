# CORE-GATE:L4 当前组合与缺口评估

2026-10-28；仅 DEVELOPMENT 当前功能评估，基线 `457f20e7`。不改变计划的 INTEGRATION stage，不启动真实 testnet/生产凭据/数据库/外部发布。

评估对象为 CORE-GATE:L4 的四项直接依赖：L4-SERVICE、CORE:L03、CORE:L04、G8；FEP-8 作为第五份范围/缺口材料。原回执、输入源码 blob、日志及封存文件逐项校验；只作 ORIGINAL_SCOPE_ONLY。旧文字中“未接通”的观察与当前 L03/L04 进展分别记录，不删除历史 FAIL、旧 unknown/NOT_RUN 或将它们改绑到当前源码。

当前链路为 P10 独立两人审批 → P11 原请求/原期限命令 → 公共 BFF → 原生 AssistedExecution → 真实 L02 mTLS 子进程 → owned L01 协议回复 → 同 Command/Order → 公共 C10 GET → 当前 Audit 消费者。C01/F06、Cookie/CORS/TLS Web bridge、risk Subject 及 signer/venue 数据仍是明确 reference/owned 替代。实际本机 TLS 进程不等于真实 Vault 或 venue 网络。

本轮复现并修复三项当前缺陷：C10 `/orders?approval=...` 不满足 Orders 的 `approvalId` 参数契约；Audit runtime 拒绝 Assisted Live 模式，不能消费已有 C10 GET。另有原始digest UUID缺少版本/variant位，被生成客户端拒绝；现使用确定性RFC UUIDv8，旧失败包不重写。现输出规范引用，只允许具备当前 `audit:read` 的 Assisted Live 会话只读共同审计。create/cancel/download/status 导出操作在该模式于 runtime 层拒绝，调用者即使注入 export capability 也不能发出导出或 MFA IO；UI隐藏导出抽屉并明确当前只读。P11 增加获权限用户的共同审计入口。不放宽 Guarded Live、默认关闭、CSRF/幂等恢复或服务器资源权限。

限定验证覆盖：新旧 Audit runtime/gateway/HTTP 消费者、当前 public mTLS 双副本/重启/unknown/撤权回归、新 Chromium P10/P11→mTLS→C10及默认关闭、两项既有 G8 Paper 浏览器回归、当前 TypeScript/编译/生成契约/受影响 lint、评估器负向测试和计划/阶段拒绝。当前只运行一次必要 Web build，不展开所有上游/全仓覆盖率/数据库 campaign。4个浏览器场景及3次axe扫描分别记账，当前owned样本不是200笔venue/50个独立审批旅程或目标性能证据。

评估清单保留19项继承缺口全部OPEN，并把当前新增L03/L04进展放入单独 currentObservation；G8四项本机进展不等于完整关闭。另列8项当前产品/联调/发布义务：当前R04/X02可信源与kill generation、真实身份、公共Fill/对账/Alert、全局/账户native kill控制、C11激活、目标持久性/Vault/RLS/跨主机、获准testnet、F07/F09目标安全容量通知长稳及发布。它们有原任务owner、关闭判据和阶段，不能以人工确认或文件检查代替工程证据。

工程目标 `PASS_L4_CURRENT_COMPOSITION_AND_GAP_ASSESSMENT`；开发评估 COMPLETED_CURRENT_SCOPE、review IN_REVIEW。完整Gate NOT_READY_GAPS_OPEN、stage NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED、M5 PREPARED_NOT_READY；159个阶段及规范依赖/量化要求不提升。没有“高危为零”、实际DB持久化100%或真实testnet完成结论。既有完整浏览器/手工辅助技术、旧axe incomplete仍属原SHA。

机器清单：[core-l4-current-assessment.json](../execution/core-l4-current-assessment.json)。当前源码、执行命令、输入/二进制/产物hash和原始失败见[本轮证据](../audit/evidence/core-l4-current-local-20261028/README.md)。工程复核入口 `node scripts/core-l4-review.mjs --verify`；正式评审文稿保持待用户确认，不自批。

下一原任务 CORE:X02 DEVELOPMENT，对应 L4-CURRENT-SOURCE-01：将当前不可变R04 Proposal、X02签名RiskDecision及账户/时效/额度/kill generation接到公共审批Subject，拒绝过期、撤销、签名或scope不一致，先完成自有本机真实模块接续。历史X02_LOCAL READY保留原范围，不重跑全部前置，也不授权真实外部环境；其他当前缺口与目标义务仍开放。
