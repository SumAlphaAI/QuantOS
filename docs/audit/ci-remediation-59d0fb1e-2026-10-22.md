# 59d0fb1e CI 跟踪与 SCA 修复

基线为已推送 main 的 `59d0fb1e5586d6edba01f78a0e545c240e196b62`。从干净 main 开始，仅修复本轮已观察错误并生成本地提交；不推送、不启动工作流、不操作数据库。

## 远程工作流实测

精确完整 SHA 查询获得 9 个 push 工作流，均已结束：F01 Clean Room、Frontend Baseline、Compatibility、F03、R01、F04、F08、F09 共 8 个 SUCCESS；[QuantOS CI 39704571354](https://github.com/SumAlphaAI/QuantOS/actions/runs/39704571354) FAILURE。

F05/F07 取消日常全量数据库/覆盖率已在远程 main 生效：

- 从 GitHub 读取该 SHA 的两份工作流、主 CI、Makefile、手工策略模块，逐字匹配本地版本，原始 blob/内容摘要保存在 `remote-policy.json`。
- 两份专用工作流只有 `workflow_dispatch`，无 push/PR/schedule；确认输入默认 false，job 同时要求手工事件与确认输入。F05/F07 针对该完整 SHA 的运行数均为 0。
- 主 CI 只执行 `make f05-check` 的静态、负向、离线单元测试；完整 F05 DB Gate 和覆盖率调用已移除，没有 F07 DB 调用。托管 F05 source Gate 实际 SUCCESS。
- 手工模块入口仍要求显式开关，并拒绝 push/PR/schedule。旧聚合入口不能绕过手工确认。本轮负向复验通过。
- 最近历史运行中的 F05/F07 schedule 失败属于 `ee00c14d` 等旧 SHA，最近五项均已结束；没有遗留排队/运行中的记录。不得将历史失败当作新 SHA 自动执行，也不把“未执行”视为全量数据库验收 PASS。

## 原始错误与修复

主任务唯一失败步骤是 `Run SCA checks`，新公布的漏洞使当前锁文件被拒绝：

| 公告 | 旧锁版本 | 修改 |
| --- | --- | --- |
| [Storybook GHSA-f2ph-cmg5-wxc8](https://github.com/advisories/GHSA-f2ph-cmg5-wxc8) | storybook、@storybook/core 8.6.18，critical | Storybook/React/Vite/addon 组件统一使用 8.6.19 系列下界，实际锁定 8.6.19 |
| [Vitest GHSA-qxg6-89mg-rqv8](https://github.com/advisories/GHSA-qxg6-89mg-rqv8) | @vitest/mocker 4.1.11，moderate | vitest、coverage-v8 及传递的 mocker 同步升级 4.1.12 |
| [Vitest GHSA-xp26-3454-mjgp](https://github.com/advisories/GHSA-xp26-3454-mjgp) | @vitest/mocker 4.1.11，moderate | 同一 4.1.12 修复版覆盖 |

以上为上游公告列明的修复版本，保持原 major。只更改根 package.json、UI/domain-ui package.json 和 pnpm-lock.yaml；未增加 waiver、排除扫描、修改既有 braces 补丁或放宽门槛。锁文件变化来自这些依赖及其对应传递依赖/peer 绑定。

`verify-download-ci` 因 verify 失败而 skipped，`verify-download` 随后按现有规则拒绝 `CI_RESULT=skipped`，是上游失败传播；下载校验不需放宽。原日志中的 braces finding 为 `backportVerified=true`，已有补丁验证有效，不是本次未解决漏洞的根因。

## 验证及范围

本轮扩大到 Web 测试/覆盖率，是因为直接升级了所有 Web 单测共享的 Vitest 与 coverage-v8。未扩大到全仓 Rust/Python、完整数据库或 F05/F07 campaign。

| 验证 | 结果 |
| --- | --- |
| 实际 npm SCA | PASS；仅剩既有 braces finding，原补丁重新验证 BACKPORT_VERIFIED；无新增豁免 |
| Node 许可证扫描 | PASS，748 个锁定包、8 个工作区 |
| pnpm coverage:web | 68 文件、451 PASS / 3 SKIPPED；行覆盖率 97.79% |
| critical coverage | 59 文件、349 PASS / 3 SKIPPED；行/分支/函数/语句 100%；与上行有重叠，不相加为唯一用例数 |
| Storybook 静态构建 | PASS，UI/domain-ui/Terminal stories；保留 chunk size 警告，不恢复不安全消息或 iframe 开关 |
| UI/domain-ui 类型检查 | PASS |
| F05/F07 手工门禁、F02 SCA/secret 负向、braces/GLib 回归 | 37 PASS |
| 离线冻结锁安装 | PASS（pnpm 10.20.0），未再次解析/漂移锁文件 |
| diff whitespace、Git 历史 Gitleaks | PASS；暂存补丁亦扫描，结果随提交前检查记录 |
| Rust/Python SCA | 原 SHA 托管结果 PASS；相关锁文件未变，本轮不重复扫描、不改绑为新候选实测 |
| 新提交的托管 CI、数据库、部署/发布 | NOT_RUN；待用户推送后核对新 SHA，不能宣称远程 CI 已绿 |

初次本地负向检查因未向 fixture 子进程提供 Gitleaks 路径而失败，指定工程已有 8.28.0 二进制绝对路径后 37 项通过；初次冻结安装因无 TTY 交互保护中止，在一致的包存储访问环境下设置 CI=true 后通过。两次失败日志保留，未修改项目检查逻辑规避环境问题。

[证据目录](evidence/ci-59d0fb1e-20261022/)保存原始托管失败日志、全部工作流状态/步骤、远端触发策略核对、本地失败及成功回归、锁文件摘要和命令。源码/配置修复以本地提交及输入摘要绑定；F05/F07 日常禁用策略保持原样。
