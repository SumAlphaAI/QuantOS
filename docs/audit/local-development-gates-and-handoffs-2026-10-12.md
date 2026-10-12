# TP03 / TP04 / F0 本地开发 Gate 与后续阶段移交

范围依据：用户在本会话明确授权新增 TP03、TP04、F0 本地开发 Gate、Supabase目标最终发布验收，并检查 R04 后全部任务。此授权不是正式工程接受或发布授权。

本轮实现 `R04_LOCAL`：17个必要前置节点、56组本地检查；原13组Supabase目标命令完整移交 `RELEASE-GATE:BETA`，保持 NOT_RUN。仅 F0、TP03、TP04 发布自身本地Gate，其他上游记录不授予目标READY；R03另复验自身7组检查。R04 admission是实施准入，R04完成Gate仍NOT_ASSESSED。

## 执行与验收边界

- 冻结源码提交后运行 `make r04-assess-local`；本地前置与R03必须来自同一候选提交，日志、Artifact、wheel、源码/计划内容和依赖摘要递归绑定。
- `make f0-local-check tp03-local-check tp04-local-check r03-admission-check r04-admission-check` 验证当前本地准入；`make local-release-check` 无最终目标与正式Beta回执时明确拒绝。
- 严格入口 `node scripts/provider-a1-receipts.mjs --f0` 与组件 `--ready` 保留原数据库消费要求，不将本地档案作为严格数据库通过回执。
- 读取数据库变量和目标 opt-in 从本地环境剥离；不加载 `.env.local`，不创建本地数据库，不连接Supabase，不升级订阅，不使用生产凭据或外部发布。

## 后续任务完整性

核心计划R04之后22个任务逐卡定义本地开发、INTEGRATION测试及最终发布范围。原量化/集成要求保留，外部环境和代表性性能不阻塞DEVELOPMENT。`scripts/development-gate-handoff-policy.json`与任务卡逐字绑定，`make development-handoff-check`和计划CLI校验覆盖缺项、漂移和假PASS。真实模块集成仍属测试；截止时间、拒绝、幂等/恢复等正确性不能后置。

## 原失败证据与活动问题

[原目标诊断与严格失败报告](./F0-target-failures-remediation-2026-10-12.md)、[原56组结果](./evidence/provider-a1-remediation-20261004/f0-target-readmission-20261012/attempt-01/execution-results.json)、[原完整性索引](./evidence/f0-target-diagnostics-20261012/integrity.json)保留。新runner在写组件回执前逐字归档TP03/TP04/R03旧证据并绑定SHA，失败尝试不拼接为新PASS。

R04-P03公共Rust校验器接受7/9畸形输入、R04-P04研究输入消费闭环及专用完成回执仍待实现，详见[原R04预检](./R04-interface-fixture-preflight-2026-10-12.md)。这些阻塞R04完成验收，不阻塞开展修复实现。Supabase只读、真实Auth/持久恢复、性能/长稳、hosted CI及正式用户确认均不因本地准入完成。

## 实际复验

冻结候选：`767894432483879aab9c8298e342a2a18adeefb9`，开始时Git干净。实现提交为 `750a08d0`；`76789443`仅保存首次启动失败与旧回执。完整attempt-02全部重新实际执行，不拼接首次失败结果。候选之后仅保存文档/证据，源码、测试、配置与规范输入保持绑定内容。

| Gate | 当前结果 | 本地必要范围 |
|---|---|---|
| CORE-GATE:F0 | READY / R04_LOCAL | 12节点、42组 |
| CORE:TP03 | READY / R04_LOCAL | 13节点、45组 |
| CORE:TP04 | READY / R04_LOCAL | 14节点、48组 |
| CORE:R03 | READY / R03_LOCAL，依赖显式R04_LOCAL档案 | 同候选17节点/56组前置 + 自身7组 |
| CORE:R04 admission | READY，仅允许开展本地实现 | R03、TP03、TP04、F0同候选且内容有效 |
| CORE:R04完成 | NOT_ASSESSED | R04-P03/P04尚未关闭 |
| Supabase / RELEASE / 正式接受 | NOT_RUN / NOT_ASSESSED / false | 原13组目标命令及目标环境/性能义务未验收 |

全图 **4 READY / 155 NOT_ASSESSED / 0 BLOCKED**。原严格数据库失败状态保留在原SHA和原失败manifest中；当前本地READY不能消费为严格数据库READY，也不授予其他上游目标Gate。

实际入口及结果：

| 命令 | 结果 |
|---|---|
| `env PATH="/Users/anray/Library/pnpm/.tools/pnpm/10.20.0/bin:$PATH" node scripts/record-r04-local-prerequisites.mjs docs/audit/evidence/provider-a1-remediation-20261004/r04-local-20261012/attempt-02` | exit 0；17节点、56/56组本地PASS；R03 7/7 PASS；清理discovered=[]、remaining=[] |
| `make f0-local-check tp03-local-check tp04-local-check r03-admission-check r04-admission-check` | exit 0；五个CLI均通过 |
| `make local-release-check`、`make r03-release-check` | 各exit 2，预期拒绝，未授予发布 |
| `node scripts/provider-a1-receipts.mjs --f0`、两组件 `--ready` | 各exit 1；严格入口拒绝本地档案，不作为目标DB通过 |
| `node --test scripts/local-development-gate.test.mjs scripts/development-gate-handoff.test.mjs scripts/provider-a1-receipts.test.mjs scripts/r03-stage-check.test.mjs scripts/development-plan-order-negative.mjs scripts/tp03-functional-artifacts.test.mjs scripts/tp04-functional-artifacts.test.mjs` | 230/230 PASS，0失败/跳过 |
| `node scripts/check-development-plans.mjs`、`make development-handoff-check` | PASS；22任务/16后续检查点，无开发外部/性能Gate |
| `node docs/audit/evidence/local-development-20261012/verify-future-targets.mjs` | PASS；原22任务量化条款逐字未变、16检查点原scope保留 |
| R04公开Rust校验器纯探针 | 执行exit 0，但requirementStatus=GAPS_FOUND；7/9畸形输入被接受，不能记作R04要求PASS |
| Gitleaks 8.28.0 `dir --redact`（新证据、完整attempt、纯probe三范围） | 三组exit 0，no leaks found |
| `git diff --check` | PASS |

56组包括三轮独立构建、完整lint、`make test`、协议/API client、领域/事件/Storage、覆盖率、SQL静态/供应链/秘密扫描、F06/F07拒绝机制、F08功能/nightly/wheel服务链、F09调度负向、R01/R02、TP02/TP03/TP04全部本地必要检查。两组件各12项实际检查均通过，完整Python套件各1366项（TP03 9.24s、TP04 8.84s）；100条schema/双RPC重放、wheel五RPC、受控取消及UI bridge通过。这些耗时仅为本次诊断，不构成目标负载性能验收。

实际证据：[完整执行索引](./evidence/provider-a1-remediation-20261004/r04-local-20261012/attempt-02/execution-results.json)、[本地前置内容档案](./evidence/provider-a1-remediation-20261004/r04-local-20261012/attempt-02/local-prerequisites.json)、[R03七组](./evidence/provider-a1-remediation-20261004/r04-local-20261012/attempt-02/r03-execution-results.json)、[R04 admission](./evidence/local-development-20261012/r04-admission.json)、[最终CLI结果](./evidence/local-development-20261012/final-checks.json)、[目标条款保留核对](./evidence/local-development-20261012/future-target-preservation.json)、[当前R04负向缺口](./evidence/r04-preflight-20261012/runtime-contract-local-admission-20261012/receipt.json)。

首次尝试没有执行检查：PATH选择了全局pnpm 11.21.0，原生启动器身份校验失败；项目固定pnpm 10.20.0。仅在任务PATH优先使用现有缓存的10.20.0，Node 24.12.0/uv 0.7.0/Rust 1.91.0全部符合固定版本；未改全局配置或锁文件。见[失败原文及处置](./evidence/local-development-20261012/diagnosis/attempt-01-launcher-failure.json)。

## 变更文件与剩余风险

主要实现：`scripts/provider-a1-receipts.mjs`、`scripts/provider-a1-policy.json`、`scripts/local-development-gate.mjs`、`scripts/record-r04-local-prerequisites.mjs`、`scripts/r03-stage-check.mjs`、`scripts/r03-record-development.mjs`、`scripts/check-development-plans.mjs`、`scripts/check-development-plan-order.mjs`、`scripts/development-plan-order-policy.json`、`scripts/check-development-gate-handoff.mjs`、`scripts/development-gate-handoff-policy.json`、`Makefile`。新增/调整三份相关测试；两份开发计划同步阶段契约和当前范围；组件回执与全部验收证据单独保存。

[完整变更文件清单](./evidence/local-development-20261012/changed-files.txt)、[结果摘要](./evidence/local-development-20261012/summary.json)、[完整性校验](./evidence/local-development-20261012/integrity.json)、[可重跑内容验证](./evidence/local-development-20261012/verify-final-state.mjs)。

未决：R04-P03七类输入校验缺口、R04-P04研究输入消费闭环/完成回执；真实Supabase容量可写性、Auth、持久恢复、外部目标/性能/长稳、hosted CI及正式用户确认均待对应阶段实际验收。本轮不重新消费已退役历史事实、不声称新pending=0；未升级订阅、未使用生产凭据、未推送或外部发布。

完整性复核：544条历史SHA绑定保持一致；源文件/规范输入、全部新回执/日志/制品另行逐字核验。

下一可执行任务：**实现R04公共Signal/Proposal校验一致性与R03研究输入消费闭环**，补版本/enum/数值/metadata/反方观点/期限边界负向、证据绑定和无订单调用计数，形成独立完成回执；保持目标环境与性能最终发布验收。
