# TP01-D 选择性吸收与最小 patch 队列

日期：2026-10-09。范围为 R1 DEVELOPMENT；依据开发计划 TP01-D、TP01-C/R02/F0 依赖及既有 inventory/ADR。正式用户确认、部署、发布与候选同 SHA hosted CI 分别待验。

## 当前结论

**TP01-D DEVELOPMENT READY。** 冻结源码 `6a393eb081d1d9629a1ca1ff451ac1e25c15fede` 完成16节点/62唯一命令组的实际功能复评与全部严格内容校验；当前16 READY、143 NOT_ASSESSED、0 BLOCKED。TP01-C/F08/F0与R01/R02已在新源码上重新准入。源码提交后仅更新生命周期文档/证据；正式ACCEPTED、候选同SHA hosted CI、INTEGRATION/RELEASE与R1-SERVICE整体Gate未授予。

## 实现与问题闭合

| 项目 | 实现及验证要求 |
|---|---|
| 设计范围 | 只保留已批准 workflow_decomposition / streaming_phase_projection；不迁移上游 session、账户或权限模型 |
| 最小 queue | 两项 adapter-side-equivalent-rewrite；绑定已受控 v0.1.13 SHA c33133f4fd5e978d21d2a61fdd8787fb352b4687 和 model/event 文件摘要，保留 v0.1.12 起源；无上游/fork源码修改或 patch 应用 |
| 合约崩溃修复 | 原 provider 返回两阶段时 Execute 接受、StreamExecute 在 Artifact 登记后 IndexError；现先校验合约/协议/fixture/不可变设计与来源/三阶段顺序，拒绝前不登记 owner、输入或 Artifact；两个投影入口独立校验 |
| QuantOS 边界 | session→workflow_run_id、权限→Engine metadata/research allowlist、审计→QuantOS envelope、存储→Artifact facade、流式→StreamExecute |
| 审计与幂等 | tenant/workspace/actor/run/request/correlation/causation/snapshot/policy 关联完整；同执行 key 改 request/correlation/causation 拒绝 ALREADY_EXISTS，保护 Artifact 审计身份 |
| 20 个回放 | 每项 Execute 两次、StreamExecute 两次；输出、流序列、最终 Artifact 引用与读回稳定，无上游 session/event/cursor/auth_ticket 泄漏 |
| 拒绝与边界 | 18 类坏合约经双 RPC 拒绝；两个投影直接拒绝、源码导入边界、三类审计身份冲突，共新增44 Python用例 |
| 移除 adapter | Python 子进程 import hook 强制 vibe_adapter 不可导入并实际探测；Runtime→reviewed Manager→UDS→RD-Agent 仍连续完成10次研究及≤2s取消。现有独立 Manager 测试另验缺少 adapter 路由 |
| 严格准入 | standalone engineering 验证返回 NOT_ASSESSED；统一 manifest 绑定源文件、命令、日志、依赖、实际目标与进程收尾，严格通过后才 --admit |

## 执行与证据

前置刷新和本轮新源码复评分别记账。原始失败保留，任何独立完整补测均注明原失败、同源证明与组合来源；不修改自动重试策略。

- 完整新源码执行命令：`GITLEAKS_BIN="$PWD/artifacts/tools/gitleaks" node scripts/provider-a1-receipts.mjs --assess-tp01-d docs/audit/evidence/provider-a1-remediation-20261004/tp01-d-admission-20261009/attempt-01`（Node 24.12.0 / pnpm 10.20.0）；62/62 PASS，无额外重试。
- 前置刷新：[报告](./TP01-D-prerequisite-admission-2026-10-09.md)。
- 畸形合约修复前探测：[原始日志](./evidence/tp01-d-20261009/preflight-contract.log)。
- TP01-D组件：[receipt](./evidence/tp01-d-20261009/receipt.json)。
- 组件验收：`node engines/vibe-adapter/check-absorption.mjs --record` 四组全部通过（queue、Python44、Runtime2、格式7文件），仅授予 engineeringStatus=PASS / stageGate=NOT_ASSESSED。
- TP01-C完整回归：`node engines/vibe-adapter/check-development.mjs --record` 七组全部通过，Python307、Manager55、Ruff、格式、Python3.12类型、锁文件和计划检查；依赖尚未重新准入时 standalone stageGate=BLOCKED。
- `node --test scripts/provider-a1-receipts.test.mjs scripts/tp01-c-functional-artifacts.test.mjs scripts/tp01-d-patch-queue.test.mjs scripts/tp01-d-functional-artifacts.test.mjs`：88/88；`pnpm test:development-plans`：38/38；`cargo fmt --all -- --check`、新增Python测试Ruff均通过。
- 首次组件脚本建清单拒绝原件：[输入选择错误](./evidence/tp01-d-20261009/component-initial-input-selector-failure.log)。上游是Git link，已改为绑定完整锁定且干净的Git link，两个参考文件另外以queue摘要校验。首次Runtime命令混入数据库guard用例，严格的2-test标记拒绝；[原日志与receipt](./evidence/tp01-d-20261009/initial-component-mixed-target/verifier-failure.log)保留，修正为research_workflow_过滤后实际两项通过，不将未运行数据库检查计为PASS。
- 冻结源码：`6a393eb081d1d9629a1ca1ff451ac1e25c15fede`；[62组有效执行台账](./evidence/provider-a1-remediation-20261004/tp01-d-admission-20261009/attempt-01/execution-results.json)，[TP01-D严格manifest](./evidence/provider-a1-remediation-20261004/tp01-d-admission-20261009/attempt-01/core-tp01-d.json)，[F08](./evidence/provider-a1-remediation-20261004/tp01-d-admission-20261009/attempt-01/core-f08.json)、[F0](./evidence/provider-a1-remediation-20261004/tp01-d-admission-20261009/attempt-01/core-gate-f0.json)、[TP01-C](./evidence/provider-a1-remediation-20261004/tp01-d-admission-20261009/attempt-01/core-tp01-c.json)、[R02](./evidence/provider-a1-remediation-20261004/tp01-d-admission-20261009/attempt-01/core-r02.json)。上述相对链接基于docs/audit目录。
- 62个唯一命令组之外，既有允许的完整命令自动重试增加0次；失败尝试明细=[]，原尝试均在台账/log保留，不扩大重试条件。
- 真实目标：F01三轮独立跨语言构建摘要一致；已有开发Supabase的数据/RLS/Storage/F06/F09、F05一万事件、F07百任务恢复及覆盖、R01/R02实际目标和消费者检查通过。R02使用32条已保留事实，sourceAge=439259s、quality=degraded、engineStopped=true；不声称有新健康行情或新用途授权。
- 前后两次owned进程检查均PASS，scope=`b4ece0d4`，最终discovered=0/remaining=0；后一次位于TP01-D检查之后，覆盖新增Runtime子进程。F07调度P95=872.585ms，仅DIAGNOSTIC_ONLY，不授予发布性能PASS。
- 证据入库：通用target/忽略规则曾排除本轮R01/R02嵌套supporting文件，已按实际台账引用逐项摘要验证并显式加入Git；不修改忽略规则或加入其他构建输出。最终提交后逐Git对象复核原轮/组合/新轮全部引用字节，见[Git证据追踪](./evidence/tp01-d-20261009/git-evidence-tracking.json)。
- `node engines/vibe-adapter/check-development.mjs --admit/--ready`、`node engines/vibe-adapter/check-absorption.mjs --admit/--ready` 均严格通过；组件工程验证跳过依赖仍返回NOT_ASSESSED。最终16节点和9项篡改/缺测/正式声明/依赖负向见[严格Gate探针](./evidence/tp01-d-20261009/final-gate-probes.json)。88项聚焦检查、38项计划负向、diff空白及历史secret扫描见[最终检查日志](./evidence/tp01-d-20261009/final-checks.log)。

## 变更文件与交付

| 文件组 | 变更 |
|---|---|
| `engines/vibe-adapter/src/vibe_adapter/{protocols,workflow,streaming,context,service,audit}.py` | 统一合约校验、QuantOS审计关联、执行身份冲突拒绝 |
| `engines/tests/test_vibe_adapter_absorption.py` | 新增44个确定性回放、坏合约、投影和身份冲突/导入边界用例 |
| `crates/quantos-runtime/tests/research_orchestration.rs` | 实际禁止导入vibe_adapter，验证其他研究和取消仍工作 |
| `forks/vibe-trading/patch-queue/*`、`scripts/tp01-d-patch-queue*.mjs` | 两项受控设计、当前已锁定Git link/参考摘要/边界替换及18检查 |
| `engines/vibe-adapter/check-{development,absorption}.mjs`、`scripts/provider-a1-{receipts.mjs,policy.json}`、`scripts/tp01-{c,d}-functional-artifacts.test.mjs` | 新D严格工程/依赖准入、后置scope进程检查、支持日志及负向；C全Python回归数量只能扩展，不能降到263以下 |
| 计划、ADR、adapter README、progress tracker、audit/evidence | 当前工程状态、同步决策、原失败/原确认保留、前置和新源码完整证据 |

没有改变第三方锁定SHA、Git link、上游源码、生产配置或任何其他仓库。

暂存Git对象快照的独立secret扫描通过，见[扫描记录](./evidence/tp01-d-20261009/staged-secret-scan.json)；最终扩展快照提交前再扫描，提交后再扫描完整历史。

完整变更文件见[文件清单](./evidence/tp01-d-20261009/changed-files.txt)；10/10开发控制见[控制矩阵](./evidence/tp01-d-20261009/control-matrix.json)。

## 剩余边界

Artifact 为有租户检查的内存 mock，审计为 metadata 投影；持久化/可信引用解析、已部署 HTTP/JWT、真实工具/LLM、OS 出站隔离、代表性性能/长稳、用途许可、hosted 同 SHA CI 及正式 ACCEPTED 不由本轮授予。R01 B01/FA-H01 OPEN/PARTIAL、保留行情 Degraded 仅原内部 Research 用途及有效期（2026-10-10T00:00:00Z到期）仍遵守；F07恢复时延仅诊断，不作发布性能 PASS。R1-SERVICE 整体 Gate 与后续任务分别评估。

## Gate与下一可执行任务

本轮仅DEVELOPMENT功能范围READY；formalAccepted=false。下一可执行任务为TP02（RD-Agent自动研究/实验Engine）开发范围补齐与当前准入：其F08/F0前置已严格READY，现有开发状态PARTIAL。TP01-E仍依赖R1-SERVICE整体Gate，不能仅凭TP01-D通过即开始准入；R03还依赖TP02。未执行外部推送、发布或生产凭据动作。
