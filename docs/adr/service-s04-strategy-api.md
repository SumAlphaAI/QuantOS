# SERVICE:S04 授权策略服务边界

状态：本地功能实现；Supabase/外部目标、公共BFF及页面验收待后续任务。

可信宿主构造 `StrategyService`，注入不可变 StrategyInput 目录、S01 Snapshot/Artifact catalog、可信 clock 与每请求 SessionResolver。目标适配器 SupabaseSessions 使用 F06 GatewayAuthMiddleware 与 SupabaseAuthVerifier 验证 token、身份及成员权限；本轮不构造目标连接。本地测试用服务端私有会话表与独立真实 TCP listener，无客户端身份覆盖开关。请求不能携带 AuthContext、source/image、报告或已审批标志。

`/strategy/v1` 是 owner-service API；公共BFF `/v1` 契约和生成客户端由 BFF-FE-004 映射，P06/P07及20个UI fixture归CORE:S04/G3，不能以此库的HTTP测试记作页面验收。POST只产生本机服务状态或配置票据，不启动外部部署。

策略目录和Lab输入按tenant/workspace分页，写入需要显式strategy.write；审批需要strategy.approve且审批者不同于发布者。只读审批者可读取相同范围的草稿/报告/Release与审计。S01保存CAS与不可变版本；服务端静态检查及S02回测再次核对受信任快照/Artifact与版本绑定，只接收服务端生成的不透明ValidatedBacktest。审批hash必须精确匹配，审批有效期不超过快照到期，决定只能提交一次。拒绝决定不可重新审批，需新版本/新Release。部署请求只允许Paper/Shadow，创建票据和消费时都复核身份、授权、内容与时效，并返回实际原生adapter配置；相同票据幂等。

所有成功、拒绝和并发冲突在同一个服务锁中追加作用域内单调序列/hash链审计。关联ID由服务生成，不保存bearer、原始请求、提示或异常细节；返回no-store。审计满后先拒绝业务变更。body限制64KiB，参数16KiB，分页1..200，草稿/输入/回测/票据各最多1000，全局10000条审计限制业务状态增长；HTTP最多64个处理中请求，身份与body有期限。同步身份任务超时仍持有permit，避免重复请求无限启动阻塞任务。

决定采用进程内事务锁以完成当前本地功能Gate，不宣称跨进程持久审计或数据库事务。服务重启丢失状态；生产宿主的来源保证、真实成员撤权、数据库持久性/审批CAS、OS隔离、负载长稳和同SHA CI都由测试及RELEASE-GATE:BETA实际验收。业务审批测试不能替代ProjectUser正式验收确认；不得自动ACCEPTED。
