# BFF-FE-003 执行记录

2026-10-12 已交付 C03/C04 的九个页面 operation、live 持久化适配器、reference fixture、生成契约、功能/负向测试与证据校验器。当前本地实现 COMPLETED；DEVELOPMENT Gate READY（BFF003_LOCAL，40 节点/135 组），formalAccepted=false；外部目标与性能验收 NOT_RUN。

- 实现：[共享页面语义](../../services/bff-gateway/src/research.rs)、[live adapter](../../services/bff-gateway/src/live/research.rs)、[Supabase 迁移](../../supabase/migrations/20261012150000_bff_research_pages.sql)。
- 决策和边界：[ADR](../adr/ADR-BFF-FE-003-research-page-provider.md)。
- 当前报告：[A2/R1 与本任务完整本地准入](../audit/A3-local-admission-2026-10-12.md)；[首次实现记录](../audit/BFF-FE-003-implementation-2026-10-12.md)和 2026-10-07 初审保留为历史。
- 当前本地准入复核：`pnpm check:bff-fe-003` 或 `pnpm check:bff-fe-003:development`；任一源码/日志/产物/依赖漂移即拒绝。旧 manifest 用 `--historical` 单独复核，不构成当前准入。
- 负向回归：`pnpm test:bff-fe-003`。

live 请求还需要已配置的 QUANTOS_RUNTIME_DATABASE_URL、QUANTOS_BFF_SNAPSHOT_DATABASE_URL、QUANTOS_BFF_RESEARCH_SOURCE_POLICY（服务端审批 JSON 文件路径）、SUPABASE_URL 和 QUANTOS_RUNTIME_STORAGE_KEY。不得把值写入仓库或日志。必须使用已有的受限 BFF/Runtime/Snapshot 连接；工具名为 research.hypothesis.v1 / research.experiment.v1，需事先按领域任务授权注册；BFF 不自动授予 capability、启用 Engine 或许可来源。

目标验收入口为 `node scripts/test-bff-fe-003-live.mjs`，只接受明确 dev 配置及 TARGET_ENABLED=1，需要已获准目标、独立 fixture 身份/会话、快照和可读取 Artifact。脚本不应用迁移、不配置角色、不创建数据库。环境变量名见脚本；输出写 TARGET_RECEIPT 指定文件，Cookie/CSRF 不写回执。本轮 NOT_RUN。该 smoke 不能单独代替跨租户/撤权、强杀恢复、Storage 故障、迁移/RLS 的完整目标验收。

下一可执行任务为 A3 的 BFF-FE-005 市场目录/报价/K线 API；完成后聚合 PROVIDER:A3。共享源码变化后须刷新受影响消费者闭包，不能转授上游独立 READY。真实 Supabase/Auth/Storage/worker 与全部性能移交 RELEASE-GATE:BETA；本机 consumer/UI 链在对应 I 迭代验收。
