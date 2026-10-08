# c7a4d65 远程 CI 整改报告

日期：2026-10-08。远程失败源码：`c7a4d6531359b8d82e86a3d22758bbbb1af0de4c`。本轮只修复 CI 测试执行隔离与版本契约，未修改生产审批逻辑、依赖锁、工作流安全检查或数据库。

## 1. 失败与根因

同一完整 SHA 共9个工作流完成，7成功、2失败；原始运行清单和失败日志存于[证据目录](./evidence/ci-fix-c7a4d65-20261008/remote-runs.json)。

| 工作流 | 失败表现 | 已确认根因与修复 |
|---|---|---|
| [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/37752814417) | `make f05-check` 中 `actual_identity_time_quality_and_purpose_are_required` 在 `approval_reference` 断言失败；下游签名/下载任务无法完成 | 前序 R02 行为破坏测试使用临时源码副本，却把 Cargo 产物写入真实工作区 `target/`。最后一个移除 approval_reference 检查的变体污染后续编译缓存，较新的变体产物可被原源码复用。修复为副本内独立 `target/`，随副本清理；六种变体仍须由真实行为测试发现，结束后额外运行真实工作区全部 storage 单元测试。 |
| [Frontend Baseline](https://github.com/SumAlphaAI/QuantOS/actions/runs/37752814419) | PRE-03 smoke 对根 ESLint 插件、terminal/website Next 报版本不符 | 依赖已固定15.5.27，PRE-03及运行栈ADR仍写15.5.24。同步三处固定版本及ADR；新增两个应用拒绝15.5.24的回归，并更新ADR漂移探针，保留精确版本、manifest/lock/ADR、导出产物与浏览器检查。 |

本地首先复现了相同 `approval_reference` 失败；清理 quantos-storage 编译缓存后，不改变生产源码即可使该测试通过。随后按CI顺序复跑修复后的R02和F05检查，以验证跨测试缓存污染已消除。缓存清理仅涉及Rust产物，不是数据库操作。

## 2. 验证结果

- `make r02-check`：PASS，包含来源与快照单元测试、策略/runtime测试、六种真实行为破坏检测，以及破坏测试后的真实workspace回归。最终摘要明确 `isolatedCargoTarget=true`、`workspaceAfterMutations=PASS`、`liveDatabase=false`。
- PRE-03负向：29/29 PASS，包含两应用拒绝旧Next版本、ADR/manifest/lock漂移、缺失资源、伪造HTML和脚本异常。
- 官网与Terminal：两次构建PASS；`pnpm check:pre03:web` PASS，两个路由均验证资源与浏览器实际渲染。
- `make f05-check`：PASS，7项Node负向、10项event与21项storage单元测试及既有覆盖命令通过；审批引用篡改仍被生产逻辑拒绝。
- 联合计划检查PASS、38/38负向PASS；阶段记录22/22回归及七个组件disposition入口PASS（均NOT_ASSESSED、admitted=false），没有通过组件CI重新授予准入。
- 两应用既有构建预算检查PASS，未修改预算；全部19组本地验证见[本轮验证台账](./evidence/ci-fix-c7a4d65-20261008/validation-results.json)。

首次本地PRE-03及补充预算检查未注入公开环境样例而失败，原失败保留；按现有 `env/local-mock.env.example` 复跑通过。文档链接尚未落盘时的本地计划检查失败也保留，报告落盘后重跑通过。本文各项不计作新Supabase、Linux目标部署、完整开发闭包或新提交远程CI验收。

## 3. 阶段回执与风险

`scripts/` 是现有receipt policy的共同内容输入。修复后逐一检查原14份READY manifest，全部被原严格校验以 `source/contract/config/test inventory or content changed` 拒绝，详见[失效台账](./evidence/ci-fix-c7a4d65-20261008/stale-receipts.json)。本轮未完整重跑57项闭包，故当前14节点改为NOT_ASSESSED，联合计划合计159节点NOT_ASSESSED；不重算旧摘要、不重标旧源码、不放宽内容Gate。

冻结5547211的57/57历史执行、14份manifest、全部失败轮及Supabase事实原件完整保留。历史开发控制27/27不代表当前C01已重新准入；当前C01待内容复评。功能开发COMPLETED与历史正式记录保留。原B01/FA-H01 OPEN/PARTIAL、C25/C26部署/性能发布移交、原1800秒/两标的/内部用途授权均不扩展。本轮没有实际数据库连接、迁移、删除或重建。

## 4. 后续验收

推送修复提交后，以该完整SHA检查两个失败工作流及全部同SHA必需检查；本地成功不记作远程成功。需要当前R02严格准入时，在冻结修复源码和有效用途/具名actor下执行新的完整评估目录，再依据真实结果登记阶段记录。旧用户确认文稿未获确认，且内容摘要已失效，不能用于批准当前源码。发布评估仍在Beta阶段独立执行。
