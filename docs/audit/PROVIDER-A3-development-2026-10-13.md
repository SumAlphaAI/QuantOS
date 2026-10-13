# PROVIDER:A3 聚合开发验收（2026-10-13）

冻结源码 `1ee328c7f061742d7088b26fea87baf1a44df615` 的完整本地闭包 42 节点、140/140 组 PASS。A2_LOCAL、R1_LOCAL、BFF003_LOCAL、BFF005_LOCAL 与 A3_LOCAL 同候选通过严格内容校验并事务发布；PROVIDER:A3 DEVELOPMENT READY。全图 5 READY / 154 NOT_ASSESSED / 0 BLOCKED，formalAccepted=false。

本轮从基础设施修复后的 `3967d49206f9ec6a7c7663262694e08975418fa3` 开始，旧四消费者均为 NOT_ASSESSED。新的 attempt-01 独立重跑全部必要检查，没有拼接旧成功结果。最终文档和证据提交只登记冻结候选；当前功能输入及规范范围仍须与候选一致，不把交付提交 HEAD 自动视为已验收源码。

## 实现与变更文件

- [聚合门禁](../../scripts/research-local-gate.mjs)：增加 A3_LOCAL 42 节点回执；绑定 BFF003/BFF005/A2 三份已发布回执的路径、摘要、Gate 和同一源码 SHA；递归验证实际功能证据。A3_EXECUTION 保持执行用途，不能授予聚合准入。
- [门禁测试](../../scripts/research-local-gate.test.mjs)：55 项测试，新增 13 项；覆盖缺失/重复消费者、错误路径、改写回执、重新计算哈希后的不同候选、消费者 Gate 变更、正式状态越权、执行配置误用、CLI 加载、五回执同源、事务回滚和实际静态计划校验。
- [执行器](../../scripts/record-research-local.mjs)、[功能回执校验器](../../scripts/provider-a1-receipts.mjs)、[功能输入策略](../../scripts/provider-a1-policy.json)：执行单次 140 组共同闭包，严格派生五份完整功能证明，保留历史产物原字节，证据写入新目录。
- [前置复评](../../scripts/reassess-a3-prerequisites.mjs)：保留四个必要消费者审计，同时核验 A3 聚合回执。
- [阶段策略](../../scripts/development-plan-order-policy.json)、[计划校验器](../../scripts/check-development-plan-order.mjs)、[Makefile](../../Makefile)：同步登记五个限定回执路径，加入 `provider-a3-local-check` / `provider-a3-local-assess` 入口。
- [核心计划](../SumAlpha-QuantOS-Development-Plan.md)、[前端计划](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md)、[本地验收规程](../operations/provider-a3-local-admission.md)：登记当前 Gate、历史边界和发布移交。

完整变更文件见[源码与文档清单](./evidence/provider-a3-local-20261013/changed-source-files.txt)及[全部文件清单](./evidence/provider-a3-local-20261013/changed-files.txt)；逐文件摘要见[交付索引](./evidence/provider-a3-local-20261013/evidence-index.json)。

## 测试命令与实际结果

```sh
PATH=/Users/anray/Library/pnpm/.tools/pnpm/10.20.0/bin:$PATH \
  node scripts/record-research-local.mjs \
  docs/audit/evidence/provider-a1-remediation-20261004/provider-a3-local-20261013/attempt-01
make research-local-check
make provider-a3-local-check
node scripts/reassess-a3-prerequisites.mjs
node scripts/provider-a2-development.mjs
node scripts/bff-fe-003-development.mjs --ready
node scripts/bff-fe-005-development.mjs --ready
node scripts/check-development-plans.mjs
node scripts/check-frontend-gate-handoff.mjs
cargo fmt --all -- --check
git diff --check
```

| 验证 | 结果与边界 |
|---|---|
| 冻结源码完整闭包 | 42 节点 / 140 组 PASS，全部命令 exit 0，原始日志及产物哈希完整 |
| 工作区 `make test` | Rust 385 PASS / 7 ignored；Python 1390 PASS；Web 233 PASS / 3 skipped；本地条件性数据库用例不构成 Supabase 验收 |
| 三次独立构建 | Rust、TypeScript、Python 产物可复现 PASS |
| A2 | C01/C17/C10 的 26 个 API 本地 HTTP 成功覆盖及拒绝，身份 8 项、审计 5 项实际变异均被测试拒绝 |
| BFF003 | C03/C04 的 9 个 API、本机真实模块及正负产物校验 PASS；来源、权限、幂等、取消/恢复、审计等必要功能闭包齐备 |
| BFF005 | C12 的 7 个 API、真实 loopback HTTP/SSE、Chromium、恢复/撤权/缓存隔离 PASS；33 条 HTTP 记录，其中 24 条预期拒绝响应 |
| OpenAPI/生成客户端 | 70 operations / 62 schemas；目录检查不替代后续 provider 实现 |
| 新门禁与移交预检 | 146 项 PASS；其中聚合/消费者门禁套件 55 项 PASS |
| 发布后门禁 | 11 项命令均达到预期，含五回执递归校验、四前置与 A3 复评及计划校验 |
| 目标验收拒绝 | `node scripts/provider-a2-development.mjs --target` 预期 exit 1，证明本地回执不能被当作目标通过；没有执行目标操作 |
| 实际证据改写探针 | 6/6 被拒绝：源码、聚合绑定日志、功能产物、依赖 manifest、已发布消费者回执、消费者绑定日志；逐项恢复原字节，五 Gate 恢复 READY |
| 发布移交静态检查 | 后续前端 64 任务 / 16 检查点；外部环境及性能 early Gate 均为 0，原发布要求保留 |
| 交付凭据扫描 | Gitleaks 8.28.0 对本轮变更源码、文档与证据进行扫描，PASS；未读取本地秘密配置 |
| 证据封存 | 候选 Git blob、当前功能输入、规范范围、原始日志/产物和逐文件摘要核对 PASS；历史证据无改写 |

原始结果：[完整执行](./evidence/provider-a1-remediation-20261004/provider-a3-local-20261013/attempt-01/execution-results.json)、[执行摘要](./evidence/provider-a3-local-20261013/execution-summary.json)、[发布记录](./evidence/provider-a3-local-20261013/publication.json)、[发布后检查](./evidence/provider-a3-local-20261013/postchecks.json)、[改写拒绝探针](./evidence/provider-a3-local-20261013/tamper-probes.json)、[源码绑定](./evidence/provider-a3-local-20261013/source-binding.json)、[历史完整性](./evidence/provider-a3-local-20261013/historical-evidence-integrity.json)、[交付扫描](./evidence/provider-a3-local-20261013/gitleaks-scan.json)、[最终核验](./evidence/provider-a3-local-20261013/final-verification.json)。

## Gate 与未决风险

| 消费者 | DEVELOPMENT Gate | 必要节点 / 检查组 | 发布检查移交 |
|---|---|---|---|
| PROVIDER:A2 | A2_LOCAL READY | 17 / 67 | 10 组 NOT_RUN |
| CORE-GATE:R1-SERVICE | R1_LOCAL READY | 27 / 85 | 19 组 NOT_RUN |
| FE:BFF-FE-003 | BFF003_LOCAL READY | 40 / 135 | 22 组 NOT_RUN |
| FE:BFF-FE-005 | BFF005_LOCAL READY | 40 / 135 | 21 组 NOT_RUN |
| PROVIDER:A3 | A3_LOCAL READY | 42 / 140 | 22 组 NOT_RUN |

消费者的本地闭包证明不授予上游独立 Gate。正式检查点仍为 NOT_STARTED，source_commit=null、正式 evidence 为空，没有自行批准 ACCEPTED。

尚未执行 Supabase 迁移/RLS/事务、实际 Auth/Storage 与 worker 持久恢复、外部来源用途许可/部署、远程漏洞库与 fork 治理、完整浏览器矩阵、同 SHA hosted CI，以及性能/容量/长稳。它们保留原要求并移交 RELEASE-GATE:BETA，状态 NOT_RUN，不阻塞本地开发。UI/consumer 页面功能链在对应 I 迭代验证。

没有使用生产凭据、连接目标数据库、建立本机 PostgreSQL/Supabase、推送远端、触发外部发布或执行候选签名。

下一任务为 A4 `BFF-FE-006：Portfolio、Risk、Proposal、Approval 与 Order API`。先复评 X01–X04、TP07/X3-SERVICE 等本地功能前置，再实现页面 API；本轮 A3 READY 不替代这些前置证明。
