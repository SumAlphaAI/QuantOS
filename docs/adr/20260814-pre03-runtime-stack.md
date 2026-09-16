# ADR: 前端运行时技术栈落地（PRE-03）

- 状态：已落地；2026-09-16 仓库 Gate 复核通过（GPT-6 Astra 复审未运行）
- 日期：2026-08-14；复核：2026-09-16
- 关联：PRE-03 技术栈落地；执行计划第 2 节；[PRE-02 token ADR](./20260814-pre02-design-tokens.md)

## 背景

仓库原为 TypeScript 骨架，无页面运行时。PRE-03 在现有 pnpm workspace 引入目标依赖并建立 Next.js Web/Terminal 与 Tauri 加载 PoC，产出依赖锁、最小构建与双端 smoke。2026-09-16 复核发现旧文档中的部分版本范围和 React 版本已经不符合实际锁文件，因此将锁文件解析、共享产物约束和负向测试固化为 Gate。

## 决策

### 1. 运行时版本（锁文件实际解析值）

| 层 | 选型 | 锁定版本 | 说明 |
|---|---|---|---|
| 工具链 | Node / pnpm / Rust | 24.12.0 / 10.20.0 / 1.91.0 | `.nvmrc`、`packageManager`、`rust-toolchain.toml` 固定；bootstrap 使用 `pnpm install --frozen-lockfile` |
| 框架 | Next.js / React / React DOM | 15.5.23 / 19.2.8 / 19.2.8 | App Router；官网与 Terminal 分应用构建 |
| 服务端状态 | @tanstack/react-query | 5.101.4 | 领域真相不进 Zustand |
| 本地 UI 状态 | zustand | 5.0.15 | 仅布局、抽屉、筛选与草稿 |
| 表格 | @tanstack/react-table / react-virtual | 8.21.3 / 3.14.9 | 服务端分页 + 虚拟化 |
| 图表 | echarts / lightweight-charts | 6.1.0 / 5.2.1 | 分工见 PRE-02 ADR 第 7 节 |
| 表单 | react-hook-form / zod | 7.85.0 / 4.4.3 | 服务端校验仍为准 |
| 国际化 | next-intl | 4.13.6 | 文案源在 `packages/ui/src/i18n` |
| 样式 | tailwindcss / @tailwindcss/postcss | 4.3.3 / 4.3.3 | token 集中见 PRE-02 |
| UI 基件 | @radix-ui/react-dialog / react-tabs | 1.1.23 / 1.1.21 | 按需增补 primitives |
| Mock | msw | 2.15.0 | fixture 由同一 schema 驱动（PRE-06） |
| 组件文档 | storybook / vite | 8.6.18 / 6.4.3 | 骨架见 PRE-02，本次确认锁定依赖与静态构建 |
| 桌面壳 | Tauri / tauri-plugin-deep-link | 2.11.5 / 2.4.9 | 仅平台能力；版本来自桌面壳 `Cargo.lock` |

表中是 2026-09-16 锁文件的实际解析值，不以 `package.json` 中的 semver 范围代替锁定版本。版本替换必须修订本 ADR 与 `expectedLockedVersions`；CI 使用 `--frozen-lockfile`，依赖漂移进入 PRE-03 Gate。

### 2. 双端同一产物加载架构

- `apps/terminal` 以 `output: "export"` 构建静态产物 `out/`；Web（`app.sumalpha.ai`）与 Tauri Desktop 加载同一份产物。
- Tauri 壳（`apps/terminal-desktop/src-tauri`）：`frontendDist = ../terminal/out`，dev 模式 `devUrl = http://localhost:3100`；注册 `quantos://` 深链；最小窗口 1180×760；最小 capability；CSP 默认拒绝。
- 静态 export 保证双端产物一致且不依赖本地 Node 服务。Terminal 数据经 BFF 客户端拉取；若未来需要服务端渲染，须修订本 ADR 并重新设计桌面加载方式。
- Terminal 全站 `noindex, nofollow` 由 `app/layout.tsx` metadata 保证。
- Tauri 壳通过根 `Cargo.toml` 的 `workspace.exclude` 独立于领域 crate workspace，GUI 依赖不进入根 workspace 检查。

### 3. 验证机制

- 正向 Gate：`pnpm check:pre03` 解析工具链、pnpm/Tauri 锁文件、Next/Tauri 配置和 Rust 壳；校验 26 项前端锁定依赖、Tauri 依赖、共享产物、静态 export、窗口和深链接线，并在临时回环端口打开 Terminal `/command`、`/auth/deep-link` 与官网 `/` 的真实构建产物。
- 负向 Gate：`pnpm test:pre03` 故意破坏依赖版本、桌面 `frontendDist`、深链消毒与 Node pin，必须全部被拒绝。固定端口和把 404 页面当成功的旧 smoke 行为已移除。
- CI：Frontend Baseline 在两个 Next 构建后执行正向与负向 Gate；`scripts/check-lockfiles.sh` 同时要求根 Cargo、Buf、pnpm、Engine uv 与桌面 Tauri Cargo 锁文件。
- Tauri 深链由 Rust 壳消费冷启动/运行中事件，白名单消毒后进入 BFF session 重新鉴权 Gate。每个签名桌面候选包仍须执行 OS/GUI 回归，失败时关闭桌面深链能力。

## 后果

- 正向：Web/Desktop 同路由同产物；新环境 bootstrap/build/test 可脚本化计时；关键版本与配置漂移可失败关闭。
- 约束：业务代码禁止出现 `isDesktop` 分叉；平台差异只进入 `packages/platform` 与 `src-tauri`；静态 export 下不可使用 Next 服务端特性，鉴权与守卫在客户端 + BFF 实现。
- 隔离实测（2026-09-16，本机）：从不含 `.git`、`node_modules`、构建产物和目标缓存的临时副本执行离线 frozen install、全量 lint/test、Terminal/Website/Storybook 构建及 PRE-03 正负 Gate 用时 37.73s；同副本 Tauri `cargo check --locked` 冷构建 16.70s，合计约 54.43s，低于 30 分钟门槛。
- 证据边界：隔离验证使用本机 pnpm/Cargo 下载缓存；未运行原生 GUI、签名候选包或发布动作，不把仓库 Gate 解释为目标环境或 GPT-6 Astra 复审通过。
