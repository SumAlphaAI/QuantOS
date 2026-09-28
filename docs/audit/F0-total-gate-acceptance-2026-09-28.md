# F0 总 Gate 验收（2026-09-28）

## 1. 结论与基线

**结论：未通过，不关闭 F0。** 本轮验证候选源码 `f7618693f9bc007606b8b8bb912afabef8efb5e3`。远程 main 为 `d0d81287664b5ab55515997481c9782b21455262`，尚未包含 F09 修复；PR #6 为 OPEN / draft。文档提交不自动继承上述源码的回执。

全部 7 项阶段条件逐项核验，当前 **4 PASS、1 PARTIAL、2 FAIL（严格通过 4/7，57.1%）**。F01–F09 的历史 ACCEPTED 不能代替本轮同 SHA 总验收。F09 移交 L04 的 5 项运行期问题继续按已批准边界追踪，不作为本次开发期失败原因。

## 2. 阶段条件明细

| # | 开发计划条件 | 当前结果 | 本轮证据与边界 |
| --- | --- | --- | --- |
| 1 | F01–F09 开发 Gate、三语言 SDK、Mock Engine、事件重放及默认拒绝全绿 | FAIL | CI 与 8/8 required checks 通过；F06、F07、F08、F09 分项证据补齐。但 F05 实际共享库用例失败，F03 手动验收缺可信比较基线而失败，主线正式签名尚缺；独立工作流的 PR 临时合并 SHA 不充当候选 SHA 回执。 |
| 2 | 远程 migration 重放、drift、auth.users/RLS、UUID/timestamptz | PARTIAL | CI 同 SHA 数据库七类负向检查 PASS，但其数据库为远程 runner 内一次性 PostgreSQL，不能写作实际 Supabase 重建通过。Supabase F07 前向 checksum migration/RLS、F06 身份拒绝 PASS；当前 Supabase 完整重建/独立参考库漂移回执未取得。 |
| 3 | outbox/inbox 租约、去重、退避/DLQ/checkpoint、漏通知补偿 | FAIL | F05 两项断言实际失败：全局消费者读到非本次 fixture 事件；预期处理 2 条，实际 10 条。随后停止测试，整组不能计 PASS。 |
| 4 | Vault 受控解密、四角色拒绝、F09 容量规则/ADR | PASS | 实际 Execution 六场景、四角色两路径 SQL 拒绝 8/8、F06 四类拒绝 4/4；F09 规则和 ADR Gate 通过。 |
| 5 | 已交付服务的 health/metrics/trace/结构化错误、供应链追溯 | PASS | F09 push 与手动调度内部完整 SHA、各 7 个日志摘要及三类真实写入口 trace 通过；CI SCA 三生态 findings=[]，依赖 digest 可追溯。按既有 F09 开发阶段范围解释，未来入口归所属业务任务。 |
| 6 | TP01–TP05 固定版本、许可与 capability inventory 评估 | PASS | `make tp-intake-check` PASS；未批准上游未进入生产依赖锁。整体 adapter/生产准入不在此项冒充完成。 |
| 7 | TP01-A/B 固定 baseline、只读副本、fork、分级及禁止耦合 | PASS | 本地只读/变异负例 PASS；使用现有 gh 凭据以 GET 核对真实 fork 两分支 SHA、保护、required checks 等通过。Actions 缺凭据仍另列自动化风险，未改变任何保护设置。 |

## 3. 本轮目标验收及远程回执

证据副本存于 [evidence/f0-f761869](evidence/f0-f761869/ci-download.json)，保留组件原始状态。实际数据库操作均直连已配置测试 Supabase；未创建本地数据库、未执行 schema reset。部分历史脚本输出 `isolated`，本次实际环境为用户批准的共享测试 Supabase，不能据该字符串宣称创建了独立隔离环境。

| 项目 | 本轮结果 |
| --- | --- |
| QuantOS CI | [36369874456](https://github.com/SumAlphaAI/QuantOS/actions/runs/36369874456) SUCCESS；下载回执 commit 为候选完整 SHA，downloadVerified=true，formalSignatureVerified=false（PR 既有策略）。7 类数据库检查及 npm/PyPI/Cargo SCA PASS。main 正式签名未执行。 |
| F01 | PR [36369874472](https://github.com/SumAlphaAI/QuantOS/actions/runs/36369874472) SUCCESS，但内部 source.commit 为临时合并 `fa9b28dbdff1806feaa2e4dc596e4a913c1659f7`；不作为候选 SHA 回执。精确源码补跑 [36370698521](https://github.com/SumAlphaAI/QuantOS/actions/runs/36370698521) SUCCESS；内部 source.commit 为候选完整 SHA、dirty=false，冷启动 256.385 秒，三次 combinedSha256 完全相同、reproducible=true。 |
| F03 / F04 | PR 作业成功；精确源码补跑 F03 [36370998577](https://github.com/SumAlphaAI/QuantOS/actions/runs/36370998577)、F04 [36371009026](https://github.com/SumAlphaAI/QuantOS/actions/runs/36371009026) ：F03 FAILURE，内部 acceptance=FAIL、sourceSha=expectedSha=候选 SHA，错误为 `Missing trusted proto baseline`；F04 SUCCESS，产物复算分支 43/44=97.73%。 |
| F05 | Supabase 事件组 2 项断言失败后停止（SIGTERM），不得记作全组通过；独立 Storage 实际往返 1/1 PASS。当前完整 target 重建、万条/并发定量与 Nightly 回执缺失。 |
| F06 | 新同 SHA v2 Git note 已生成并推送 `refs/notes/f06-acceptance`；干净工作树下 `make f06-acceptance-gate` PASS，5 项负向 Gate 测试 PASS。实际 DB 8 项通过、1 项已移出范围的延迟诊断跳过；真实 Auth→BFF 9 HTTP 检查、Runtime 身份链、Execution 六场景和 Vault 拒绝 8/8 通过。 |
| F07 | [Nightly 36370078514](https://github.com/SumAlphaAI/QuantOS/actions/runs/36370078514) SUCCESS，内部同 SHA / clean / PASS；100/100 恢复、100 唯一 Artifact，调度 P95 47.375014ms（<200ms），覆盖率 Gate 通过。实际 Auth/Runtime/Storage 流程完成；目标服务 receipt 保留 DIAGNOSTIC_ONLY，临时管理员 Storage key 的边界仍属于 L04，不改写为部署通过。 |
| F08 | Nightly [36370087816](https://github.com/SumAlphaAI/QuantOS/actions/runs/36370087816) SUCCESS；目标 [36370365089](https://github.com/SumAlphaAI/QuantOS/actions/runs/36370365089) 同 SHA、wheel 安装、9/9 场景 PASS。stable 精确源码补跑 [36371021401](https://github.com/SumAlphaAI/QuantOS/actions/runs/36371021401) SUCCESS；stable 与 Nightly 的 source-sha.txt 均核对为候选完整 SHA，Nightly 分支负向 4/4 通过。 |
| F09 | push [36369870354](https://github.com/SumAlphaAI/QuantOS/actions/runs/36369870354)、手动调度 [36370096723](https://github.com/SumAlphaAI/QuantOS/actions/runs/36370096723) SUCCESS；内部 SHA、dirty=false、PASS、各 7 日志摘要及三条真实写入 trace 核对一致。手动调度不等于观察到 cron。 |
| TP01 | Actions [36370151708](https://github.com/SumAlphaAI/QuantOS/actions/runs/36370151708) FAILURE：GH_TOKEN 为空。其后本机以既有 gh 凭据只读查询真实 fork，治理核验 PASS；这是独立人工执行证据，不将失败工作流改为成功。 |

首次 F06 服务烟测缺少 `QUANTOS_TRACE_EXPORT_PATH`，补充绝对路径后成功；测试环境确认开关按用户既有授权设置。未修改源码、未放宽 TLS、F02 签名、权限或告警阈值。

## 4. 阻塞项、风险与后续顺序

| ID | 级别 | 所属模块／具体表现 | 影响与整改条件 |
| --- | --- | --- | --- |
| F0-B01 | 阻塞 | F05 `postgres_persistence.rs:583,750`；消费者对共享 outbox 全局领取，fixture 假定空库。读取历史 event_id，处理数 10≠2。 | 当前共享 Supabase 无法取得可信 F05 全组/万条/并发回执，且测试可能推进其他测试事件状态。改造测试为仅处理自身 fixture（不得把断言放宽或清空共享库掩盖），证明历史事件不被领取后重跑。需连同 migration 重建路径满足既有远程验收要求。 |
| F0-B02 | 阻塞 | 总验收基线未集成；main 尚无 F09，候选只有 PR 下载验证。 | 在候选阻塞项解决、PR 可审查后按正常保护流程集成；对最终源码 SHA 补齐正式签名/独立下载及所有受影响回执，不混用旧 main、PR head 和临时 merge SHA。 |
| F0-H01 | 高危 | F03 `.github/workflows/f03-protocol.yml:17` 手动触发无 PR base/push before，`QUANTOS_PROTO_BASE` 为空。 | 精确 SHA 手动协议 Gate 失败；补充显式可信基线并验证解析到非 HEAD 的完整 commit，保留缺失/自比较/破坏性协议拒绝，不以 PR 临时合并产物替代。 |
| F0-M01 | 中危 | TP01 Actions 未配置 fork 读取凭据。 | 本机真实治理核验通过，但自动化不可重复执行；配置适当权限的专用凭据后重跑，不上传个人凭据或降低 fork 保护。 |

下一步先修复 F05 共享测试库适配和非破坏性验收入口、F03 手动可信基线配置，明确远程 migration 重建/参考库方案；重新冻结源码并获取必要回执，再处理主线集成与正式签名。只有 7/7 条件全部满足，才能关闭 F0。当前不需要以部署生产者、同地域运行指标或 L04 运行期演练替代上述开发期整改。
