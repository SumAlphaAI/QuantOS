# 核心开发计划复审记录归档（格式重构前）

> 归档日期：2026-10-07
> 来源：主开发计划 v3.33；归档前 HEAD `095a4b3d07ede4c05326c2b90b86ea0b7fdbb44a`。
> 范围：47 个任务原复审模块、状态范围和修复追踪；保留原字段、结论、空白状态及证据，不产生新复审或验收。

主计划按[前端执行计划](../../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md#task-bff-fe-000)统一为任务字段和“当前工程复核”摘要。本文件保存重构前的指定模型字段及原始记录；模型名称仅是原文记录，不证明本次调用。历史 ACCEPTED/目标回执只适用于原源码与环境，阶段准入及候选同 SHA 验收须分别核验。后续问题与修复验证继续写入各任务审计报告，保留本归档。

<a id="review-f01"></a>
## F01：初始化 Polyglot Monorepo

- 状态范围：2026-09-17 再次复核通过；20/20（100%）检查点、3/3 量化验收通过，当前未解决问题为 0。适用源码与环境边界见复审报告；F0 总体 Gate 不随本项放行。

- review_model: `GPT-6 Astra`
- review_status: `ACCEPTED`
- review_conclusion: 全部问题已解决；本次锁检查、16 项负向测试、8 个后端漂移探针及既有验收回执核验通过，实现相对验收源码无变更。详见 [F01 全面复审报告](../F01-comprehensive-review-2026-09-17.md)。
- issues: []
- fix_tracking: []
- 后续基线变更：F02 经用户批准升级 Python 至 3.12；原 F01 冷启动与三次构建回执仍仅适用于其记录源码，新基线结果另见 F02 整改记录。
- 历史追溯：已关闭问题及逐项验证已归档至 [F01 整改记录](../F01-remediation-2026-09-17.md)；本任务活动清单只保留未解决问题。

<a id="review-f02"></a>
## F02：CI、制品与供应链门禁

- 状态范围：2026-09-26 F02-A11 全部关闭；12/12原问题、24/24检查点通过。验收基线为main `bb4ef3c95753c1db15c7f2e2ba3ae22abb7a0b1f`，8/8 required checks、7/7主线工作流、正式签名与独立下载验签全部成功；文档归档提交不自动继承该源码回执，F0总体不随本项放行。

- review_model: `GPT-6 Astra`
- review_status: `ACCEPTED`
- review_conclusion: F02-A11 CLOSED；原物理目录下callback与UI短模块ID冲突已精确重现并修复，两份实际Next配置采用固定八位空间且遇冲突失败。真实编译5/5回归、完整Terminal两种顺序61/61文件一致；main bb4ef3c完整SHA的8项检查及正式签名下载回执全部通过。当前未解决问题0，详见 [F02当前复审报告](../F02-comprehensive-review-2026-09-17.md)。
- issues: []
- fix_tracking: []

<a id="review-f03"></a>
## F03：领域协议 v1 与 SDK 生成

- 状态范围：2026-09-20原六项问题及C12全部关闭，20/20（100%）检查点、4/4量化标准通过。c3be28d独立协议验收#2成功，同SHA制品/日志摘要和92份生成文件哈希均核验一致；不代表F02 A11或其他CI通过。

- review_model: `GPT-6 Astra`
- review_status: `ACCEPTED`
- review_conclusion: COMPLETED / ACCEPTED。c3be28d的F03 Protocol Acceptance #2完整执行proto-check并成功，生成物无漂移；50份Schema、六方向二进制与ProtoJSON、11003组样本及15项非法JSON探针通过。下载包及日志摘要、sourceSha/expectedSha、92份文件哈希均核验一致。C12已关闭，既有Rust8/Python127/TS46项本地证据保留。详见 [F03 全面复审报告](../F03-comprehensive-review-2026-09-20.md)。 2026-09-28 补充：手动基线缺陷 F0-H01 已修复，必须提供非 HEAD 的完整祖先 SHA；main `91e222f` 的独立手动 Gate、92 个生成物摘要通过。 详见 [F0 整改与主线验收](../F0-F05-F03-main-acceptance-2026-09-28.md)。
- issues: []
- fix_tracking: []

<a id="review-f04"></a>
## F04：Core、错误、时钟与 ID

- review_model: `GPT-6 Astra`
- review_status: `ACCEPTED`
- review_conclusion: 2026-09-21 验收通过：c769897de9b1f94fbd6dd9ac3e35b6aca2e8945a 同 SHA 的 QuantOS CI、F01 Clean Room、Frontend Baseline、F03、F04 branch 和 Compatibility 全部 SUCCESS。chacha20 阻断经远端 SCA 验证关闭；数据库/RLS、F02 recovery、运行时打包、main-only 签名策略、正式签名及独立下载验签全部成功，236 个发布文件与 HMAC-SHA256 签名验证通过。原九项问题及 23 个检查点全部完成，F02 A11 独立保持开放。详见 [完整远端验收回执](../F04-remote-acceptance-c769897-2026-09-21.md)。
- issues: []
- fix_tracking: []

<a id="review-f05"></a>
## F05：事件、存储与审计账本

- review_model: `GPT-6 Astra`
- review_status: `ACCEPTED`
- review_conclusion: 2026-09-23 以完整 SHA 48d837692b81e56bd88e13189f0cf15ee34976d3 完成三项同 SHA 验收：QuantOS CI #117 整体 SUCCESS，正式签名与独立下载验签确认 236 个发布文件；F05 Event Nightly #7 SUCCESS，10,000 条正式消费和唯一副作用全部对齐、完整事件链取回 160.233317ms，Linux pg.rs region 607/714=85.014%；隔离 Supabase 目标 Gate PASS，15 项 migration、RLS、真实 Storage 及万条一致性通过。30/30 检查点 PASS，初审 11/11 问题关闭。目标 Supabase 的跨区域 ID 链时延仅作完整性观测，不能外推为该环境完整载荷 ≤5 秒。详见 [F05 全面复审报告](../F05-comprehensive-review-2026-09-21.md)及[同 SHA 正式验收](../F05-acceptance-48d8376-2026-09-23.md)。 2026-09-28 补充：F0-B01 共享库测试串扰已修复；main `91e222f` 的 CI/Nightly 通过，万条事件及唯一副作用一致、完整查询 159.374ms、分支覆盖 87.013%。经用户授权重建当前测试项目 quantos schema，同 main SHA 的 Supabase 完整 target、独立远程参考库 drift 与实际 RLS 全部通过，F0 7/7 闭环。 详见 [F0 整改与主线验收](../F0-F05-F03-main-acceptance-2026-09-28.md)。
- issues: []
- fix_tracking: []

<a id="review-f06"></a>
## F06：身份、授权、秘密引用与主上下文

- review_model: `GPT-6 Astra`
- review_status: `ACCEPTED`
- 状态解释：ACCEPTED 表示已列明基线的 F06 服务端范围验收；development_status=COMPLETED 只标识开发完成。对任一新 HEAD，仍必须具备绑定该完整 SHA 的 refs/notes/f06-acceptance 回执、全部问题 CLOSED、干净工作树及 make f06-acceptance-gate PASS。文档提交不转移历史回执；下游本地契约 Gate 不代表 F06 目标验收。
- review_conclusion: F06-A01–A10 全部关闭：阻塞级 2/2、高危 5/5、中危 2/2、低危 1/1，共 10/10（100%），活动问题 0。保持已确认服务端范围的 ACCEPTED；新 HEAD 仍须通过同 SHA 总 Gate。详见 [当前复审结论](../F06-comprehensive-review-2026-09-24.md)、[已关闭问题与修复追踪](../F06-closed-findings-2026-09-25.md)和[性能范围修订](../F06-A09-remote-latency-gate-withdrawal-2026-09-25.md)。
- issues: []
- fix_tracking: []

<a id="review-f07"></a>
## F07：Runtime 最小可恢复工作流

- review_model: `GPT-6 Astra`
- review_status: `ACCEPTED`
- review_conclusion: 2026-09-25 再次逐项复核，F07-A01–A12 全部关闭：阻塞级 2/2、高危 5/5、中危 4/4、低危 1/1，共 12/12（100%），活动清单清空。f5993743420cc7f5f2de0544e3b83404eea88cdc 的开发验收维持 18/18、量化 3/3；当前实现与该基线无差异，本轮本地 Runtime 12/12、Gateway cookie 拒绝 1/1 通过，缺库强制验收负向探针按预期拒绝。部署 HTTPS 入口与受限 Storage 凭据继续列为 L04 上线前 Gate；历史回执不自动转移到新 HEAD。详见 [当前全面复审](../F07-comprehensive-review-2026-09-24.md)和[逐项关闭复核](../F07-closure-recheck-2026-09-25.md)，已关闭问题及修复追踪移至后者。
- issues: []
- fix_tracking: []

<a id="review-f08"></a>
## F08：Engine SDK、Manager 与 Mock Engine

- review_model: `GPT-6 Astra`
- review_status: `ACCEPTED`
- 状态解释：ACCEPTED 绑定完整源码 SHA `830c0c547f08d1667725fee55015fc09608b8f48` 的 F08 开发阶段基线。远程 CI、Nightly、隔离目标回执均与该 SHA 一致；后续源码、文档或合并新 SHA 不自动继承回执，生产部署不在本阶段验收范围。
- review_conclusion: 2026-09-26 完成 PR #1 合并后的主线同 SHA 正式验收（合并触发的 7 个工作流及补充 Nightly/目标共 9 个工作流均成功）：主线 CI 36238199294、Nightly 36239409436、隔离目标 36239615322 均首次执行 SUCCESS，目标九项 release 场景 9/9 PASS；跨秒回归在两道远程 Gate 均通过。原阻塞级 2/2、高危 5/5、中危 3/3、低危 1/1，共 11/11 问题关闭，24/24 检查点完成，活动代码问题 0。CPU/GPU 硬隔离按用户决定移除，127 项可审计覆盖率豁免保持既定范围。详见 [当前复审结论](../F08-comprehensive-review-2026-09-25.md)、[主线验收收尾](../main-acceptance-closeout-830c0c5-2026-09-26.md)、[逐项关闭复核](../F08-closure-recheck-2026-09-26.md)、[初审归档](../F08-initial-review-2026-09-25.md)和[已关闭问题及修复追踪](../F08-closed-findings-2026-09-26.md)。
- issues: []
- fix_tracking: []

<a id="review-f09"></a>
## F09：本地可观测性、容量阈值与故障注入

- review_model: `GPT-6 Astra`
- review_status: `ACCEPTED`
- review_conclusion: 2026-09-28 最终源码 `81cb5ae43f87e7d4b4be059b9eed036b755b4986` 的 CI、F09 push 目标和手动调度/Nightly 路径回执全部通过；内部完整 SHA、下载验证、两份目标各 7 个日志摘要和三类真实写入口 trace 均核验，F09-B04 关闭。原 14 项现为 9 项关闭（8 项代码修复及 B04 回执闭环）、5 项部分修复／移交，B01–B03/H05/M03 的运行期剩余范围仍由业务任务/L04 追踪。手动调度不代表已观察实际 cron；后续文档提交不自动继承该源码回执。详见[最终验收](../F09-final-acceptance-2026-09-28.md)、[当前剩余问题](../F09-comprehensive-review-2026-09-27.md)、[逐项复核归档](../F09-findings-recheck-2026-09-28.md)。F0 总 Gate 最新结论见第 4.2 节，F02 main 正式签名约束不变。
- issues: []
- fix_tracking: []

<a id="review-tp01-a"></a>
## TP01-A：上游只读副本与 Fork 基线

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-tp01-b"></a>
## TP01-B：capability inventory 与禁止耦合清单

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-r01"></a>
## R01：Market ingestion 与标准化行情契约

- review_model: `GPT-6 Astra`
- review_status: `FIX_VALIDATION`
- review_conclusion: 2026-10-03 补齐 Binance 持续监督、受控异常 ≤5s 提交与事务池完整八并发 Gate 验证；fixture/真实进程故障最大 2164ms/1919ms。9 项关闭，B01 的长期部署、远程同 SHA CI 和许可验收仍待完成，R01 未 ACCEPTED；本轮为整改验证，未产生新的独立 Astra 复审。 2026-10-04：经用户明确选择新增 30 分钟有界内部评估授权；实际 1801.473s、6243 唯一成交、F05 11195/11195 与 actor 清理通过。readiness 30.43%、2623 tick 新鲜度降级，保持健康风险与 B01 PARTIAL；详见[扩大窗口报告](../R01-window-validation-2026-10-04.md)。专项只读评估确认 source-age P95 3686.049ms、processing 到检测 P95 17.437ms；运行期 ready=35/114（30.70% 点样本），44 条自然 tick 告警检测到 progress >5s、native ACK 缺测、trace 共写坏行待整改。未启动新窗口；scope 1800 秒/两标的/用途/到期日不变，24h 或部署须新范围授权；Linux/systemd、父启动器/主机死亡通知、商用许可、远程同 SHA CI 均待验收，B01 OPEN/PARTIAL。详见[专项评估报告](../R01-freshness-assessment-2026-10-04.md)。 专项整改验证补齐精确 ACK/HTTP-SQL 分段、跨进程 trace、共享 watchdog 身份、固定 deadline 采样与时钟诊断，并修复监控读超时连接恢复和在途页停止。新独立 1800s 窗口完整性通过：8530 成交、9461/9461 精确 ACK，自然 tick/source 异常最大 3454.521/1577.815ms；检测降级 8.37%、effective ready 109/120，不能记为健康通过。专项 5/7 关闭，FA-H01 与 B01 OPEN/PARTIAL；前次失败、缺测和原不可变事实保留，范围及期限未扩大。详见[专项整改报告](../R01-freshness-remediation-2026-10-04.md)。
- issues:
  - issue_id: B01
    severity: BLOCKER
    description: Binance REST、真实补偿与历史受控五秒异常回执已取得；自然运行新鲜度/readiness 降级、精确告警 ACK/trace 补证、长期部署及父启动器/主机死亡通知、远程同 SHA CI 与商用许可未验收
    evidence: docs/audit/R01-remediation-validation-2026-10-02.md
    status: OPEN
  - issue_id: H01
    severity: HIGH
    description: 来源身份、序号、事件与 outbox 原子提交；失败重试安全
    evidence: docs/audit/R01-remediation-validation-2026-10-02.md
    status: CLOSED
  - issue_id: H02
    severity: HIGH
    description: tenant/provider/source ID 唯一键与内容 hash 冲突校验
    evidence: docs/audit/R01-remediation-validation-2026-10-02.md
    status: CLOSED
  - issue_id: H03
    severity: HIGH
    description: 显式 instrument map 与 BASE/QUOTE v2 契约
    evidence: docs/audit/R01-remediation-validation-2026-10-02.md
    status: CLOSED
  - issue_id: H04
    severity: HIGH
    description: 非法数值质量事件及坏帧隔离，继续后续摄取
    evidence: docs/audit/R01-remediation-validation-2026-10-02.md
    status: CLOSED
  - issue_id: M01
    severity: MEDIUM
    description: 实际 processing clock、持久 watchdog 与目标异常提交测试；真实源边界见 B01
    evidence: docs/audit/R01-remediation-validation-2026-10-02.md
    status: CLOSED
  - issue_id: M02
    severity: MEDIUM
    description: registry 元数据、审批引用、版本、过期及撤销校验
    evidence: docs/audit/R01-remediation-validation-2026-10-02.md
    status: CLOSED
  - issue_id: M03
    severity: MEDIUM
    description: 行为测试、真实 mutant 与按文件 stable/nightly 覆盖 Gate
    evidence: docs/audit/R01-remediation-validation-2026-10-02.md
    status: CLOSED
  - issue_id: M04
    severity: MEDIUM
    description: replay spec Result、流式读取、帧/数量上限
    evidence: docs/audit/R01-remediation-validation-2026-10-02.md
    status: CLOSED
  - issue_id: L01
    severity: LOW
    description: trace 示例、v2 ADR、故障恢复与 provider 申请指南
    evidence: docs/audit/R01-remediation-validation-2026-10-02.md
    status: CLOSED
- fix_tracking:
  - issue_id: B01
    fix_ref: docs/audit/R01-supervision-validation-2026-10-03.md
    verification_command: make r01-check；QUANTOS_R01_POOL_MODE=transaction node --env-file=.env.local scripts/r01-live-check.cjs；stable/nightly coverage Gate；r01-supervision-check.cjs 与 --live
    verification_environment: 同一配置 Supabase 事务池；保留八并发完整 Gate；fixture 异常与 Binance 真实进程故障分开验收
    verification_evidence: docs/audit/evidence/r01-supervision-20261003/index.json
    verification_status: PARTIAL
  - issue_id: H01
    fix_ref: docs/audit/R01-remediation-validation-2026-10-02.md
    verification_command: make r01-check；node --env-file=.env.local scripts/r01-live-check.cjs；stable/nightly coverage Gate
    verification_environment: local Rust 与配置的 Supabase PostgreSQL；fixture only
    verification_evidence: docs/audit/evidence/r01-remediation-20261002/index.json
    verification_status: PASS
  - issue_id: H02
    fix_ref: docs/audit/R01-remediation-validation-2026-10-02.md
    verification_command: make r01-check；node --env-file=.env.local scripts/r01-live-check.cjs；stable/nightly coverage Gate
    verification_environment: local Rust 与配置的 Supabase PostgreSQL；fixture only
    verification_evidence: docs/audit/evidence/r01-remediation-20261002/index.json
    verification_status: PASS
  - issue_id: H03
    fix_ref: docs/audit/R01-remediation-validation-2026-10-02.md
    verification_command: make r01-check；node --env-file=.env.local scripts/r01-live-check.cjs；stable/nightly coverage Gate
    verification_environment: local Rust 与配置的 Supabase PostgreSQL；fixture only
    verification_evidence: docs/audit/evidence/r01-remediation-20261002/index.json
    verification_status: PASS
  - issue_id: H04
    fix_ref: docs/audit/R01-remediation-validation-2026-10-02.md
    verification_command: make r01-check；node --env-file=.env.local scripts/r01-live-check.cjs；stable/nightly coverage Gate
    verification_environment: local Rust 与配置的 Supabase PostgreSQL；fixture only
    verification_evidence: docs/audit/evidence/r01-remediation-20261002/index.json
    verification_status: PASS
  - issue_id: M01
    fix_ref: docs/audit/R01-remediation-validation-2026-10-02.md
    verification_command: make r01-check；node --env-file=.env.local scripts/r01-live-check.cjs；stable/nightly coverage Gate
    verification_environment: local Rust 与配置的 Supabase PostgreSQL；fixture only
    verification_evidence: docs/audit/evidence/r01-remediation-20261002/index.json
    verification_status: PASS
  - issue_id: M02
    fix_ref: docs/audit/R01-remediation-validation-2026-10-02.md
    verification_command: make r01-check；node --env-file=.env.local scripts/r01-live-check.cjs；stable/nightly coverage Gate
    verification_environment: local Rust 与配置的 Supabase PostgreSQL；fixture only
    verification_evidence: docs/audit/evidence/r01-remediation-20261002/index.json
    verification_status: PASS
  - issue_id: M03
    fix_ref: docs/audit/R01-remediation-validation-2026-10-02.md
    verification_command: make r01-check；node --env-file=.env.local scripts/r01-live-check.cjs；stable/nightly coverage Gate
    verification_environment: local Rust 与配置的 Supabase PostgreSQL；fixture only
    verification_evidence: docs/audit/evidence/r01-remediation-20261002/index.json
    verification_status: PASS
  - issue_id: M04
    fix_ref: docs/audit/R01-remediation-validation-2026-10-02.md
    verification_command: make r01-check；node --env-file=.env.local scripts/r01-live-check.cjs；stable/nightly coverage Gate
    verification_environment: local Rust 与配置的 Supabase PostgreSQL；fixture only
    verification_evidence: docs/audit/evidence/r01-remediation-20261002/index.json
    verification_status: PASS
  - issue_id: L01
    fix_ref: docs/audit/R01-remediation-validation-2026-10-02.md
    verification_command: make r01-check；node --env-file=.env.local scripts/r01-live-check.cjs；stable/nightly coverage Gate
    verification_environment: local Rust 与配置的 Supabase PostgreSQL；fixture only
    verification_evidence: docs/audit/evidence/r01-remediation-20261002/index.json
    verification_status: PASS

<a id="review-r02"></a>
## R02：DataSnapshot、血缘与质量 Gate

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-tp01-c"></a>
## TP01-C：`vibe_adapter` skeleton

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-tp01-d"></a>
## TP01-D：选择性吸收与最小 patch 队列

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-tp02"></a>
## TP02：RD-Agent：自动研究/实验 Engine

- 状态范围：固定版本、许可证与 capability inventory 评估已完成；整体适配与生产准入仍依任务标准判定。

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-tp03"></a>
## TP03：LLMQuant：特征、因子、模型、Signal Engine

- 状态范围：固定版本、许可证与 capability inventory 评估已完成；整体适配与生产准入仍依任务标准判定。

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-tp04"></a>
## TP04：TradingAgents：多 Agent 决策 Engine

- 状态范围：固定版本、许可证与 capability inventory 评估已完成；整体适配与生产准入仍依任务标准判定。

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-tp05"></a>
## TP05：OpenBB：数据/研究适配服务

- 状态范围：固定版本、许可证与 capability inventory 评估已完成；整体适配与生产准入仍依任务标准判定。

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-tp08"></a>
## TP08：Qlib

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-tp09"></a>
## TP09：TrendRadar

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-tp10"></a>
## TP10：ValueCell

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-tp11"></a>
## TP11：OpenStock

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-r03"></a>
## R03：Research orchestration 与 Artifact lifecycle

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-r04"></a>
## R04：Signal 与 TradeProposal 工作流

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-tp01-e"></a>
## TP01-E：同步自动化与分级阻断

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-tp01-f"></a>
## TP01-F：canary、观测与回滚

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-tp01-g"></a>
## TP01-G：上游贡献与脱钩替换

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-s01"></a>
## S01：策略草稿与参数模型

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-tp06"></a>
## TP06：VibeTradingLabs/vibetrading：自然语言策略开发参考/适配候选

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-s02"></a>
## S02：回测与成本/滑点验证

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-s03"></a>
## S03：StrategyRelease 与部署目标控制

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-x01"></a>
## X01：Portfolio 读模型与风险输入快照

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-x02"></a>
## X02：Pre/Post-trade Risk 与 kill switch

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-x03"></a>
## X03：TradeCommand 签发与审批状态机

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-tp07"></a>
## TP07：NautilusTrader：研究、仿真、OMS、执行内核

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-tp12"></a>
## TP12：nautilus_agents

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-x04"></a>
## X04：Nautilus 边界、Paper OMS 与订单状态机

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-x05"></a>
## X05：Shadow 运行、对账与异常队列

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-u01"></a>
## U01：Web Terminal 壳、认证与 Research 页面

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-tp01"></a>
## TP01：Vibe-Trading：研究工作流/工具/MCP/记忆 UX 参考与受控 Fork

- 状态范围：固定版本、许可证与 capability inventory 评估已完成；整体适配与生产准入仍依任务标准判定。

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-s04"></a>
## S04：策略审批与 Terminal Strategy 页面

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-x06"></a>
## X06：执行/审计/运维 Terminal 页面

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-l01"></a>
## L01：优先 venue testnet 适配

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-l02"></a>
## L02：Supabase Vault、mTLS 与受限执行区

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-l03"></a>
## L03：双人审批、MFA 与 Assisted Live UI Gate

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="review-l04"></a>
## L04：容量、恢复、安全与上线证据包

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []
