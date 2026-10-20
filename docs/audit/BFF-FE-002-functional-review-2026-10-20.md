# FE:BFF-FE-002 / A6：Command Center 聚合 API 功能交付（2026-10-20）

冻结源码 **116d076e7506b96aa7161f9c87cf9001df56428d**，1247输入、16/16当前功能与直接相关检查、5/5实际入口PASS。仅 **BFF002_SCOPE_LOCAL DEVELOPMENT READY**；本任务确认PENDING、formalAccepted=false、runtimeAdmission=DENIED。完整INTEGRATION/RELEASE NOT_RUN；两计划与机器门禁同步，仅本节点1 READY/其余158 NOT_ASSESSED。

新增只读 **GET /v1/command/summary**（getCommandSummary）与 **GET /v1/command/stream**（subscribeCommandEvents）。C02由planned发布，OpenAPI1.13.0当前134操作/113schema，新增CommandSummary/CommandSource/CommandItem三模型和精确六生成物。与8a0ce81b的语义对比确认原132操作/110模型不变；兼容版本登记复用原85项工程修正，不代表A1/staging或发布签署。PRE04字段字典705行、Gap-02 Closed只表示契约已发布；旧Inventory Fixture保留为历史设计示例。

四受权来源为研究run元数据、执行risk/order/Trade审批、策略Release审批、X06/F09健康与告警。入口ops.read，各来源再核对原capability/tenant/workspace/account/mode；无权、缺失、poison或陈旧不替换成零，source带status/asOf/hash，相应计数null、风险unknown；Owner不读取当前操作者的研究；Owner/Approver执行读取与Context已宣告的execution.operate一致。两个审批来源都ready才输出总pendingApprovals。openRiskAlerts只计已授权C16中domain=risk的活跃条目，X02命中仅影响riskPosture，不伪造告警实例；当前系统告警由priority展示。

C02读取只调用既有account_checks/只读快照，不评估/记录新执行decision、不签发命令、不消费审批证明或增加F05根/venue submission。参考模式首次请求只初始化自有合成fixture；Shadow不创建Paper执行/策略host。Live使用F06身份和owner注入host，研究单条显式tenant/workspace/actor/account/session mode匹配的有界查询，无fixture回退；其他host try_lock繁忙时拒绝/降级。该新SQL仅编译和静态复核，未连接数据库，不能称RLS/数据库验收通过。

最多四来源、每源2000行；priority和recentActivity分别先按严重度/来源时间排序再各取50，旧严重项不被较新info挤掉，truncated明确标识。引用仅规范相对路径和资源类型/UUID/状态/来源时间，不输出prompt、用户身份/raw标签/secret或可执行载荷。无来源时间的策略审批保留null。最终组合重查期限，projection expiresAt和首次stream deadline不晚于ready来源最早失效与30秒上限。

事件为有限snapshot SSE poll/resume，最多1000租约、每租约32帧，绑定当前身份/权限/session/account/mode；旧帧精确回放、无事实变化不生成伪更新，gap/未知/到期/绑定变化409，撤权先于重放，过期读取释放配额。生成consumer在schema、作用域、期限和sequence全部通过后才绑定stream/替换事实；错误首帧/重复/gap不冒充成功，401/403终态清空。完整UI101仍Mocked，未把该页面改称Integrated。

A5原稿人工确认已保存，见[原始记录](evidence/provider-a5-confirmation-20261020/summary.md)；仅5fb5b6aa/8a0ce81b及1169原输入。六前置仅核对原Git blob、输入/规范、日志与产物hash、A5原用户确认：FE:BFF-FE-003 aeab72a5/963fd053；FE:BFF-FE-006 aad08dd5/2404a7df；FE:BFF-FE-010 3152db47/4ed64603；CORE-GATE:X3-SERVICE cd196195/f2d8330f；PROVIDER:A5 5fb5b6aa/8a0ce81b；CORE:F09 e2b85a80/f2d8330f。全部referenceOnly/NOT_REVALIDATED，不调用其Gate，不重授当前READY；共享输入变化后A5独立当前撤回NOT_ASSESSED，原稿/确认/回执保持原字节。C02发布直接影响PRE04、BFF000 catalog和共享响应生成清单，因此执行其静态负向用例，不重验F0/G0或上游业务闭包、全仓或三轮独立构建。

| 当前验证 | 结果 |
|---|---|
| Rust | 47通过：C02 18、Auth/audit 29 |
| Node | 249通过：原确认/流程34、Gate 63、policy/CI 78、发布清单负向74 |
| consumer/契约 | 46通过/7文件；实际生成客户端和全部当前组件/操作响应清单精确覆盖 |
| HTTP / Chromium | 两C02 API、42条当前HTTP（含受审核治理/研究前置操作）；成功401403/schema、404/422、回放/来源变化、基本Chromium |
| 覆盖率 | helper行24/24、分支44/44均100%；仅该helper，不是全仓覆盖率 |
| 必要构建/静态 | generated、build、types、lint、Clippy、plans通过 |
| 实际入口 | development、CI disposition、A5原确认、前置metadata、plans共5/5通过；均本机执行 |
| 历史保护 | 54,468份原audit/gate逐字节保持，历史失败/中断不重写 |

实际命令及exit/signal/timeout/log hash见[结果](evidence/bff-fe-002-local-20261020/review-results.json)；仅function-attempt-05完整回执用于本次准入。

| 检查 | 命令 | 结果 |
|---|---|---|
| contract | `node scripts/check-bff-fe-002-boundary.mjs` | PASS |
| generated | `node scripts/check-bff-generated.mjs` | PASS |
| inventory | `node scripts/pre04-inventory.mjs` | PASS |
| command | `cargo test --locked --offline -p bff-gateway --lib command::tests:: -- --test-threads=1` | PASS |
| a2-boundary | `cargo test --locked --offline -p bff-gateway --test auth_settings_provider --test audit_export_provider` | PASS |
| build | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS |
| http | `node scripts/test-bff-fe-002-http.mjs docs/audit/evidence/bff-fe-002-local-20261020/function-attempt-05/reference-http.json` | PASS |
| consumers | `pnpm exec vitest run apps/terminal/tests/command-provider-consumer.test.ts packages/api-client/tests/bff-response.test.ts packages/api-client/tests/bff-transport.test.ts packages/api-client/tests/sse-poc.test.ts tests/contract --coverage --coverage.provider=v8 --coverage.include=apps/terminal/src/command/gateway.ts --coverage.reporter=json-summary --coverage.reportsDirectory=docs/audit/evidence/bff-fe-002-local-20261020/function-attempt-05/consumer-coverage` | PASS |
| types | `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal typecheck` | PASS |
| lint | `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal lint` | PASS |
| clippy | `cargo clippy --locked --offline -p bff-gateway --lib -- -D warnings` | PASS |
| confirmation | `node --test scripts/provider-a5-confirmation-20261020.test.mjs scripts/user-acceptance-confirmation.test.mjs` | PASS |
| gate-tests | `node --test scripts/bff-fe-002-functional-gate.test.mjs` | PASS |
| plan-policy | `node --test scripts/development-plan-order-negative.mjs scripts/ci-stage-disposition.test.mjs` | PASS |
| inventory-negative | `node --test scripts/pre04-gate-negative.mjs scripts/bff-fe-000-gate-negative.mjs scripts/bff-remediation-negative.mjs` | PASS |
| plans | `node scripts/check-development-plans.mjs` | PASS |

HTTP状态分布：`{"200": 31, "201": 1, "202": 1, "401": 2, "403": 3, "404": 1, "409": 2, "422": 1}`。本机debug回环观测42次请求，均值2.222ms、最大54.155ms；仅请求基线，不作为负载/性能预算验收。受控研究变更先403且计数不变，再由独立已验签审核记录对应的Owner近端认证启用能力；只创建已有C03参考意图和元数据，不运行外部Engine。共34限定控制点。

[实施预检失败](evidence/bff-fe-002-local-20261020/preflight/disposition.json)保留：live测试初始化字段、旧版本/清单标识、Clippy、旧数值literal/测试env、旧planned/field-count负向假设、最终采样期限的可变声明等均有原输出；不称为冻结候选通过。[正式首轮](evidence/bff-fe-002-local-20261020/function-attempt-01/disposition.json)源码e1fe2452前6组PASS，HTTP缺少已审核研究能力前置而得到403、测试期望202导致FAIL，后9组NOT_RUN，产品拒绝保持。[第二轮](evidence/bff-fe-002-local-20261020/function-attempt-02/disposition.json)源码42daa44f前7组PASS，consumer43 PASS/3 FAIL：两个旧schema/operation数量断言和新成功示例缺失，后8组NOT_RUN。修正为与独立生成清单精确比较，补成功示例，保留planned未来操作负向。第三轮源码e4cea929的16组均PASS，但通用计划校验器遗漏BFF002 profile而套入旧依赖重验规则，发布FAIL且原子回滚。修正类型分派与合成形状/冒用拒绝用例后，第四候选da9058d3的16组/5入口PASS；收尾Context对照发现参考Owner/Approver已有execution.operate被误裁剪，旧测试也错误期望隐藏执行读信息，第四轮原PASS/READY字节另存并SUPERSEDED，当前准入撤回。修正参考身份映射并新增与Context三角色对照后，只第五候选独立完整PASS，不拼接前轮或历史结果，完整进程退出0后整理本稿。

文档收尾后，使用去凭据离线环境及缓存pnpm10.20.0执行 `pnpm check:bff-fe-002:development`、`node scripts/check-development-plans.mjs`、当前十处Rust文件格式与 `git diff --check`，四项均退出0，见[收尾检查](evidence/bff-fe-002-local-20261020/final-checks.json)。这里只核对当前准入与计划/格式一致性，不扩大功能或上游复验。

未决风险：真实Supabase/PostgreSQL/RLS/IdP/MFA与新研究查询、实际工作流/Engine/观察源、跨实例/重启和持久事件恢复、P02/UI101/G1/FEP1完整页面/业务链、目标安全/性能/容量/长稳/部署及同SHA hosted CI和正式发布全部NOT_RUN，目标自动化NOT_IMPLEMENTED。当前四owner来源是独立时点读模型，非跨服务原子快照；参考研究仅使用已有受控C03 fixture元数据，不表示真实Engine worker完成。X01既有f64/报价与来源期限保证不提高；有限进程租约不承诺持久恢复。 无生产凭据、目标数据库、本地PostgreSQL/Supabase、venue submit、push、部署或外部发布。

证据：[manifest](evidence/bff-fe-002-local-20261020/manifest.json)、[完整确认稿](evidence/bff-fe-002-local-20261020/confirmation-draft.md)、[控制矩阵](evidence/bff-fe-002-local-20261020/control-matrix.json)、[变更文件](evidence/bff-fe-002-local-20261020/changed-files.json)、[索引](evidence/bff-fe-002-local-20261020/evidence-index.json)。下一可执行：项目用户确认本稿后 **FE:BFF-FE-011 / A6：Web浏览器平台能力API当前功能复核**，仅其当前功能及直接影响。
