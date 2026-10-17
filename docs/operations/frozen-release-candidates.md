# 冻结候选、组件 CI 与验收记录

正式验收选择一个完整、不可变的候选提交 SHA。后续整理文档、保存确认或补充证据索引会改变仓库 HEAD，但不会改变这个已选候选，也不会让旧回执自动接受新 HEAD。正式回执、目标环境、签名产物和来源 CI run 仍必须匹配同一个候选 SHA。

开发与联调采用 [分阶段测试规程](./phased-testing.md)。本规程的冻结、完整矩阵和同 SHA 要求属于发布/正式候选，不把日常功能、新提交、文档或工具修复自动扩大为全仓/上游全闭包复验。开发证据绑定实际源码与输入；文档或证据提交不改绑历史结果。

## 三种不同的动作

| 动作 | 入口 | 结果边界 |
|---|---|---|
| 普通 push/PR | QuantOS CI | 组件检查、未签名构建及下载完整性；`formalSignatureVerified=false` |
| 候选签名 | Sign Frozen Release Candidate，手动 workflow_dispatch | 指定候选 SHA 和该 SHA 的成功 QuantOS CI push/main run；受保护 `f02-signing` Environment；不部署服务、不代表业务 ACCEPTED |
| R01 迁移/覆盖及 F09 目标检查 | R01 Market Service Gate / F09 Observability Gate，手动 workflow_dispatch | 显式候选 SHA；从该提交检出后执行已配置测试目标；普通 push/PR/schedule 不访问该目标 |

普通 CI 仍按实际事件 SHA 运行，文档也可能触发组件检查。这里没有用 `paths-ignore` 隐藏必需检查，也没有把任意 `.md` 或 `docs/` 视作无需校验的功能输入。改变源码、契约、迁移、工作流、校验规则或被回执绑定的输入时，应选择新候选并执行对应检查。

## 正式校验显式选候选

以下是命令示例，不会自动执行目标环境或发布；把占位值替换为已冻结的 40 位 SHA。省略候选、使用 HEAD/分支/短 SHA、未知对象或非当前历史祖先会失败。

```sh
QUANTOS_CANDIDATE_SHA=<完整40位候选SHA>
node scripts/check-f06-acceptance.mjs --candidate "$QUANTOS_CANDIDATE_SHA"
pnpm check:p0 --candidate "$QUANTOS_CANDIDATE_SHA"
pnpm check:bff-a1-final-review --candidate "$QUANTOS_CANDIDATE_SHA"
node scripts/verify-release.mjs artifacts/release "$QUANTOS_CANDIDATE_SHA"
```

F06/P0 从所选提交读取计划和发现关闭记录，从该 SHA 的 Git notes 读取回执。BFF A1 从所选提交读取计划策略、OpenAPI 和生成契约，独立验证实际 staging 日志和用户确认的字节摘要。后续记录文件可以在工作区，但篡改日志、换用其他 SHA 的回执、缺少目标证据或确认仍被拒绝。

输出明确包含 `validationTarget=FROZEN_CANDIDATE_ONLY`、`observedHead`、`currentHeadAcceptance=NOT_CLAIMED`、`workingTreeAcceptance=NOT_CLAIMED`。即使后来发生了代码变更，选择旧候选也只是在核对旧候选，不能据此接受后来的代码或工作区。开发入口 `pnpm check:bff-a1-development` 继续检查当前功能输入，永不授予正式 ACCEPTED。

## 手动签名的版本链

1. 冻结并测试候选，保留该候选的成功 QuantOS CI run ID。
2. 需要签名时，在受保护 main 的 `Sign Frozen Release Candidate` 工作流中显式填写 `candidate_sha` 与 `source_run_id`；这一步由获得权限的人执行。
3. 预检拒绝错误 SHA/run、失败或未完成 CI、PR/fork、其他分支、仓库或工作流；签名之前再次检查来源 run。
4. 只下载该 run 的 `quantos-build-inputs`。完整验证 manifest、文件清单、摘要和 SBOM 的候选 SHA 后签名，再独立验证 HMAC。
5. 产出 `quantos-f02-candidate-promotion/v1`：分别记录候选 `commit`、控制/校验器 `validatorCommit`、来源 CI run 和 promotion run。`deploymentPerformed=false`、`formalAccepted=false`。

不使用“最新成功 run”、不重新构建另一个 HEAD 来补旧候选签名，不复制 Git notes 到新 HEAD，不把组件 CI 的下载回执当正式签名回执。CI artifact 已过期或不完整时，明确失败；需要重新执行相同候选的 CI，而不是偷偷改为当前 HEAD。业务、用途许可、发布授权和真实目标证据仍独立验收。

本地修改工作流并不更改 GitHub 服务端现有配置；合并/推送后才会采用新配置。本规程不授权 Codex 推送、触发工作流、使用签名密钥或执行外部发布。
