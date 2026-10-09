# TP01-D 选择性吸收与最小 patch 队列

日期：2026-10-09。范围为 R1 DEVELOPMENT；依据开发计划 TP01-D、TP01-C/R02/F0 依赖及既有 inventory/ADR。正式用户确认、部署、发布与候选同 SHA hosted CI 分别待验。

## 当前结论

实现已完成，完整依赖准入待冻结源码复评。仅组件通过不能宣称 DEVELOPMENT READY。

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

- 前置刷新：[报告](./TP01-D-prerequisite-admission-2026-10-09.md)。
- 畸形合约修复前探测：[原始日志](./evidence/tp01-d-20261009/preflight-contract.log)。
- TP01-D组件：[receipt](./evidence/tp01-d-20261009/receipt.json)。
- 组件验收：`node engines/vibe-adapter/check-absorption.mjs --record` 四组全部通过（queue、Python44、Runtime2、格式7文件），仅授予 engineeringStatus=PASS / stageGate=NOT_ASSESSED。
- TP01-C完整回归：`node engines/vibe-adapter/check-development.mjs --record` 七组全部通过，Python307、Manager55、Ruff、格式、Python3.12类型、锁文件和计划检查；依赖尚未重新准入时 standalone stageGate=BLOCKED。
- `node --test scripts/provider-a1-receipts.test.mjs scripts/tp01-c-functional-artifacts.test.mjs scripts/tp01-d-patch-queue.test.mjs scripts/tp01-d-functional-artifacts.test.mjs`：88/88；`pnpm test:development-plans`：38/38；`cargo fmt --all -- --check`、新增Python测试Ruff均通过。
- 首次组件脚本建清单拒绝原件：[输入选择错误](./evidence/tp01-d-20261009/component-initial-input-selector-failure.log)。上游是Git link，已改为绑定完整锁定且干净的Git link，两个参考文件另外以queue摘要校验。首次Runtime命令混入数据库guard用例，严格的2-test标记拒绝；[原日志与receipt](./evidence/tp01-d-20261009/initial-component-mixed-target/verifier-failure.log)保留，修正为research_workflow_过滤后实际两项通过，不将未运行数据库检查计为PASS。
- 完整源码冻结、62组执行台账、16节点严格 Gate 与最终验证：待新源码完整复评后填写。

## 剩余边界

Artifact 为有租户检查的内存 mock，审计为 metadata 投影；持久化/可信引用解析、已部署 HTTP/JWT、真实工具/LLM、OS 出站隔离、代表性性能/长稳、用途许可、hosted 同 SHA CI 及正式 ACCEPTED 不由本轮授予。R01 B01/FA-H01 OPEN/PARTIAL、保留行情 Degraded 仅原内部 Research 用途及有效期仍遵守；F07恢复时延仅诊断，不作发布性能 PASS。R1-SERVICE 整体 Gate 与后续任务分别评估。
