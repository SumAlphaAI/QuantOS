# TP01-E_LOCAL 本地开发准入 — 2026-10-14

本轮实现 TP01-E 的本地功能生产者、严格回执消费与事务式准入。冻结候选 `9b7bb8e5a8d6753208427918de69c0abd94e892a` 从干净提交完整复验 28 节点必要闭包，88 组命令全部实际执行；不拼接旧 SHA 结果。最终结果见[独立核验](./evidence/tp01-e-local-20261014/verification.json)、[完整执行](./evidence/provider-a1-remediation-20261004/tp01-e-local-20261014/attempt-05/execution-results.json)和[本地闭包](./evidence/provider-a1-remediation-20261004/tp01-e-local-20261014/attempt-05/local-prerequisites.json)。

## Gate 与范围

`TP01-E_LOCAL` 限定 DEVELOPMENT READY，唯一消费者为 `CORE:TP01-E`。全图 1 READY / 158 NOT_ASSESSED / 0 BLOCKED；必要前置是本项同源 LOCAL_READY 投影，未重新授予上游独立 READY，也未放行 R1-SERVICE、SERVICE:TP01 或 S2-SERVICE。`formalAccepted=false`、`syncApproved=false`，目标数据库、外部环境及性能验收均未执行。

28 节点包括 F01–F09、TP01-A/B/C/D、F0、R01–R04、TP02–TP05、TP08–TP11、R1-SERVICE 本地投影与 TP01-E。直接前置为 TP01-D、F02、R1-SERVICE。准入逐项绑定命令、源提交、规范输入、依赖 digest、原始日志及支持文件 hash；完整 index 缺节点、混合候选或被篡改时拒绝。

## 实现与变更文件

- 新增 `scripts/tp01-e-functional.mjs`、`scripts/fixtures/tp01-e-local/candidates.json` 与功能负向测试：六组自有合成场景及六组边界 CLI，校验分级、monitor/Gate 阻断、S0 保留、异常输入、摘要和决策/issue 文稿；非零退出作为期望拒绝原样保留。
- 新增 `scripts/tp01-e-local-gate.mjs`、专用准入测试、计划契约测试与 `scripts/record-tp01-e-local.mjs`：完整闭包、同候选证明、有限消费者授权及写入失败回滚。
- 更新 `scripts/provider-a1-policy.json`、`scripts/provider-a1-receipts.mjs`、计划 order policy、两份计划及发布移交 policy；增加 Makefile 本地准入/拒绝发布入口。
- 新增 `scripts/tp-reference-local.mjs` 及测试；拆分 TP09/TP10/TP11 `--record-local` 与原在线 `--record`，两种制品不得替换。固定历史材料本地校验继续执行，当前公共字节/provider 条款、在线 CVE 刷新留发布验收。
- 更新 TP09/TP10/TP11 开发生产者和制品负向测试、计划负向测试；完整 `make test` 执行预算由 30 分钟调整为 90 分钟，用例、命令及产品性能目标不变。
- 新增[操作规程](../operations/tp01-e-local-admission.md)及本轮证据。全部路径及 seal 见[变更清单](./evidence/tp01-e-local-20261014/changed-files.txt)和[证据封存](./evidence/tp01-e-local-20261014/seal.json)。

## 测试与证据

| 命令 / 检查 | 结果 |
| --- | --- |
| `node scripts/record-tp01-e-local.mjs docs/audit/evidence/provider-a1-remediation-20261004/tp01-e-local-20261014/attempt-05` | 28 节点 / 88 组 PASS，三次完整跨语言可复现构建 PASS |
| `make test`（本轮 f01-test） | Rust 396 PASS / 8 ignored；Python 1390 PASS；Web 233 PASS / 3 skipped；0 失败 |
| `node scripts/tp01-e-functional.mjs --record` | 原同步回归 23/23；12 个 CLI 场景 / 13 条执行记录；8 个预期非零拒绝原样保留 |
| `node --test --test-reporter=tap scripts/tp01-e-functional.test.mjs scripts/tp-reference-local.test.mjs` | 55/55 PASS |
| `node --test --test-reporter=tap scripts/tp01-e-local-gate.test.mjs scripts/tp01-e-plan-contract.test.mjs` | 49/49 PASS |
| `node docs/audit/evidence/tp01-e-local-20261014/verify.mjs --record` | 冻结输入、闭包、原始日志/制品/支持文件及历史证据核验 PASS |
| `node scripts/tp01-e-local-gate.mjs --ready` / `--release` | ready 退出 0；release 预期拒绝退出 2 |
| `node --test --test-reporter=tap docs/audit/evidence/tp01-e-local-20261014/closure-negatives.mjs` | 实际完整 index：1 正向 + 15 篡改拒绝，16/16 PASS |
| `node scripts/check-development-plans.mjs` / 计划负向测试 | PASS / 44/44 PASS |
| `make development-handoff-check` / `node scripts/check-frontend-gate-handoff.mjs` | 全部 PASS |

ignored/skipped 单独保留，不计为通过；数据库目标测试不由本地替代。

收尾命令、期望/实际退出码和日志 hash 见[收尾回执](./evidence/tp01-e-local-20261014/post-checks.json)。执行器 stdout 及最终退出结果见[控制台](./evidence/tp01-e-local-20261014/assessment-05-console.log)和[进程结果](./evidence/tp01-e-local-20261014/assessment-05-status.json)。冻结源提交与证据提交分离；后者只封存结果和计划展示字段，不改变本轮规范输入。

核验了 1382 项冻结输入（1381 个文件与 1 个 Gitlink），25,617 份基线历史证据字节保持一致，626 份 canonical 组件文件恢复为原件。

## 失败记录保留

| 轮次 / 冻结源 | 实际结果 | 处置 |
| --- | --- | --- |
| attempt-01 / `2505ff8b` | 82 PASS / 6 FAIL | TP09/10/11 内嵌线上 HTTP 请求失败；拆分本地历史材料与在线验收，未授予 Gate |
| attempt-02 / `7cac3a1d` | 88 命令 PASS，发布 FAIL | 计划层缺少 E 的本地依赖契约登记；事务恢复计划和 manifest，未授予 Gate |
| attempt-03 / `16775be2` | INTERRUPTED；仅 4 组完成 | 工具会话丢失后进程终止，确切原因未确定；无完整 index，无 Gate |
| attempt-04 / `b7af55ee` | 87 PASS / 1 FAIL | 完整 make test 超出旧 30 分钟预算，ETIMEDOUT/SIGPIPE；原件保留并提高执行器预算，无 Gate |
| attempt-05 / `9b7bb8e5` | 88 PASS；准入及收尾 PASS | 全新干净冻结源完整执行，核验后只发布 E 本地 Gate |

[首次失败](./evidence/provider-a1-remediation-20261004/tp01-e-local-20261014/attempt-01/failure.json)、[第二轮发布回滚](./evidence/provider-a1-remediation-20261004/tp01-e-local-20261014/attempt-02/publication-failure.json)、[中断记录](./evidence/provider-a1-remediation-20261004/tp01-e-local-20261014/attempt-03/interruption.json)、[第四轮超时](./evidence/provider-a1-remediation-20261004/tp01-e-local-20261014/attempt-04/failure.json)及 development-01–09 的失败/整改回执均封存，没有覆盖或改记 PASS。

收尾审计脚本另有两次失败：首次误把当前新增契约施加到旧计划；改用旧计划原始 Gate 字段逐项比较后，第二次发现验证 API 返回摘要不含 deferred 字段。两次日志均保留，改为读取已严格验证的原始 index，并完成第三次核验 PASS。这些修正只涉及独立审计辅助脚本，不改变业务实现、规范输入或已执行的冻结闭包。见[首次审计失败](./evidence/tp01-e-local-20261014/verification-01-failed.log)、[第二次审计失败](./evidence/tp01-e-local-20261014/verification-02.log)及[最终核验日志](./evidence/tp01-e-local-20261014/verification-03.log)。

首次 seal 创建还因报告引用尚未创建的 seal 本身被拒，失败日志[原样保存](./evidence/tp01-e-local-20261014/seal-01-failed.log)。创建阶段仅允许该精确自引用目标稍后生成，写入后的 verify 仍要求所有链接实际存在并匹配 hash；其余链接检查不变。

## 风险与发布移交

22 组 Supabase、外部环境和性能义务保持 NOT_RUN，完整清单在本地 index 的 deferred 字段与两计划 RELEASE-GATE:BETA 映射中。包括迁移/RLS/事务/Auth/Storage/持久 Artifact 和 audit、实际部署、GitHub/fork 治理、真实上游候选/在线 CVE/自然 schedule/同 SHA CI、公共字节/provider 条款、真实 diff/range-diff 和候选采用、R02 数据用途许可、OS egress 与容量/P95/长稳。

自有合成候选和固定历史元数据不能证明当前上游、公共字节、CVE 清除或真实数据许可；本轮只证明本地分级与阻断机制，未批准 sync 或外部发布。历史受限 R02 fixture 保持退役，不恢复原限时许可。实际签名、运行中禁用及回滚闭环继续由 TP01-F 实现。未升级订阅、使用生产凭据、连接 Supabase、创建本地数据库、推送 Git 或发布 issue/PR/部署。

## Git 与下一任务

本轮源码提交：`2505ff8b`（本地准入）、`7cac3a1d`（本地/在线材料边界）、`16775be2`（计划契约登记）、`b7af55ee`（中断证据）、`9b7bb8e5`（执行器预算与超时证据）。最终证据提交由 Git 历史定位，本报告不自引用自身提交 hash。

下一可执行任务：TP01-F_LOCAL 本地接口/fixture 和整改，实现真实本机验签及坏签名拒绝、运行中禁用/回滚、在途请求确定性收尾，补充专用负向测试后从新冻结提交复验 29 节点闭包。7 天 canary、目标环境回滚 SLA、外部环境与性能继续留测试/发布阶段；不直接登记 SERVICE:TP01 或 S2-SERVICE。
