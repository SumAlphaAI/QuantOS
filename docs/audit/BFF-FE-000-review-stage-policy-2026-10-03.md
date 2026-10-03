# BFF-FE-000：staging 验收阶段调整

> 日期：2026-10-03；前端执行计划 v3.16；依据：用户明确要求将 B-01 中真实 staging 验收移到最后评审阶段。
> 工程基线：`6587853dc800401f4c9273ae4883b1c475edc1b9`，已关闭 13 项工程问题。
> 当前结论：**开发交付已完成；B-01 staging 为 DEFERRED_TO_FINAL_REVIEW，不阻塞开发完成或 REVIEW_READY。正式目标验收与联合签署仍待最后评审。**

## 一、调整原因与范围

A1/BFF-FE-000 交付版本化契约、生成物、全页命名、同源 mock 和校验 harness。把尚不具备的真实 staging 当作当前代码开发缺陷，会混淆开发完成与最后验收，并使后续 provider 尚未完成时提前要求完整目标验证。

本次仅调整 B-01 的 staging 执行时机和开发报告口径：最后评审定义为代码与对应 provider 实现完成后、`RE_REVIEW → ACCEPTED` 前。不是删除真实环境要求，也不是将本地参考模式计为 staging。A2–A6、各页面 Integrated/Done、发布条件及 P0/F06 的独立回执规则保持原要求。

[全面复审](./BFF-FE-000-comprehensive-review-2026-10-03.md)、[整改复验](./BFF-FE-000-remediation-validation-2026-10-03.md)和对应 manifest/log 保留原始内容。其 B-01“当前开发阻塞”与完成率口径由本记录更新；历史代码缺陷、测试结果和未执行真实环境的事实不变。

## 二、阶段要求与统计口径

| 阶段 | 必须完成 | staging/签署状态 | 放行含义 |
|---|---|---|---|
| DEVELOPMENT / FIX_VALIDATION | OpenAPI、生成漂移、兼容性、schema、安全负向、单元/契约、本地参考 provider/harness、文档与 CI 接线 | staging：DEFERRED_TO_FINAL_REVIEW；签署：PENDING_FINAL_REVIEW | 可完成工程开发与进入 REVIEW_READY；不授予正式 ACCEPTED |
| REVIEW_READY / IN_REVIEW / RE_REVIEW 工程复核 | 审查代码与本地验证证据、处理工程缺陷 | 准备最终目标环境；缺 staging 不记为代码缺陷 | 完成工程复核后进入最后验收步骤 |
| 最后评审，RE_REVIEW → ACCEPTED 前 | 固定完整源码 SHA，真实 staging 七类检查、证据哈希、当期联合签署 | 必须真实通过；缺失则 NOT_ACCEPTED | 才能关闭 PROVIDER:A1 / 正式 G0 的相应条件 |

当前代码开发任务保持 `development_status=COMPLETED`，已有 13/13 工程问题关闭，工程整改率为 100%。B-01 的 staging 子项从“开发阻塞”改为“最后评审待办”，不进入当前代码完成率分母；不把它改成 CLOSED/PASS，也不据此将全部 14 项正式验收声明为完成。签署同样仍是正式评审条件。

历史 C24 在开发阶段为 `NOT_APPLICABLE_AT_DEVELOPMENT / DEFERRED_TO_FINAL_REVIEW`，最后评审恢复为必须检查。C01 包含的当前 P0 同 SHA 准入另行验证；本次没有重新执行或宣称其通过。工程完成率、依赖准入和正式验收率分别报告，避免继续用“未 staging”得出“代码任务 0%”的结论。

## 三、执行入口与门禁

[机器策略](../../bff/a1-review-policy.json)明确 staging/signatures 的必需阶段和正式检查点；[前端计划](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md#task-bff-fe-000)、[交付总结](../BFF-FE-000-summary.md)与[回执规程](../BFF-FE-000-openapi-proposal.md#验收回执)同步。

- `pnpm check:bff-a1-development`：执行工程基线语义检查；输出 `PASS` 仅针对 engineering baseline，同时输出 `formalAccepted=false`、`stagingStatus=DEFERRED_TO_FINAL_REVIEW`。不读取目标会话或要求 staging 回执；代码/契约退化仍失败。
- `make bff-contract-check` 与开发 CI：使用上述开发入口并继续执行兼容、生成、契约和安全回归，不调用真实 staging 验收。
- `pnpm check:bff-a1-final-review`：最后评审显式执行，保留完整 SHA、真实 HTTPS staging、七类日志、哈希与七角色组织回执的严格校验。缺资料为 NOT_ACCEPTED，不得静默回退开发模式。
- 旧 `pnpm check:bff-a1-acceptance`：保留严格最后评审行为，兼容历史规程；不作为当前开发完成检查。

检查点 JSON 的 `review_status=NOT_STARTED`、`source_commit=null`、`evidence=[]` 未改成已验收；依赖图仍表示正式验收顺序。本次只解除 B-01 staging 对 A1 代码开发和 REVIEW_READY 的提前阻塞，不篡改其他核心/阶段依赖。

## 四、复验与后续

本次针对阶段切换执行检查：缺 staging 时开发入口成功且 formalAccepted=false；同一状态的最后评审入口拒绝；工程缺陷、未知阶段、非法策略和将 final-review 命令改接 development 均失败；已有合法/伪造/篡改回执测试继续保留。执行输出与文件哈希见 [证据清单](./evidence/bff-fe-000-review-stage-20261003/manifest.json)。验证不启动数据库、不调用真实 staging、不代签。

本次 10 项执行检查中，7 项工程/治理检查通过，3 项（最后评审、旧严格入口、非法阶段）按预期拒绝；17/17 阶段/语义/兼容/回执测试、16/16 定向契约与 SSE 测试，以及原 A1/A2 门禁回归均通过。

最后评审就绪后按原回执规程执行真实环境验证和组织确认，再更新正式检查点。期间继续按代码与对应服务依赖完成开发；staging 待办保持可追踪，不再登记为当前代码开发缺陷。
