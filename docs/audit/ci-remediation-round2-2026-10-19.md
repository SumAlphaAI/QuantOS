# d5af1e25 后续三个 CI 失败修复（2026-10-19）

失败版本：`d5af1e25cb63c9128fb1e3426adf95ec393e49f0`。本次直接在 `main` 修复并本地提交，未推送。原始失败日志、脱敏扫描报告与本地结果保存于 [第二轮证据目录](evidence/ci-remediation-round2-20261019/)，`manifest.json` 绑定修复输入和日志的 SHA-256。

## 远程结果与根因

| 工作流 | d5af1e25 结果 | 本轮定位 |
|---|---|---|
| QuantOS Compatibility | [SUCCESS / 39188202049](https://github.com/SumAlphaAI/QuantOS/actions/runs/39188202049) | 上轮浏览器入口修复已在目标 CI 通过；该结论只绑定 d5af1e25。 |
| F08 Engine CI | [SUCCESS / 39188202055](https://github.com/SumAlphaAI/QuantOS/actions/runs/39188202055) | 上轮 Python lint 修复已在目标 CI 通过。 |
| Frontend Baseline | [FAILURE / 39188202015](https://github.com/SumAlphaAI/QuantOS/actions/runs/39188202015) | 50 个成功响应缺少 correlation/cache 头声明；10 个游标接口实际使用具名筛选参数，策略元数据仍为空，A1 误按通用 filter 语法校验。另有负向测试固定旧接口数量、只替换首个追踪引用。 |
| F01 Clean Room | [FAILURE / 39188202039](https://github.com/SumAlphaAI/QuantOS/actions/runs/39188202039) | `git archive` 不包含 `.git`，BFF 的共享 fixture 强制执行 `git rev-parse HEAD`，导致 64 个测试失败；策略模块另有四处同类 fixture 读取。 |
| QuantOS CI | [FAILURE / 39188202046](https://github.com/SumAlphaAI/QuantOS/actions/runs/39188202046) | Gitleaks 940 个命中均为历史文件摘要误报；后续 F02 证据未生成、下载校验被拒绝是连锁结果。 |

## 修复内容

- **契约与门禁**：补齐实际 provider 已统一发送的 `X-Correlation-Id` 和 `Cache-Control: no-store`，同步生成 TypeScript 和 provider policy。为 10 个接口准确声明具名查询筛选、枚举排序和冻结游标策略；门禁逐项检查参数存在、UUID/日期/枚举边界和策略集合一致，继续拒绝未声明或无界筛选。没有给接口添加尚未实现的通用 `filter` 参数。此次只纠正已有行为的声明及策略元数据，接口集合、请求和响应 body 均未改变；兼容检查对 d5af1e25 返回 `changes=0`，保持 1.12.0。
- **源码身份**：新增 `quantos_core::fixture_source::fixture_source_commit`。有 `.git` 时读取实际 HEAD，并拒绝与显式 SHA 冲突；无 `.git` 的源码快照要求显式提供 F01 已注入的 `GITHUB_SHA`。缺失、格式错误、全零 SHA 或损坏的 Git 元数据均拒绝，不使用固定伪造值。BFF/策略五处 owned fixture 统一调用该入口；不授予部署、数据库或业务验收权限。
- **扫描误报**：940 个命中全部来自提交 `63aaee15e4baab5963e2b1439982e61cc2c8c871` 的 `docs/audit/evidence/bff-fe-006-local-20261019/preflight/history-sha256.json`。逐条解析原始行、定位其引用的 Git blob 并重新计算 SHA-256，940/940 一致。仅向 `.gitleaksignore` 追加精确 commit/file/rule/line 指纹；原始历史文件保持原样。新增同一路径未来提交的凭据注入检查，保证这些豁免不覆盖后续内容。

## 本地验证与适用范围

| 检查 | 结果 |
|---|---|
| A1 Gate / development / 对 d5af1e25 的 compatibility | PASS；132 published + 2 planned；engineering baseline only，formalAccepted=false；0 个不兼容变化 |
| A1 正负向测试（两个测试文件） | 29/29 PASS，0 skip；包括响应头删除、具名参数/策略缺失、无界筛选及排序漂移拒绝 |
| BFF OpenAPI / generated / page coverage | PASS；132 operations、110 schemas、132 page references |
| 既有 PRE-01/PRE-06 回归 | 62/62 PASS，0 skip |
| 契约 fixture 测试 | 3 文件、29/29 PASS |
| Gitleaks 8.28.0 全历史扫描 | PASS；638 commits、约 1.57 GB，0 leaks；读取修复后的精确指纹列表 |
| Gitleaks 凭据注入与误报豁免负向检查 | 2/2 PASS，0 skip；GitHub/Slack token、64 位 hex 凭据、未审核摘要均被拒绝；覆盖普通 audit 路径和本次历史清单同一路径的新提交 |
| 无 `.git` 快照 Rust lib 回归 | BFF 147 PASS / 1 ignored；core 源码身份 2 PASS；strategy 29 PASS / 2 ignored；0 fail |
| 无 `.git` 快照 `service_s04` 集成 | 6/6 PASS；包含真实本机 TCP/owned Python 生成器、权限拒绝、幂等、CAS、来源篡改与恢复 |
| 直接受影响包 Clippy | `quantos-core`、`quantos-strategy`、`bff-gateway --all-targets --locked --offline -- -D warnings` PASS |
| `cargo fmt --all --check` / `git diff --check` | PASS |

无 Git 回归在独立源码目录和独立 Cargo target 中执行，未创建开发分支或 worktree。该目录由当前工作树的 Rust/engine/必要 fixture 文件复制，详细文件摘要保存于 `local/source-snapshot-inputs.json`，Python 使用既有固定环境。测试环境 `GITHUB_SHA` 为复现失败条件而显式设为 d5af1e25；**这是 base + 修复文件摘要绑定的本地工程验证，不是 d5af1e25 或新冻结提交的完整 Clean Room 验收**。原有 3 项数据库测试保持 ignored，未连接数据库，也未建立本机数据库。源码快照的输入与最终修复输入逐项核对。

初次 A1 负向测试运行保留了一个失败：登记表有多个 `getCommandSummary` 引用，单次替换没有删除全部追踪；修正为 `replaceAll` 后 29/29 通过。另一次在原目录启动的重复 core helper 测试等待编辑器 Cargo 锁，被主动中断，未记 PASS；同一 helper 的两项验证已在无 Git 独立快照中通过。原始日志均保留。

本轮 Gate：`PASS_LOCAL_SCOPED`。未执行全仓测试、完整三次 Clean Room/可复现构建、目标数据库或发布验收；不修改历史验收 SHA，不重授依赖链 READY。新候选远程 CI 为 `NOT_RUN`（未推送）。下一步是在授权推送后，核验本轮三个失败工作流及此前两个已通过工作流在同一新 SHA 上的完整结果，尤其保留 F02 生成/下载与 Linux 目标结果的独立确认。
