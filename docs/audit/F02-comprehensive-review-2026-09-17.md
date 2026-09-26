# F02 CI、制品与供应链门禁复审报告

> 更新：2026-09-26。主线基线：`ac73a95a758cc95385b69e9d6f9376cef4a2af0b`。
> 结论：**F02-A11 的 required checks 实际阻断/恢复证据缺口已关闭；F02 整体仍为 IMPLEMENTED_PENDING_ACCEPTANCE / FIX_VALIDATION。** 当前主线三次可重复构建失败，因此 A11 整体保持 OPEN，不能据分支保护通过宣告全量验收。
> 原始问题与历史失败保持可追溯：[本次更新前报告](./F02-review-before-A11-closeout-2026-09-26.md)、[原整改记录](./F02-remediation-2026-09-17.md)。

## 一、任务完成概况

本次完成有效分支保护配置、失败合并实证、恢复后隔离合并实证，并修复 Playwright PR 元数据采集截断 Git 历史导致 Secret scan 误定位的问题。详细拓扑、提交与运行编号见 [分支保护验收报告](./F02-A11-branch-protection-2026-09-26.md)。

规则集 23727075 对 main 启用 8 项 GitHub Actions 来源检查、strict 模式、禁止删除/强推及零 bypass；故障 PR 实际收到 HTTP 405，恢复后实际合并到同规则保护的隔离目标。验收后已移除临时目标 scope，main 保护持续生效。未升级套餐。

main 的正式 CI、签名、独立下载验签、SCA、许可证与隔离数据库检查已成功；当前主线 required checks 为 **7/8 成功**，独立 `acceptance (reproducibility)` 失败。源码、PR 恢复检查和主线运行各自绑定完整 SHA，不互相替代。

| 等级 | 原问题数 | 已关闭 | 仍开放 |
|---|---:|---:|---:|
| 阻塞级 | 0 | 0 | 0 |
| 高危 | 6 | 6 | 0 |
| 中危 | 6 | 5 | 1（A11 剩余完整主线验收） |
| 低危 | 0 | 0 | 0 |
| 合计 | 12 | 11 | 1 |

原问题关闭率仍为 **11/12（91.7%）**；required checks 子缺口已经关闭，不再列为待配置或缺阻断回执。

## 二、完成情况明细统计

### 2.1 原已关闭项索引

以下索引保留 2026-09-20 的验证范围。当前主线新远程回执另见第 2.2 节，不把历史本地运行改写为本次运行。

这里只保留关闭索引及证据，不再列作待整改问题。

| ID | 等级 | 复核结果 | 当前实现与验证依据 |
|---|---|---|---|
| A01 | 高危 | CLOSED | Gitleaks默认规则已加载、固定8.28.0且下载校验；历史真实扫描器正反对照通过。配置/入口未变化；本轮缺少该二进制，未重跑通过 |
| A02 | 高危 | CLOSED | RLS逐迁移跟踪ENABLE/FORCE/policy最终状态；本轮删policy、索引冒充policy、disable/no-force拒绝及恢复通过 |
| A03 | 高危 | CLOSED | PR/main必跑PostgreSQL17.10服务与独立双库测试，不依赖生产Secret；历史真实数据库重建、身份隔离通过，脚本/迁移未变 |
| A04 | 高危 | CLOSED | ledger SQL SHA、真实catalog比对、同库别名拒绝；历史列/索引/RLS/checksum变异与恢复回执有效，核心代码未变 |
| A05 | 高危 | CLOSED（实现） | 完整Rust/wheels/Web制品、SBOM及双向清单哈希绑定；本轮错误SHA、篡改、缺失、多余和Web原生文件拒绝通过。主干正式下载验签归A11 |
| A06 | 高危 | CLOSED | Next15.5.24、sharp0.35.4及其他已确认漏洞升级保留；本轮npm阻断级告警0、Python漏洞0；Rust固定版本复扫未运行，历史同锁扫描通过 |
| A07 | 中危 | CLOSED | Node全锁图、Python全部激活依赖组、SPDX逻辑与未知许可拒绝、精确版本有条件准入均保留；许可策略负向测试通过，历史全量许可回执有效 |
| A08 | 中危 | CLOSED | PR base/push before作为不同于HEAD的基线；本轮真实Buf删除字段拒绝、恢复通过、HEAD自比较拒绝 |
| A09 | 中危 | CLOSED | 三生态统一消费精确生态/包/版本/漏洞/期限的豁免；本轮匹配、过期/无效日期、错误版本和扫描器故障拒绝通过 |
| A10 | 中危 | CLOSED | 正向对照、原因断言、恢复验证已接入真实门禁；本轮工具缺失明确失败，未被误认作合成secret已拒绝；数据库与Gitleaks历史真实测试保留 |
| A12 | 中危 | CLOSED | npm不再prod-only，Python导出all-groups，Rust未排除dev；本轮npm/Python全范围扫描通过，范围代码与历史版相同 |

### 2.2 验收检查点

沿用原 24 个检查点：**23/24（95.8%）具备各自范围的实现/验证证据**，C24 尚未完成。这不是新提交 24/24 全量验收结论。

| 检查点 | 状态 | 证据范围 |
|---|---|---|
| C01–C05、C07–C17、C19–C22 | PASS（既有已归档范围） | 原实现证据保留；当前 main CI 另有完整扫描、DB、覆盖率与负向门禁成功回执 |
| C06 完整兼容/视觉 | PASS | ac73a95 主 CI 与三浏览器检查成功，未跳过视觉比较或放宽阈值 |
| C18 主干实际交付及正式签名 | PASS | ac73a95 CI 36240334477；正式下载回执 downloadVerified/formalSignatureVerified 均 true |
| C23 真实 CI 故意破坏与恢复 | PASS | PR #3，真实失败检查、HTTP 405/rule suite fail；固定恢复 SHA 的 8 项检查成功及实际隔离合并/rule suite pass |
| C24 当前 SHA 全部远程验收 | PARTIAL | ac73a95 的独立三次构建失败，当前主线 7/8；不得用恢复 PR 的另一个 SHA 替代 |

原始回执及 SHA-256 清单见 [本次证据目录](./evidence/F02-A11-2026-09-26/README.md)。本地 F02 回归 15/15 通过，包括真实 Playwright/Git 历史保全正反对照；这不替代远程验收。

## 三、当前问题清单及风险分析

本轮补充：[可重复构建诊断及留存修复](./F02-A11-reproducibility-diagnosis-2026-09-26.md)。原 SHA 六次 Linux Web 构建未复现；正式 Gate 已增加原始字节留存、摘要核验与 4 项故障回归。构建漂移根因仍未确认，以下状态不变。

活动问题仅 **A11 / 中危 / OPEN（剩余完整主线验收）**：

| 模块 | 具体表现 | 影响范围 |
|---|---|---|
| F01/F02 Terminal 可重复构建 | ac73a95 的 F01 run 36240334483：第 1 次构建与第 2/3 次 Terminal JS chunk、HTML/RSC 摘要不同；Rust、Python及其他工作区一致 | 当前 main 的 acceptance (reproducibility) 为 failure；F02 不得整体 ACCEPTED |

已关闭子缺口：正式主线签名/下载验签、有效 required checks 配置及真实阻断/恢复。已修复 Playwright 对完整 Git 历史的破坏，未扩大密钥扫描豁免。

既有风险口径保持：Node 中危告警不属于 high/critical 阻断阈值；WebKit 不等于真实 Safari；专用 PostgreSQL 不代表托管 Supabase 验收。历史独立签名成功及新 PR 的检查结果均仅适用于各自记录 SHA。

## 四、整改建议

1. 保留当前 main 的全部 required checks 和零 bypass；通过 PR 合入本次 Playwright 修复及回归。
2. 对 Terminal 构建差异保留每轮实际 chunk 内容并定位根因；不得只比较文件名、排除差异文件、降低重复次数或反复重跑掩盖问题。
3. 修复合入后，固定新的完整 main SHA，取得全部 8 项检查及正式下载验签成功回执，再关闭 A11 整体并将 F02 标记 ACCEPTED。
