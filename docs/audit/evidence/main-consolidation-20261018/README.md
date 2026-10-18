# main 分支整合与开发约定

2026-10-18，依据项目用户要求，将现存其他本地分支全部整合至 main，删除已合并分支，并在根目录 AGENTS.md 规定快速迭代期间直接在 main 开发和提交，不另开分支。

- 原 main：`b829499849ae5e3be2a82d69c6673e383c006c82`。
- 原工作分支 codex/x03-command：`12a11c723b920aa5afcc2d837a9c0de00c042782`。
- 操作前工作区干净，只有一个 worktree。11 个非 main 分支及原 main 均为原工作分支祖先；完整名称、SHA 与检查结果见 [branches.json](./branches.json)。
- 执行 `git switch main`、`git merge --ff-only codex/x03-command`，逐一检查全部原分支 tip 可从 main 到达，再以 `git branch -d` 安全删除 11 个非 main 分支。未强制删除、重置或改写提交历史。
- 快进合并后的树为 `98099ab50f968af7b8c3fac1c9a8a500466d67dd`，与操作前当前分支完全一致。工作流文档变更单独提交。
- 本地仅剩 main；操作时远端跟踪引用只有 origin/main 及 origin/HEAD。本次未联网刷新远端分支，未推送、部署或执行外部发布。

验证包括原分支 tip 的祖先关系、合并前后树相等、剩余分支、原审计/门禁文件未变、远端跟踪引用未变、差异空白检查及开发计划/CI 阶段声明检查。见 [verification.json](./verification.json) 与本目录检查日志。初次计划和 CI 检查发生于本 README 创建前，因链接暂缺失败，原失败保留在 initial-check-0.log 和 initial-check-1.log；补齐文档后重试，最终结果以 final-check 日志为准。

AGENTS.md 是 PROVIDER:A5 当前输入的一部分；本次修改后将当前阶段门禁撤回 NOT_ASSESSED。原 A5 用户确认仍为原范围 CONFIRMED，原源码、确认稿、回执及历史失败均保持原字节，不绑定到本次新提交，不自行重新授予 READY。未改业务代码，未运行业务测试、全闭包、目标数据库、完整联调或发布验收。本次 Git 整合检查 PASS 不代表这些验收通过。

下一项开发可在 main 继续 FE:BFF-FE-002 / A6；需要当前 A5 READY 时，按实际影响范围另行复核，历史确认仍保持原绑定。
