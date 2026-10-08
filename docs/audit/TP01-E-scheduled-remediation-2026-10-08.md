# TP01-E 额外定时阻断整改报告

日期：2026-10-08。起点：`92b0b18`（本轮先提交的工作区验收文档）。承接[41a3b27 CI 验收](./CI-41a3b27-acceptance-2026-10-08.md)。本报告是当前修复源码的本地工程验证及真实公开上游读取，未推送或执行新 SHA 的 GitHub workflow；历史远程 PASS 不迁移。

## 1. 任务完成概况

**定时任务的执行语义及失败证据缺口已修复；上游候选同步阻断仍保留。** 定时任务完成候选监测后可成功结束，同时明确呈现 `syncGateStatus=BLOCKED`；人工同步 Gate 仍以 `--fail-on-block` 返回 2，没有把监测成功写成供应链批准。

修复前：[37765837510](https://github.com/SumAlphaAI/QuantOS/actions/runs/37765837510) 六模拟成功，live 候选评估以需人工决策退出 2，后续摘要/上传被跳过。该失败及缺失原件的事实继续保留，新生成的决策不冒充旧运行的决策。

## 2. 完成情况与验证明细

| 控制点 | 结果与证据 |
|---|---|
| 定时监测与严格同步区分 | schedule 仅调用显式 `--monitor-only`；workflow_dispatch 继续使用 `--fail-on-block`，未添加 continue-on-error。summary 独立记录 executionMode、monitoringStatus、syncGateStatus、blockedCandidateCount、syncApproved=false。 |
| 失败时保留原始证据 | live summary、simulation/live upload 使用 always()；live artifact 同时包含 upstream-candidates.json/.md 和评估、决策、issue 草稿；if-no-files-found=error 保留。 |
| 异常仍失败 | 输入 schema、候选列表、基线、严重性、不可变 ref 和 release 四项摘要检查；无效报告/JSON 与冲突标志返回非零；上游读取错误仍直接失败。 |
| 高危分级保留 | 原 S0/S1 分类与 API/许可/CVE/冲突负向检查保留；上游 S0 信号不会因缺少 scenario 细节而降级。 |
| 自动化回归 | [23/23 测试](./evidence/tp01-e-scheduled-remediation-20261008/sync-tests.log)通过，含实际工作流 shell 的 schedule=0 / workflow_dispatch=2、summary 发布、异常输入与原六场景；测试只使用 Node 内置模块，适配未安装 pnpm 依赖的定时 runner。 |
| 六场景实际 CLI | API break、license change、CVE、patch conflict 均正确 BLOCKED；planned sync/research drift 为 CLEAR；verify-expected 全部成功。完整[执行清单](./evidence/tp01-e-scheduled-remediation-20261008/evaluations.json)与各场景原件归档。 |
| 真实公开上游读取 | [原报告](./evidence/tp01-e-scheduled-remediation-20261008/live/upstream-candidates.json)于 2026-10-08T11:46:14.493Z 生成；锁定 v0.1.13，发现 main 推进与 v0.1.16，两候选；release LICENSE/NOTICE 摘要未变，requirements/pyproject 摘要变化。 |
| 真实候选双模式 | 同一真实报告：[monitor](./evidence/tp01-e-scheduled-remediation-20261008/live-monitor/summary.json)退出 0、warning、1 个 BLOCKED；[gate](./evidence/tp01-e-scheduled-remediation-20261008/live-gate/summary.json)退出 2、1 个 BLOCKED；均生成两份决策/issue，syncApproved=false。 |
| 相邻边界回归 | 上游只读/受控 fork 正负向检查及 canary/rollback 4/4 回归通过；fork 仍 pending-auth，未宣称远程 fork 配置通过。计划结构/负向检查另归档。 |

上游 baseline、只读源码、patch queue 及既有失败/签署/证据原件保持字节不变。此次未连接数据库、启动行情服务、运行新的 provider 窗口或触发远程部署。

## 3. 问题清单及风险分析

| 问题 | 处理结论 | 剩余风险 |
|---|---|---|
| 定时监测将待复审候选混为执行失败 | FIXED / 本地验证通过 | 新 commit 的远程 schedule 结果待推送后观察。定时 success 只证明监测完成，不能只看 workflow 颜色判断同步准入。 |
| 阻断后摘要与 live artifact 被跳过 | FIXED / shell 与配置验证通过 | 本机不能证明 GitHub artifact 传输；远程验证须确认失败 Gate 也可下载决策及原报告。 |
| 不完整报告可能当作无候选；上游严重性可能丢失 | FIXED / 负向验证通过 | 监测不能替代候选的完整安全、兼容性及许可证审查。 |
| v0.1.16 依赖漂移需人工决策 | OPEN / 候选仍 BLOCKED | 不自动吸收、改 lock 或补写许可批准。现有摘要不能证明存在 CVE，也不是全面许可合规结论。 |

当前计划仍 159 节点 NOT_ASSESSED；本次局部修复不恢复旧 READY，不授予 R02 或 TP01-SERVICE 阶段准入、正式 ACCEPTED 或发布许可。R01 B01/FA-H01、1800 秒原范围及 C25/C26 Beta 移交保持原结论。

开发验证最初的工作流测试 fixture 使用 symlink，导致 import.meta 指向仓库而非临时目录，出现 21 PASS/2 FAIL；已改为复制两份入口源码至 fixture 后重跑为 23/23。该问题属于测试隔离设置，未据此放宽业务断言。

## 4. 整改建议与后续执行

本次修复与前置文档归档分成两个提交。推送修复后，以修复完整 SHA 核验六模拟、定时监测与 artifact 上传；手动 dispatch 对当前待复审候选预期仍阻断，需确认失败时上传成功。按[运行规程](../runbooks/tp01_vibe_sync_monitoring.md)分别检查任务执行状态和候选准入状态。

候选采用是后续独立工作：获取 immutable ref 的实际依赖/许可证差异，执行契约、回放、权限与供应链检查，再按项目用户统一确认规程形成受控采用决策。此次不将“定时任务消除误报”扩大为批准升级，不修改历史失败或同步门禁。
