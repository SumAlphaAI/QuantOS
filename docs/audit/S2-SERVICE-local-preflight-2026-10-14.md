# S2-SERVICE 本地接口、fixture 与必要前置预检（2026-10-14）

结果：`PREFLIGHT_COMPLETE_WITH_LOCAL_GAPS` / 回执 `PASS_WITH_LOCAL_GAPS`。本轮预检完成，**没有授予 S2_SERVICE_LOCAL、TP01_SERVICE_LOCAL 或正式 ACCEPTED**。S2-SERVICE39节点、SERVICE:TP01子闭包31节点均已逐项建立规范输入、依赖、检查、来源、消费关系和待补项映射。全局仍为0 READY / 159 NOT_ASSESSED / 0 BLOCKED；本地缺项不被解释为Supabase/外部/性能阻塞。

## 冻结与证据范围

- 基线：`59e6f418600ec569fcdae5f1cacdb865b20d0c42`，起始工作区干净。
- 本轮预检冻结提交：`eac43e0d7c7de2261e8517406f5da4562ff1df13`。从干净提交实际执行19组检查，输入绑定1132项（包括固定Gitlink）；严格验据PASS。
- 必要前置27节点/85组来自`5e14e3a48bc44f1629a68a9b94da88d860231417`的R1_LOCAL原执行。本轮重新校验完整递归回执、原命令/退出码/日志及制品hash、冻结Git blob、规范输入和当前输入一致性，原X03证据封存也通过。**这是原执行证明的当前输入复验，不是本轮提交重新执行85组；未发布R1 Gate。**
- 保留基线下25,570份历史证据文件逐字节一致。R02使用此前合成授权输入证明；本轮不消费退役32条市场事实。

[机器验证摘要](./evidence/s2-service-preflight-20261014/verification.json)、[完整执行回执](./evidence/s2-service-preflight-20261014/attempt-01/receipt.json)、[19组实际命令/结果](./evidence/s2-service-preflight-20261014/attempt-01/results.json)、[冻结输入](./evidence/s2-service-preflight-20261014/attempt-01/inputs.json)、[原件索引](./evidence/s2-service-preflight-20261014/attempt-01/artifact-index.json)。

## 本地范围与验收映射

[准入提议与阶段移交](./evidence/s2-service-preflight-20261014/proposed-scope.md)定义12份后续本地回执及消费关系；[完整39节点映射](./evidence/s2-service-preflight-20261014/mapping.json)含每节点规范输入、来源路径、本地要求、待补项和31节点归属。下面检查ID可在上述执行结果或原R1_LOCAL策略回执中追溯。

| 节点（拓扑顺序） | TP01子闭包 | 本地策略状态 | 检查映射 |
| --- | --- | --- | --- |
| `CORE:F01` | 是 | 已映射；原5e14e3a4证据严格重验 | `f01`、`f01-negative`、`f01-reproducibility`、`f01-lint`、`f01-test` |
| `CORE:F03` | 是 | 已映射；原5e14e3a4证据严格重验 | `proto`、`proto-client`、`api-client-tests` |
| `CORE:F04` | 是 | 已映射；原5e14e3a4证据严格重验 | `foundation-rust`、`f04`、`f04-negative`、`f04-line-coverage`、`f04-branch-coverage` |
| `CORE:F05` | 是 | 已映射；原5e14e3a4证据严格重验 | `event-rust`、`f05`、`f05-negative`、`storage-rust`、`f05-coverage` |
| `CORE:F02` | 是 | 已映射；原5e14e3a4证据严格重验 | `f02-migration-preflight`、`f02-negative`、`f02-secrets`、`f02-license`、`f02-waivers`、`f01-negative`、`proto` |
| `CORE:F06` | 是 | 已映射；原5e14e3a4证据严格重验 | `auth-rust`、`f06-negative` |
| `CORE:F07` | 是 | 已映射；原5e14e3a4证据严格重验 | `r03-f07-runtime`、`r03-f07-gateway` |
| `CORE:F08` | 是 | 已映射；原5e14e3a4证据严格重验 | `f08-functional`、`f08-branches`、`f08-service` |
| `CORE:F09` | 是 | 已映射；原5e14e3a4证据严格重验 | `f09-functional`、`f09-negative` |
| `CORE:TP01-A` | 是 | 已映射；原5e14e3a4证据严格重验 | `tp01-negative`、`tp01-sync`、`tp01-local-baseline` |
| `CORE:TP01-B` | 是 | 已映射；原5e14e3a4证据严格重验 | `tp01-capability`、`tp-intake` |
| `CORE-GATE:F0` | 是 | 已映射；原5e14e3a4证据严格重验 | `plans`、`plans-negative`、`fep0-negative`、`local-gate-policy` |
| `CORE:R01` | 是 | 已映射；原5e14e3a4证据严格重验 | `r01-functional`、`r1-receipt-negative` |
| `CORE:R02` | 是 | 已映射；原5e14e3a4证据严格重验 | `r02-functional`、`r02-engine-consumers`、`r1-receipt-negative`、`r1-process-cleanup` |
| `CORE:TP01-C` | 是 | 已映射；原5e14e3a4证据严格重验 | `tp01-c-skeleton`、`tp01-c-evidence-negative`、`tp01-c-local-policy`、`tp01-c-process-cleanup` |
| `CORE:TP01-D` | 是 | 已映射；原5e14e3a4证据严格重验 | `tp01-d-absorption`、`tp01-d-negatives`、`tp01-d-process-cleanup`、`tp01-d-local-policy` |
| `CORE:TP02` | 是 | 已映射；原5e14e3a4证据严格重验 | `tp02-development`、`tp02-negatives`、`tp02-process-cleanup` |
| `CORE:TP03` | 是 | 已映射；原5e14e3a4证据严格重验 | `tp03-development`、`tp03-negatives`、`tp03-process-cleanup` |
| `CORE:TP04` | 是 | 已映射；原5e14e3a4证据严格重验 | `tp04-development`、`tp04-negatives`、`tp04-process-cleanup` |
| `CORE:TP05` | 是 | 已映射；原5e14e3a4证据严格重验 | `tp05-development`、`tp05-negatives`、`tp05-process-cleanup` |
| `CORE:TP08` | 是 | 已映射；原5e14e3a4证据严格重验 | `tp08-development`、`tp08-negatives`、`tp08-process-cleanup` |
| `CORE:TP09` | 是 | 已映射；原5e14e3a4证据严格重验 | `tp09-development`、`tp09-negatives`、`tp09-process-cleanup` |
| `CORE:TP10` | 是 | 已映射；原5e14e3a4证据严格重验 | `tp10-development`、`tp10-negatives`、`tp10-process-cleanup` |
| `CORE:TP11` | 是 | 已映射；原5e14e3a4证据严格重验 | `tp11-development`、`tp11-negatives`、`tp11-process-cleanup` |
| `CORE:R03` | 是 | 已映射；原5e14e3a4证据严格重验 | `r03-local-runtime`、`r03-local-engines`、`r03-local-tp02`、`r03-local-manager`、`r03-local-clippy`、`research-local-negatives` |
| `CORE:R04` | 是 | 已映射；原5e14e3a4证据严格重验 | `r04-local-products`、`research-local-negatives` |
| `CORE-GATE:R1-SERVICE` | 是 | 已映射；原5e14e3a4证据严格重验 | `research-local-negatives` |
| `CORE:TP01-E` | 是 | PROPOSED；未登记 | `sync-local` |
| `CORE:TP01-F` | 是 | PROPOSED；未登记 | `rollout-local`、`rollout-boundary` |
| `CORE:TP01-G` | 是 | PROPOSED；未登记 | `python-boundaries` |
| `SERVICE:TP01` | 是 | PROPOSED；未登记 | `prerequisite-proof`、`sync-local`、`rollout-local`、`python-boundaries` |
| `CORE:S01` | 否 | PROPOSED；未登记 | `strategy-domain` |
| `CORE:TP06` | 否 | PROPOSED；未登记 | `python-boundaries`、`strategy-bridge`、`strategy-domain` |
| `CORE:S02` | 否 | PROPOSED；未登记 | `strategy-domain`、`strategy-bridge` |
| `CORE:S03` | 否 | PROPOSED；未登记 | `strategy-domain` |
| `SERVICE:S04` | 否 | PROPOSED；未登记 | `fixtures-negative`、`actual-routes`、`strategy-domain` |
| `EVALUATION:TP07` | 否 | PROPOSED；未登记 | `evaluation-boundary` |
| `EVALUATION:TP12` | 否 | PROPOSED；未登记 | `python-boundaries`、`evaluation-boundary` |
| `CORE-GATE:S2-SERVICE` | 否 | PROPOSED；未登记 | `prerequisite-proof`、`fixtures-negative`、`strategy-domain`、`strategy-bridge`、`evaluation-boundary` |

SERVICE:TP01必须保留三次可复现构建、20组workflow双RPC回放、≥100安全负向、受控取消≤2秒、Artifact去重以及E/F/G组合消费。受控取消/TTL/过期和并发拒绝是本地功能，不能随P95性能目标延期。SERVICE:S04必须证明授权API与权威审批的成功、拒绝、恢复、过期/并发冲突和审计。页面P06/P07、20 UI fixture及S2业务联调由CORE:S04/G3关闭。

## 接口与fixture结果

已有`quantos-strategy`草稿/回测/Release进程内API，以及StrategyLab五RPC、Rust Manager本机UDS桥接。策略领域15测试和桥接4测试通过，Python198测试通过；这些证明已有局部实现，不替代专用服务组合回执。

C05声明11个策略BFF操作，拥有15个自有合成请求/响应示例（4请求+11响应）及1个计划SSE操作`subscribeBacktestRun`。本轮接口/负向测试51/51通过。BFF-FE-004是SERVICE:S04的未来消费者，**不在39节点闭包中**；其实际provider探针发现11/11业务路由404。独立session=200，无认证=401，伪造Release请求=422，进程已终止。守卫通过不表示业务handler实现；后续可以先完成专用策略服务，再进入BFF联调，不因本报告提前授予BFF Gate。

[HTTP原始回执](./evidence/s2-service-preflight-20261014/attempt-01/http/receipt.json)保留每操作、状态码、响应体、hash和契约偏差；服务原始日志也保留。

## 测试命令与结果

| 实际命令/分组 | 结果 |
| --- | --- |
| `node docs/audit/evidence/s2-service-preflight-20261014/run.mjs attempt-01` | 19/19预检符合预期，其中4项退出2是开放缺项，不能计准入PASS |
| `node docs/audit/evidence/x03-replay-fix-20261014/verify-local.mjs`；原 `seal.py --verify` | 原27节点/85组及封存校验PASS；原执行SHA保持5e14e3a4 |
| `node --test --test-reporter=tap docs/audit/evidence/s2-service-preflight-20261014/preflight.test.mjs` | 51 PASS，含15合成例、鉴权/CSRF/幂等/乐观锁、伪造字段和闭包删减负向 |
| `node --test --test-reporter=tap scripts/tests/sync-vibe.test.mjs scripts/tests/sync-vibe-cli.test.mjs` | 23 PASS，API/许可证/CVE/patch分级及严格阻断/monitor差异 |
| `node --test --test-reporter=tap scripts/tests/tp01-vibe-rollout.test.mjs` | 4 PASS，仅合成状态机；不证明7天或真实回滚SLA |
| `cargo test --locked --offline -p quantos-strategy --lib` | 15 PASS / 1 ignored（P95发布测试）；包括50并发、10次重放、100泄漏/静态失败/部署拒绝 |
| `engines/.venv/bin/python -m pytest`，选择StrategyLab、Vibe契约/吸收/边界及TP12规则5文件（完整参数见results） | 198 PASS，含100恶意提示及100边界fixture；TP12有7条禁止耦合规则 |
| `cargo test --locked --offline -p quantos-engine-manager --test python_strategy_lab` | 4 PASS，真实本机UDS、五RPC及100恶意输入；不连接Supabase |
| `cargo build --locked --offline -p bff-gateway`；`route-probe.mjs ... --require-implemented` | build PASS；11路由404，探针退出2并保留原件 |
| OpenAPI、generated、catalog、计划结构、handoff | PASS |
| `node --test --test-reporter=tap scripts/development-plan-order-negative.mjs` | 42 PASS |
| `node docs/audit/evidence/s2-service-preflight-20261014/verify.mjs --record` | PASS，1132冻结输入、25,570历史文件、39/31闭包、原27/85证明与所有计数/退出码/hash校验 |
| `node --test --test-reporter=tap docs/audit/evidence/s2-service-preflight-20261014/verify-negatives.mjs` | 21 PASS；拒绝伪造READY/正式/数据库/外部/性能、闭包减项、消除退出2、遗漏命令、超时、信号、日志/制品篡改及膨胀计数 |

本轮最终列出的功能/结构/证据测试合计358 PASS、1发布性能ignored；不同测试中的100条fixture不当作100个独立测试，也不去重合称统一安全覆盖率。本轮未重跑全仓完整测试套件，未称39节点正式admission通过。

## 开放缺项、风险与失败保留

| 编号 | 当前证据与风险 | 后续本地闭合条件 |
| --- | --- | --- |
| S2-G01 | 12个节点无本地策略/专用严格回执，27已映射节点当前阶段也未发布 | 依赖顺序实现E/F/G、TP01服务、策略/评估及S2专用策略与负向；新冻结提交完成所需闭包 |
| S2-G02 | TP01-F库信任`signedArtifactsPresent`/`runtimeIsolationVerified`布尔值，未验签；JSON禁用/回滚未消费至运行适配器/在途请求 | 接入真实本机验签/禁用/回滚控制器，补伪造/篡改签名、切换拒绝和在途收尾负向及组合回执 |
| S2-G03 | SERVICE:S04缺专用授权服务消费证明；当前Release类型只有approved_at/by，现有领域测试不证明过期、并发审批及审计闭环；11个未来BFF业务handler404 | 完成专用策略服务API、权威审批与审计、过期/并发拒绝及成功/恢复消费；随后独立BFF联调 |
| S2-G04 | TP07 ADR固定引用commit，但本仓无`third_party/nautilus_trader` baseline/SBOM/CVE及专用能力清单；TP12 reference-only与CVE not_run不补足TP07 | 补本地评估材料或形成明确不引入的处置/范围决定；保持运行时不可采用，外部更新另授权 |

四份预期退出2原件保留：[准入拒绝](./evidence/s2-service-preflight-20261014/attempt-01/local-admission-refusal.log)、[TP01-F探针](./evidence/s2-service-preflight-20261014/attempt-01/rollout.json)、[TP07评估探针](./evidence/s2-service-preflight-20261014/attempt-01/evaluation.json)、上述HTTP原件。开发探测首次50 PASS/1 FAIL也保留在[development-probe-01.log](./evidence/s2-service-preflight-20261014/development-probe-01.log)：新测试错误地选择不含correlationId的列表响应作错配负向，改为含correlationId的createBacktest响应；[第二次51 PASS](./evidence/s2-service-preflight-20261014/development-probe-02.log)及冻结后51 PASS独立保留。该首次失败是测试设计修正，未伪称产品缺陷或覆盖原件。

## Gate、移交与下一任务

- S2-SERVICE / SERVICE:TP01：`NOT_ASSESSED`；新profile均`PROPOSED_NOT_REGISTERED`。预检完成不等于READY、ACCEPTED、测试阶段或发布放行。
- Supabase目标数据库/RLS/持久化/Storage、外部环境/CI/在线供应链刷新、P95/容量与持续窗口目标：`NOT_RUN`，继续交测试/最终发布。未升级订阅、未使用生产凭据、未执行外部发布。
- 下一可执行任务：**实现TP01-E_LOCAL本地准入及专用负向测试，从新冻结提交完整复验28节点必要本地闭包**；随后修复TP01-F运行控制缺项并推进29/30/31节点递进准入。TP07评估材料、S04服务闭环并行于后续各自授权任务处理。

## 变更与复查入口

运行时与原计划未改。新增预检范围/映射/15合成fixture、可执行检查与接口/边界探针、51接口/闭包测试、21回执负向、19组原始回执和本报告。[完整变更文件清单](./evidence/s2-service-preflight-20261014/changed-files.txt)和[证据封存](./evidence/s2-service-preflight-20261014/seal.json)记录交付文件hash；本地证据提交见最终交付Git记录，未推送。

重复复查使用`node docs/audit/evidence/s2-service-preflight-20261014/verify.mjs`和`python3 docs/audit/evidence/s2-service-preflight-20261014/seal.py --verify`；不要复用已有attempt运行器或`--record`覆写回执。
