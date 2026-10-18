# PROVIDER:A3 当前功能汇总准入

依据AGENTS.md及分阶段测试规程，A3_SCOPE_LOCAL仅授予C03/C04/C12共16操作当前本机汇总功能。直接前置仍为BFF003、BFF005、A2；三份原稿/确认/回执以原SHA、输入及实际日志/产物核对，referenceOnly，不把原READY改绑成当前PASS，也不重授各自独立Gate。共享输入变化撤回BFF005独立READY，原确认有效范围不变。旧42节点A3_LOCAL闭包仅历史用途。

当前发现并修复reference组合缺陷：Market报价返回独立生成的dataSnapshotId，在Research Snapshot读模型不可解析。ProviderData默认构造现在将同一批trade/book合成事实注册为Snapshot fixture；来源明确synthetic-reference，hash绑定instrument/trade/book，2秒有效期与报价新鲜度保持保守边界。可创建Research输入，超期新请求拒绝，已完成幂等请求仍返回原答复。未伪造真实R02审批、worker结果或私有对象；live适配器继续冷加载获准快照，不接入reference注册函数。

`scripts/provider-a3-functional-scope.mjs`列出18组命令与逐组原因：16 API边界/生成与门禁负向，当前Research/Market provider，新增跨域组合/同键并发审计，R02来源与hash/expiry拒绝，共享ProviderData/Audit/session受影响的两A2 provider，当前源码实际16操作HTTP（每项401/403）、基本Chromium，单provider实际generated aggregate consumer的Market→Snapshot→Research、跨域丢响应并发恢复、冻结Audit分页与注销撤权，types/lint/clippy、三原确认/门禁/计划CI。没有Research Engine/UDS、R01容量、上游闭包、全仓或三轮独立构建。

先冻结代码，使用 `make provider-a3-local-assess ATTEMPT=docs/audit/evidence/provider-a3-local-20261018/function-attempt-NN`。新attempt按顺序保存源码、输入、精确命令/原因、时间/退出/信号/超时和日志摘要。HTTP汇总器运行当前两子域探针，而非子域Gate；父回执绑定两原始HTTP产物与其重建后的16操作记录，拒绝跨attempt、混SHA、改写、缺失/重复覆盖。全部通过后仅原子发布A3 manifest和检查点stage_gate；development、CI、三原确认、直接前置复核、plans七个实际入口验证失败则恢复原文件。失败/中断使用新目录保留，不改成PASS。

`pnpm check:provider-a3:development`、`make provider-a3-local-check`及mandatory CI的`pnpm check:provider-a3:ci && pnpm test:provider-a3`使用当前scoped门禁。`node scripts/reassess-a3-prerequisites.mjs`默认只核对三直接前置与原始证据，不递归遍历/执行旧闭包；显式`--historical`保留原审计用途。功能实现、完整业务联调、发布分别记账，后两者NOT_RUN。

R01 B01/FA-H01、真实source-age与自然告警风险未关闭；所有报价executable=false。本机合成快照、引用可解析和短期有效不代表真实R02来源授权或持久worker通过。实际Supabase/Auth/RLS/Storage、跨实例持久事务/幂等/崩溃恢复、真实Engine/来源批准与撤权/部署身份、完整UI/API业务链、安全/性能/长稳及同SHA hosted CI均NOT_RUN；市场及A3真实目标矩阵专用自动化NOT_IMPLEMENTED，必须另行授权非生产目标后实际验收。formalAccepted=false、runtimeAdmission=DENIED，不使用生产凭据、不连接目标库、不建本地DB、不推送/外部发布。汇总完整稿待项目用户确认，Codex不得自行批准。
