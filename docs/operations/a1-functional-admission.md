# A1 当前功能复核与冻结范围

依据最新 AGENTS.md，以 `record-a1-functional.mjs` 在已提交源码上执行 `a1-functional-scope.mjs` 的当前功能与直接影响检查。默认不重验上游Gate，不执行全仓测试、三轮独立构建、数据库或外部发布。每次使用全新attempt目录，保留失败与原源码；源码、规范输入、精确命令/超时、原始日志和产物摘要绑定，完整通过后原子发布FE:BFF-FE-000与PROVIDER:A1两个当前回执。

当前直接前置核对：PRE04接口/字段/owner，PRE06契约fixture/CI与测试结构，F03本地Buf结构/descriptor/兼容及客户端元数据，F05事件/actor/tenant/correlation与append-only静态约束及reference审计证据，F06 cookie/origin/CORS/权限与拒绝消费边界，P0原范围基线与当前Web配置/生成/PoC。依赖行NOT_REVALIDATED/referenceOnly不授予独立上游READY；它们不代表未测试当前A1消费边界。

版本化OpenAPI为源，隔离生成六类client/Zod/JSONSchema/operation/MSW/Rust-input-policy产物并逐字节比较；已发布与计划operation分别冻结。真实Rust reference HTTP只覆盖已经实现的C01/C17/C10，不将其他接口的schema/mock或核心能力升级为已实现provider。前端生产导入边界禁止InMemory/private/server/venue绕过。实际Web/OIDC、SSE续传/空洞/撤权PoC、静态bundle预算和负向测试为本轮工程证明；真实性能、完整页面和全平台矩阵不在本轮声明。

`check:a1:functional`、`check:bff-a1-development`和`check:provider-a1`对本轮manifest验证当前内容与冻结源码。历史回执验证函数保持原范围；旧递归assess默认已由分阶段策略拒绝，不使用历史READY补齐新候选。共享输入变化时撤回受影响的旧独立READY，保留旧记录，不扩大无关复验。

`check:a1:freeze`、`check:g0-engineering`与`check:fep0:engineering`验证当前A1范围的G0/FEP-0工程冻结证明。freeze.json固定会话/错误/分页/job/SSE、Research/DataSnapshot/Strategy/Portfolio/Risk/Proposal/Approval/Order最低面、页面追踪、19项owner/期限/兼容安排及已发布/未实现边界。G0当前功能范围用户确认PENDING、G0/FEP-0独立阶段均NOT_GRANTED；strict ready入口继续拒绝。A1准备工程PASS不能自动完成G0确认、FEP-0独立准入、PROVIDER:ALL或新页面准入。

Codex拟定当前源码/摘要与审阅维度的完整确认稿；用户实际答复前不生成批准。历史G0确认不能迁移。下一步可按计划复核A2已实现API，G0/FEP-0完成准入仍需当前确认与对应范围评估。真实Supabase/OIDC/RLS/持久事务、staging七类证据、完整业务联调、性能/长稳/部署/同SHA hosted CI及正式验收保持NOT_RUN。外部发布与生产凭据不在本轮授权内。
