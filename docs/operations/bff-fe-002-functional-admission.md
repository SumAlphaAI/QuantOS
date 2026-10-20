# BFF-FE-002 / C02 当前功能准入

发布 OpenAPI 1.13.0 的 getCommandSummary、subscribeCommandEvents；134操作/113schema及六生成物一致。GET /v1/command/summary、GET /v1/command/stream 只读。当前四来源：R03研究run、X01/X02/X03/X04执行读模型、S04策略审批、X06/F09健康及告警。关联现有接口，无HTTP扇出，无命令签发、审批消费、风险decision记录、任意脚本或venue submit。新 helper 与真实生成consumer验证C02；既有UI101继续Mocked，不声称完整页面集成。

ops.read是入口权限，各来源再按其原权限/tenant/workspace/account/mode拒绝或裁剪。不可用/无权/陈旧来源保留status/asOf/hash，相关计数为null，风险unknown；零只代表真实受权来源计数为零。策略与交易审批都ready才给pendingApprovals总数。参考研究只当前操作者可见；Owner不自动读取该actor的研究或获得execution.operate。真实live用F06身份和owner注入host，研究只执行一条有界查询，显式作用域与session mode匹配；缺失host不使用fixture。

最多四来源、每来源2000行，priority/recentActivity各50条；超出输入上限整来源unavailable，输出truncated可见。来源排序在输出截断前完成；critical/warning优先队列与近期活动分别选取，旧严重项不会被较新的info挤掉。最终组合重新检查来源期限，expiresAt取ready来源最早期限与30秒上限；来源在采样期间过期则置stale。资源引用仅规范相对路径、类型/UUID/状态/来源时间；不输出原始prompt、actor信息、token、标签或可执行payload。近期活动按有来源的时间倒序；缺失源时间的策略审批保留null，不伪造时间。单次响应多host采样不等于跨服务原子快照。

事件为有限SSE snapshot poll/resume，streamId绑定当前tenant/workspace/account/mode/actor/role/capabilities和session；初始最多30秒deadline并受ready来源剩余期限上限约束，不续期，最多1000租约/每租约32事件，过期读取清理。sequence严格连续、旧frame精确回放、无改变不发伪更新，gap/未知/过期/作用域变化409；当前身份拒绝先于旧数据回放。consumer只在有效载荷和序列通过后绑定stream/更新事实，撤权清除。需要新快照时创建新facts/lease，不自动重交意图。

16组当前功能及直接router/auth/audit、生成契约与PRE04同步检查；不执行依赖Gate、全仓或三轮独立构建。记录本机debug请求/延迟基线，仅观测，不声称目标性能通过。原A5确认绑定5fb5b6aa/8a0ce81b及1169原输入，六前置原Git/输入/日志/产物referenceOnly，独立当前READY不重授。失败/NOT_RUN与历史均保留。新C02完整稿PENDING、formalAccepted=false、runtimeAdmission=DENIED。

实际Supabase/PostgreSQL/RLS/IdP/MFA、真实工作流和来源、跨实例/重启回放、G1/FEP1/P02/UI101完整业务链、目标性能/负载/长稳/安全、部署和同SHA hosted CI及正式发布均NOT_RUN；目标专用自动化NOT_IMPLEMENTED。过程内有限租约不承诺持久恢复；X01既有f64和来源期限保证不提高。无生产凭据、目标数据库、本地PG/Supabase、推送或部署。
