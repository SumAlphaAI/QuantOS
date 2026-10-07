# 主开发计划旧 READY 复评报告

> 日期：2026-10-07（Asia/Shanghai）。阶段：DEVELOPMENT。
> 冻结工程源码：`963a2c3cff3e380fa1cd8b8d67d6370e8b716ac6`。后续证据/文档提交独立记账；功能回执按规范输入内容绑定，不声明新 HEAD 的同 SHA 正式或 hosted CI 通过。
> 依据：主计划 v3.34 明确标注的格式重构后旧 25 READY 待复评，及现行 provider/G0/FEP-0/身份/Audit 独立内容门禁。

## 当前结论

原 25 READY 已全部完成复评。**25 READY、0 BLOCKED**：21 个基础/准备节点、两项 BFF 和 G0/FEP-0 均严格 READY。项目用户本会话明确答复“确认 G0 DEVELOPMENT 文稿”；原答复、当前文稿及范围摘要已保存并通过门禁。未把旧批准自动迁移到新输入。

F0/A1 **87/87** 独立命令组实际通过，G0 **16/16** 实际通过，FEP-0 确认前和确认后各 **2/2** 实际通过；三轮独立目录全语言构建可复现。实际目标操作均连接既有配置的 Supabase，未建立本地 PostgreSQL/Supabase、未重建共享数据库。

当前已确认文稿：[G0 DEVELOPMENT 当前文稿](../gate-records/G0-user-confirmation-draft-2026-10-07-1d2bce97fcfb.md)，范围摘要 `sha256:1d2bce97fcfb44f7a3995d6364e2d018171260dce243e03b5f7bb671111f76ac`。API 1.5.0、62 published；46 planned 不作已实现。按[项目用户确认规程](../gate-records/user-acceptance-confirmation-workflow.md)由项目用户一人确认，Codex 不自行批准。见[本会话原始确认记录](../gate-records/G0-user-confirmation-2026-10-07-1d2bce97fcfb.json)。原 `900e809c60dd` 确认台账保留在[历史原件](../gate-records/G0-user-confirmations-before-plan-ready-reassessment-20261007.json)。

## 失效原因与复评范围

[输入差异分析](./evidence/core-plan-ready-reassessment-20261007/stale-input-analysis.json)实际比对 25 项：23 项功能输入受 7 个脚本变化影响；11 个核心任务的规范字段也发生变化。两个 BFF 任务自身功能/计划输入未变，但上游回执必须重新消费。需求、依赖、开发状态与历史正式结论保持原事实。

7 个变化脚本为 `check-development-plans.mjs`、`check-development-plan-order.mjs`、`check-f06-acceptance.mjs`、`check-r01.mjs` 及 development-plan-order/F06/R01 三份负向套件。实际重评按现行义务执行，没有删除检查、放宽门槛或重新定义成功条件。

## 逐节点结果

[机器可读矩阵](./evidence/core-plan-ready-reassessment-20261007/node-matrix.json)保存完整原/新 digest、证据路径和依赖；[原 25 项快照](./evidence/core-plan-ready-reassessment-20261007/previous-ready-nodes.json)及历史回执完整保留。

| 节点 | 原摘要前缀 | 当前阶段 | 当前证据 |
|---|---|---|---|
| `CORE:F01` | `9ccbcb1947e7` | READY | [当前回执](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/core-f01.json) |
| `CORE:F02` | `6d1f8c132ea1` | READY | [当前回执](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/core-f02.json) |
| `CORE:F03` | `041ff6ab3d9d` | READY | [当前回执](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/core-f03.json) |
| `CORE:F04` | `7afc9e704bc0` | READY | [当前回执](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/core-f04.json) |
| `CORE:F05` | `7243fa9588b1` | READY | [当前回执](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/core-f05.json) |
| `CORE:F06` | `bf19322d46e7` | READY | [当前回执](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/core-f06.json) |
| `CORE:F07` | `d7868b2b9ab2` | READY | [当前回执](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/core-f07.json) |
| `CORE:F08` | `8468951ed2dd` | READY | [当前回执](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/core-f08.json) |
| `CORE:F09` | `5b0c72c26ac4` | READY | [当前回执](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/core-f09.json) |
| `CORE:TP01-A` | `c480fcb7069f` | READY | [当前回执](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/core-tp01-a.json) |
| `CORE:TP01-B` | `e4fd6a474de9` | READY | [当前回执](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/core-tp01-b.json) |
| `FE:PRE-01` | `8c18a181588d` | READY | [当前回执](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/fe-pre-01.json) |
| `FE:PRE-02` | `6ee0fc8da236` | READY | [当前回执](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/fe-pre-02.json) |
| `FE:PRE-03` | `6c8a47d5b739` | READY | [当前回执](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/fe-pre-03.json) |
| `FE:PRE-04` | `dfe99a6b0648` | READY | [当前回执](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/fe-pre-04.json) |
| `FE:PRE-05` | `4319f80d0bc2` | READY | [当前回执](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/fe-pre-05.json) |
| `FE:PRE-06` | `17e9db8686eb` | READY | [当前回执](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/fe-pre-06.json) |
| `FE:BFF-FE-000` | `7aef1dd96049` | READY | [当前回执](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/fe-bff-fe-000.json) |
| `FE:FEP-0` | `6e998f5f4265` | READY | [当前回执](./evidence/fep0-remediation-20261005/user-confirmed-20261007-1d2bce97fcfb/fep0.json) |
| `FE:BFF-FE-001` | `9544dc25a2e3` | READY | [当前回执](./evidence/bff-fe-001-remediation-20261005/core-plan-format-reassessment-20261007/a2.json) |
| `FE:BFF-FE-007` | `07150c4b8385` | READY | [当前回执](./evidence/bff-fe-007-remediation-20261006/core-plan-format-reassessment-20261007/development.json) |
| `CORE-GATE:F0` | `6eca9a2ba4f4` | READY | [当前回执](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/core-gate-f0.json) |
| `PREPARATION:P0` | `2f404b402bd7` | READY | [当前回执](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/preparation-p0.json) |
| `PROVIDER:A1` | `5abf7d6c0279` | READY | [当前回执](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/provider-a1.json) |
| `FRONTEND-GATE:G0` | `83743d85b014` | READY | [当前回执](./evidence/frontend-g0-fep0-remediation-20261005/core-plan-format-reassessment-20261007/g0.json) |

## 实际执行与目标边界

| 检查范围 | 本轮结果 | 证据 |
|---|---|---|
| F0/A1 全闭包 | 87/87 PASS，21 节点严格 READY；全部执行绑定冻结源码 | [完整执行](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/execution-results.json) |
| F01 三轮独立构建 | bootstrap、Rust release、pnpm build、Python build 各轮全部通过，各语言文件清单和综合 digest 一致 | [构建回执](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/f01-reproducibility.json) |
| F06 真实目标 | build/preflight/Auth BFF/Auth Runtime/Execution/Vault/database 七组通过 | [新目标回执](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/f06-target.json) |
| F05 数据正确性 | 持久化 8/8；万条事件的 applied/uniqueSideEffects/dispatched 均为 10000，checkpoint 10001；存储/私有 Storage/RLS/覆盖率通过 | [规模回执](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/f05-volume.json) |
| F07 Runtime | OS 终止 worker 后 100/100 恢复、100 唯一 Artifact 绑定；line 93.28%、region 88.43%；真实服务拒绝矩阵通过 | [恢复](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/supporting/f07-recovery/recovery-diagnostic.json)、[服务](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/supporting/f07-service/target-service.json) |
| F08/F09/第三方 | Engine/nightly 分支/真实 wheel-UDS、F09 新目标与持久 trace、TP 基线与 intake 等实际通过 | [完整执行](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/execution-results.json) |
| Chromium/契约/生成 | Chromium 27/27；契约、生成漂移、负向、变异、覆盖率与结构顺序实际通过 | [Chromium](./evidence/provider-a1-remediation-20261004/core-plan-format-reassessment-20261007/logs/chromium.log) |
| 身份 BFF 本地重跑 | 3 组语义、22/14 项契约/阶段负向、8/8 实际语义变异拒绝；上游依赖刷新 | [功能回执](./evidence/bff-fe-001-remediation-20261005/core-plan-format-reassessment-20261007/a2.json) |
| Audit BFF 本地重跑 | 3 组语义、5/5 实际语义变异拒绝；三项依赖刷新 | [功能回执](./evidence/bff-fe-007-remediation-20261006/core-plan-format-reassessment-20261007/development.json) |
| G0 | 16/16 工程 PASS，当前文稿用户确认记录核验通过，严格 READY | [工程回执](./evidence/frontend-g0-fep0-remediation-20261005/core-plan-format-reassessment-20261007/g0.json) |
| FEP-0 | 确认前 2/2 PASS；确认后独立重跑 2/2 PASS，八依赖严格 READY | [聚合回执](./evidence/fep0-remediation-20261005/user-confirmed-20261007-1d2bce97fcfb/fep0.json) |

本轮身份/Audit **未重新执行原目标调用**。两者自身功能输入完整一致，严格门禁重新核对目标的 7/13 项源码摘要、断言、正常/拒绝矩阵与清理。保留身份原目标提交 `d758c839fbd57366346d0f2b9ef2081c68ab51e6` 的 51 次请求/14 条断言，以及 Audit 原提交 `5e3339c9e5cc95d550c6e67ffa36701998cb0e2f` 的 83 次请求/45 条断言；两份原件 `cleanupVerified=true`。见[复用核验](./evidence/core-plan-ready-reassessment-20261007/reused-target-verification.json)。

F07 恢复调度 P95 **287.05725 ms** 为诊断值，未满足 200 ms 发布性能目标；其原生回执仍为 `DIAGNOSTIC_ONLY`，未改成正式 PASS。服务检查仍使用 `temporary-admin-key`，不证明受限 Storage 凭据或部署 HTTPS。F05 4008.106625 ms 仅为目标 event ID client retrieval，不能代替完整载荷链还原的正式性能验收。上述原边界继续由 L04/RELEASE 收口。

## 发布顺序拒绝与处理

G0 初次 `--assess` 的 16 项检查全部完成，但其末尾联合图核验返回 exit 1：旧 FEP-0 READY 不允许依赖新的 G0 BLOCKED。未把整条初次执行冒充成功。已撤销失效的 FEP-0 准入，暂置 NOT_ASSESSED，随后严格 G0 engineering 校验通过，并实际执行两项 FEP-0 聚合检查，由 evaluator 发布 BLOCKED 回执。随后项目用户确认当前文稿，G0 finalize 严格 READY，FEP-0 确认后再次实际重评 READY；确认前 [BLOCKED 工程回执](./evidence/fep0-remediation-20261005/core-plan-format-reassessment-20261007/fep0.json)和 [G0 PENDING 原件](./evidence/frontend-g0-fep0-remediation-20261005/core-plan-format-reassessment-20261007/pending-g0-b99b2be202d5.json)均保留；[过程记录](./evidence/core-plan-ready-reassessment-20261007/g0-publication-transition.json)保留拒绝与处理事实。

## 最终校验

[严格终检](./evidence/core-plan-ready-reassessment-20261007/final-validation.json)对原 25 节点逐项验证新输入/回执/依赖与确认，全部 READY、formalAccepted=false；原 159 节点规范输入、依赖、开发及正式复审状态与冻结源码完全一致，旧 25 份回执摘要未改写。计划结构/顺序、文档本地链接及显式锚点、diff 空白检查通过。

## 后续边界

- 当前文稿用户确认已记录并核验，G0 finalize 和确认后 FEP-0 实际重评已完成；本轮开发准入无剩余确认待办。确认前台账、阶段矩阵与 BLOCKED 回执完整保留。
- DEVELOPMENT READY 不表示历史正式 ACCEPTED 已迁移。新 hosted CI、staging/真实 IdP、RELEASE 性能/长稳/最终确认、本轮新 HEAD 正式 Git-note 回执均未在本次范围内验收。
- PROVIDER:ALL、未实现 API、消费页面业务联调与 Desktop 保持独立验收。
