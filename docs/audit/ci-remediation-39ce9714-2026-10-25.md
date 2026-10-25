# 39ce9714 CI 跟踪与修复（2026-10-25）

状态：`PASS_LOCAL_SCOPED_REPAIR_HOSTED_RECHECK_PENDING`。跟踪源码为 `39ce971488c36cd48564b802fee4e1919c169313`，远程 main 已核对为该 SHA。修复在 main 生成本地提交，不推送。逐文件修复输入绑定与原始日志见[证据目录](evidence/ci-39ce9714-20261025)的 `source-binding.json`、`SHA256SUMS`；`.gz` 可用 `gzip -dc` 无损读取。本记录由同一修复提交包含，不将原 SHA 的结果改绑为新提交验收。

## 远程结论

该 SHA 的 9 个 push 工作流全部结束：6 成功、3 失败。F01 Clean Room、F04 Core Branch Coverage、F03、F08、F09、R01 成功；F01 原可复现构建故障在该 SHA 已通过远端检查。

| 失败工作流 | 实际原因 | 本轮处理 |
|---|---|---|
| [Frontend Baseline](https://github.com/SumAlphaAI/QuantOS/actions/runs/40174245528) | Provider 公共模块在导入时断言 OpenAPI 必须为 1.14.0、113 schemas，当前为 1.16.0、119 schemas | 改为当前 OpenAPI 与生成物版本、精确 operationId/method/path、schema 名称集合及目录归属核对；保留响应、唯一性、owner 和 published catalog 检查 |
| [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/40174245336) | 浏览器截图基线过期及 P01 Linux 缺图；verify-download 随上游失败拒绝继续 | 修复截图与用例；保留下载门禁的失败传播 |
| [QuantOS Compatibility](https://github.com/SumAlphaAI/QuantOS/actions/runs/40174245400) | 三个 Linux 浏览器均有相同类别截图故障，每个项目 44 项功能测试成功、5 项视觉测试失败，无 flaky | 补齐 30 张 P01 Linux 引用，更新共享壳 12 张 Linux 引用，修复深色用例媒体设置 |

保留原始 FAIL 日志和完整终态列表 `runs-final.json.gz`。本轮另手工运行一次现有 [Visual Baseline Candidates](https://github.com/SumAlphaAI/QuantOS/actions/runs/40176236047)，确切源码仍为 39ce9714；结果成功，属于候选捕获，不计为新提交 CI 或像素比较通过。该工作流不提交、不推送、不连接数据库。

## 修复内容及视觉来源

- `provider-all-contract.mjs` 去掉过期的版本/数量常量，核对当前生成的操作三元组、schema 集合和版本；published catalog 不能遗漏/增加孤立操作，owner 与拒绝响应约束继续有效。`check-provider-all-boundary.mjs` 输出当前真实数量。增加同步版本/schema 升级可接受，以及旧版本、操作遗漏、相同数量的 route/method/schema 替换、重复操作、目录孤立操作必须拒绝的测试。
- Linux 缺失的 P01 五页 × 两主题 × 三浏览器共 30 张截图，来自原失败 job 的完整 actual PNG。共享壳另外 12 张候选来自上述手工 Linux 工作流；登录深色引用的特殊来源见下一项。manifest 从 112 增至 142 张，原阈值 `maxDiffPixelRatio=0.005` 和三浏览器强制比较保留。
- `ui102-auth.spec.ts` 的“深色”用例原来没有设置媒体模式，当前认证页面因此实际显示浅色。现在显式 `page.emulateMedia({colorScheme:"dark"})`。三张 Linux 登录引用使用同 SHA 原 P01 `/login` 深色 actual：相同路由、1440×900、相同暗色媒体，fullPage 高度也恰为 900。局部引用复制不改像素；本机 Chromium 已证明 UI102 viewport 与 P01 fullPage 完整像素相同，并在修复后独立比较成功。对应的一张 Darwin Chromium 登录引用同步；其余 Darwin 图像不改写。
- 候选打包脚本原来只收录共享壳 12 张，即使 P01 用例已捕获也不会归档。现在完整打包 42 张，拒绝旧 12 张回执。工作流同步步骤说明及候选路径定义文件的触发路径。原共享壳最低完整性矩阵仍保留；新增用例没有通过排除测试或扩大差异阈值处理。
- PRE-06 规程追加当前维护说明；旧日期、旧表格和历史验收原范围保留。

所有 Linux 引用按原始 PNG 直接复制，没有图片编辑或跨平台冒充。`linux-import.json.gz` 记录每张图来源、artifact/run ID、原/新摘要、尺寸及用途。实际 renderer、packages、构建配置和依赖锁与捕获 SHA 未发生变化；唯一截图上下文调整为 UI102 显式深色，复用已有同路由深色捕获并单独验证。

原失败 actual 与独立手工候选中可共同核对的 9 组截图（Command、登录、Security × 三浏览器）逐像素一致，见 `independent-linux-captures.json.gz`。这是修复媒体设置前原故障的独立稳定性诊断，不作为新深色用例在 Linux 的比较通过。

Codex 已查看三浏览器共享壳、设置和 P01 深浅色总览，核对页面内容、控件和完整布局；没有发现需要修改产品代码的渲染缺陷。审阅状态及来源见 `visual-review.json.gz`。引用接纳与原功能/发布验收相互独立。

## 验证结果

| 命令/范围 | 结果 |
|---|---|
| 当前六项 BFF 生成物校验 `node scripts/check-bff-generated.mjs` | PASS；1.16.0、134 operations、119 schemas；`bff-generated.log.gz` |
| Provider A1 / CI disposition / Provider ALL / PRE-06 正负向测试 | 191 PASS、0 fail、0 skip；`final-node-regression.log.gz` |
| 全部 `ci-stage-disposition.mjs` 组件入口 | 21 个出口成功；仅验证既有阶段记录，不提升 admission/READY；`ci-dispositions.json.gz` |
| `node scripts/check-provider-all-boundary.mjs` | PASS；134 operations、119 schemas；`provider-boundary.log.gz` |
| `node scripts/check-visual-baselines.mjs --platform linux` / PRE-06 静态 | PASS；142 张引用、134 operations、119 schemas；`visual-linux.log.gz`、`pre06-static.log.gz` |
| 显式 mock profile 下 Terminal 生产构建 | PASS；`terminal-build.log.gz`；无数据库连接 |
| Darwin Chromium 全部默认 Terminal 用例，`--update-snapshots=none --retries=0` | 49 PASS，包含修复后视觉比较；`chromium-compare.log.gz`、`chromium-report.json.gz` |
| F05/F07 手工数据库策略负向测试 | 6 PASS；自动事件、无授权入口均被拒绝；`manual-policy-negative.log.gz` |
| 开发计划静态校验 | PASS；`plans.log.gz`，不提升目标环境验收 |
| Gitleaks 8.28.0 历史与原始证据扫描 | 无命中；`secrets-history.log.gz`、`raw-artifact-secret-scan.log.gz` |

原始平台测试与新修复测试分别保留：初次本机三浏览器捕获完成 Chromium 后停滞于 Firefox 启动，240 秒超时，未完成 WebKit；日志 `darwin-capture.log.gz` 保留失败/中断，不计三浏览器 PASS。后续仅对可运行的 Chromium 独立完成比较。未为无关依赖链、全仓构建、数据库或完整 Provider campaign 扩大复验。

下载故障也保留边界：三个普通 artifact 下载长时间无输出后停止，改为有超时、重试上限的 HTTP 206 Range 读取。按 ZIP 中央目录选择完整 PNG/JSON entry，核对解压长度、CRC32 和 SHA-256；未声称完整归档下载或校验。一次错误 artifact ID 查询返回 404，使用已查询的正确 ID 后成功，没有把失败查询记为通过。候选初次仅取回 JSON 后补取全部 PNG，最终 inventory 明确记录 13 个完整 entry。下载脚本不保存凭据或签名 URL。

## F05/F07 确认及待验项

远程该 SHA 的两个 workflow 源码与本地一致，均只有 `workflow_dispatch`，`confirm_full_database_run` 默认 false，job 需显式确认且设置 `QUANTOS_MANUAL_F05_F07=1`；该 SHA 下均 0 次运行。证据：`remote-f05.json.gz`、`remote-f07.json.gz`、`f05-runs.json.gz`、`f07-runs.json.gz`、`manual-policy.json.gz`。自动工作流没有调用两个全量 campaign；本轮未连接数据库，未执行 F05/F07 全量覆盖率或数据库验收，状态仍为 `NOT_RUN`。

修复提交的远端 CI、Linux 三浏览器比较，以及本机 Firefox/WebKit 完整比较均未完成，不能用候选捕获、离线清单或 Chromium 的结果代替。发布、生产、实际 IdP/数据库验收同样为 `NOT_RUN`。

下一步：用户推送本地修复提交后，跟踪该确切 SHA 的三个失败工作流及下游门禁，确认完整 Linux 比较；保持 F05/F07 手工边界。
