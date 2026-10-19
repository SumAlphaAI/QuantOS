# 8f433963 五个 CI 工作流跟踪与第四轮修复（2026-10-19）

跟踪版本：`8f433963bd414d450b81046553ceff8bd19e6170`。五个工作流全部进入终态，2 个成功、3 个失败；本轮在 `main` 修复并生成本地提交，未推送。前三轮报告、验收回执和原始失败日志保持原样。

## 远程终态

| 工作流 | 同 SHA 运行 | 结果与本轮定位 |
|---|---|---|
| QuantOS Compatibility | [39195209638](https://github.com/SumAlphaAI/QuantOS/actions/runs/39195209638) | SUCCESS。 |
| F08 Engine CI | [39195209615](https://github.com/SumAlphaAI/QuantOS/actions/runs/39195209615) | SUCCESS。 |
| Frontend Baseline (FEP-0) | [39195209710](https://github.com/SumAlphaAI/QuantOS/actions/runs/39195209710) | FAILURE；Market scoped disposition 已进入 Chromium consumer，但浏览器尚未安装；现有安装步骤位于其后。 |
| F01 Clean Room | [39195209645](https://github.com/SumAlphaAI/QuantOS/actions/runs/39195209645) | FAILURE；Rust BFF 148 PASS / 0 FAIL / 1 ignored 后进入前端测试，13 个终端集成测试文件使用包工作目录拼接二进制路径，出现 `apps/terminal/target/debug/bff-gateway ENOENT`。 |
| QuantOS CI | [39195209761](https://github.com/SumAlphaAI/QuantOS/actions/runs/39195209761) | FAILURE；Test workspace 同样在上述 13 个文件启动 BFF 时失败；F02 归档缺失及后续下载校验为前置中断的连锁结果。 |

F01 的 BFF 在约 242 秒测试进程中仍为 148 PASS / 0 FAIL，主 CI 亦为 148 PASS / 0 FAIL / 1 ignored；这些远程结果只绑定 8f433963，表明上一轮时钟修复已在慢环境执行，不能据此将新候选的远程 CI 记为通过。

## 修复

1. 将 Frontend Baseline 既有 Chromium 安装步骤前移到首个 provider browser consumer 之前。PRE-06 解析实际 YAML 并校验顺序；新增删除安装、禁用安装、移动至消费者之后三个负向变体，保持缺失浏览器时拒绝通过。
2. 新增终端测试共享 helper，以模块位置确定源码根目录，再解析 Cargo debug 二进制，支持相对及绝对 `CARGO_TARGET_DIR` 和 Windows 扩展名。13 个消费者统一从源码根目录启动 BFF，消除 pnpm 包工作目录差异。测试断言、启动错误拒绝和清理保留。
3. F01 无 `.git` 源码副本的 BFF 子进程显式转发已提供的 `GITHUB_SHA`，维持原有环境白名单；不生成虚构 SHA，不转发数据库或云凭据。源码标识仍由既有 Rust fixture 校验。
4. `make test-web` 在前端递归测试前显式执行锁定依赖的 BFF 二进制构建，使入口具备实际测试前置条件。

## 本地结果

| 检查 | 结果 |
|---|---|
| PRE-06 结构与运行负向回归 | 20/20 PASS，0 skip；含浏览器安装顺序拒绝 |
| PRE-06 当前结构 Gate | PASS；132 operations / 110 schemas / 24 visual baselines |
| `make test-web` | PASS / exit 0；显式构建 BFF 后运行前端工作区；终端 28 文件、120/120 PASS，原 13 个启动失败文件实际执行 |
| terminal typecheck / lint | PASS；首次类型检查失败日志保留，修正 helper 对 Next.js `ProcessEnv` 类型的假设后通过 |
| 无 `.git`、独立 Cargo target 的 BFF 构建及终端测试 | PASS；从副本 `apps/terminal` 目录运行，28 文件、120/120 PASS，0 skip；同时验证真实启动、工作目录、绝对 target 覆盖及显式 SHA 传递 |
| Market 原失败入口 | PASS；50 条 HTTP 记录、7 个接口、Chromium consumer PASS |
| Gitleaks 8.28.0 历史与新增暂存补丁扫描 | PASS；原始扫描日志见证据目录 |
| `git diff --check` | PASS |

`make test-web` 中 domain-ui 原有 3 项 skip 保留，不将整个工作区描述为零跳过。未修改 Rust 运行时代码，本轮未重跑无关 Rust 全仓测试或完整 BFF 门禁链。未启动本机数据库，也未连接目标数据库。

无 Git 验证使用 385 个输入文件的独立源码副本、独立 Cargo target，并复用现有锁定 Node 依赖和 workspace packages 链接，未执行干净依赖引导或完整 F01 三轮验收。`GITHUB_SHA` 为失败基线 8f433963；源码副本及当前修复输入由各文件 SHA-256 绑定，不把失败基线描述为已通过新修复。

## 证据与边界

[第四轮证据](evidence/ci-remediation-round4-20261019/)包含三份原始远程失败日志、同 SHA 终态快照、本地成功及初次失败日志、执行命令和输入摘要。`manifest.json` 校验修复输入与证据，整体候选由所在 Git 提交标识；历史记录未重写。

本轮 Gate 为 `PASS_LOCAL_SCOPED`。新提交远程 CI 为 `NOT_RUN`（未推送）；完整 F01、F02 产物生成及下载验证、后续尚未抵达的 hosted 步骤仍须在新 SHA 推送后核对五个工作流。目标数据库、部署、发布与正式验收未在本轮执行。
