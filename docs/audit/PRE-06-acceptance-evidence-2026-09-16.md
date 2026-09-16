# PRE-06 验收证据（2026-09-16）

> 任务：FEP-0 / PRE-06 测试基线（Web-only）
>
> 验证基线：`e38fb4012d3cb610fd6b3c37187fbe7da986bd32`
>
> 环境：macOS，Node.js `v24.12.0`，pnpm `10.20.0`
>
> 证据边界：本文证明当前仓库与本机 Web 浏览器基线；未使用生产/staging 凭据，未部署、发布或构造外部回执。

## 1. 开始状态与锁文件

- `git status --short --branch` 为 `## main...origin/main`，工作区与暂存区为空；HEAD 为上述 PRE-05 提交。
- `bash scripts/check-lockfiles.sh` 确认所有必需锁文件存在。
- 本任务未增删依赖，`pnpm-lock.yaml` 无变更。

## 2. 发现与修复

1. 旧总结停留在 OpenAPI 1.0.0 / 42 operations、仅 `/command` 视觉基线和未实现的 nightly 矩阵；现同步为 1.1.0 / 55 operations / 41 schemas 与实际 CI 接线。
2. 官网 Playwright 没有进入 frontend baseline/compatibility workflow；现官网与 Terminal 均运行三浏览器。
3. 一期 compatibility workflow 混入 Desktop OS/Tauri Gate；现迁至第二期手动 workflow，一期 Terminal 显式排除 Desktop deep-link spec。
4. Playwright device preset 覆盖了期望的 1440 viewport，旧文件名与像素尺寸不一致；现两套 config 固定 1440×900，重生成 5 个快照并用 manifest 冻结。
5. 旧视觉破坏检查使用合成图，不能证明入库 PNG 真实受控；现篡改实际快照并同时触发 SHA-256 和 pixel diff Gate。
6. Terminal E2E OIDC callback 构建值为 `localhost:3100`、Playwright 服务为 `3190`；现 CI 构建值与本机 E2E origin 一致。
7. Chromium axe 发现设置页下载记录区域可滚动但不可键盘聚焦；现补充 region 语义、名称与 `tabIndex=0`，并增加 E2E。
8. Firefox 暴露官网文档折叠项用例的目标不够明确；现定位 `#architecture details`，并验证 `open` 后再检查内容。
9. 当前 shell 的首个 `pnpm` 为全局 11.21.0，与仓库固定的 10.20.0 不一致；最终验收将 Node 24.12.0 的 pnpm 10.20.0 目录置于 `PATH` 首位，未改动仓库工具链。

## 3. 交付证据

| 交付 | 证据 |
|---|---|
| PRE-06 结构与可破坏 Gate | `scripts/check-pre06.mjs`、`scripts/pre06-gate-negative.mjs` |
| 真实视觉基线完整性 | `tests/e2e/visual-baselines.json`、`scripts/check-visual-baselines.mjs` |
| contract 异常语义 | `tests/contract/contract.test.ts`、`handlers.ts`、`fixtures/errors/` |
| 浏览器/无障碍基线 | `playwright.config.ts`、`playwright.website.config.ts`、`tests/e2e/` |
| Web-only CI 边界 | `frontend-baseline.yml`、`compatibility.yml`、`desktop-phase2.yml` |
| 任务总结 | `docs/PRE-06-summary.md` |

## 4. 验证命令与结果

| 命令 | 结果 | 关键输出 |
|---|---|---|
| `pnpm check:pre06` | PASS | `quantos-pre06/v1`；55 operations / 41 schemas / 5 visual baselines |
| `pnpm test:pre06` | PASS | 7/7 正向/负向结构 Gate |
| `pnpm test:contract` | PASS | 12/12；403/409/429/501、权限不变量与敏感字段 |
| `pnpm sabotage:pre06` | PASS | schema、权限、敏感字段、实际 PNG 完整性/像素差异均被捕获 |
| `pnpm check:visual-baselines` | PASS | 5 个 PNG 的 inventory/hash/尺寸/scope 通过 |
| `pnpm check:perf` | PASS | 138.8KB 共享首屏 JS，58.1KB 最大 chunk，10.7KB CSS |
| 官网 / Terminal 静态构建 | PASS | 官网 12 个静态生成步骤；Terminal 17 个静态生成步骤 |
| Terminal Chromium | PASS | 27/27 |
| Terminal Firefox | PASS（有跳过） | 24 通过，3 个平台快照用例跳过 |
| Terminal WebKit | PASS（有跳过） | 25 通过，2 个平台快照用例跳过 |
| 官网 Chromium / Firefox / WebKit | PASS | 每个浏览器 18/18 |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | PASS | 8 个 workspace 项目；22 个测试文件、111 个测试通过 |
| `pnpm check:pre03:web` | PASS | 官网 `/`、Terminal `/command` 的 Web-only 构建路由 smoke |
| `node scripts/check-secrets.mjs .` | PASS | 仓库 secret-pattern checks |
| `node scripts/check-development-plans.mjs --fresh-review` | PASS | 结构与 Desktop 分期通过；平台/模型复审 NOT_RUN |
| `bash scripts/check-lockfiles.sh` / `git diff --check` | PASS | 锁文件存在；无空白错误 |

## 5. Gate 结论

- **PRE-06 repository Gate：PASS。** Web 测试目录、contract/MSW、Playwright/axe、视觉完整性、性能预算、CI 接线与可破坏检查可重放。
- **PRE-06 development status：COMPLETED。** FEP-0 开发状态随 PRE-01–06 完成而记为 `COMPLETED`，不等于 G0 联合签署。
- **Web-only scope Gate：PASS。** Desktop/Tauri/深链不进入一期自动 Gate。
- **GPT-6 Astra 功能复审：NOT_STARTED / NOT RUN。** 未伪造平台加载、模型评审或外部签署。

## 6. 未决风险

1. GitHub Actions/Linux runner 本轮未执行；本地 macOS 三浏览器结果不是 CI receipt。
2. Firefox 和部分 WebKit 尚无 darwin 视觉快照，Linux 也无平台快照；这些像素比对为明确 skip，不得记为已验收。已入库 5 个 PNG 的完整性 Gate 仍为强制项。
3. staging BFF/OIDC/SSE/provider 与真实测试身份未验证；MSW/consumer contract 不是 provider 实现证据。
4. 未进行外部部署、发布、Desktop 原生验收或 GPT-6 Astra 复审。
5. 开发机全局 `pnpm` 仍可能优先解析到 11.21.0；重放时应使用仓库 `packageManager` 指定的 10.20.0，或确保 Node 24.12.0 工具链在 `PATH` 首位。

## 7. 下一可执行任务

按执行计划的拓扑顺序为 **BFF-FE-000：页面 BFF OpenAPI 基线**。执行前仍要确认 `CORE:F03`、`CORE:F05`、`CORE:F06` 的准入依赖，并继续区分生成契约、provider 实现、staging 回执与联合签署。
