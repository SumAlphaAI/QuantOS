# PRE-03 执行总结与验收自检

> 任务：PRE-03 技术栈落地（FEP-0）  状态：仓库 Gate 已完成；GPT-6 Astra 功能复审未开始
> 版本：1.1  日期：2026-09-16

## 1. 交付物

| 要求产出 | 交付 | 位置 |
|---|---|---|
| 运行时 ADR | 实际锁定版本、双端同一产物架构、验证与边界 | [docs/adr/20260814-pre03-runtime-stack.md](./adr/20260814-pre03-runtime-stack.md) |
| 依赖锁 | pnpm 与 Tauri 锁文件冻结实际版本；Node/pnpm/Rust 均有仓库 pin；必需锁文件进入存在性 Gate | `.nvmrc`、`package.json`、`rust-toolchain.toml`、`pnpm-lock.yaml`、`apps/terminal-desktop/src-tauri/Cargo.lock` |
| 最小构建 | Terminal（17 个静态页面）、官网（12 个静态页面）、Storybook 静态构建、Tauri `cargo check --locked` | `apps/terminal`、`apps/website`、`packages/ui`、`apps/terminal-desktop/src-tauri` |
| 双端 Gate | 43 项运行时契约 + 3 项真实构建路由检查通过；5/5 负向测试证明关键漂移会阻断 | [scripts/pre03-smoke.mjs](../scripts/pre03-smoke.mjs)、[scripts/pre03-gate-negative.mjs](../scripts/pre03-gate-negative.mjs) |
| 验收证据 | 起始状态、锁文件、隔离计时、命令结果、Gate 与风险 | [PRE-03 acceptance evidence](./audit/PRE-03-acceptance-evidence-2026-09-16.md) |

## 2. 完成标准自检

| 完成标准 | 结果 | 证据 |
|---|---|---|
| 在现有 workspace 引入并验证目标依赖 | 达成 | Gate 从锁文件校验 26 项前端依赖、Tauri 2.11.5 与 deep-link 2.4.9；全量 lint 和 109 项 workspace 测试通过 |
| Next.js Web PoC | 达成 | `apps/website` App Router 静态导出，12 个页面构建成功，首页构建产物可服务 |
| Next.js Terminal PoC | 达成 | `apps/terminal` App Router 静态导出，17 个页面构建成功，`/command` 和 `/auth/deep-link` 构建产物可服务 |
| Tauri 加载/深链 PoC | 达成（仓库层） | 同一 `out/` 产物；`quantos://` 注册；冷/热接收；URL 白名单消毒后进入本地重新鉴权页；锁定编译通过。未把原生 GUI 手测计为本次证据 |
| 新环境 ≤30 分钟 bootstrap/build/test | 达成 | 无 Git、node_modules 与构建缓存的隔离副本：离线 frozen install + lint/test + 三项构建 + PRE-03 Gate 37.73s；Tauri 冷 `cargo check` 16.70s；合计约 54.43s |
| Web 与 Desktop 打开同一路由 | 达成（产物与配置层） | 构建产物 `/command` 可服务；Tauri `frontendDist` 精确指向同一 `apps/terminal/out`，偏离会被负向测试拒绝。原生窗口打开仍属候选包 GUI 验收 |

## 3. 2026-09-16 复核修复

1. 将旧 ADR 中的 React 19.2.7 和多个模糊 `x` 范围改为当前锁文件的精确解析值。
2. 增加 `.nvmrc`，把本地 Node 版本与 CI 的 24.12.0 统一。
3. smoke 改用临时回环端口和真实 404，扩展为工具链、依赖、构建产物、Tauri 共享目录、深链与窗口契约 Gate。
4. 新增依赖漂移、桌面产物分叉、深链消毒缺失和 Node pin 漂移的可破坏测试。
5. 锁文件检查增加 `buf.lock` 与桌面壳 `Cargo.lock`，Frontend Baseline CI 同时执行 PRE-03 正向和负向 Gate。

## 4. 边界与遗留

1. 每个签名桌面候选包仍须执行原生 OS/GUI 和冷/热深链回归；本次未运行签名候选包、生产凭据或外部发布。
2. 隔离复现使用本机已有 pnpm/Cargo 下载缓存；它验证干净 workspace 的 frozen bootstrap 与冷构建，不声明完全无缓存、首次联网下载耗时。
3. Next 构建存在 ESLint plugin 未检测到的非阻断警告；Storybook 构建存在 `use client`/source map、第三方 `eval` 与大 chunk 警告。
4. TanStack Query、Zustand、next-intl 与 MSW 的业务接线分别属于后续 UI/PRE-06 任务；依赖存在不代表所有业务集成完成。
5. GPT-6 Astra 功能复审保持 `NOT_STARTED / NOT RUN`；仓库结构校验不得解释为模型复审。
