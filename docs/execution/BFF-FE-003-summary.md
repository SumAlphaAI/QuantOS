# BFF-FE-003 执行记录

2026-10-12 已交付 C03/C04 的九个页面 operation、live 持久化适配器、reference fixture、生成契约、功能/负向测试与证据校验器。当前为 IMPLEMENTED_PENDING_ACCEPTANCE；DEVELOPMENT Gate BLOCKED，formalAccepted=false。

- 实现：[共享页面语义](../../services/bff-gateway/src/research.rs)、[live adapter](../../services/bff-gateway/src/live/research.rs)、[Supabase 迁移](../../supabase/migrations/20261012150000_bff_research_pages.sql)。
- 决策和边界：[ADR](../adr/ADR-BFF-FE-003-research-page-provider.md)。
- 当前报告：[本地交付与门禁](../audit/BFF-FE-003-implementation-2026-10-12.md)。2026-10-07 初审保留原件，不能当作当前结果。
- 默认工程复核：`pnpm check:bff-fe-003`；严格阶段准入：`pnpm check:bff-fe-003:development`。后者在依赖/目标不足时退出 2，不提升 READY。
- 负向回归：`pnpm test:bff-fe-003`。

live 请求还需要已配置的 QUANTOS_RUNTIME_DATABASE_URL、QUANTOS_BFF_SNAPSHOT_DATABASE_URL、QUANTOS_BFF_RESEARCH_SOURCE_POLICY（服务端审批 JSON 文件路径）、SUPABASE_URL 和 QUANTOS_RUNTIME_STORAGE_KEY。不得把值写入仓库或日志。必须使用已有的受限 BFF/Runtime/Snapshot 连接；工具名为 research.hypothesis.v1 / research.experiment.v1，需事先按领域任务授权注册；BFF 不自动授予 capability、启用 Engine 或许可来源。

目标验收入口为 `node scripts/test-bff-fe-003-live.mjs`，只接受明确 dev 配置及 TARGET_ENABLED=1，需要已获准目标、独立 fixture 身份/会话、快照和可读取 Artifact。脚本不应用迁移、不配置角色、不创建数据库。环境变量名见脚本；输出写 TARGET_RECEIPT 指定文件，Cookie/CSRF 不写回执。本轮 NOT_RUN。该 smoke 不能单独代替跨租户/撤权、强杀恢复、Storage 故障、迁移/RLS 的完整目标验收。

下一步先更新受本次契约/Runtime 源码变更影响的 A2、核心依赖回执并处理 R1-SERVICE 准入；在获准非生产 Supabase 完成新迁移与 Auth/BFF/R03/Storage 功能闭环后再重评本任务。并行可执行 A3 的 BFF-FE-005 市场目录/报价/K线实现；PROVIDER:A3 需两项任务及 PROVIDER:A2 全部成立。
