# TP01-E 定时监测与同步 Gate

> 2026-10-08：8408122 的远程六场景/23 回归、真实人工严格阻断及失败后原件上传/下载已验证。自然 event=schedule 的实时运行尚无回执，候选仍未批准。详见[远程验证报告](../audit/TP01-E-remote-verification-2026-10-08.md)。

`TP01 Vibe Sync Gate` 保留两种执行语义。每天的 `schedule` 用 `--monitor-only` 采集并评估候选；人工 `workflow_dispatch` 用 `--fail-on-block` 检查候选同步准入。两种运行均先执行六个模拟场景及 CLI 回归。

| 指标 | 含义与处理 |
|---|---|
| workflow success | 监测/模拟执行完成且证据上传成功；不能据此认定候选已批准。 |
| monitoringStatus=COMPLETED | 候选评估完成；采集失败、输入无效、评估失败仍返回非零。 |
| syncGateStatus=BLOCKED | 存在阻断候选；查看 blockedCandidateCount、逐项 decisions/reasons/requiredActions。 |
| syncGateStatus=CLEAR | 当前分类未发现阻断；仍需计划中的复审与授权，不直接执行同步。 |
| syncApproved=false | 此工具只生成评估及决策草稿，没有批准或采用候选。 |

定时监测发现阻断时输出 GitHub warning，job summary 显示 `BLOCKED`、候选 ref 与原因。运行完成后下载 `tp01-vibe-sync-live` artifact，保存 upstream-candidates 原报告、live-summary、live-decisions 与 live-issues。即使严格 Gate 退出 2，摘要与上传仍通过 `always()` 执行；证据上传失败继续记任务失败。采集或评估异常可能没有完整决策，保留已生成的原报告和失败日志，不补造成功回执。

手动运行该 workflow 仍执行严格 Gate：存在 S0/S1 等阻断候选时退出 2。CLI 同样保留 `--fail-on-block`；`--monitor-only` 仅接受 candidate-report，不能同时使用 fail-on-block、scenario 或 verify-expected。默认不带这些标志的 CLI 为 report 模式，只出报告。

2026-10-08 的真实监测仍有 `v0.1.16@e1dbea8ad3077569ff86f86ee5cb9b7c5e068ebb` 的依赖摘要差异。按 requiredActions 进行依赖兼容性、LICENSE/NOTICE 及契约/回放/权限负向复审后，再另行形成候选采用决策；此次修复未批准升级。锁定版本仍为 v0.1.13。详见[专项整改报告](../audit/TP01-E-scheduled-remediation-2026-10-08.md)。
