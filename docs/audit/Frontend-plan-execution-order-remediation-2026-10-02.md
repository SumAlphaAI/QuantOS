# 前端与核心计划验收顺序协调修复

- 日期：2026-10-02（Asia/Shanghai）。
- 授权：按[初审报告](./Frontend-plan-execution-order-review-2026-10-02.md)的优先协调方案和修复顺序执行，并生成本地 Git 提交。
- 基线：`77af3444cf31ea12d6c68bdc8a66b674e63336b9`；候选文件内容由[证据摘要](./evidence/frontend-plan-order-remediation-2026-10-02/summary.json)的 SHA256 绑定。
- 文档：[核心 v3.19](../SumAlpha-QuantOS-Development-Plan.md)、[前端 v3.1](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md)。
- 结论：**计划一致性修复 PASS，4/4 初审问题 CLOSED**。这是执行/验收路线和校验器的修复，不是新增业务、数据库、provider、浏览器或生产验收。

## 1. 最终执行路线

```text
F0 完整 Gate
→ R1 服务 Gate（保留 Research UI 待验收）
→ TP01 服务子范围 / S2 服务 Gate
→ X3 服务 Gate
→ P0/A1–A6 全部页面 API provider 验收
→ I1–I8 页面闭环 + R1/S2/X3 完整 Gate
→ I9/G7 Paper + Shadow Beta
→ L4 服务准备 Gate
→ I10/G8 + L03/L04 + L4 完整 Gate（仅 testnet 评审）
```

P0 及早期契约工作可以在其依赖已验收后提前执行；路线表给出一条无循环的串行路线。新页面与既有页面真实联调仍必须等待全部 12 个 API 及 PROVIDER:ALL 验收。

新增 SERVICE:TP01/S04/X06/L03/L04、CORE-GATE:*SERVICE 作为明确限定范围的服务验收单位；CORE:<ID> 继续表示完整任务。页面/视觉/Web E2E 标准未删减。TP01 服务 Gate 仅让 TP06 继续，TP01 总项完整验收仍需要 U01/Web Research E2E。L4 服务准备在 Beta 后，不提前启用生产实盘。

完整任务随消费页面闭环验收：FEP-2 后复审 U01/TP01 并关闭完整 R1；FEP-3 后复审 S04 并关闭完整 S2；G5/G4/G6 后复审 X06 并关闭完整 X3；FEP-8 后复审 L03/L04 并关闭完整 L4。closes_core 是这个后置关系，不能反向作为页面启动依赖。

## 2. 问题闭环

| 问题 | 修复 | 验证 | 状态 |
|---|---|---|---|
| B-01 跨阶段阻塞循环 | 服务准入与完整阶段关闭拆分，保留全量 API 前置；U01/S04/X06/TP01 等完整任务移动到前端闭环窗口 | 联合图 157 个节点、1454 条依赖边无环；恢复完整 R1 作为 S2 服务前置的负向探针被拒绝 | CLOSED |
| H-01 跨文档准入缺少稳定单位 | 全部核心任务结构化 depends_on/acceptance_window；前端 core_prerequisites 与 depends_on 同步；里程碑 closes_core 映射；FEP-7/8 显式完整/服务 Gate 准入 | 检查遗漏 L4 服务依赖、文字依赖漂移、错误总项映射、服务 Gate 缺失均拒绝 | CLOSED |
| M-01 关闭位置不明确 | P0 仅准备检查点；G0/FEP-0 在 A1 末尾；G1/I1、G2/I2、G3/I3、G5/I6、G4/I7、G6/I8、G7/I9、G8/I10；每个 A 窗口设 provider Gate，A6 后设 ALL | 检查点必须位于自身窗口及全部同文档前置之后；提前关闭 G5 或把 G1 移到子任务之前均拒绝 | CLOSED |
| M-02 校验器缺少跨计划语义图 | 新联合图校验、固定窗口/必要依赖策略、scope/status/SHA/evidence 字段检查，并接入 package scripts、Makefile、Frontend Baseline CI | 原 CORE:R04→CORE:L04 探针现在拒绝；20/20 正负向用例通过 | CLOSED |

## 3. 保留内容与状态

- 原 47 个核心任务、75 个前端任务、12 个 API、22 个一期逐页任务保持唯一标识和 task/review 锚点。
- 122 个任务的需求、技术要求、交付物、量化/集成/页面标准、原复审记录与开发状态逐字段对比通过。
- 核心完整 Gate 原 22 条勾选逐条保留；F07/F09 上线前移交和缺目标回执时保持 NOT RUN / NO RECEIPT 的要求不变。
- 所有 75 项前端复审仍为 NOT_STARTED；35 个检查点中只有 F0 是映射既有历史 ACCEPTED 记录，其余新服务/评估/provider/页面检查点为 NOT_STARTED/null/[]。历史 F0 源码回执不迁移到本次新提交。
- FEP 的 iteration 现在表示实际关闭窗口：FEP-0=A1、FEP-4=I7、FEP-5=I6。FEP 编号继续表示业务范围，G5 在 G4 前关闭是依赖要求。
- UI-VIS-000 的 P0 设计输入与 I1 完整交付分开表述；没有提前宣称其实现/验收完成。

## 4. 检查结果与入口

| 检查 | 结果 |
|---|---|
| 结构、链接、Web-only 范围与联合图 | PASS；47/75 任务，35 检查点，157 验收节点，1454 边 |
| 新计划顺序正负向测试 | 20/20 PASS（1 个基线用例、19 个破坏用例） |
| F06 现有回执负向测试 | 5/5 PASS；是校验器测试，不是实际 F06 目标验收 |
| PRE-01、PRE-04、BFF-FE-000、PRE-06 静态 Gate | PASS |
| CI YAML、package scripts、Makefile 接线 | PASS；未运行远端 CI |
| 原需求/状态/复审/Gate 保留 | PASS |
| 数据库执行、staging provider/consumer、浏览器 E2E、远程 CI | NOT_RUN |

入口：

```sh
pnpm check:development-plans
pnpm test:development-plans
make development-plan-check
```

本机默认 pnpm wrapper 等待工具链解析，被停止；使用已缓存且符合工程 packageManager 的 pnpm 10.20.0 执行新 package scripts 通过，未安装依赖或修改工具链。未来有意调整顺序/范围时，必须同步两份计划与 `scripts/development-plan-order-policy.json`，再运行正负向校验。

## 5. 证据和剩余边界

- [完整静态结构与拓扑顺序](./evidence/frontend-plan-order-remediation-2026-10-02/structure.json)。
- [20 项测试输出](./evidence/frontend-plan-order-remediation-2026-10-02/negative-tests.txt)。
- [字段保留、检查摘要与输入 SHA256](./evidence/frontend-plan-order-remediation-2026-10-02/summary.json)。

校验器检查的是图、必要依赖、关闭位置和证据引用形状/存在性；不证明证据内容真实、远端 SHA 验证成功或前置服务已实际 ACCEPTED。按计划执行时仍须验证对应范围的完整源码 SHA、目标环境与回执。服务准入通过也不能授予生产发布、实盘或绕过完整业务 Gate 的权限。
