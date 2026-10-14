# R1/A2/BFF003/BFF005/A3 聚合本地复验（2026-10-14）

结果：本轮完整聚合闭包复验PASS；R1-SERVICE/A2/BFF003/BFF005/A3五项限定DEVELOPMENT READY已恢复，TP02_LOCAL也从本次同源证明重新READY。冻结候选为 `5fa0fb04b0c3b4584eb7b405bb9d2fa5e4458842`，共同执行42节点/141组全部PASS。全图6 READY / 153 NOT_ASSESSED / 0 BLOCKED；Supabase、外部环境、性能仍NOT_RUN，发布与正式接受未授予，formalAccepted=false。

## 范围与必要修复

本轮从 `ea57f0b49ecc9f4de386515d2166e5b185121958` 开始。五项聚合/消费者Gate因前次公共输入变化撤回；TP02_LOCAL当时是唯一READY。本轮预检实际发现聚合门禁套件55项中52 PASS、3 FAIL：两项复评测试错误假设所有非聚合消费者的节点都不能READY，静态发布测试未给独立TP02的回执建立隔离路径。该失败不表示TP02本身失败；修改前其公共Gate与seal实际PASS。[失败原件](./evidence/provider-a3-readmission-20261014/preflight/01-existing-gate-state-failure.log)保留。

修复内容：

- 聚合与TP02测试fixture从隔离的NOT_ASSESSED模型起步，真实计划解析、发布/回滚断言保持；不会为通过测试删除真实独立Gate。新增聚合发布保留独立TP02的回归检查。
- A3_EXECUTION共同执行增加TP02专用Gate组，成为42节点/141组。五消费者必要检查仍为A2 17/67、R1 27/85、BFF003 40/135、BFF005 40/135、A3 42/140；新增组用于从本轮实际共同执行派生TP02_LOCAL完整13节点/44组。owner/profile/scope、递归依赖、日志及摘要均重绑并严格验证，不拼接旧候选。
- 记录器在F01独立构建前保持工作区干净；临时保存canonical组件，成功或失败均保留本轮生成差异并恢复原字节。旧五份wrapper、TP02 wrapper、publication及两份计划归档；六份发布异常时恢复全部wrapper和计划并记录失败。
- A3前置复评识别TP02独立本地回执，避免用严格目标验收器误报已有LOCAL Gate。发布五消费者仍使用原声明路径，历史原字节通过归档保留。

共享功能输入变化后按规程暂时撤回旧TP02 READY，[原阶段快照](./evidence/provider-a3-readmission-20261014/prior-stages.json)保留；本轮完成后要求六份回执均绑定同一新候选，不直接沿用135c7bd5的TP02或1ee328c7的A3证明。[操作规程](../operations/provider-a3-local-admission.md)保留准入与发布边界。

## 命令与测试结果

执行器剥离数据库/Supabase/凭据及目标opt-in，启用QUANTOS_SKIP_ENV=1、UV_OFFLINE=1、CARGO_NET_OFFLINE=true、npm_config_offline=true、QUANTOS_RELEASE_PERFORMANCE=0；固定pnpm 10.20.0。

```sh
PATH=/Users/anray/Library/pnpm/.tools/pnpm/10.20.0/bin:$PATH \
  node scripts/record-research-local.mjs \
  docs/audit/evidence/provider-a1-remediation-20261004/provider-a3-readmission-20261014/attempt-01
make research-local-check
make provider-a3-local-check
make tp02-local-check
node scripts/reassess-a3-prerequisites.mjs
node docs/audit/evidence/provider-a3-readmission-20261014/run-final.mjs final-01
python3 docs/audit/evidence/provider-a3-readmission-20261014/seal-evidence.py --verify
```

| 验证 | 实际结果 |
| --- | --- |
| 共同执行 | 42节点 / 141组 PASS，0 FAIL、0 timeout |
| 冻结输入 | 1455项：1454文件 + 1个干净固定gitlink，与候选Git blob及摘要一致 |
| 历史证据 | 基线23531份全部保留；7份canonical证据旧字节归档并与原Git blob一致 |
| 组件恢复 | 626份原组件文件恢复并逐项摘要一致；本轮生成差异另行保留 |
| 修复后门禁单测 | 聚合57 + TP02 55 + 通用回执54 = 166/166 PASS |
| 计划负向 | 42/42 PASS；跨计划结构、依赖顺序PASS |
| 收尾与真实改写探针 | 21/21 PASS；13/13真实改写被拒绝且恢复原字节；RELEASE/执行专用profile/严格F0越界均按预期拒绝 |

已实际完成的F01完整make test：Rust 385 PASS / 0 FAIL / 7 ignored，Python 1390 PASS，前端233 PASS / 3 skipped。Rust ignored为发布性能等独立条件；不记作当前目标验收。完整执行的最终141组结果以本轮execution-results为准。

## Gate 与未决风险

| Gate | 范围 | 节点 / 检查组 | 移交RELEASE检查组 | 结果 |
| --- | --- | --- | --- | --- |
| `PROVIDER:A2` | `A2_LOCAL` | 17 / 67 | 10 | DEVELOPMENT READY |
| `CORE-GATE:R1-SERVICE` | `R1_LOCAL` | 27 / 85 | 19 | DEVELOPMENT READY |
| `FE:BFF-FE-003` | `BFF003_LOCAL` | 40 / 135 | 22 | DEVELOPMENT READY |
| `FE:BFF-FE-005` | `BFF005_LOCAL` | 40 / 135 | 21 | DEVELOPMENT READY |
| `PROVIDER:A3` | `A3_LOCAL` | 42 / 140 | 22 | DEVELOPMENT READY |
| `CORE:TP02` | `TP02_LOCAL` | 13 / 44 | 13 | DEVELOPMENT READY |

本地消费者证明不授予其余上游独立Gate，TP02只通过自身完整同候选13节点证明重新准入。A3还绑定BFF003/BFF005/A2三份已发布消费者回执的路径、摘要、Gate及同一源码；R1在相应本地闭包中验证。A3_EXECUTION仅为共同执行用途，公共入口须拒绝将它作为聚合准入。

数据库与外部目标命令、Supabase可写/迁移/RLS/事务/Auth/Storage、真实worker/Artifact/audit持久恢复、来源用途许可与真实provider/LLM/tool、OS隔离、远程SCA/fork治理、完整浏览器矩阵、代表性性能/容量/长稳及同SHA hosted CI仍归测试/RELEASE-GATE:BETA，NOT_RUN。正式确认需ProjectUser，未自行批准ACCEPTED；原量化目标不降低。

F01完整套件中条件性live PostgreSQL用例在无DATABASE_URL/opt-in时跳过连接，不构成数据库通过。前端TP03/TP04/TP05专用UI取消探针在普通pnpm test未提供桥接输入时有3项既有skipped，不能计作PASS；对应Engine专用验收回执单独核对。未消费已退役32条事实、未采集新数据；本轮使用自有合成/fixture输入。未升级订阅、未使用生产凭据、未建立本机数据库/容器、未推送或执行外部发布。

## 证据与变更

当前原始结果：[共同执行](./evidence/provider-a1-remediation-20261004/provider-a3-readmission-20261014/attempt-01/execution-results.json)、[本轮发布记录](./evidence/provider-a3-readmission-20261014/publication.json)、[严格验证](./evidence/provider-a3-readmission-20261014/verification.json)、[收尾检查](./evidence/provider-a3-readmission-20261014/final-01/results.json)、[真实改写拒绝](./evidence/provider-a3-readmission-20261014/final-01/tamper-probes.json)。

旧canonical wrapper路径保留为当前入口；旧字节、原始源SHA和摘要归档到本轮history，逐项与冻结Git blob核对。旧20261013索引/报告及旧seal是历史候选记录；其原canonical路径已刷新，旧seal不能直接验证当前wrapper，须按本轮history归档核对原字节，不能充当本轮当前源验收；本轮新验证器同时核对全部基线历史文件与归档替代路径，未删除旧失败。

主要变更：聚合/TP02测试fixture隔离、共同执行策略、同源索引派生、记录器归档/回滚、前置复评、操作规程、两份计划和审计脚本/原始证据。完整[文件清单](./evidence/provider-a3-readmission-20261014/changed-files.txt)与[封存摘要](./evidence/provider-a3-readmission-20261014/seal.json)随本地证据提交。冻结实现提交 `5fa0fb04`；最终证据提交哈希在完成回复报告。

下一可执行任务：A4/BFF-FE-006 接口及X01–X04、TP07、X3-SERVICE必要本地前置预检，再实现Portfolio/Risk/Proposal/Approval/Order API；本轮A3 READY不替代这些前置证明，不授予交易或生产权限。
