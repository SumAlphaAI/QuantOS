# ade12c8 远程 CI 故障整改报告

- 日期：2026-10-07。
- 原始提交：`ade12c8907254a8fa1fa69481fe2e1ca3536b0aa`。
- 范围：定位该提交的 GitHub Actions 失败，修复组件 CI 与阶段准入的职责冲突、历史证据 Python lint 范围错误，生成独立本地提交。
- 当前边界：新候选 hosted CI **NOT RUN**；计划中的 `NOT_ASSESSED` 保持不变；不生成正式验收、数据库验收或阶段 READY 回执。
- 证据目录：[ci-ade12c8-remediation-20261007](./evidence/ci-ade12c8-remediation-20261007/)。原始失败日志、首次本地受限执行及后续验证分别保留。

## 1. 远程执行结果与根因

只读获取同一完整 SHA 的 9 个 workflow 结果：5 个成功、4 个失败。原始运行列表见 [remote-runs.json](./evidence/ci-ade12c8-remediation-20261007/remote-runs.json)。

| 失败工作流 | 实际失败步骤 | 根因 | 整改 |
| --- | --- | --- | --- |
| [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/37631136205) | `make bff-contract-check` 中的 `check:bff-fe-007:development` | 执行文档迁移已撤销旧 READY，当前 `NOT_ASSESSED` 被严格准入验证器正确拒绝；组件 CI 却仍要求当前阶段已放行 | 组件 CI 校验阶段状态记录；READY 声明仍执行原严格验证器 |
| [Frontend Baseline (FEP-0)](https://github.com/SumAlphaAI/QuantOS/actions/runs/37631136449) | `check:provider-a1` | 同类职责冲突，`PROVIDER:A1: dependency is not READY`。F0、FEP-0、A2、G0 的后续严格调用也存在相同潜在阻塞 | 同步七个 DEVELOPMENT 节点的组件 CI 调用，保留全部组件检查及回执负向测试 |
| [F01 Clean Room](https://github.com/SumAlphaAI/QuantOS/actions/runs/37631136410) | clean-room 的 `make ... lint test` | Ruff 将两份目录迁移历史证据 `verify-relocation.py` 当作活动工程源码，报 63 个 E401/E701/E702/E731 等错误 | 保持归档字节不变，统一排除归档证据目录并验证活动源码仍受 lint 约束 |
| [F08 Engine CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/37631136453) | stable Gate 的 Ruff | 同上；错误发生前 Engine Rust 测试已通过 | 与 `lint-python` 使用同一归档排除范围，并保留完整 F08 后续检查 |

该 SHA 的 R01 Market Service Gate、F03 Protocol Acceptance、QuantOS Compatibility、F04 Core Branch Coverage、F09 Observability Gate 成功；这些结果属于原始 SHA，不转记为整改候选的结果。

QuantOS CI 后续出现 F02 产物目录缺失、下载验证未执行，是前置 BFF 步骤失败的连带结果。本轮保留上传缺文件失败、构建/签名及下载验签要求，没有修改这些检查来掩盖上游失败。

## 2. 代码与规程调整

1. 新增 `scripts/ci-stage-disposition.mjs` 和七个 `check:*:ci` 入口。未评估状态必须为 `DEVELOPMENT/NOT_ASSESSED`、空 evidence、null digest；输出明确包含 `assessmentExecuted=false`、`admitted=false`、`formalAccepted=false`。记录校验通过不等于阶段验收通过。
2. READY 声明必须调用原有严格验证器，校验当前回执、输入与依赖；任何失败直接阻断，不回退到未评估。G0/FEP-0 的 BLOCKED 仅在原验证器确认工程 PASS 且回执状态一致时允许作为未准入状态记录。
3. 原 `check:provider-a1`、`check:f0-development`、`check:fep0`、`check:g0-development`、两项 BFF `:development`、`check:provider-a2` / `make provider-a2-check` 严格入口不变。所有阶段负向测试继续执行；CI 不使用 `if:false`、`continue-on-error` 或伪造 READY。
4. 更新 A2、FEP-0、G0 的 CI 接线断言，新增接线负向测试，拒绝移除/禁用阶段状态检查、移除回归或将严格命令替换为组件 CI 命令。
5. `make lint-python` 与 `make f08-check` 仅额外排除 `docs/audit/evidence/`；原第三方上游排除保留，不忽略全局 Ruff 规则。真实 Ruff 负向测试验证 `engines/`、`scripts/` 中的违规仍失败。

操作说明见 [组件 CI 与 DEVELOPMENT 准入检查](../runbooks/ci_stage_disposition.md)。业务源码、迁移、历史回执和确认原件未修改，也没有恢复计划中的历史 READY。

## 3. 验证结果

本地环境为 macOS，使用工程固定 Node 24.12.0、pnpm 10.20.0、Rust 1.91.0、uv 0.7.0。执行 `make` 时设置 `QUANTOS_SKIP_ENV=1`，不加载 `.env.local`；本轮未执行数据库目标测试、未建立本地数据库、未修改 Supabase。

| 验证 | 结果 | 证据 |
| --- | --- | --- |
| 完整 `make bff-contract-check` | PASS | `bff-contract-check.log`，含真实本地语义/变异拒绝及契约/回执回归 |
| 八组阶段及 Python lint 范围回归 | 241/241 PASS | `all-stage-regressions.log` |
| 七个 `check:*:ci` 实际调用 | PASS；七个结果仍为 NOT_ASSESSED，均不授予准入 | `ci-dispositions.log` |
| 原严格 `check:provider-a1` | 预期非零拒绝；未评估状态仍阻断准入 | `strict-admission-still-blocked.log` |
| 计划联合门禁、38 项负向及锁文件 | PASS | `plan-lockfile-check.log` |
| PRE-04/PRE-06/P0/G0 后续前端检查 | PASS | `frontend-followup-checks.log`；G0 正式状态仍 NO CURRENT RECEIPT |
| `make f01-check lint test` | PASS；F01、本地 Rust/Python/Web lint、类型检查、全工作区单元及文档测试通过 | `workspace-checks-escalated.log`；目标数据库用例未启用，不转记为数据库验收 |
| `make f08-check` | PASS；129 项 Python 测试通过，覆盖率 90.77%；Rust 原始行/region 95.88%/90.38% | `f08-check.log` 与两份覆盖率 JSON；stable 负向 4 PASS / 1 nightly 分支项 SKIP，不声称 nightly 分支验收 |
| Linux clean-room / 三次完整可重复构建 | 本轮未执行；待新候选远程运行 | 原始 F01 失败完整保留 |
| 新候选同 SHA hosted CI / 下载验签 | NOT RUN | 本轮仅生成本地提交 |

首次本地执行因沙箱无法读取 uv 默认缓存而中断；改用空临时缓存的尝试又遇到依赖下载网络限制。后续获得工具执行批准，使用既有依赖缓存复跑。前两次失败日志保留，不记为 PASS，不将这些环境限制归因于业务代码。

## 4. 后续验证与验收边界

完成本地整改提交后，由项目用户推送，再检查该完整新 SHA 的全部相关 workflow；主 CI 的 F02/发布产物/签名下载验签以及 Linux F01/F08 结果必须以新运行证据确认。新 SHA 有后续错误时依据实际失败步骤修复，不把本轮本地成功记为远程通过。

阶段 READY 的恢复须独立按原规程实际复评当前内容及依赖；涉及用途许可或当前业务确认时保留项目用户确认环节。R01 原 provider 范围、R02 未完成的集成/RELEASE 验收，以及原报告边界不因组件 CI 调整而改变。
