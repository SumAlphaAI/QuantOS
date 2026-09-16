# PRE-03 验收证据（2026-09-16）

> 任务：FEP-0 / PRE-03 技术栈落地
> 验证基线：`1c187ece615b120512822587ca20f8d4f893eaf2`
> 环境：macOS，Node.js `v24.12.0`，pnpm `10.20.0`，Rust/Cargo `1.91.0`
> 证据边界：验证当前仓库的运行时 pin、依赖锁、最小构建、共享 Terminal 产物、Tauri 配置与深链接线；未使用生产凭据、外部服务、签名证书或发布授权。

## 1. 开始状态与锁文件

- 开始时 `git status --short --branch` 为 `## main...origin/main`，工作区和暂存区均为空；HEAD 与 `origin/main` 均为上述基线提交。
- 检查 `Cargo.lock`、`buf.lock`、`engines/uv.lock`、`pnpm-lock.yaml`、桌面壳 `Cargo.lock`、fork/repository 与 third-party baseline 锁文件；本任务未产生锁文件差异。
- 发现宿主默认 pnpm 为 11.21.0，与根 `packageManager` 不符；验收命令显式使用 Node 24.12.0 的 Corepack shim，使实际 pnpm 为 10.20.0。新增 `.nvmrc` 后 Node 版本也可由仓库解析。

## 2. 发现与修复

1. 旧 ADR 把 React 写为 19.2.7，并用多个 `x` 范围描述依赖，与当前锁文件解析值不一致；已改为 26 项实际前端锁定版本及精确 Tauri 版本。
2. 旧 smoke 使用固定端口，只检查少量字符串，并可能把 `404.html` 回退当成 HTTP 200；已改为临时回环端口、真实 404、构建路由和 43 项运行时契约检查。
3. Node 24.12.0 只存在于 CI，仓库缺少开发机 pin；已新增 `.nvmrc`，并纳入 Gate。
4. 锁文件 Gate 未覆盖 `buf.lock` 与桌面壳 `Cargo.lock`；现已补齐。
5. 旧 smoke 没有破坏性证据；新增 5 个负向测试，覆盖依赖漂移、桌面产物分叉、深链消毒缺失和工具链漂移。
6. Frontend Baseline 原先只执行 smoke；现同时执行 `check:pre03` 与 `test:pre03`。

## 3. 隔离新环境计时

在 `/private/tmp` 建立不含 `.git`、`node_modules`、`.next`、`out`、`storybook-static`、`target` 等缓存/产物的副本：

- `pnpm install --frozen-lockfile --offline`、全量 lint/test、Terminal/Website/Storybook 构建、PRE-03 正负 Gate：37.73s。
- `cargo check --locked --manifest-path apps/terminal-desktop/src-tauri/Cargo.toml` 冷目标目录：16.70s。
- 合计约 54.43s，小于 30 分钟完成标准。

首次尝试使用宿主 pnpm 11.21.0，在 0.45s 即因 native binary 身份不在锁文件中而失败；切换到仓库声明的 pnpm 10.20.0 后成功。这次失败未产生安装结果或锁文件变化。隔离验证复用了本机 pnpm/Cargo 下载缓存，因此不把结果外推为完全无缓存的首次联网下载时长。

## 4. 验证命令与结果

| 命令 | 结果 | 关键输出 |
|---|---|---|
| `pnpm check:pre03` | PASS | `quantos-pre03/v1`；26 locked dependencies；43 runtime contract checks；3 built route checks |
| `pnpm test:pre03` | PASS | 5/5 负向测试 |
| `pnpm lint` | PASS | 8 个 workspace 项目 |
| `pnpm test` | PASS | 22 个测试文件、109 个测试；SSE 用例使用本机临时回环端口 |
| `pnpm --filter @sumalpha/terminal build` | PASS | 17 个静态页面；`/command` First Load JS 126 kB |
| `pnpm --filter @sumalpha/website build` | PASS | 12 个静态页面 |
| `pnpm --filter @sumalpha/ui build-storybook` | PASS | Storybook 8.6.18 / Vite 6.4.3 静态构建 |
| `cargo check --locked --manifest-path apps/terminal-desktop/src-tauri/Cargo.toml` | PASS | Tauri 2.11.5 / deep-link 2.4.9 锁定编译 |
| `bash scripts/check-lockfiles.sh` | PASS | 根 Cargo、Buf、pnpm、Engine uv、桌面 Tauri Cargo 锁文件均存在 |
| `node scripts/check-development-plans.mjs --fresh-review` | PASS | `quantos-plan-review/v1` structure PASS；platform/model 均为 `NOT_RUN` |

## 5. Gate 结论

- **PRE-03 repository Gate：PASS。** 运行时 ADR、锁文件、最小构建与双端共享产物 smoke 均有可重放证据，关键约束有负向测试。
- **PRE-03 development status：COMPLETED。** 表示仓库内技术栈落地完成，不代表原生 GUI、签名包、目标环境或发布验收完成。
- **30 分钟 Gate：PASS。** 当前机器、现有下载缓存条件下，隔离 workspace 全链约 54.43s。
- **Web/Desktop 同路由 Gate：PASS（产物与配置层）。** Web `/command` 来自 `apps/terminal/out`；Tauri 精确加载同一目录。原生窗口人工打开未计入此结论。
- **GPT-6 Astra 功能复审：NOT_STARTED / NOT RUN。** 未伪造 Codex 平台加载或模型结论。

## 6. 未决风险

1. 未执行 Tauri 原生窗口、冷/热深链的真实 OS/GUI 手测，也未构建或签名候选发布包；这些需要独立候选包验收授权。
2. 完全空下载缓存下的网络安装耗时未测；本次只证明干净 workspace 可由冻结锁文件离线重建并远低于 30 分钟。
3. Next 构建仍提示 ESLint 未检测到 Next 插件；构建与 workspace lint 均通过，但后续应在独立 lint 配置任务中评估规则覆盖。
4. Storybook 仍有 `use client`/source map、第三方 `eval` 与大于 500 kB 文档工具 chunk 的非阻断警告；这些不属于 Terminal 生产 bundle。

## 7. 下一可执行任务

按执行计划依赖顺序为 **PRE-04：接口盘点**。开始前应保持 PRE-01、PRE-02、PRE-03 正向 Gate 与负向测试通过，并继续把开发完成与 GPT-6 Astra 功能复审状态分开记录。
