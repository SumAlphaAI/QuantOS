# ADR: 前端运行时技术栈落地（PRE-03）

- 状态：已落地（待 G0 联合评审签署）
- 日期：2026-08-14
- 关联：PRE-03 技术栈落地；执行计划第 2 节；[PRE-02 token ADR](./20260814-pre02-design-tokens.md)

## 背景

仓库原为 TypeScript 骨架，无页面运行时。PRE-03 在现有 pnpm workspace 引入目标依赖并建立 Next.js Web/Terminal 与 Tauri 加载 PoC，产出依赖锁、最小构建与双端 smoke。

## 决策

### 1. 运行时版本（pnpm-lock.yaml 锁定）

| 层 | 选型 | 锁定版本 | 说明 |
|---|---|---|---|
| 工具链 | Node / pnpm / Rust | 24.12 / 10.20.0（packageManager 字段固定）/ 1.91 | bootstrap 唯一入口 `pnpm install --frozen-lockfile` |
| 框架 | Next.js (App Router) + React | 15.5.23 / 19.2.7 | 官网与 Terminal 分应用构建 |
| 服务端状态 | @tanstack/react-query | 5.90.x | 领域真相不进 Zustand |
| 本地 UI 状态 | zustand | 5.0.x | 仅布局/抽屉/筛选/草稿 |
| 表格 | @tanstack/react-table + react-virtual | 8.21.x / 3.13.x | 服务端分页 + 虚拟化 |
| 图表 | echarts / lightweight-charts | 6.1.x / 5.1.x | 分工见 PRE-02 ADR 第 7 节 |
| 表单 | react-hook-form + zod | 7.71.x / 4.4.x | 服务端校验仍为准 |
| 国际化 | next-intl | 4.12.x | 文案源在 packages/ui/src/i18n |
| 样式 | tailwindcss v4 + @tailwindcss/postcss | 4.2.x | token 集中见 PRE-02 |
| UI 基件 | @radix-ui/react-dialog / react-tabs | 最新 1.x | 按需增补 primitives |
| Mock | msw | 2.13.x | fixture 由同一 schema 驱动（PRE-06） |
| 组件文档 | storybook + react-vite + addons | 8.6.18（vite 6） | 骨架见 PRE-02，本次完成依赖落地 |
| 桌面壳 | Tauri 2 + tauri-plugin-deep-link | 2.x | 仅平台能力 |

版本替换必须修订本 ADR；CI 使用 `--frozen-lockfile`，生成 client diff 与依赖漂移进入检查。

### 2. 双端同一产物加载架构

- `apps/terminal` 以 `output: "export"` 构建静态产物 `out/`；Web（`app.sumalpha.ai`）与 Tauri Desktop 加载**同一份产物**。
- Tauri 壳（`apps/terminal-desktop/src-tauri`）：`frontendDist = ../terminal/out`，dev 模式 `devUrl = http://localhost:3100`（与 `terminal dev` 端口一致）；注册 `quantos://` 深链；最小窗口 1180×760；最小 capability（core:default + deep-link:default）；CSP 默认拒绝。
- PoC 阶段选择静态 export 的理由：双端产物字节级一致、无 Node 服务端依赖、Tauri 嵌入简单。约束：后续需要 SSR/ISR 的官网不受此限（官网独立应用）；Terminal 为登录后应用，全部数据经 BFF 客户端拉取，静态 export 不损失能力。若未来引入服务端渲染需求，须修订本 ADR 并改为本机 loopback 加载方案。
- Terminal 全站 `noindex, nofollow` 由 `app/layout.tsx` metadata 保证（output export 下自定义 headers 不生效，故不采用 headers 方案）。
- Tauri 壳通过 root `Cargo.toml` 的 `workspace.exclude` 独立于领域 crate workspace，GUI 依赖不进入 `cargo check/clippy --workspace`。

### 3. 验证机制

- 双端 smoke：`scripts/pre03-smoke.mjs` 验证 ①Terminal `/command` 可打开 ②官网首页可打开 ③Tauri 配置加载同一产物 + 深链 + 窗口约束 ④`quantos://command ↔ /command` 路由一致。
- 真实 Tauri 窗口冒烟（`pnpm --filter @sumalpha/terminal-desktop tauri dev` 或等价命令）需 GUI 会话，列为 G0 前人工验证项；自动化侧由 `cargo check`（Rust 壳编译）+ 配置 smoke 覆盖。

## 后果

- 正向：Web/Desktop 同路由同产物；新环境 bootstrap/build/test 全链路可脚本化计时；lockfile 冻结全部版本。
- 约束：业务代码禁止出现 `isDesktop` 分叉；平台差异只进 `packages/platform` 与 src-tauri；静态 export 下不可使用 Next 服务端特性（headers/rewrites/middleware），鉴权与守卫在客户端 + BFF 实现。
- 实测（2026-08-14，本机）：pnpm 依赖安装约 3.5 分钟；terminal build 7.6s、website build 7.2s；双端 smoke <5s；Tauri Rust 壳首次 cargo check 含依赖编译约数分钟。全程远低于 30 分钟门槛。
