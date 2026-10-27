# PROVIDER:ALL 当前功能汇总准入

按最新 AGENTS.md，在 main 独立冻结当前 BFF 功能源码。当前工具要求12个 API 任务，包括 BFF-FE-000 契约基础设施（不虚构运行时路由）及 BFF-FE-001～011 的142项已发布操作、17契约、132 schemas。十个既有域另加显式受控 Assisted 域，共十一份 HTTP 子记录；完整工程回执须全部验证，旧134项记录不能满足当前全集。只运行当前 BFF 包、生成客户端、必要 Web/OIDC/SSE PoC 与直接静态回归，不调用 A1～A6 或核心任务的历史 Gate，不递归重验全部依赖，不做全仓/三轮独立构建。

2026-10-27 CI 修复新增独立的自有 loopback Assisted HTTP 探针，验证8项操作、Paper/Assisted 两种默认关闭、身份/权限/CSRF/自批拒绝、两名独立审批人、原请求重放和 native Command/Order 绑定。父验证器纳入该子命令、sourceCommit、日志与记录摘要，并拒绝旧十域及被重算父子摘要的伪造记录。接收器测试使用明确标注的自有样本 fixture；实际执行证据为探针新产物，两者分账。原134项、113 schemas 的历史范围及回执保留，不据此升级当前142项、G0或发布验收。本轮十一域 HTTP aggregate 已实际复验142项/3074条记录，完整工程矩阵、阶段确认与发布验收仍未执行，状态见[CI修复记录](../audit/ci-remediation-4667f503-2026-10-27.md)。

Paper 上下文正确拒绝 Shadow 专用的对账/账本/Performance，Shadow 成功路径由当前独立探针验证；公开 submitAccessRequest 仅按其202/422/429/default契约验证，不伪造401/403。同一 provider 的新 Rust 和生成 client 测试覆盖各业务族读取、当前会话/成员撤销、隔离与过期、读取不增加执行权限及 Shadow 不创建 Paper host。当前所有 BFF 单元和各 API HTTP/consumer 的成功、适用拒绝、幂等、数据完整性、审计、敏感字段、原子性、独立 deadline 和恢复检查属于 ALL 自身范围；进程内租约、有限流和合成来源不能证明真实部署的持久恢复。

旧A1/Research HTTP探针没有内嵌sourceCommit，保留原格式；由当前父进程的源码、命令、时间和产物摘要显式绑定，禁止向子记录伪造字段。PRE01当前登记修复纳入直接负例回归。G0本轮只核证当前功能冻结最小范围，未调用G0独立严格Gate；独立stage未授予，所需额外工程及阶段义务不因本稿或用户确认自动消失。

18份原始 API/provider 技术回执绑定各自原源码/提交/日志/产物，仅作原范围参考。G0 是第19项独立前提，当前登记 PENDING；原 A1 确认明确不授予 G0、FEP-0、PROVIDER:ALL 或新页面准入。历史工程冻结复核134项、最小14 schemas、页面/字段绑定、19条处置及六类生成物，生成独立 G0 请求摘要；当前新增接口须另按实际冻结组织，不会改写旧 G0 文稿、确认登记或把历史 READY 移到新源码。

ALL_SCOPE_LOCAL 的工程验证可 PASS；在 G0 当前范围确认缺失时，DEVELOPMENT Gate 必须 BLOCKED。`check:provider-all:engineering` 验证工程回执，`check:provider-all:ci` 校验 BLOCKED 且 admitted=false，严格 `check:provider-all` 必须返回拒绝。不能以 CI 成功、Codex 拟稿或 A6 原确认放行 I1 新页面。当前 ALL 完整稿与独立 G0 范围附件均 PENDING，确认后另行执行对应门禁；不得自动复用旧确认。

全业务链/页面联调、实际 Supabase/PostgreSQL/RLS/事务、IdP/MFA/Storage、外部来源/许可/venue、跨实例重启恢复、目标安全/性能/容量/长稳/部署/同 SHA hosted CI 与发布验收 NOT_RUN，目标自动化 NOT_IMPLEMENTED，runtime DENIED。显式排除仅需目标 Supabase 的 F09 ignored 用例，不记数据库通过。不使用生产凭据，不推送或部署。
