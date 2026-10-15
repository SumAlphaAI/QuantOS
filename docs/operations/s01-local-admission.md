# S01 策略草稿本地开发准入

S01 的直接依赖保持 R02、R03、R1-SERVICE；本轮额外审查用户指定的 F08、SERVICE:TP01、R1-SERVICE 完整闭包。`S01_LOCAL` roots 为 CORE:S01 与 SERVICE:TP01，只发布 S01 的 DEVELOPMENT READY，内部 LOCAL_READY 不传播上游或其他消费者。不得用旧 SERVICE 或 R1 回执代替当前源码执行。

`quantos-strategy::drafts::DraftService` 提供 create/save/versions/validate 库 API，供服务集成；本任务不新增 HTTP 路由或 UI。AuthContext 必须由服务器 quantos-auth 验证后注入，Catalog 必须由可信存储加载，不能从请求 JSON 构造。save 的 base_version 必填，手动和自动保存均比较当前 head；冲突明确返回 VersionConflict，调用者拉取版本、解决冲突后重试。WIP 允许缺省引用，但每个已提供引用须属于租户且 id/hash 一致；缺快照或 Artifact 不能验证。保存检查默认 Strategy 快照质量/许可/有效期，验证另用当前规则复查。版本不可变、hash 绑定参数/引用/save_kind，时间倒退和版本溢出拒绝且不改变 head。

进程内服务以同一 Mutex 原子执行比较保存。50 组各四个真实线程同时编辑同一草稿，每组仅一胜三冲突，并核对历史内容和 validation handoff hash；另有50次过期编辑及显式重试恢复测试。内存服务重启后不持久化。PgStrategyStore 持久化 API 必须传服务器 AuthContext，使用行锁、同事务版本/head 更新和 auth.users 审计用户；持久验证重新加载 R02 来源/规则和 Artifact。数据库触发器约束跨租户引用、不可变版本与审计链；RLS 强制租户/工作区读取。既有auth.users删除时FK置空语义通过仅限嵌套触发器、且其他字段不变的例外保留；普通请求不能清空作者。迁移只交付，未经目标执行不宣称生效。已存在历史记录不回填或删除；历史无用户审计的草稿需要目标迁移前审核。

清洁冻结源码后执行 `make s01-assess-local`。记录器移除数据库/外部凭据并离线执行完整联合闭包，保存命令、结果、SHA、输入hash、原始日志和每节点manifest；失败保留，重试使用新的 attempt-NN。覆盖检查必须包含50并发组、拒绝矩阵与迁移静态契约。生成的共享canonical证据按字节恢复，历史原件保留；发布S01自身manifest与计划时失败则回滚。`make s01-local-check` 验证当前输入；`make s01-release-check` 缺真实目标/正式证据时拒绝。

原量化目标全部保留：实际Supabase迁移/RLS/auth.users审计/事务/跨进程恢复、50组目标并发编辑无静默覆盖、缺权限/快照/Artifact拒绝、保存P95<300ms、负载长稳、部署与同SHA hosted CI交给测试及 RELEASE-GATE:BETA，未执行NOT_RUN。继承SERVICE:TP01所有目标义务；无生产凭据、外部发布、正式签署或上游接受。本地READY不等于正式ACCEPTED。用户确认遵循 docs/gate-records/user-acceptance-confirmation-workflow.md。
