# FE:BFF-FE-004 / A4 Strategy、Backtest 与 Release API 当前功能复核

当前功能 **BFF004_SCOPE_LOCAL DEVELOPMENT READY**。源码 `8172d825e90c6f7ff63f1107cd002b94a0983c8b`；925 输入；digest `sha256:c547a563a7f76b519a64d017185fbb6e080a26cba6870218f0b4a68ffcb9639b`。17/17 当前范围检查与5/5实际门禁入口通过；仅 functionImplementation=PASS，businessIntegration/releaseAcceptance=NOT_RUN，formalAccepted=false，runtimeAdmission=DENIED。本次完整确认稿PENDING。

## 已交付功能

C05十二操作覆盖 strategy list、draft get/save、static check、backtest create/get/stream、release list/create/get、approval submission及rollback request。provider调用真实StrategyService/DraftService及S01/S02/S03/S04；trusted输入目录和时钟由服务端宿主供应，HTTP不能构造验证报告、来源授权、已批准Release或执行命令。支持已注册可信Artifact策略；任意代码/不匹配参数/未来引用只保留草稿并拒绝静态检查及回测，未经支持的任意源码不执行。

草稿If-Match执行原子CAS；30个并发编辑只有一次成功，409返回currentVersion/conflictDiff。consumer保留本地编辑，显式解决冲突后保存。相同actor/key/intent恢复相同响应，改意图409；100次保存重试不重复审计，1000次实际HTTP回测重试同job/receipt。202不代表报告成功。

回测固定可信DataSnapshot/Artifact与不可变草稿版本；真正执行S02得到private proof，报告绑定参数、来源提交、镜像/运行时和内容hash。reportArtifactId经A3可定位，metadata/attachment canonical hash一致；live适配也仅解析同一可信租约及工作区内的报告，读取审计进入F05。stream为有限资源journal，支持afterSequence恢复/去重、未来sequence拒绝、租约切换和撤权终止；不声称持久广播。

Release不可变，allowedTargets固定paper/shadow。公共C08显示策略审批及timeline；独立有效身份/MFA、单次proof、版本/有效期及禁自批，跨策略/执行proof复用拒绝，精确成功重试可恢复；策略审批不签发TradeCommand。rollback要求来源与更早目标同策略、均有效获批，仅记录受理，**无部署、无venue submit**。

F05参考审计根eventId/causationId与响应auditRef、actor、route一致；重试不重复追加。默认live没有host时503，不回退fixture。显式live host为进程内租约，审计持久事务失败会隔离宿主；不把这一隔离策略当成持久原子事务或跨实例恢复。

## 直接前置及原确认

九直接前置：BFF-FE-003、BFF-FE-006、BFF-FE-007、CORE:S01/S02/S03、CORE-GATE:X3-SERVICE、SERVICE:S04及PROVIDER:A3。原manifest逐字节/hash核对，仅NOT_REVALIDATED/referenceOnly，不重授新候选READY。当前直接回归覆盖18个策略用例、16个修改影响的执行用例、6个S04服务用例、29个A2认证/审计用例及24个Research/A3边界用例。没有递归依赖门禁、全仓测试、无关10万事件回放或三轮独立构建。

用户最新原始答复完整保存在[FE006确认账本](./evidence/bff-fe-006-confirmation-20261018/user-confirmation.json)，确认原稿/原技术回执aeaef3f、原源码590f1f8f，严格门禁CONFIRMED。原FE006稿使用bare request JSON，原稿未重写；显式兼容格式、document/receipt hash和16MiB分批原源码核验防止大文件溢出且保留全部检查。PROVIDER:A3原确认仍绑定4580bac/93d66ad原范围。共享源变更后FE006当前独立Gate撤回NOT_ASSESSED；两份原确认均不扩展为当前HEAD或A4聚合准入。

## 测试和证据

唯一当前PASS来自[function-attempt-02](./evidence/bff-fe-004-local-20261018/function-attempt-02/function-receipt.json)。**93 Rust、160 Node、52 consumer/contract**；十二API、1068条真实HTTP/schema记录，逐项成功/401/403及错误/冲突/恢复；1000幂等重试和基本Chromium通过。新增consumer行17/17、分支36/36、语句58/58、函数17/17，100%。OpenAPI1.9.0共74操作/64schema，六类生成client/Zod/JSONSchema/operations/MSW/Rust输入策略一致；planned34，不等于provider实现或全页面验收。

| 检查组 | 结果 | 实际命令 |
| --- | --- | --- |
| contract | PASS | `node scripts/check-bff-fe-004-boundary.mjs` |
| generated | PASS | `node scripts/check-bff-generated.mjs` |
| strategy | 18 cases PASS | `cargo test --locked --offline -p bff-gateway --lib strategy::tests:: -- --test-threads=1` |
| execution-direct | 16 cases PASS | `cargo test --locked --offline -p bff-gateway --lib execution::tests:: -- --test-threads=1` |
| core-strategy | 6 cases PASS | `cargo test --locked --offline -p quantos-strategy --test service_s04` |
| a2-boundary | 29 cases PASS | `cargo test --locked --offline -p bff-gateway --test auth_settings_provider --test audit_export_provider` |
| a3-boundary | 24 cases PASS | `cargo test --locked --offline -p bff-gateway --lib research -- --test-threads=1` |
| build | PASS | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` |
| http | 12 operations / 1068 records PASS | `node scripts/test-bff-fe-004-http.mjs docs/audit/evidence/bff-fe-004-local-20261018/function-attempt-02/reference-http.json` |
| consumers | 52 cases / 10 files PASS | `pnpm exec vitest run apps/terminal/tests/strategy-provider-consumer.test.ts apps/terminal/tests/strategy-recovery.test.ts apps/terminal/tests/execution-provider-consumer.test.ts apps/terminal/tests/execution-recovery.test.ts packages/api-client/tests/bff-response.test.ts packages/api-client/tests/bff-transport.test.ts packages/api-client/tests/sse-poc.test.ts tests/contract --coverage --coverage.provider=v8 --coverage.include=apps/terminal/src/strategy/gateway.ts --coverage.reporter=json-summary --coverage.reportsDirectory=docs/audit/evidence/bff-fe-004-local-20261018/function-attempt-02/consumer-coverage` |
| types | PASS | `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal typecheck` |
| lint | PASS | `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal lint` |
| clippy | PASS | `cargo clippy --locked --offline -p bff-gateway --lib -- -D warnings` |
| confirmation | 42 cases PASS | `node --test scripts/bff-fe-006-confirmation.test.mjs scripts/provider-a3-confirmation.test.mjs scripts/user-acceptance-confirmation.test.mjs` |
| gate-tests | 48 cases PASS | `node --test scripts/bff-fe-004-functional-gate.test.mjs` |
| plan-policy | 70 cases PASS | `node --test scripts/development-plan-order-negative.mjs scripts/ci-stage-disposition.test.mjs` |
| plans | PASS | `node scripts/check-development-plans.mjs` |

每组原始日志、起止/耗时/timeout/exit/signal/spawn状态和hash见[逐组结果](./evidence/bff-fe-004-local-20261018/review-results.json)。development、CI处置、FE006原确认、直接前置metadata及计划五入口均实际执行，退出0；失败时publication回滚受单测验证。CI已注册必执行处置和负向用例；源码转移按影响范围，非递归。

## 保留失败与范围

源码76ecc6f4的attempt01在策略17测试通过后，代码复核发现首审计事件替换ID未同步causation根；主动SIGTERM停止，execution-direct为INTERRUPTED，未发布READY。修复加闭合证据链断言后冻结8172d825，attempt02完整重验当前范围。首次bare稿确认失败、模块别名/夹具字段编译失败、TypeScript语法及开放参数类型失败、Artifact.hypothesis缺失/旧73计数、Clippy失败均保留，详见[探索说明](./evidence/bff-fe-004-local-20261018/exploratory/README.md)。元数据收口中计划先链接未落盘报告导致门禁拒绝，保留空stdout及失败说明；补齐报告后只重验受影响元数据入口，不重跑业务组。停止/失败未记作PASS。

原53,062份已跟踪审计/门禁文件逐字节无变化，[保留证明](./evidence/bff-fe-004-local-20261018/history-preservation.json)。[完整变更清单](./evidence/bff-fe-004-local-20261018/changed-files.json)、[证据索引](./evidence/bff-fe-004-local-20261018/evidence-index.json)、[控制矩阵](./evidence/bff-fe-004-local-20261018/control-matrix.json)提供文件和hash。所有改动仅QuantOS；未使用生产凭据、私有根dotenv、目标DB或外部发布，未push。

## 变更文件

- provider：`services/bff-gateway/src/strategy.rs`、`strategy/tests.rs`、`live/strategy.rs`；共享`lib.rs`、`input_contract.rs`、`execution.rs`、`execution/reference_seed.rs`、`execution/reference_release.rs`、`live.rs`、`live/execution.rs`、`live/research.rs`；现有F09测试仅补可选宿主/共享proof字段以编译。核心Strategy crate无改动。
- client/contract：`apps/terminal/src/strategy/gateway.ts`、两个strategy测试；OpenAPI/catalog/compatibility、六生成物、通用response/contract版本测试。
- 门禁：bff-fe-004 contract/scope/gate/recorder/development/boundary/HTTP/negative tests，FE006原确认器/负向用例，计划政策与CI分发/测试、package/Makefile/workflow；两开发计划、页面API覆盖登记、功能规程及本报告/确认稿/证据。完整路径列表以上述JSON为准。

## 未决风险与阶段状态

功能范围内确认缺陷已修复。仍有进程内host/命令缓存、单租约恢复边界；持久Supabase迁移/事务/RLS、真实Auth/MFA/Storage、跨实例及重启/未知结果恢复、真实来源用途许可/撤权与可信运行环境均未验。核心S02回测指标保留f64计算，字符串输出不升级精度，成本校准仍待目标环境。完整P06/P07/G3/FEP3及A4业务UI联调、性能/容量/长稳、部署/同SHA hosted CI和正式发布全部NOT_RUN；不授予上游、真实交易或runtime许可。

Gate：BFF004_SCOPE_LOCAL DEVELOPMENT READY；其余158节点NOT_ASSESSED，BLOCKED0。A3/FE006原确认CONFIRMED；本次人工确认PENDING；完整联调/发布NOT_RUN。请审阅[完整确认稿](./evidence/bff-fe-004-local-20261018/confirmation-draft.md)。下一可执行任务为 **PROVIDER:A4 当前功能汇总复核**，使用新的当前功能组合证据，不拼接旧READY。源码提交76ecc6f4（首次）、8172d825（审计修复与当前冻结）；最后的文档/证据提交由Git日志和最终回复给出。
