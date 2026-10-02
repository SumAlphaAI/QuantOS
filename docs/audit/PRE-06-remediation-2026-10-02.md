# PRE-06 整改验收记录

> 日期：2026-10-02；结论：仓库工程整改通过；初审基线：`cb729db7497b25b0e6e1a6a02a4699287ae8172e`。
> 验证对象：初审提交加本次修复，独立Git导出副本、冻结依赖与公开CI mock配置；最终源码SHA-256见[证据清单](./evidence/pre06-remediation-20261002/manifest.json)。提交自身SHA在Git记录中查询，不用初审SHA冒充修复提交。

## 一、任务完成概况

初审2高危、6中危、1低危共9项已全部关闭，剩余0项。20项工程控制点全部PASS，实际完成率 **20/20=100%**，PARTIAL和FAIL均0。[初审历史](./PRE-06-comprehensive-review-history-2026-10-02.md)及其原证据保持原字节，保留50%历史结论。

验收范围为仓库工程门禁与macOS本地Web mock重放。Linux已验证12张基线完整，当前Linux浏览器执行、远端CI/上传回执、正式G0与指定模型复审、风险/QA/设计owner签署、真实staging/provider/BFF/IdP/Sentry/账号、数据库、全业务及Desktop/native均为 **NOT RUN / NO RECEIPT**。本轮没有数据库操作。

## 二、完成情况明细统计

| 验证 | 最终结果 |
|---|---|
| 独立重放 | 28项主检查退出0，包括PRE04/PRE05联动、lint/typecheck、生成/计划检查、两应用构建与性能、六组浏览器 |
| 单元/契约/门禁 | 单元187项/25文件；contract17项；PRE06负向15项；sabotage4种破坏；九个新增/修改mjs文件补充lint零错误 |
| fixture集合 | 10JSON：6契约正向、2预期负向、2隔离inventory；PRE04规划数据有独立schema且不作为发布响应 |
| 覆盖率 | 全局行覆盖率 **81.27%**；关键五文件111/111行、126/126语句、27/27函数、98/98分支，各文件四维100%。独立关键运行106项/18文件；未测分支注入使门禁exit1 |
| 浏览器 | macOS官网54项、Terminal81项，合计135/135；失败、跳过、flaky均0；retries0、update-snapshots=none |
| 视觉 | 原17张不变，新增macOS7张；Linux/macOS各12张完整；工程人工核对后独立重放，不将更新模式视为验收PASS |
| 性能 | 两应用共享139.4KB、最大chunk58.5KB；Terminal CSS10.7KB、官网4.4KB；逐路由≤200KB，最大Terminal167.1KB/官网141.7KB |
| 原误放行探针 | 14项独立拒绝探针零误放行；11项实际文件/配置破坏全部exit1 |
| 补充实际负向 | 两应用路由超预算/旧构建回执4项、真实像素差异1项、关键未测分支1项全部exit1；真实trace及图片留存 |

命令和统计见[commands.json](./evidence/pre06-remediation-20261002/commands.json)、[coverage-summary.json](./evidence/pre06-remediation-20261002/coverage-summary.json)、[critical-coverage-summary.json](./evidence/pre06-remediation-20261002/critical-coverage-summary.json)、[mutations.json](./evidence/pre06-remediation-20261002/mutations.json)、[probes.json](./evidence/pre06-remediation-20261002/probes.json)、[supplement.json](./evidence/pre06-remediation-20261002/supplement.json)、[critical-branch-negative.json](./evidence/pre06-remediation-20261002/critical-branch-negative.json)、[script-lint.json](./evidence/pre06-remediation-20261002/script-lint.json)。当前最终文件为权威结果；attempt-1/2/3与visual-prepare-attempt-1、mutation-attempt-1保留修复过程中的失败，不能替代最终验收。缺图生成命令按Playwright行为退出1，只用于生成候选图；最终六组禁止更新重放全部退出0。

## 三、问题关闭及风险分析

| 编号 | 原优先级 | 模块 | 修复结果 | 状态 | 证据 |
|---|---|---|---|---|---|
| H-01 | 高危 | 字段安全扫描 | 统一字段分隔符与大小写；冻结字典别名、嵌套对象/数组及有效公开字段回归。 | CLOSED | [contract.log](./evidence/pre06-remediation-20261002/contract.log)、[probes.json](./evidence/pre06-remediation-20261002/probes.json) |
| H-02 | 高危 | 执行结构与断言 | YAML实际步骤、条件、顺序和TS AST断言受检；契约、浏览器和独立sabotage入口先验结构。 | CLOSED | [pre06-negative.log](./evidence/pre06-remediation-20261002/pre06-negative.log)、[mutations.json](./evidence/pre06-remediation-20261002/mutations.json)、[removed-visual-assertions-sabotage.log](./evidence/pre06-remediation-20261002/removed-visual-assertions-sabotage.log) |
| M-01 | 中危 | fixture与MSW | 全量10项清单，6契约正向/2负向/2inventory-only；独立PRE04 schema且禁止MSW加载；修复StrategyDraft缺files。 | CLOSED | [contract.log](./evidence/pre06-remediation-20261002/contract.log)、[unused-fixture-contract.log](./evidence/pre06-remediation-20261002/unused-fixture-contract.log) |
| M-02 | 中危 | 性能预算 | 两应用CI检查真实资源、路由及源码/配置/构建回执；每路由200KB，与共享250/chunk200/CSS60KB共同阻断。 | CLOSED | [perf-terminal.log](./evidence/pre06-remediation-20261002/perf-terminal.log)、[perf-website.log](./evidence/pre06-remediation-20261002/perf-website.log)、[supplement.json](./evidence/pre06-remediation-20261002/supplement.json)、[pre06-negative.log](./evidence/pre06-remediation-20261002/pre06-negative.log) |
| M-03 | 中危 | 重试政策 | 两配置CI启用failOnFlakyTests；两实际配置一失败一重试通过仍exit1并记录flaky。 | CLOSED | [terminal-flaky.json](./evidence/pre06-remediation-20261002/terminal-flaky.json)、[website-flaky.json](./evidence/pre06-remediation-20261002/website-flaky.json)、[mutations.json](./evidence/pre06-remediation-20261002/mutations.json) |
| M-04 | 中危 | 视觉矩阵 | 支持Linux/macOS×三浏览器；补齐7张macOS图，24图完整性与人工工程像素核对后独立禁止更新重放。 | CLOSED | [visual-darwin.log](./evidence/pre06-remediation-20261002/visual-darwin.log)、[visual-linux.log](./evidence/pre06-remediation-20261002/visual-linux.log)、[visual-comparison.png](./evidence/pre06-remediation-20261002/visual-comparison.png)、[terminal-firefox.json](./evidence/pre06-remediation-20261002/terminal-firefox.json)、[terminal-webkit.json](./evidence/pre06-remediation-20261002/terminal-webkit.json) |
| M-05 | 中危 | 关键覆盖率 | 固定5个当前风险政策文件，包括TSX；逐文件行/语句/函数/分支100%；补齐真实分支用例。 | CLOSED | [critical-coverage-summary.json](./evidence/pre06-remediation-20261002/critical-coverage-summary.json)、[critical-branch-negative.log](./evidence/pre06-remediation-20261002/critical-branch-negative.log)、[web-coverage.log](./evidence/pre06-remediation-20261002/web-coverage.log) |
| M-06 | 中危 | 文档与执行身份 | 总结、执行计划与当前清单/指标/执行身份同步；初审和历史验收独立保存。 | CLOSED | [manifest.json](./evidence/pre06-remediation-20261002/manifest.json)、[task-matrix.json](./evidence/pre06-remediation-20261002/task-matrix.json)、[plans.log](./evidence/pre06-remediation-20261002/plans.log) |
| L-01 | 低危 | 失败附件归档 | 两workflow always上传artifacts/browser并保留14天；分应用报告/附件目录；本地真实像素失败trace与diff归档。 | CLOSED | [pre06-negative.log](./evidence/pre06-remediation-20261002/pre06-negative.log)、[visual-runtime-negative-artifacts](./evidence/pre06-remediation-20261002/visual-runtime-negative-artifacts)、[visual-runtime-negative.json](./evidence/pre06-remediation-20261002/visual-runtime-negative.json) |

敏感字段修复证明检测可靠性，没有真实泄露事件。AST/YAML结构验证与真实破坏探针共同保护当前关键断言，不能证明任意未来逻辑或恶意篡改均被识别。5个文件和路由200KB是当前工程清单与初始预算，新增关键业务必须扩充，不以当前100%推断未来全量业务覆盖。

两CI已配置报告与附件上传；本轮只验证接线及本地实际失败产物，未声称远端上传发生。新增视觉已完成工程像素核对，未冒充指定设计owner签字。

## 四、后续维护

本次9项无需继续整改。新增fixture须同步清单/schema/预期结果，禁止inventory进入MSW；新增关键政策须扩充冻结清单及逐文件100%门禁；新增OS/浏览器须补齐平台图并另行禁止更新重放。保留全局80%与独立关键100%双门槛、flaky失败及always附件归档。

正式目标验收按执行计划另取Linux/远端CI/G0等独立回执。当前工程完成状态与这些边界同时成立，不用历史或本地结果替代目标证据。
