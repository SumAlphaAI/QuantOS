# ad011968 CI 复核及修复（2026-10-31）

状态：`PASS_LOCAL_SCOPED_REPAIR_HOSTED_RECHECK_PENDING`。远端结果绑定 `ad011968281d1b71c8ec876548665ada493bfb0d`，当前修复直接在 main 提交，不推送。source-binding.json 绑定当前输入；本地日志的 sourceCommit/GITHUB_SHA 为修复前 HEAD，不能当作新提交的远端或目标验收。

## 原 SHA 远端结果

9 个 push 工作流为 6 success、3 failure；另有同 SHA 的 R01、F09、F08 定时运行成功。成功的 push 为 F03、R01、F04、F08、F09、Compatibility。未查询到本 SHA 的 Visual Baseline 运行，F05/F07 campaign 未执行；不沿用旧 SHA 的结果。

| 工作流 | 当前远端事实 |
|---|---|
| [QuantOS Compatibility](https://github.com/SumAlphaAI/QuantOS/actions/runs/41057928615) | SUCCESS；Chromium、WebKit、Firefox jobs 均通过，原 Firefox 交互修复继续通过本 SHA 的兼容性任务 |
| [F01 Clean Room](https://github.com/SumAlphaAI/QuantOS/actions/runs/41057928531) | reproducibility SUCCESS；clean-room FAIL。L04 完整 77 项 PASS、0 failed/ignored/filtered，572.28 秒；其后 Terminal Web 测试报告 11 failed files、74 failed tests、1781 passed、1 skipped，另有 4 个 failed suites。原有 Rust L04 修复已抵达实际通过，不能把后续 Web 错误归回 L04 |
| [Frontend Baseline](https://github.com/SumAlphaAI/QuantOS/actions/runs/41057928564) | FAIL：A2 当前 inventory/summary 仍为 API 1.18.0、142 operations、132 schemas；结构检查失败，所以 CLI 没启动当前三组语义测试，随后报告缺少成功 proof、18 个摘要不匹配及两条清单/总结错误 |
| [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/41057928518) | FAIL：同一 A2 Gate 的 21 条失败；verify-download 继续拒绝前置未完成，没有修改其传播逻辑 |

F01 clean-room 的 make 步骤在 2025.489 秒时因 Web 错误退出；它没有执行到后续 1800 秒完成限额判断。新修复是否满足完整 clean-room 限额仍须新的远端运行，不能由本地增量结果推算为通过。

## 修复

A2 当前 inventory 更新至实际 API 1.34.0、160 operations、180 schemas，并新增当前总结段。原 2026-10-27 段落改为历史标题，正文、历史 evidence 和 historicalEvidence 字段保留。C01/C17 本任务仍是 20 项；formalAccepted=false、stagingStatus=DEFERRED_TO_FINAL_REVIEW。没有改 Gate 的执行/proof/源码摘要要求；结构通过后，原 CLI 在当前源码实际重跑三组回归并生成新 proof，未复制历史摘要或人为写 PASS。

四处 UI fixture 读取（native-review helper、account-state、R01、cash-only）原先相对进程 cwd，pnpm 从 apps/terminal 执行时无法找到仓库根目录 docs 下的 JSON。改为相对测试文件的 import.meta.url 定位；历史 JSON 字节、输入模型变换及拒绝断言全部不变。这些 JSON 仍只作为显式 UI 响应模型，不能充当当前签名、市场、原生执行或目标环境回执。

原 test-web 在已构建 owned-fixture BFF 后又耗时 1 分 42 秒重建 dev BFF，并通过默认 debug 路径启动。原日志出现五个启动超时条目：UI503 套件、CORE L03 两项、FEP5 一项、X3 一项。未优化参考宿主在并行 Web 测试中产生初始化压力，是结合原日志、现有 profile 和本地优化产物复验的判断，不声称重现了 Linux 当时完全相同的负载。

`make test-web` 改为执行新的准备入口与其拒绝回归。入口以既有 owned-fixture profile 构建当前 BFF，通过 Cargo JSON 的实际 executable 传入 QUANTOS_REFERENCE_BFF_EXECUTABLE；不猜测 target 路径，缺产物/文件、构建或测试失败均失败。Terminal helper 优先使用显式产物，空值拒绝，无效路径不回退到旧 debug 二进制；手工未指定时保留原 debug 路径及 CARGO_TARGET_DIR 支持。归档仍原样转发既有 GITHUB_SHA，不要求 .git。

原 pnpm test 范围、15 秒启动期限、请求 deadline、各用例 timeout、有效期、重试/拒绝/未知结果恢复断言、F01 1800 秒限额和 60 分钟 job 上限均未修改。默认 dev/test/release 及生产源码无变化。实际产物检查确认 opt-level=1、debug_assertions=true、overflow_checks=true，并嵌入当前完整生成输入策略。这是功能测试准备，不是生产或性能验收。

## 本地验证

| 检查 | 结果 |
|---|---|
| 原 A2 CLI 当前实际三组语义回归 | PASS：settings_policy 8、auth_settings_provider 17、Terminal auth/settings 29；三组 exit 0，18 个来源摘要匹配 |
| A2 + 新 Web 准备入口正反回归 | PASS：33 tests，0 fail/skip；含构建/信号/缺产物拒绝、失败传播、实际路径及归档 SHA 转发 |
| 新 Web 入口的完整 pnpm test | PASS：166 files、2098 passed、3 existing skipped；Terminal 139 files/1893 passed，无 skip。3 skip 位于 domain-ui，未增删或算作通过 |
| 根目录的受影响 UI fixture 组 | PASS：7 files、107 tests；与 pnpm 包目录执行对照，不依赖 cwd |
| F01 与 CI disposition 拒绝回归 | PASS：58 tests，0 fail/skip |
| Terminal TypeScript、修改文件 ESLint | PASS |
| F01 静态清单/固定工具链、PRE-06、开发计划、C10 contract 检查 | PASS；清单检查不代表重跑完整 clean-room |
| A2 / C10 CI disposition | recordValidation PASS，但 stage status=NOT_ASSESSED、assessmentExecuted=false、admitted=false、formalAccepted=false；不记 READY |
| Cargo 实际 BFF/profile/生成策略绑定 | PASS |

初次本机默认 pnpm 11 包装器尝试自动切换项目版本时网络失败或停滞，相关未完成检查中止，不能记 PASS。后续通过现有缓存的 pnpm 10.20.0 执行，未关闭签名检查或改包管理器配置。F01 静态清单第一次在沙箱内被 uv 缓存权限拒绝；在固定工具版本、离线模式和可读取现有缓存的环境下完成。中止 lint 探针的临时页面已只按创建的确切路径清理，仓库源码未因此改动。

## 证据与边界

[证据目录](evidence/ci-ad011968-20261031) 保留原 workflow/jobs/完整失败日志、F01 归档报告、实际 A2 proof 和三组日志、完整 Web/根目录 fixture/拒绝回归与静态结果。gzip 和 SHA256SUMS 校验归档，source-binding.json 使用独立 path/sha256 字段；当前输入由包含本记录的提交绑定。原失败、缺失 proof、NOT_ASSESSED 与历史回执保留。

没有推送、部署、创建分支/worktree、建立本机数据库/容器、连接真实 Supabase/交易所或运行 F05/F07 campaign。完整新 SHA clean-room、三轮构建、目标/发布/性能验收均 `NOT_RUN`。原 SHA 的 L04/Firefox hosted 通过不改绑为新 SHA。用户推送后应复查主 CI、Frontend Baseline、F01（包括最终耗时限制及后续步骤）；本地 scoped PASS 不代表新 SHA hosted PASS 或全局 READY。提交后另执行完整历史凭据扫描，并在交付信息报告结果。
