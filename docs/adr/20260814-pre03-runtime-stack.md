# ADR: 前端运行时技术栈落地（PRE-03）

- 状态：Accepted（工程选型，不代表正式 G0）
- 更新：2026-10-02
- 范围：第一期官网与 Web Terminal；Desktop 属[独立第二期计划](../SumAlpha-QuantOS-Desktop-Development-Execution-Plan.md)
- 关联：[前端执行计划](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md)、[PRE-02 token ADR](./20260814-pre02-design-tokens.md)

## 决策与版本

官网与 Terminal 使用 Next.js App Router、React 与 TypeScript，独立静态导出 `out/`。Terminal 全站 `noindex, nofollow`；浏览器只访问 BFF，不访问数据库或 venue。静态导出不使用 Next 服务端特性；鉴权与守卫由客户端及 BFF 实现。

Node 固定 24.12.0，pnpm 固定 10.20.0；安装执行 `pnpm install --frozen-lockfile`。根 Rust 工具链归 CORE:F01；第一期 PRE-03 不读取 Desktop 工程文件。

以下版本为当前冻结锁的解析值，作为 PRE-03 Gate 的一致性输入。Next 从历史 15.5.23 对齐已有升级基线 15.5.24，本轮不降级框架。新增同版本 Next ESLint 插件与 React Testing Library/jsdom，以落实既定开发和组件测试规范。

| 依赖 | 锁定版本 |
|---|---|
| @next/eslint-plugin-next | 15.5.24 |
| next | 15.5.24 |
| react | 19.2.8 |
| react-dom | 19.2.8 |
| @tanstack/react-query | 5.101.4 |
| @tanstack/react-table | 8.21.3 |
| @tanstack/react-virtual | 3.14.9 |
| echarts | 6.1.0 |
| lightweight-charts | 5.2.1 |
| next-intl | 4.13.6 |
| react-hook-form | 7.85.0 |
| zod | 4.4.3 |
| zustand | 5.0.15 |
| msw | 2.15.0 |
| tailwindcss | 4.3.3 |
| @tailwindcss/postcss | 4.3.3 |
| @radix-ui/react-dialog | 1.1.23 |
| @radix-ui/react-tabs | 1.1.21 |
| storybook | 8.6.18 |
| vite | 6.4.3 |
| @testing-library/react | 16.3.0 |
| jsdom | 26.1.0 |

版本替换必须同步 ADR、manifest、锁文件与 `expectedLockedVersions`。Next 推荐及 core-web-vitals lint 启用，异步 Client Component 作为错误拒绝；`no-html-link-for-pages` 仅针对 Pages Router，本工程静态 App Router 无 pages/ 目录，明确关闭该单项规则。业务接线与页面验收由后续任务负责；安装依赖不代表全量 Query、图表、i18n 或 provider 集成完成。观测 SDK 依隐私策略批准后启用，local-mock 默认关闭。

## 构建、启动与验收

1. 正常 build 在 Next 构建后生成 `out/pre03-build.json`，包含实际构建配置、build ID，以及源文件/锁/ADR/公开环境 profile 的摘要。摘要排除构建目录、node_modules、环境凭据文件和缓存；未绑定当前来源的旧 out 无法通过。
2. `pnpm check:pre03`、`check:pre03:web`、`smoke:pre03` 默认为一期 Web。在独立子进程中逐应用读取 Next 官方配置加载器的最终有效配置及实际公开环境（支持 `.env.local` 和进程注入，防止跨应用缓存污染），校验 29 项锁版本、从实际一期 workspace 独立发现 manifests，对照全部 importer 的声明/锁集合、精确 workspace 链接目标与 overrides 一致性、包解析及快照、ADR 版本与构建来源；检查目标 HTML 引用 JS/CSS，再用 Chromium 验证 `/command` 守卫放行与官网首页渲染及无页面脚本异常。
3. 两应用 `start` 使用仓库静态服务器，端口官网3000/Terminal3100，未知页面或资源返回真实404。首次使用复制 `env/local-mock.env.example` 到两个应用的 `.env.local`，或由环境显式注入同一 profile；构建与验收使用相同公开变量。
4. `pnpm test:pre03` 为 Web 正负套件，覆盖有效配置、注释/死分支/覆盖、坏锁/ADR、坏资源、空页面、脚本异常与阶段隔离。Frontend Baseline 在构建前安装 Chromium，构建后调用正向及负向 Gate。
5. `check:pre03:desktop` / `test:pre03:desktop` 是显式二期参考检查，保留 Tauri 共享产物与深链约束，不进入一期门禁。原生 GUI、签名包及 OS 深链不是本 ADR 的一期验收内容。

## 时限与证据边界

目标为新 Web workspace ≤30分钟完成 bootstrap/build/test。重放必须记录源码与输入摘要、工具链、profile、缓存条件、命令退出码与耗时；缓存可用的干净安装不能外推为完全空下载缓存的网络时长。历史 2026-09-16 双端记录保留历史身份；当前整改证据另存 `docs/audit`。

仓库 Gate、local-mock 浏览器验证与实际 GitHub CI、正式 G0、provider/staging 验收分别记录。不得以本地通过代替外部验收。
