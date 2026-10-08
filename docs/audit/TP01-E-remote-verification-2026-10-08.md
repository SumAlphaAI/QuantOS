# TP01-E 远程工程验证报告

日期：2026-10-08（北京时间）。完整验证 SHA：`8408122e2bcd75bdb09ff44fd04ef5dedfa3ef2f`。承接[定时阻断整改](./TP01-E-scheduled-remediation-2026-10-08.md)。远端 main 与本机源码一致；本轮只触发现有只读 workflow、下载原件及归档验证，未升级上游、连接数据库或改变行情用途范围。

## 1. 任务完成概况

**TP01-E 已执行的远程工程检查 7/7 通过：六场景、23 项回归、真实候选严格阻断、失败后的摘要/证据上传及下载验证闭合。没有发现新的源码执行缺陷，无需继续修改同步分类实现。** 本轮更新待验状态、运行规程和计划，以独立文档提交归档。

实际主线为 **8/8 个 push 工作流成功**；F04 的 paths 未匹配本次改动，没有该 SHA 的运行，不计为当前验收通过。完整[原始清单](./evidence/tp01-e-remote-verification-8408122-20261008/remote-runs.json)共 11 个终态运行：10 success、1 failure。failure 为人工严格同步 Gate 的预期候选阻断，保留其真实 GitHub conclusion，不改写成工作流 success。

**自然定时触发尚未验证，候选采用尚未批准。** 远程 Linux 上执行 schedule 分支的受控 fixture 回归证明该分支行为，不能替代真实 event=schedule 的调度/实时报告/上传回执。完整 TP01 全量复审、阶段准入与正式验收不在本专项范围。

## 2. 完成情况明细

| 检查 | 实际结果 | 原始证据 |
|---|---|---|
| RV01 同 SHA 主线执行 | 8/8 push 成功；Dependency Graph 动态运行另为 success；F04 NOT_RUN_PATH_FILTER_NO_MATCH | [运行清单](./evidence/tp01-e-remote-verification-8408122-20261008/remote-runs.json)、[主线作业](./evidence/tp01-e-remote-verification-8408122-20261008/quantos-ci-jobs.json) |
| RV02 真实公开上游监测 | [37777155663](https://github.com/SumAlphaAI/QuantOS/actions/runs/37777155663) workflow_dispatch success；原报告已下载 | [作业](./evidence/tp01-e-remote-verification-8408122-20261008/upstream-jobs.json)、[报告](./evidence/tp01-e-remote-verification-8408122-20261008/upstream-artifact/upstream-candidates.json) |
| RV03 六场景模拟 | API break、license change、CVE-high、patch conflict、planned sync、research drift 全部 success；分类分别 S1/S1/S0/S1/S2/S3，前四项 BLOCKED | [37777148460 作业](./evidence/tp01-e-remote-verification-8408122-20261008/sync-jobs.json)、[六制品原件](./evidence/tp01-e-remote-verification-8408122-20261008/sync-artifacts/) |
| RV04 远程 CLI/分支回归 | Ubuntu runner 上 23/23、fail=0，含实际 workflow shell 的 schedule 模拟、dispatch 严格阻断、异常输入、S0 保留及摘要发布 | [完整 CI 日志](./evidence/tp01-e-remote-verification-8408122-20261008/sync-ci.log) |
| RV05 真实严格 Gate 拒绝 | workflow_dispatch 的 live 步骤退出 2；两个真实候选中一个 S1 BLOCKED，syncApproved=false。该负向验证通过，workflow conclusion 仍为 failure | [原始 live summary](./evidence/tp01-e-remote-verification-8408122-20261008/sync-artifacts/tp01-vibe-sync-live/sync-vibe/live-summary.json) |
| RV06 阻断后摘要/上传/下载 | Publish workflow summary、Upload live sync artifacts 均 success；七个 artifact 全部实际下载，包括 live 原报告、两份 decision、两份 issue 及 summary，不再出现历史 skipped 缺口 | [制品元数据](./evidence/tp01-e-remote-verification-8408122-20261008/sync-artifacts-metadata.json)、[live 原件](./evidence/tp01-e-remote-verification-8408122-20261008/sync-artifacts/tp01-vibe-sync-live/) |
| RV07 主线签名与下载 | QuantOS CI 的 verify/signing-policy/sign-main/verify-download-main/verify-download success；原始回执同 SHA、downloadVerified=true、formalSignatureVerified=true。PR 专用 job 按事件 skipped，未计 PASS | [37773542342](https://github.com/SumAlphaAI/QuantOS/actions/runs/37773542342)、[原回执](./evidence/tp01-e-remote-verification-8408122-20261008/main-download-receipt/download-receipt.json) |

TP01 两次真实运行均于北京时间 2026-10-08 20:28–20:29 完成；原始日志保留 UTC 时间，不改字节。此处正式制品签名是工程签名检查，不代表项目用户正式 ACCEPTED。

补充本机验证：用远程 live artifact 的原报告调用 `--monitor-only`，退出 0、syncGateStatus=BLOCKED、syncApproved=false；除生成时间外，决策内容与远程严格 Gate 完全一致。见[本地比较回执](./evidence/tp01-e-remote-verification-8408122-20261008/local-monitor-replay/comparison.json)。这条结果明确记为 macOS 本地 replay，不算新的远程监测运行。

工程核验脚本及[结构化结论](./evidence/tp01-e-remote-verification-8408122-20261008/assessment.json)已归档。五组历史索引共 764 个文件摘要保持不变；本机最初的索引检查未兼容旧索引有/无 sha256: 前缀，失败日志保留，统一前缀解析后实际字节检查通过，不改历史摘要或源文件。初始/运行中状态快照只记录读取时的状态，最终结论以 remote-runs.json、sync-jobs.json、upstream-jobs.json 为准。

文档更新后的计划结构及 38/38 负向检查通过；新增报告/证据的配置凭据扫描与 gitleaks 均无匹配。原始下载文件保持原格式（包括生成的 Markdown 末尾空行），[证据摘要索引](./evidence/tp01-e-remote-verification-8408122-20261008/checksums.json)记录 SHA-256，不为格式检查改写原件。

## 3. 问题清单及风险分析

| 问题或边界 | 当前结论 | 风险与范围 |
|---|---|---|
| TP01-E 失败时证据被跳过 | VERIFIED / 已关闭此工程缺陷 | 已取得严格 Gate 失败后的原报告、决策及 issue；历史缺失原件仍为缺失，新原件不替代旧失败轮。 |
| 定时模式的阻断语义 | VERIFIED_IN_REMOTE_FIXTURE；自然 schedule NOT_RUN | 已在远程 Linux 验证原 workflow shell 的定时分支；尚无新 SHA 自然触发的完整实时回执，不能声称 cron/持续运行验收通过。 |
| v0.1.16 上游依赖漂移 | OPEN / 候选 BLOCKED | requirements-lock/pyproject 摘要变化；LICENSE/NOTICE 摘要未变化只说明本次比较，不能代替完整许可/供应链审查，也不能据此断言存在或不存在 CVE。 |
| F04 当前 SHA 回执 | NOT_RUN / paths 未匹配 | 本次 TP01 变更未触及 F04 配置的触发路径；当前主线正确统计为 8/8。历史其他 SHA 的 F04 success 不迁移。 |
| 阶段与发布范围 | 保持原结论 | 159 节点 NOT_ASSESSED；R02 C01 当前内容复评、R01 B01/FA-H01、Beta 性能/部署/长期运行分别待验；不补写 READY 或正式签署。 |

## 4. 后续执行建议

原 workflow 的 cron 为 03:27 UTC，名义下一周期为北京时间 **2026-10-09 11:27**；GitHub 实际起跑以事件回执为准。自然触发后按该运行自身完整 SHA 下载原报告及决策，核对 event=schedule、executionMode=monitor、monitoringStatus=COMPLETED、BLOCKED warning、摘要与上传 success。不能因为本轮工程验证通过省略该回执，也不通过自动批准候选消除严格 Gate 的 failure。

本轮没有安排自动跟踪或触发额外长期运行。新文档提交不继承 8408122 的同 SHA 远程结论。完成自然调度核验之外，近期开发主线按计划进入 R02 必需前置功能复评，再开展 R03 功能复审；代表性性能、部署、24 小时或更大 provider 范围仍按原发布/授权安排。
