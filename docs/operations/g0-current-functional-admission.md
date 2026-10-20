# G0 当前功能复核与 ALL 评估

本轮只同步8项API工程处置、复核当前G0最小契约/页面追踪/生成客户端/权限/敏感字段/Web与模拟OIDC/SSE基础，执行当前功能和直接相关回归。原ALL完整稿的本会话确认只绑定a045f15c源码与fce29312证据包；原134项API/240 Rust/341 Node/144 consumer/3015 HTTP等结果保留原范围，不改绑为本轮源码。以严格差异清单证明业务runtime、OpenAPI及生成输出字节未变，直接检查变更的G0/门禁工具。默认不递归执行P0/A1/BFF000或其他上游Gate，不重跑134项HTTP、全仓、三轮构建。

8项只从PENDING变为IMPLEMENTED_ENGINEERING；19条范围/负责人/阶段/期限/兼容策略继续可追踪，其余11项不自动关闭。旧JSON/Markdown原字节在preflight和Git中保留；历史十项、签署/逾期、RELEASE/PHASE_TWO不改。原G0文稿、当前已确认ALL稿及技术回执不修改。

当前G0完整功能范围变化须单独拟新稿并由项目用户确认。G0_SCOPE_LOCAL工程PASS后，确认缺失时stage BLOCKED；正式G0 review_status仍与历史隔离。ALL_G0_REVIEW_LOCAL消费当前G0与原已确认API工程证据；G0未确认、或G0-L10-2仍PENDING且4类legacy fixture尚在生产API包时，ALL必须BLOCKED。不能将8项同步、现有import禁令或ALL原稿确认当作legacy移除或新G0批准。

G0-L10-2移除工作不在8项台账同步中冒充完成；它的既有消费期限PROVIDER:ALL仍生效。新G0确认也不自动消除这一ALL阻塞条件。页面/runtime DENIED；真实Supabase/Auth/RLS/Storage、数据源/venue、持久恢复、全UI业务联调、目标安全/性能/长稳/部署/同SHA hosted CI与发布验收NOT_RUN，目标自动化NOT_IMPLEMENTED。不使用生产凭据，不推送或部署。

用户实际确认新G0原稿后，保存原答复/摘要及更新对应scopeDigest登记，可使用`pnpm finalize:g0-development`确认收口；它核验原已完成工程/当前输入与真正G0批准，保存pending原字节后只更新确认状态和实际门禁，不重跑无关API/上游。即使G0 READY，L10-2仍未完成时ALL依旧BLOCKED；确认原ALL稿不能代替新G0批准。
