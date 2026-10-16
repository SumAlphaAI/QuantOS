# EVALUATION:TP07 本地评估验收报告

2026-10-16，QuantOS分支codex/evaluation-tp07；基线6ab6d9474f998d78092a37fafc25dcb1311e531c，冻结候选 `c12b69ccaaf93e962268ac9c560f857ab40969f1`。全部28组实际执行PASS：7依赖节点/25组先于本检查点3组，共8节点。三次独立构建、make lint/test PASS；Rust 414 passed/11 ignored，Python1845 passed，Web233 passed/3 skipped；条件返回NOT_RUN的数据库用例及ignored/skipped不能当目标验收。12项评估和53项门禁测试通过。

## 实现与评估结果

固定NautilusTrader `fa86c6e39e8f064d5922c0ee4da5e2a9a2716408`，Python1.231.0/Rust0.61.0，17个源证据文件按完整Git commit/tree/blob路径与SHA-256核对。本地checkout HEAD未采用，新远程签名/真实性未声称验证。只读取公开元数据/文档，未安装、导入、构建或执行上游。

修正历史ADR错误：两份固定manifest均声明LGPL-3.0-or-later，而非旧文LGPL-3.0-only。独立进程是工程边界，不是法律自动豁免；正式法律/分发/通知/源码与可替换性批准仍NOT_RUN。[上游政策](https://nautilustrader.io/legal/open-source-licensing/)以仓库许可为准。

SPDX2.3评估SBOM含全部1051个Cargo/uv lock条目，包括dev/optional及未选平台；不是部署/特性解析后的运行时SBOM。包许可结论NOASSERTION。公开OSV快照查询1004个registry包/版本，返回56个advisory ID（可能互为别名，不等于56个独立CVE）；47个非registry条目未覆盖。严重性、可达性、修复与当前在线刷新未据此验收，vulnerabilityFree=false。请求/响应、时间和两锁hash在third_party/nautilus-trader/cve-audit.json绑定；离线验收不访问OSV。

新增离线验证器和12项正负向测试，覆盖源文件/元数据篡改、固定Git树、许可、SBOM缺项、查询缺项、CVE伪清洁、运行时依赖/import、未知项保留与--runtime拒绝；53项门禁测试覆盖完整依赖/混SHA/篡改/越界声明/事务性发布及回滚。7类capability inventory明确输入/输出/副作用/权限/禁止项/替换；新的ADR列明Agent不直连venue、命令与身份净化、QuantOS风控/账本权威和PaperKernel替换预案。静态排除检查不代替OS隔离或实际transport证明。

旧TP07实现说明已改为历史模型，不再宣称当前adapter/Paper/真实Nautilus进程已验收。两份计划和机器策略同步EVAL-TP07_LOCAL。共享回执输入改变使SERVICE:S04旧独立READY撤回，历史1ce8e899及36节点118组证据保留。本次仅EVALUATION:TP07 DEVELOPMENT READY，全图1 READY/158 NOT_ASSESSED/0 BLOCKED。

## 证据与边界

[完整变更索引](./evidence/eval-tp07-local-20261016/changed-files.json)、[本任务manifest](./evidence/eval-tp07-local-20261016/manifest.json)、[摘要](./evidence/eval-tp07-local-20261016/summary.json)、[实际评估输出](./evidence/eval-tp07-local-20261016/evaluation-evidence.json)。

[全部执行结果](./evidence/provider-a1-remediation-20261004/eval-tp07-local-20261016/attempt-01/execution-results.json)、[依赖先后顺序](./evidence/provider-a1-remediation-20261004/eval-tp07-local-20261016/attempt-01/dependency-revalidation.json)、[canonical恢复](./evidence/provider-a1-remediation-20261004/eval-tp07-local-20261016/attempt-01/canonical-preservation.json)：本闭包没有需要备份/恢复的canonical输出目录（0文件/0目录），既有历史证据未改写。

预检首轮OSV请求误用Cargo ecosystem被400拒绝，修正crates.io后全量成功；首轮策略测试发现继承了无关研究/前端发布项，已限定必要依赖移交9组；uv缓存沙箱拒绝后改用已存在的固定Ruff，无安装。原始记录保留在[preflight](./evidence/eval-tp07-local-20261016/preflight/index.json)和third_party/nautilus-trader/advisory-attempt-01。预检未冻结，不替代本轮依赖闭包。原始上游文件和生成日志保持字节；源码/文档与完整raw差异格式检查均PASS（exit 0），详见post/diff-status.json。

[收尾检查](./evidence/eval-tp07-local-20261016/post/checks.json)记录本地Gate、计划/交接、发布拒绝、格式和秘密扫描。不得将局部PASS提升为数据库/生产/正式验收。

## 未决风险、Gate与下一任务

runtimeAdmission=DENIED，upstreamExecuted=false，databaseExecution=false，externalPublished=false。未使用生产凭据、未建立本地PostgreSQL/Supabase，也未推送或执行外部发布。固定候选要求Rust1.97.1，与QuantOS1.91.0不同；构建/ABI/真实事件语义未验证。CVE/许可未知项与命中保持开放。

9组继承目标义务及本任务3类移交：实际Supabase身份和部署、真实进程transport/隔离、Paper/Shadow/Order/Fill与持久幂等恢复、法律/分发批准、运行时SBOM和最新漏洞/可达性/修复、安全/性能/长稳及同SHA hosted CI，归CORE:TP07/X3和RELEASE-GATE:BETA，全部NOT_RUN。CORE:TP07、S2整体、Beta和正式ACCEPTED未放行。

[六维确认文稿](./evidence/eval-tp07-local-20261016/confirmation-draft.md)已拟定但PENDING，formalAccepted=false；用户确认也不替代未执行技术证据。

下一可执行：**EVALUATION:TP12**，先复验CORE:F07及本评估的新候选完整依赖，再完成TP12 ADR/threat model/接口差异和至少5条禁止耦合规则；不引入运行时依赖。之后汇总CORE-GATE:S2-SERVICE，不能直接宣称CORE:TP07/X3已完成。
