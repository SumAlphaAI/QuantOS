# 27bebbf0 五个 CI 工作流跟踪与第三轮修复（2026-10-19）

跟踪版本：`27bebbf0705bec2ce77f415452df97bab58e338f`。五个工作流全部进入终态，2 个成功、3 个失败；本轮在 `main` 修复并生成本地提交，未推送。前两轮报告、验收回执和原始日志保持原样。

## 远程终态

| 工作流 | 同 SHA 运行 | 结果与本轮定位 |
|---|---|---|
| QuantOS Compatibility | [39190738890](https://github.com/SumAlphaAI/QuantOS/actions/runs/39190738890) | SUCCESS；三浏览器目标 CI 结果只绑定 27bebbf0。 |
| F08 Engine CI | [39190738934](https://github.com/SumAlphaAI/QuantOS/actions/runs/39190738934) | SUCCESS。 |
| Frontend Baseline | [39190738895](https://github.com/SumAlphaAI/QuantOS/actions/runs/39190738895) | FAILURE；Market 测试调用的共享 environment 硬编码 macOS 的 pnpm 缓存路径，在 Linux 即使已准备正确版本也拒绝启动。 |
| QuantOS CI | [39190738912](https://github.com/SumAlphaAI/QuantOS/actions/runs/39190738912) | FAILURE；A2 当前 inventory 仍为 API 1.7.0 / 70 operations / 62 schemas，结构检查失败后没有执行新语义回归，最终附带报告旧缓存摘要不匹配。F02 归档和下载拒绝仍是前置失败后的连锁结果。 |
| F01 Clean Room | [39190738926](https://github.com/SumAlphaAI/QuantOS/actions/runs/39190738926) | FAILURE；BFF 137 PASS / 10 FAIL / 1 ignored。共用 fixture 将第一次构造的时间永久保存在进程级 OnceLock，慢环境运行约 228 秒后，新建账户/portfolio/risk 输入已超过原有 60 秒有效期。 |

## 修复

1. 新增 `scripts/pinned-pnpm.mjs`，从 `package.json` 读取精确版本，支持 CI 已准备的 PATH 及既有 macOS 缓存；通过实际 `--version` 验证，禁止下载，错误或缺失版本仍拒绝。原 credential allowlist 保持不变。新增 Linux HOME/PATH 与错误版本测试，并接入 `test:bff-fe-005`，使 CI 持续执行该回归。
2. 更新 A2 **当前契约引用**为 API 1.12.0 / 132 operations / 110 schemas，保留旧总结段落和历史证据。A2 Gate 仍必须实际执行三组 provider/consumer 语义回归并核对源码摘要，未手工填造执行回执。
3. owned reference fixture 每次构造独立时间，单次请求内部的快照、bars 和 candidate clock 使用同一时间基准。新增显式推进 5 分钟的确定性回归。风险最大年龄、命令/审批有效期、拒绝条件及 live 权限均未放宽。
4. 复验主 CI 同一 BFF 步骤时发现后续 `check:bff-fe-007` 固定要求 API 1.7.0。改为要求 v1 且至少 1.7.0，继续逐项检查六个 C10 operation、脱敏、分页、CSRF、recent-auth、能力和导出生命周期；较旧版本、未知 major 和格式错误均拒绝。此项属于原失败步骤的后续直接阻断。

## 本地结果

| 检查 | 结果 |
|---|---|
| pnpm/A2/C10 门禁正负向测试 | 37/37 PASS，0 skip；Linux PATH 不依赖 macOS 缓存，错误版本拒绝，A2 缓存/摘要和导出权限拒绝保留 |
| P0/A1 environment 消费者回归 | 83/83 PASS，0 skip；凭据过滤、公开 mock 配置及原阶段边界保持 |
| Market 实际失败入口 | PASS；50 条 HTTP 记录、7 个接口、Chromium consumer PASS |
| A2 实际执行 Gate | PASS；三组当前语义测试，源码摘要匹配；local_contract 范围，无 Supabase/staging 验收 |
| BFF Rust lib | 148 PASS / 0 FAIL / 1 ignored；含慢进程时钟回归和原有过期、风险拒绝、恢复、并发检查 |
| `cargo clippy -p bff-gateway --all-targets --locked --offline -- -D warnings` | PASS |
| 完整 `make bff-contract-check` | PASS / exit 0；实际执行 A2 三组语义、9 类业务断言破坏拒绝、C10 及后续 A4/A5 各领域组件门禁与负向回归 |
| 无 `.git` 快照的 `execution::` 回归 | 21/21 PASS，0 ignored；包含原 F01 失败的执行用例及新时钟回归 |
| 既有 PRE-01/PRE-06 回归 | 62/62 PASS，0 skip |
| A2 structure / C10 / generated / page coverage / PRE-01 / PRE-06 | PASS；当前生成物一致、132 operations / 110 schemas |
| Gitleaks 8.28.0 全历史扫描 | PASS；639 commits，0 leaks；新补丁另行扫描 |
| `cargo fmt --all --check` / `git diff --check` | PASS |

初次 Clippy 检出新增测试模块后仍有普通 item，保留该失败日志；将测试模块移到文件末尾后通过。实际执行期间共享 Cargo 目录曾发生编译锁等待，不将等待本身记录为测试成功。A2 实际语义与 full recipe 产生的当前报告和各组原始日志独立保存。

完整 BFF recipe 中组件阶段记录的有效性验证和单位回归通过，不代表重新授予 A4/A5 或依赖节点 READY；原有 `NOT_ASSESSED`、未准入和目标环境边界保持。

无 Git 验证使用当前 Rust 源码的独立复制目录和独立 Cargo target，不创建开发分支或 worktree。`GITHUB_SHA` 显式使用失败基线 27bebbf0，文件摘要见 `git-free-inputs.json`；本轮工程结果绑定 **base + 当前修复输入摘要**，不声称失败基线或新冻结 SHA 已通过完整 F01。保留原有数据库 ignored 状态，未启动本机数据库，也未连接目标数据库。

## 证据与边界

原始远程日志、终态快照、本地运行与摘要见 [第三轮证据](evidence/ci-remediation-round3-20261019/)。`manifest.json` 绑定修复输入及证据 SHA-256；整体候选由所在 Git 提交标识。执行证明中的 base SHA 与当前输入摘要分别记录，不重绑前两轮历史记录。

本轮 Gate：`PASS_LOCAL_SCOPED`。完整 F01 三轮构建、全仓测试、目标数据库、部署、发布与正式验收未在本轮执行。新修复提交的远程 CI 为 `NOT_RUN`（未推送）；下一步在授权推送后核对五个工作流的新同 SHA 终态，尤其 F02 证据生成与下载校验，不将本地验证当作远程通过。
