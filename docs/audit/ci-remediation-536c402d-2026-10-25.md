# 536c402d CI 故障修复（2026-10-25）

状态：`PASS_LOCAL_SCOPED_REPAIR_HOSTED_RECHECK_PENDING`。基线为 `536c402d0126f37fe9b857596efb72cf0df30914`，在 main 修改并仅生成本地提交；未推送、未启动远端新一轮 CI。修复源码逐文件 SHA-256 见 [source-binding.json](evidence/ci-536c402d-20261025/source-binding.json)，本记录及证据由同一修复提交包含。历史结果仅适用于原始源码及范围。

## 远端故障与修复

通过该 SHA 的工作流列表、失败 job 日志和 F01 原始构建回执定位：9 个 push 工作流中 5 个成功、4 个失败；另外 3 个 schedule 工作流成功。原始元数据与日志保存在 [证据目录](evidence/ci-536c402d-20261025)，`.gz` 均为无损压缩，可用 `gzip -dc` 读取；逐文件摘要见 `SHA256SUMS`。

| 工作流 | 原始失败 | 本轮修复 |
|---|---|---|
| [Frontend Baseline](https://github.com/SumAlphaAI/QuantOS/actions/runs/40102610201) | PRE-01 登记引用 OpenAPI 1.14.0，而当前契约为 1.16.0 | 同步当前引用；仍为 134 operations，不提升 provider/staging 验收状态 |
| [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/40102610133) | visual manifest 未覆盖已经跟踪的 PNG | 登记 64 张现存 Chromium Darwin 图片；manifest 从 48 增至 112，保留图片原字节与原范围 |
| [QuantOS Compatibility](https://github.com/SumAlphaAI/QuantOS/actions/runs/40102610131) | 三浏览器任务同样被 manifest inventory 阻断 | 同上；Linux 三浏览器要求和差异阈值均保留 |
| [F01 Clean Room](https://github.com/SumAlphaAI/QuantOS/actions/runs/40102610243) | clean-room 的 Clippy `collapsible_if`；reproducibility 的 `Build digests differ` | 合并审批权限分支；稳定 Webpack JSONP runtime 初始 chunk 遍历次序 |

F01 原始三轮回执显示 Rust、Python 摘要各自一致。恢复的两份 Terminal Webpack runtime 各为 3501 字节，SHA-256 与回执一致，差异仅为初始 `installedChunks` 全零映射的键顺序。新插件在生成该 runtime 时按已分配 chunk IDs 排序输入集合，并在 finally 恢复原方法，不修改 chunk graph。仅生产客户端构建启用。真实 bundled Webpack 的扰动测试证明原行为输出不同、修复后完整 runtime 字节相同且所有初始 ID 保留。两应用共用实现，F01 静态入口执行回归测试。

保留完整输出摘要比较；没有过滤 runtime/HTML，没有归一化生产产物，也没有放宽可复现门禁。`repro-root-cause.json.gz` 中的映射排序仅用于证明原始差异原因。

原始 artifact 下载存在限时中断：未获得完整 ZIP；从两个不完整前缀及一个成功的 byte-range 响应恢复了完整 entry，检查解压 CRC32，并将两个 runtime 的 SHA-256 与原始回执核对。保留恢复 entry、回执与 inventory；不把这次恢复描述为完整归档验证。

## 补充发现：历史摘要误报

恢复前置门禁后，对本次基线执行真实 Gitleaks 8.28.0 全历史扫描，命中 3514 条 `generic-api-key`：均为审计 JSON 的 `keyHash`。逐一读取 1176 个原始 commit/file blob、验证 JSON 和命中整行为小写 64 位十六进制摘要，并核对 fixture 生成代码的 idempotency-key SHA-256 语义。

在 `.gitleaksignore` 中加入这些确切的 commit/path/rule/line 指纹。原证据没有改写；没有新增规则级、目录级或通用摘要豁免，新提交中同形字段仍受扫描。原始脱敏扫描报告及 blob/生成器摘要见 `secrets-history-report.json.gz`、`history-digest-review.json.gz`；未从报告恢复或输出明文凭据。修复后重新扫描 931 个历史提交无命中，F02 新凭据/审计 JSON 摘要负向探针继续通过。

## 本地验证及边界

执行环境：Node 24.12.0、pnpm 10.20.0、Rust 1.91.0、Gitleaks 8.28.0。以下为本地工作树输入验证，不能替代修复提交的远端 CI 结果。

| 命令/范围 | 结果与证据 |
|---|---|
| `node scripts/check-pre01.mjs` | PASS；30 页、124 stories、210 scenarios、30 trace rows；`pre01-static.log.gz` |
| visual Linux inventory / PRE-06 静态门禁及 PRE-01/visual/PRE-06 负向探针 | PASS；112 baselines、134 operations、119 schemas；67 项测试；`visual-linux.log.gz`、`pre06-static.log.gz`、`pre01-visual-negative-final.log.gz` |
| `cargo clippy --locked --offline -p bff-gateway --all-targets -- -D warnings` | PASS；`bff-clippy.log.gz` |
| `cargo test --locked --offline -p bff-gateway --lib execution:: -- --test-threads=1` | 30 PASS；移除数据库配置及 live opt-in；`execution-tests.log.gz` |
| `cargo fmt --all -- --check` | PASS；`fmt-final.log.gz` |
| `make f01-check` | PASS；包含 F01 静态/负向、产物捕获与 Webpack 测试；`f01-static-retry.log.gz` |
| `node --test scripts/webpack-module-ids.test.mjs scripts/stable-initial-chunks.test.cjs` | 8 PASS；真实 Next 配置、模块 ID 冲突拒绝和 runtime 次序扰动；`webpack-tests-final.log.gz` |
| 三轮 fresh Website/Terminal Web 构建 | PASS；每轮各 43/182 文件，完整路径/长度/SHA-256 清单完全一致；`web-repro.json.gz`、六份 build 日志 |
| fresh 输出 `node scripts/pre03-smoke.mjs --web-only` | PASS；29 runtime pins、2332 contract exports、2 routes；`pre03-fresh-output.log.gz` |
| PRE-03 负向回归 | 33 PASS；`pre03-negative-final.log.gz` |
| F02 门禁负向回归 | 14 PASS；`f02-secret-negative.log.gz` |
| `GITLEAKS_BIN=artifacts/tools/gitleaks bash scripts/check-secrets.sh` | 重试 PASS；931 commits、约 1.93 GB；`secrets-history-retry.log.gz` |
| 计划静态检查 | PASS；`plans.log.gz`；不代表目标环境验收 |
| 全部 Web 输入摘要复核 / PNG 保留 | PASS；`source-inputs-final.log.gz`、`png-preservation.log.gz` |

三轮 Web 验证使用普通临时源码目录（无分支、无 worktree），固定物理前缀、每轮清理 `.next/out`，共享现有已安装依赖及 workspace links，使用 F01 mock profile、基线 SHA 和 SOURCE_DATE_EPOCH。验证脚本与全部输入摘要保存在 `verify-web-repro.cjs.gz`、`web-repro.json.gz`。这是针对已定位 Web 差异的复验，未重新安装全依赖，未重跑三轮 Rust/Python 构建，完整 F01 clean-room 仍为 `NOT_RUN`。

保留探索失败：初版扰动测试对数值键的引号断言错误；配置单独装载缺少 public env；初次静态检查受 uv 缓存 sandbox 权限阻断；首次临时源码副本遗漏根契约 JSON 导致类型检查失败。相应原日志没有覆盖，分别保存在 `chunk-order-tests.log.gz`、`config-load-retry.log.gz`、`f01-static.log.gz`、`initial-web-repro*.gz`。修正测试断言、完整配置/输入及所需权限后使用新记录重试；这些失败不记为 PASS。

## F05/F07 与待验项

远端该 SHA 的 F05/F07 均为 0 次运行；两个 workflow 仅有 `workflow_dispatch`，确认输入默认 false，并保留 job 显式确认与 `QUANTOS_MANUAL_F05_F07=1`。证据：`manual-policy.json.gz`。本轮没有连接数据库或执行全量覆盖率/数据库 campaign。

- 修复提交的 hosted CI：`NOT_RUN`，须用户推送后跟踪。
- 全套 Linux 三浏览器视觉回放：`NOT_RUN`；本地 inventory PASS 仅证明清单一致。
- 完整 F01 clean-room、数据库、发布/目标环境验收：`NOT_RUN`。
- 本轮本地修复通过不改变历史 Gate、业务就绪或生产验收状态。

下一步：用户推送本地修复提交后，跟踪该确切 SHA 的工作流，重点确认四个失败入口及随后门禁，不重新启用 F05/F07 日常 campaign。
