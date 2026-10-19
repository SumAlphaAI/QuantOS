# 最新推送的五个 CI 失败修复（2026-10-19）

原始失败版本：`2404a7df44c6fe08c92a8f0f5d589457a4ad9a84`。本次直接在 `main` 修复并本地提交，未授权推送。原始日志及本地复验日志见 [evidence/ci-remediation-20261019](evidence/ci-remediation-20261019/)。`manifest.json` 绑定修复输入和证据文件的 SHA-256；本报告与修复所在 Git 提交共同标识本次候选。

## 失败定位与修复

| 失败工作流 | 原始运行 | 根因与修复 |
|---|---|---|
| Frontend Baseline (FEP-0) | [39185798637](https://github.com/SumAlphaAI/QuantOS/actions/runs/39185798637) | PRE-01 登记表仍将已发布的 alerts/reconciliation/admin 接口列为 planned，且版本混用旧值。按当前 catalog、OpenAPI 和生成物同步到 1.12.0；仅 C02 两个接口保留 planned，纠正 Query/Command 列归属。 |
| QuantOS Compatibility | [39185798611](https://github.com/SumAlphaAI/QuantOS/actions/runs/39185798611) | 三浏览器入口都被 PRE-06 的旧常量 1.7.0 / 70 operations / 62 schemas 阻断。改为从当前 OpenAPI 对比版本、完整 operationId/method/path 集合和 schema 名称集合。 |
| QuantOS CI | [39185798616](https://github.com/SumAlphaAI/QuantOS/actions/runs/39185798616) | 同一 PRE-06 旧常量阻断浏览器步骤，导致后续 F02 证据未生成、下载校验被跳过并拒绝通过。修复前置根因，保留原证据归档和下载拒绝门禁。 |
| F08 Engine CI | [39185798636](https://github.com/SumAlphaAI/QuantOS/actions/runs/39185798636) | X05 脚本 1 个 E401 和 6 个 E702。拆开 import/语句并格式化，保留全部边界检查；修复前后输出逐字节一致。 |
| F01 Clean Room | [39185798604](https://github.com/SumAlphaAI/QuantOS/actions/runs/39185798604) | 同一 X05 lint 错误导致 `make lint-python` 失败，由上述格式修复解决。 |

新增负向检查覆盖生成物版本错误、接口删减、同数量接口替换、路径/HTTP 方法漂移、schema 删减及同数量 schema 替换。安全、漂移、视觉、性能、覆盖率和发布门禁没有降级。

## 本地验证

| 命令或检查 | 结果 |
|---|---|
| `node scripts/check-pre01.mjs` | PASS；30 页、124 个页面 Story、210 个页面场景、30 行追踪 |
| `node scripts/check-pre06.mjs` | PASS；132 operations、110 schemas、24 个视觉基线 |
| `node --test scripts/tests/check-pre01.test.mjs scripts/pre06-gate-negative.mjs scripts/pre06-runtime-negative.mjs` | PASS；62/62，0 fail / 0 skip |
| `make lint-python`（临时 UV cache） | PASS；lint 范围保护测试、Ruff、Pyright（0 errors / 0 warnings） |
| `python3 scripts/check-x05-no-submit.py` 与修复前输出 `cmp` | PASS；输出完全一致，venueSubmitPath=ABSENT |
| `node scripts/check-bff-generated.mjs` | PASS；生成物与当前契约一致 |
| `node scripts/check-bff-contract-coverage.mjs` | PASS；132 operations、110 schemas、132 page references |
| `vitest run tests/contract` | PASS；3 文件、29/29 测试 |
| `node scripts/pre06-sabotage-check.mjs` | PASS；schema、权限、敏感字段、视觉完整性及像素破坏均被拒绝 |
| 官网、Terminal 构建 | PASS；使用 Compatibility CI 同一组公开 mock 环境变量；客户端敏感信息检查分别扫描 40/64 文件 |
| `test:browser --project=chromium --project=webkit --workers=2 --global-timeout=60000 --reporter=line` | PASS；Terminal 54/54，0 skip |
| `test:browser:website --project=chromium --project=webkit --workers=2 --global-timeout=60000 --reporter=line` | PASS；官网 36/36，0 skip |
| Firefox 回归 | INTERRUPTED / NOT_VERIFIED；本机启动阶段持续无输出，约 2.4 分钟后主动中断，两个矩阵均 exit 130；不得作为通过 |
| `git diff --check` | PASS |

首次官网构建因未注入必需的公开 mock 环境变量失败，保留 `build-website.log`；使用 CI 的环境变量后成功。首次浏览器运行因沙箱 `listen EPERM` 无法启动静态服务，保留两份失败日志，再以允许本机回环监听的权限运行。未启动本地 PostgreSQL/Supabase，也未执行目标数据库测试。

三浏览器矩阵随后在 Firefox 启动阶段停滞。中断时 Terminal 28 passed / 7 interrupted / 46 did not run，官网 18 passed / 7 interrupted / 29 did not run；原始日志完整保留。将 Chromium/WebKit 单独执行后得到上述 90/90，通过结果只适用于本机 macOS；Linux 视觉和 Firefox 结果留待目标 CI 核验。没有修改浏览器配置、跳过列表、重试或断言来消除该限制。浏览器环境与固定 pnpm 10.20.0 的调用方式保存于 `local/browser-check.mjs`。

## 范围与后续

本次只修复五个失败工作流已确认的直接根因，并运行相关检查。全仓测试、完整依赖链、F01 clean-room 全套与 F08 完整覆盖率流程未在本次重新执行；远程失败日志中较早步骤的成功不作为新候选结果。历史验收报告和回执保持原状，当前登记表刷新不重绑旧 provider 验收。

本次根因修复 Gate：`PASS_LOCAL_SCOPED`，不代表完整 CI 验收。远程新候选 CI：`NOT_RUN`（未推送）。功能联调、目标环境、发布与正式验收没有新增通过结论。下一步：获授权推送本提交后，核验这五个工作流在同一新 SHA 上的最终状态，尤其是此前未执行的下游 F02 证据生成与下载校验及 Firefox/Linux 浏览器矩阵；不得将本地检查替代该结果。
