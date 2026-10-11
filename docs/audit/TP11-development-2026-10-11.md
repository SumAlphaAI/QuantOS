# TP11 OpenStock 限定评估 — 2026-10-11

**TP11 / TP05 / F0 DEVELOPMENT READY**。先行TP05在`ddae9d52`完成13节点/53组实际准入并提交；随后TP11功能输入变化撤销旧Gate，在冻结源码`05d3b78fbcd18a700d3c5358f69cd5db42ada65e`重验必要14节点、56唯一命令组：原轮55 PASS / 1会话超时FAIL；同源完整独立F07服务补测PASS后，56组有效结果经标准严格组合校验，总执行56+1。当前14 READY、145 NOT_ASSESSED、0 BLOCKED；formalAccepted=false。限定结论`reference_only`，真实数据、上游源码/资产/运行时与Day-1依赖不准入。先行快照见[TP05刷新报告](./TP05-readmission-2026-10-11.md)，不作为最终新源码的替代证据。

## 变更、评估与验收覆盖

| 要求 | 交付与实际证据 | 结果及边界 |
| --- | --- | --- |
| 固定来源、provider comparison及许可证 | [provider comparison](../../third_party/openstock/provider-comparison.md)、[来源观察](../../third_party/openstock/provenance.json)、[ADR](../adr/20260731-tp11-openstock-evaluation.md)；六份固定commit公共文档/许可证/依赖描述文件只读逐字节摘要验证，加两份官方条款检查 | PASS；public docs是DOCUMENTED_UNEXECUTED。未保留上游源码/资产、未安装/运行上游项目 |
| 两个provider fixture的血缘/质量映射 | [自有实验](../../third_party/openstock/experiments.py)、[输入fixtures](../../third_party/openstock/fixtures/01-finnhub-quote-to-data-contract.json)、[独立widget拒绝](../../third_party/openstock/fixtures/03-tradingview-display-only.json) | 两份Finnhub形状自有quote/news正向映射，加TradingView独立负向fixture，覆盖两个provider身份；不声称两个真实provider已可用 |
| 可验证DataSnapshot与Artifact | 实际DataSnapshot protobuf往返/生成JSON schema、独立JS字段映射、确定性重放，原始fixture/记录schema/归一化/血缘实际hash，4份物理Artifact对象字节 | PASS；两份合成Snapshot，widget先拒绝；仅mock-artifact URI，不是已部署持久化Artifact服务 |
| 未授权输入不可产出可用Snapshot | [45项Python](../../engines/tests/test_tp11_openstock_fixtures.py)、[实际F05 Gate测试](../../crates/quantos-storage/tests/tp11_reference_gate.rs)，63项Rust决策矩阵 | PASS；固定研究/测试范围、两个精确登记fixture摘要，拒绝真实origin/未授权license/未知provider/widget/嵌套authority。F05不是法律注册表；新鲜news可通过其结构性strategy/trading检查，但TP11前置intake仍拒绝这些用途 |
| TP05兼容性与替换成本 | 实际TP05 DataQueryResponse schema拒绝候选Finnhub provider/dataset；独立记录schema | PASS；quote没有volume，news未在TP05 schema准入。未来须独立实现provider/records schema、scope/cache/cancel、书面用途授权及部署证据 |
| 无Day-1依赖/生产排除 | [源码/lock/生产Gate](../../scripts/tp11-evaluation.mjs)、[35项负向测试](../../scripts/tp11-evaluation.test.mjs)、Makefile与生产manifest调用；[8份锁/清单字节未变](./evidence/tp11-20261011/lock-digests.json) | PASS；生产制品路径、运行时源码/依赖、目录复制及编码绕过被拒绝。未实际构建/发布包含OpenStock的制品 |
| 当前回执与依赖闭包 | [组件回执](./evidence/tp11-20261011/receipt.json)、[统一TP11 manifest](./evidence/provider-a1-remediation-20261004/tp11-admission-20261011/validated-composite-01/core-tp11.json) | 输入/命令/时间/源码/日志/输出/依赖递归绑定；工程PASS不自行批准正式ACCEPTED |

两份正向fixture使用字符串小数/时间和最小字段子集，仅是离线契约实验；不证明真实Finnhub HTTP传输兼容性。官方quote/company-news文档动态正文未由文本读取器取得，未补作真实接口通过。研究展示参考包括watchlist/search/widget/summary；paper trading出现在路线图，未作为已实现策略/信号/回测能力。没有交付QuantOS页面或策略Engine。

## 初始问题与修复记录

[初始原件与发现](./evidence/tp11-20261011/initial/findings.json)保留：I01修正free tier即研究许可的错误；I02以真实对象字节摘要、DataSnapshot往返和实际F05决策替代占位hash/恒false布尔；I03明确TP05缺少Finnhub provider、news和quote volume兼容；I04修正Git commit伪SHA256和“漏洞全为transitive”的错误；I05新增内容绑定回执、递归依赖与生产排除。

[首次组件预检](./evidence/tp11-20261011/initial/preflight-attempt-01/receipt.json)仅format项FAIL，原因是engines/tests使用项目100列配置而仓库外准备采用默认配置；按项目配置重排后12/12 PASS。失败记录及原产物完整保留，不伪装首次即通过。

SPDX是一个固定项目和六份观察文件的元数据，不是安装后全依赖SBOM。历史npm原报告摘要保留：39项（critical2/high13/moderate24），含5项direct。当前CVE NOT_ASSESSED，不宣称清零。QuantOS策略在单独许可证审查前拒绝源码/运行时复用；AGPL软件许可与市场/新闻数据权利分别审查。

## 测试命令与结果

原始[56组执行台账](./evidence/provider-a1-remediation-20261004/tp11-admission-20261011/attempt-01/execution-results.json)为55 PASS / 1 FAIL：F07服务在bff-startup-session 15秒超时，数据库bootstrap和真实Auth登录先通过，原失败fixture清理PASS。原始日志/failed receipt不改写。随后[同源完整独立补测](./evidence/provider-a1-remediation-20261004/tp11-admission-20261011/supplement-01/result.json)PASS；[严格组合来源](./evidence/provider-a1-remediation-20261004/tp11-admission-20261011/validated-composite-01/provenance.json)记录源码/输入逐项比对、原轮及补测摘要、56个有效组/57次实际执行与标准validateReceipt结果。不是一次56/56无失败，不扩大自动重试策略，也不把超时归因于已证实的代码缺陷。[全回归摘要](./evidence/tp11-20261011/full-test-summary.json)与[最终检查](./evidence/tp11-20261011/final-checks.json)保存实际结果。

```sh
node scripts/provider-a1-receipts.mjs --assess-tp11 docs/audit/evidence/provider-a1-remediation-20261004/tp11-admission-20261011/attempt-01
node docs/audit/evidence/tp11-20261011/independent-complete-supplement.mjs run tp11-admission-20261011
node docs/audit/evidence/tp11-20261011/independent-complete-supplement.mjs publish tp11-admission-20261011
node engines/openbb-adapter/check-development.mjs --admit
node third_party/openstock/check-development.mjs --admit
node docs/audit/evidence/tp11-20261011/final-checks.mjs
node docs/audit/evidence/tp11-20261011/final-gate-probes.mjs
python3 docs/audit/evidence/tp11-20261011/git-evidence-tracking.py --check-commit
```

| 实际命令/检查 | 结果 |
| --- | --- |
| 统一assess-tp11原轮 / 同源独立完整补测 / 严格组合 | 55 PASS / 1超时FAIL；补测PASS；56有效组/57实际执行、14严格READY |
| make lint | PASS |
| make test | Rust335 / Python1337 / Web229 PASS |
| node third_party/openstock/check-development.mjs --record | 12/12 PASS；Python45、Node35、Rust2/63决策、schema/物理对象/上游只读/lint/format/types/locks/intake |
| node --test（provider与TP01-C/D、TP02/03/04/05/08/10/11 functional-artifacts） | 215/215 PASS |
| node --test（TP08/10/11 evaluation与TP05 release-gate） | 122/122 PASS |
| pnpm test:development-plans / node --test scripts/p0-acceptance-negative.mjs | 38/38、16/16 PASS |
| 根Gate回执破坏探针 | 9/9伪造被拒绝；见[结果](./evidence/tp11-20261011/final-gate-probes.json) |
| Git证据字节/锁清单/报告链接/git diff --check/gitleaks | PASS；366份台账引用字节、8份清单/锁、26个报告链接验证；见[Git字节记录](./evidence/tp11-20261011/git-evidence-tracking.json)、[链接](./evidence/tp11-20261011/report-links.json) |

默认Rust两项ignored、缺失DB变量时提前返回的测试和Web默认UDS桥skip均不计目标/部署验收。实际开发Supabase执行在独立F02/F05、F06、F07、F09依赖检查中记录；未建立本地PostgreSQL/Supabase、容器或临时数据库。

## Gate与未决风险

必要闭包：F01–F09、TP01-A/B、F0、TP05、TP11，严格14节点READY。其他145节点保持NOT_ASSESSED；历史TP03/TP08/TP10等Gate不自动继承。正式ACCEPTED、项目用户确认、候选同SHA hosted CI、部署、实际UI/API provider、市场数据权利、代表性性能/长稳与发布授权均独立，未自行批准。

[本轮目标测量](./evidence/tp11-20261011/performance-summary.json)：F05事件/派发/receipt/唯一副作用均10000，checkpoint10001；消费 **288476** ms，event-ID客户端检索诊断 **4326.77** ms。F07恢复/调度/唯一Artifact绑定各100，调度P95诊断 **614.48** ms（目标200ms）。正确性PASS不代表完整payload检索、代表性P95或性能Gate通过。

开发目标BFF建立会话曾超时，完整独立补测通过；跨区域连接/服务启动时延仍是风险，未修改15秒阈值或自动重试策略。真实Finnhub业务/分发/衍生结果用途待书面许可；TradingView展示许可不提供导出API。当前CVE、TP05 provider/schema扩展、持久化授权/租户部署、网络隔离与页面实现仍未验收。不存在生产凭据访问、真实行情请求、上游源码/资产复制、运行时依赖、外部发布或推送。

## 变更文件、提交与下一任务

[完整变更文件清单](./evidence/tp11-20261011/changed-files.txt)覆盖本任务自`4911fa76`以来四个本地提交：TP05回归增长修复`ddae9d52`、先行准入`9cd8052f`、TP11源码`05d3b78f`以及最终证据提交（见Git历史）。共540个变更文件（含原轮/组合的支持日志与产物字节）。主要文件为third_party/openstock自有评估/fixture/recorder、Python与Rust测试、scripts/tp11-*、统一准入策略、生产构建Gate、两份计划、ADR/进度和审计证据。最终证据提交只更新生命周期/文档/回执；不迁移正式同SHA批准。

下一可执行任务：**先刷新TP03当前准入及必要F0闭包，再执行TP09 TrendRadar限定评估**。不得将当前TP11或历史TP03回执当作TP09准入。
