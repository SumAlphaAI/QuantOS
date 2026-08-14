# PRE-03 执行总结与验收自检

> 任务：PRE-03 技术栈落地（FEP-0）  状态：交付待评审
> 版本：1.0  日期：2026-08-14

## 1. 交付物

| 要求产出 | 交付 | 位置 |
|---|---|---|
| 运行时 ADR | 版本锁定表、双端同一产物加载架构、静态 export 决策与约束 | [docs/adr/20260814-pre03-runtime-stack.md](./adr/20260814-pre03-runtime-stack.md) |
| 依赖锁 | 全部新依赖经 pnpm-lock.yaml 冻结；`bootstrap = pnpm install --frozen-lockfile` | pnpm-lock.yaml |
| 最小构建 | Terminal `next build`（/command 静态导出，首载 102 kB ≤250KB gzip 预算）；官网 `next build`；Storybook `storybook build` 通过 | apps/terminal、apps/website、packages/ui |
| 双端 smoke | 7/7 通过（Web /command、官网首页、Tauri 配置同一产物/深链/窗口、quantos://command ↔ /command） | [scripts/pre03-smoke.mjs](../scripts/pre03-smoke.mjs)（`pnpm smoke:pre03`） |

## 2. 完成标准自检

| 完成标准 | 结果 | 证据 |
|---|---|---|
| 在现有 workspace 引入并验证目标依赖 | 达成 | next 15.5.23 / react 19.2.7 / TanStack Query·Table·Virtual / zustand / zod / RHF / next-intl / echarts / lightweight-charts / tailwind v4 / msw / storybook 8.6.18（vite 6）/ radix / Tauri 2；安装后 typecheck、lint、既有 30 项 terminal 场景测试全绿 |
| Next.js Web PoC | 达成 | apps/website App Router 首页 SSG，构建成功，smoke 可打开 |
| Next.js Terminal PoC | 达成 | apps/terminal App Router，/command 渲染共享 token + StateBadge（packages/ui），静态导出 |
| Tauri 加载 PoC | 达成 | src-tauri（Tauri 2 + deep-link 插件）加载同一 out/ 产物；quantos:// 注册；最小窗口 1180×760；最小 capability；`cargo check` 编译验证 |
| 新环境 ≤30 分钟 bootstrap/build/test | 达成 | 实测：依赖安装约 3.5 分钟；terminal build 7.6s；website build 7.2s；storybook build 3.7s；测试 3.4s；双端 smoke <5s；Tauri 壳首次 cargo check（含依赖编译）约 10 分钟级，总计远低 30 分钟 |
| Web 与 Desktop 打开同一路由 | 达成 | 双端共享 `apps/terminal/out` 产物；smoke 验证 /command 在 Web 可打开且 Tauri frontendDist 指向同一产物；quantos://command ↔ /command 映射一致 |

## 3. 排障记录（真实验证证据）

1. Storybook 10 与 addons 8 peer 冲突 → 全量对齐 8.6.18；vite 7 与 react-vite@8 不匹配 → 锁定 vite 6。
2. Next 构建无法解析 NodeNext 风格 `.js` 扩展 → packages/ui 改 Bundler resolution + 无扩展导入。
3. StateBadge 相对路径 `../` 层级错误 → 修正为 `../../tokens/index`（webpack 与 tsc 双重验证）。
4. `output: export` 不支持自定义 headers → noindex 改由 layout metadata 保证。
5. Tauri 壳与领域 cargo workspace 冲突 → root Cargo.toml `workspace.exclude` 隔离。
6. Storybook build 缺 public 目录 → 补占位目录后构建通过。
7. Tauri `generate_context!` 缺默认图标 → 以品牌 logo 作 `icons/icon.png`（首版签名图标），`cargo check` 通过（首次含依赖编译 14m43s，增量 0.5s）。

## 4. 边界与遗留

1. 真实 Tauri 窗口冒烟（`tauri dev` 打开 /command）需 GUI 会话，列为 G0 前人工验证项；自动化覆盖 = cargo check + 配置 smoke。
2. Tailwind token 接线（tokens.json → CSS 变量/theme）随 UI-103 设计系统实施完成；当前页面样式仅 PoC 级内联 token。
3. TanStack Query/Zustand/next-intl/MSW 已装未接线，接线属 FEP-1（UI-101/102）与 PRE-06（fixture）。
4. 正式制品前需补齐多尺寸图标、manifest、SBOM 与签名（执行计划第 2 节包管理行）；当前仅首版 PoC 图标。
5. `smoke:pre03` 与 `check:design` 建议并入 CI（与 PRE-06 测试基线合并实施）。
