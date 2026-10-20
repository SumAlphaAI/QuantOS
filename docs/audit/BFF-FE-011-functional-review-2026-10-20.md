# FE:BFF-FE-011 / A6：Web 浏览器平台能力 API 当前功能复核（2026-10-20）

冻结源码 **a3524fdf7a226023957eec553ff0d80df2cd3f77**，1278项输入，16/16检查和5/5实际入口通过。仅 **BFF011_SCOPE_LOCAL DEVELOPMENT READY**；新稿PENDING，formalAccepted=false、runtimeAdmission=DENIED，完整INTEGRATION/RELEASE NOT_RUN。两计划、CI disposition、严格门禁与新profile同步；当前全图仅本节点READY，其余不重授。

复核现有两项C17/P17 API：`GET /v1/platform/browser-capabilities`（getPlatformCapabilities）和`GET /v1/settings/downloads`（listDownloads）。OpenAPI1.14.0仍134操作/113模型，新增optional权限策略/降级/TTL/历史无URL约束与下载动作路径，六生成物精确再生、PRE04字典710行。其余既有字段约束保持，工程兼容性不等于A1/目标签署。

原 live 历史查询尚无实际写入方的controlledDownload安全命令，并直接返回存储JSON；参考路由始终空列表。本次改接现有受控审计导出owner：live显式user/tenant/actor/workspace/account作用域、audit:read和F06当前身份；只读安全元数据并记录历史访问审计，不读取快照/对象内容、不生成文件/票据。源码查询和鉴权编译/静态检查通过，但本次没有数据库执行，不能称RLS/SQL目标验收通过。

服务端permissionState始终unknown，权限来源明确为browser_runtime，GET不请求本机权限。客户端只在本机检测；拒绝/default/unsupported通知降为应用内，剪贴板不可用手工复制，离线禁下载/领域动作，无本地敏感文件导入。CSP/session布尔值表示服务端策略，实际部署CSP和完整Web平台验收NOT_RUN。

历史白名单剔除下载URL、存储路径、reason/原水印/原始标签/会话。只有ready且当前audit:export给相对owner动作路径，保留期到期改expired；queued/generating/cancel_requested为preparing，取消终态为failed，ready不声称已下载。最多2000条来源、超量503；pageSize1–200，同排序值以downloadId破平局，先排序/筛选后分页。游标只在进程内，最多512、60秒且后继不延长，绑定当前身份/会话/mode/作用域、查询、pageSize、数据摘要；未知/篡改/变更/到期422重载，不承诺跨实例或重启恢复。

显式下载手势走已有导出owner获取短时链接，共享期限函数取now+300秒、文件保留期与会话期限最早值，到期拒绝签发。新consumer校验对象、HTTPS同源、BFF内容路径、无userinfo/query/fragment及当前有效期，不将票据缓存于历史。本机reference返回不可实际消费的合成URL，只证明元数据、TTL与拒绝；真实live签名、Storage及一次消费验收NOT_RUN，未用本机fixture代替目标下载。

BFF002原人工确认已另存[原始记录](evidence/bff-fe-002-confirmation-20261020/summary.md)，仅116d076e/原稿3d86f2fb及1247输入；共享平台/契约输入变化后其独立当前Gate撤回NOT_ASSESSED。四前置仅验证原Git/输入/日志/产物哈希、referenceOnly/NOT_REVALIDATED，无递归Gate、全仓、三轮独立构建或上游当前READY。既有所有审计与原稿保持字节。

| 当前验证 | 结果 |
|---|---|
| Rust | 44通过：平台15（含数据库声明七状态静态枚举验证），Auth/审计导出29 |
| Node | 249通过：原确认/流程34、Gate60、policy/CI81、直接清单负向74 |
| consumer/契约 | 64通过/7文件；生成客户端、C17及共享响应契约 |
| HTTP / Chromium | 两API及受控导出前置共35条HTTP、schema和敏感字段检查；Chromium无权限prompt和历史URL |
| helper覆盖率 | 行18/18、分支49/49均100%，仅新平台helper |
| 编译/静态 | 一次当前BFF build、Clippy、TypeScript、lint、generated、inventory和plans通过 |
| 实际入口 | development、CI disposition、原确认、前置metadata、plans共5/5，本机执行 |
| 原历史保护 | 54,649份既有audit/gate逐字节保持 |

实际命令、exit/signal/timeout和日志hash见[结果](evidence/bff-fe-011-local-20261020/review-results.json)。仅第二轮完整独立回执准入，不拼接首轮PASS。

| 检查 | 命令 | 结果 |
|---|---|---|
| contract | `node scripts/check-bff-fe-011-boundary.mjs` | PASS / exit0 |
| generated | `node scripts/check-bff-generated.mjs` | PASS / exit0 |
| inventory | `node scripts/pre04-inventory.mjs` | PASS / exit0 |
| platform | `cargo test --locked --offline -p bff-gateway --lib platform::tests:: -- --test-threads=1` | PASS / exit0 |
| a2-boundary | `cargo test --locked --offline -p bff-gateway --test auth_settings_provider --test audit_export_provider` | PASS / exit0 |
| build | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS / exit0 |
| http | `node scripts/test-bff-fe-011-http.mjs docs/audit/evidence/bff-fe-011-local-20261020/function-attempt-02/reference-http.json` | PASS / exit0 |
| consumers | `pnpm exec vitest run apps/terminal/tests/browser-platform-provider-consumer.test.ts apps/terminal/tests/ui104-settings.test.ts packages/api-client/tests/bff-response.test.ts packages/api-client/tests/bff-transport.test.ts tests/contract --coverage --coverage.provider=v8 --coverage.include=apps/terminal/src/settings/platform.ts --coverage.reporter=json-summary --coverage.reportsDirectory=docs/audit/evidence/bff-fe-011-local-20261020/function-attempt-02/consumer-coverage` | PASS / exit0 |
| types | `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal typecheck` | PASS / exit0 |
| lint | `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal lint` | PASS / exit0 |
| clippy | `cargo clippy --locked --offline -p bff-gateway --lib -- -D warnings` | PASS / exit0 |
| confirmation | `node --test scripts/bff-fe-002-confirmation-20261020.test.mjs scripts/user-acceptance-confirmation.test.mjs` | PASS / exit0 |
| gate-tests | `node --test scripts/bff-fe-011-functional-gate.test.mjs` | PASS / exit0 |
| plan-policy | `node --test scripts/development-plan-order-negative.mjs scripts/ci-stage-disposition.test.mjs` | PASS / exit0 |
| inventory-negative | `node --test scripts/pre04-gate-negative.mjs scripts/bff-fe-000-gate-negative.mjs scripts/bff-remediation-negative.mjs` | PASS / exit0 |
| plans | `node scripts/check-development-plans.mjs` | PASS / exit0 |

HTTP状态分布：`{"200": 20, "202": 3, "401": 2, "403": 1, "409": 1, "410": 1, "422": 7}`。本机debug均值1.119ms、最大15.919ms，只是观测基线，不作负载性能验收。

预检保留实际失败：新增LiveState字段漏配已有测试构造；未知查询进入Axum非标准400；生成解析器保留额外字段；旧PRE04行数和共享契约固定版本断言；synthetic Gate fixture引号解析问题。均已修正，原日志/无法落盘的终端失败摘要在preflight。首轮源码87fbc37e的16组/5入口虽PASS，后续独立语义复核发现漏映射真实generating/cancel_requested，原READY字节封存为SUPERSEDED；修正后的本轮15项平台用例直接读迁移枚举，完整独立16组/5入口PASS。原FAIL/替代不改为当前通过。

未决风险及待执行：真实Supabase/PostgreSQL/RLS、IdP/MFA/Storage和单次内容消费、完整P17/UI104/G1/FEP1业务链、实际部署CSP、跨实例/持久游标、目标安全/性能/容量/长稳/部署/同SHA hosted CI及发布全NOT_RUN；相关目标自动化NOT_IMPLEMENTED。当前历史只接审计导出源，Performance报表保留C15 owner独立生命周期，不把全部报表/本机下载文件混为此源。2000行硬上限超量503、进程重启游标422须重新加载；这些边界显式保留。

产物：[manifest](evidence/bff-fe-011-local-20261020/manifest.json)、[控制矩阵](evidence/bff-fe-011-local-20261020/control-matrix.json)、[环境](evidence/bff-fe-011-local-20261020/environment.json)、[历史](evidence/bff-fe-011-local-20261020/history-preservation.json)、[变更文件](evidence/bff-fe-011-local-20261020/changed-files.json)、[证据索引](evidence/bff-fe-011-local-20261020/evidence-index.json)、[完整确认稿](evidence/bff-fe-011-local-20261020/confirmation-draft.md)。下一可执行：原稿确认后 **PROVIDER:A6 当前功能汇总复核**；无生产凭据、push或部署。
