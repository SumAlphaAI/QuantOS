# e0e9cbc CI 后续故障整改与复验报告

> 历史修复快照：5da474e 推送后的新 CI 失败及当前复验见[最新整改报告](CI-5da474e-remediation-2026-10-06.md)。下文保存本轮原结论，固定路径 G0 的旧原件见[独立归档](evidence/frontend-g0-fep0-remediation-20261006-before-ci-5da474e/archive-index.json)。

## 一、任务完成概况

2026-10-06 复核已推送提交 `e0e9cbc` 的 GitHub Actions：[12 条运行](evidence/ci-e0e9cbc-remediation-20261006/github-e0e9cbc-final.json)全部结束，10 成功、2 失败；定位并修复两条失败运行的两个根因，并修复完整复验发现的一项新增依赖漏洞。修复源码冻结于 `14bf36cbe9f1730f45f3bb1993e5c69fff4b2445`，完整 F0/A1 **87/87 PASS**；G0 **16/16**、FEP-0 **2/2** 工程检查 PASS，A2 当前内容门禁 READY。当前阶段台账共 **22 READY、2 BLOCKED**；两个 BLOCKED 均来自新 G0 范围的项目用户确认待办。修复提交未推送，最新 hosted CI **NOT_RUN**，formal/RELEASE 未批准。

## 二、修复明细与统计

| 原失败运行 | 原因与影响 | 已完成修复 |
|---|---|---|
| [Frontend Baseline](https://github.com/SumAlphaAI/QuantOS/actions/runs/37394888372) | checkout 未初始化 Vibe 固定 gitlink；子目录 `git rev-parse HEAD` 回退父仓 e0e9cbc，与 c33133f 不符，F0 内容校验拒绝 | 两个消费工程回执的主 checkout 设置 `submodules: true`；固定 pin 及校验保留。实际干净检出先复现拒绝，再从公开 GitHub 克隆并检出固定提交，同一 e0e9cbc 的 F0 READY；未执行上游程序 |
| [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/37394888432) | RLS 预检抹去 DO 块，漏掉 A2 十表 FOREACH/format 的 ENABLE/FORCE/policy，迁移预检提前停止；F02 artifact 缺失为连带结果 | 仅展开无条件固定表名数组及确定 format DDL，保留执行顺序；未知/条件 RLS 块拒绝，函数/注释/字符串不能充当执行。完整评估新增真实迁移 preflight 第 87 项 |

| 检查范围 | 实际结果与证据 |
|---|---|
| 依赖安全升级 | source-map-js 1.2.1 → 1.2.2，全 3 处引用受精确 override 约束；[官方公告](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)、[修复发布](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2)。实际安装后 [7 项有界防护/正常兼容探针](evidence/ci-e0e9cbc-remediation-20261006/source-map-installed-probe.json) PASS（[可重放脚本](evidence/ci-e0e9cbc-remediation-20261006/source-map-probe.cjs)），全生态 SCA PASS；未新增豁免 |
| 全仓迁移静态预检 | 50 张表 PASS；不连接数据库 |
| RLS 聚焦正负控制 | 5/5 PASS：实际 A2 十表、缺失项、后续撤销、条件/假执行、policy 内伪 SQL |
| F02 全套正负控制 | 21/21 PASS；[原件](evidence/ci-e0e9cbc-remediation-20261006/f02-negative.log) |
| 回执策略回归 | 43/43 PASS；[原件](evidence/ci-e0e9cbc-remediation-20261006/receipt-negative.log) |
| 完整 F0/A1 | 87/87 PASS，21 节点 READY；[执行明细](evidence/provider-a1-remediation-20261004/ci-submodule-rls-sca-20261006/execution-results.json) |
| G0 工程 | 16/16 PASS，BLOCKED 仅限 ProjectUser 当前范围待确认；[manifest](evidence/frontend-g0-fep0-remediation-20261006-before-ci-5da474e/g0.json) |
| A2 本地及内容回执 | 14 Rust lib（另 1 F09 ignored）、12 reference、29 consumer；8 mutation 拒绝、22 契约负向、14 阶段正负、3 transport PASS；[manifest](evidence/bff-fe-001-remediation-20261005/ci-submodule-rls-sca-20261006/a2.json) |
| FEP-0 聚合工程 | 2/2 PASS，消费 7 READY 与 1 G0 工程 PASS/BLOCKED；[manifest](evidence/fep0-remediation-20261005/ci-submodule-rls-sca-20261006/fep0.json) |

各套件有交叉，不相加为总验收用例数。完整评估包含三次独立跨语言构建、实际配置的 Supabase Auth/PostgreSQL/Storage、F02 事务反证与回滚、F05 10,000-event、F07 恢复/覆盖/服务、F08 wheel/UDS、F09 目标与四生态依赖检查。每项日志、产物及支持文件由当前 manifest 摘要绑定；静态检查与目标执行分别记录。

## 三、问题状态与风险边界

首轮 `2faef8e` 完整评估为 86 PASS / 1 FAIL（source-map-js），未发布 READY；[失败执行明细](evidence/provider-a1-remediation-20261004/ci-submodule-rls-20261006/execution-results.json)及全部日志原件保留。初次正常映射探针的 indexed 查询夹具已校正，失败日志也保留；修复防护和正常映射转换以随后实际安装 PASS 原件为据。

两处原 CI 根因及新增 SCA 漏洞均已关闭，未通过关闭门禁或更改数据库权限绕过。迁移 SQL、业务服务/API、子模块 pin 未改变。实际目标操作使用现有 Supabase，不建立本地数据库；事务负向完成回滚。

A2 本轮重新执行本地语义、mutation、正负及 transport，并重新绑定依赖；**未重跑 MFA live 操作**。沿用 [fab00ba 正常目标原件](evidence/bff-fe-001-remediation-20261005/ci-live-20261006/receipt.json)：51 次调用、20 API、14 强断言、cleanupVerified=true；7 个目标源码摘要与 `14bf36c` 完全一致，当前严格校验有效。旧 52 次目标、先前失败日志及原六项关闭记录均保留。

[前轮 G0 原件](evidence/frontend-g0-fep0-remediation-20261006-before-ci-e0e9cbc/g0.json)及其日志已独立归档，原路径与归档文件摘要见[映射索引](evidence/frontend-g0-fep0-remediation-20261006-before-ci-e0e9cbc/archive-index.json)。历史批准及不可变确认文稿保留，不自动批准新输入。当前新范围 `sha256:9fcb3ed54d9e944cc55ccef4859500a8c4d44d6f4c4af1a44936855558040a5b` 的[用户确认文稿](../gate-records/G0-user-confirmation-draft-2026-10-06-9fcb3ed54d9e.md)已生成；G0/FEP-0 严格 READY 会继续拒绝待确认状态，CI 工程检查可验证该明确边界。

## 四、整改结论与后续

修复代码、工程回执及计划同步完成；当前证据已纳入 Git，内容门禁、格式、计划结构/依赖/负向与秘密扫描通过。见[验证索引](evidence/ci-e0e9cbc-remediation-20261006/final-verification.json)。本次没有推送；新 hosted CI 需用户推送后核实，不能由本机复验代替。用户确认新 G0 文稿后，再按既定流程记录原答复并推进 G0/FEP-0；部署、同 SHA hosted CI 及正式发布验收保持独立。
