# main 自动动作与 HEAD 回执循环修复

2026-10-13。检查范围为当前 QuantOS 仓库配置及本地回归。未访问部署平台、未查询远程运行历史、未推送、未触发 GitHub Actions、未读取生产凭据、未执行签名/目标数据库/部署。formalAccepted=false。

## 确认的问题与实际范围

基线 `e4b1a730` 的 QuantOS CI 在每次 main push 后自动运行 signing-policy、sign-main、verify-download-main，后两个 job 使用 `f02-signing` Environment；R01 目标 job 对非 PR 事件执行 Supabase 前向迁移/覆盖，F09 Supabase 目标 job 同样自动执行。F06/P0/BFF A1 正式入口直接选择 HEAD，因此提交回执文档后，再运行正式命令就会查找新 HEAD 的回执。

未在仓库内找到直接发布网站或服务的工作流。之前 BFF005 的五轮本地执行没有 push/部署；重跑是源码/校验脚本修复造成的完整功能输入变化，最终纯文档提交没有再跑全闭包。因此“前几轮重复执行已经发生部署”不成立，但自动签名/目标动作与默认 HEAD 的耦合风险成立。

## 已实现

- 普通 push/PR 只生成未签名组件 CI 下载回执。保留 `verify-download` 稳定检查，仍拒绝失败或 skipped 的上游检查。
- 新独立手动签名工作流选择固定候选 SHA + 成功 source CI run；验证仓库、main push、workflow path、完整 SHA、成功状态、run attempt 与祖先关系。受保护 Environment 策略预检保留，完整产物/SBOM/摘要/HMAC 验证保留；不自动部署或 ACCEPTED。
- R01 迁移/覆盖与 F09 目标执行改为 main 手动 dispatch，候选预检后按该完整 SHA checkout，产物名使用候选 SHA；普通 CI/schedule 保留本地检查。
- F06/P0/BFF A1 正式入口强制显式候选，使用该候选 Git 快照和同 SHA 回执；不根据当前文档 HEAD 重建、也不将旧回执转授新 HEAD。A1 七类真实 staging 证据和项目用户确认要求未降低。
- 新测试验证：文档/证据后续提交、工作区修改不移动被选候选；新代码 HEAD 缺自身回执仍失败；A1 契约摘要取冻结 Git 字节；省略/短/符号/未知/非祖先 SHA 拒绝；错误 source run、PR/fork/失败 CI、自动或非 main 签名拒绝；开发入口不授予正式验收。

## 本地验证结果

| 命令 | 结果 |
|---|---|
| 候选/F02/F06/P0/A1 定向正反向测试 | 69 PASS |
| `make f02-check`（剥离凭据，静态环境） | 55 PASS / 1 数据库执行 SKIP |
| `node --test scripts/user-acceptance-confirmation.test.mjs` | 17 PASS |
| 计划顺序及前端发布移交负例 | 61 PASS |
| `node --test scripts/ci-stage-disposition.test.mjs` | 22 PASS |
| 计划及 F09 配置静态校验 | PASS；当前全图 0 READY / 159 NOT_ASSESSED / 0 BLOCKED |
| 三个正式入口省略候选、使用无真实回执的候选 | 各预期 exit 1；未误授验收 |
| YAML、JS 语法、摘要/链接、秘密扫描 | PASS；托管 GitHub 执行仍 NOT_RUN |

完整命令与退出码见原始证据；上述各套件有共享用例，不重复加总为唯一测试数。

## Gate 与风险

本轮只验收基础设施修复的本地工程结果，不执行正式/目标/发布验收。现有 BFF005 功能交付和 ac4a8dc4 冻结证据原件保留；修改工作流/校验器本身是功能输入变化，四消费者旧 READY 已撤回为 NOT_ASSESSED，不能把此前 139/139 结果移贴到本修复源码。本轮不为这个独立基础设施任务重跑整个业务闭包；下一业务准入应从新冻结候选按实际变更范围复评。

GitHub 托管运行、Environment 实际权限、手动签名、真实 Supabase 目标和部署均 NOT_RUN。修复需正常合并/推送后才在 GitHub 生效；本轮没有执行这些外部动作。普通组件 CI 仍可因文档提交运行，但不会自动进入签名 Environment 或 R01/F09 目标环境。

测试命令、退出码、原始日志与文件摘要见[证据清单](./evidence/candidate-workflow-20261013/results.json)。初次新增 A1 快照测试发现遗漏 import，修复后重跑；原始失败日志保留。本轮不是发布签署，也未批准发布候选；实仓候选参数仅用于只读拒绝探针。

后续使用方式见[冻结候选与 CI 规程](../operations/frozen-release-candidates.md)。
