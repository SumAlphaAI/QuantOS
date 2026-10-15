# S03：不可变 Release 与部署控制

Release 的 v2 content_hash 覆盖 tenant/workspace、不可变草稿版本、名称、源码完整 Git SHA、本地构建制品 digest、参数、Snapshot、Artifact 引用、完整 S02 回测凭据和规范化 Paper/Shadow 目标。相同草稿版本/内容返回原记录，变更内容确定性冲突；改变发布时间不会产生第二个内容实体。发布后内容不能重写。

仅 DraftService 执行过真实回测才签发 ValidatedBacktest：字段对调用者私有，无公开构造器和 Deserialize。服务从可信目录和固定版本取得引用及有效期；请求 JSON、任意报告或 Some(hash) 不能获得验证身份。源码/镜像/参数/报告的相等关系、报告完整性和草稿 scope 在发布与部署时复核。宿主必须提供可信源码、构建 digest、AuthContext 和时钟；这是进程内服务信任边界，不是任意原生代码沙箱。持久层只能从受限数据库行恢复凭据，不提供 JSON 请求导入接口。

审批是对候选 hash 的单次追加证明，绑定审批 actor、时间和有效期。content_hash 保持稳定；审批证明不能批准修改后的候选。审批要求 F06 PolicyEngine 的 strategy.approve，发布/票据/消费要求 strategy.write，模式仅 Paper/Shadow，所有路径复核 tenant/workspace。审批期限不得超过已验证 Snapshot 有效期；部署与本地消费重查时效。审批并发由共享 Mutex / PostgreSQL CAS 保证只有一次成功。这里是应用业务审批；与项目用户正式工程验收确认分属不同流程。

本地票据授权已验证配置及实际原生策略适配器的构造，不启动部署进程或对接 venue。完整生成Artifact参数字节进入Release内容hash，consumer从已固定Artifact构造GeneratedStrategyAdapter，Paper/Shadow两个目标各实际重放并与审批前报告完全一致。相同 release/target 返回原票据，消费必须匹配服务已记录票据并重做权限、目标及有效期检查。SERVICE:S04 继续实现公开授权 API、审计事件、拒绝/过期状态及页面联调；本任务不宣称已完成这些检查点。

PostgreSQL 前向迁移保留历史数据，以 NULL validation_evidence 阻断旧 hash-only 候选部署。新增 workspace、验证和审批证明；不可变内容/重复审批/跨租户引用/部署时效由触发器防护，workspace RLS 收紧读取。受信任 service_role 是持久化写入边界；SQL 检查不会把 hash 变成身份签名。PostgreSQL API 在封存审批前把时间统一为数据库微秒精度，避免 JSON 与 timestamptz 读回精度不同。实际 Supabase 迁移、RLS、事务、并发、恢复与真实部署均尚未执行，不能由 SQL 字符串测试代替。

迁移保留的历史异常行可能无法回填workspace；持久层必须用try_get传播NULL解码错误，不能让row.get触发panic。新增显式ignored的真实Postgres Row只读SELECT回归，待授权Supabase执行，本地不记为数据库通过。
