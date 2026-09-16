# PRE-02 验收证据（2026-09-16）

> 任务：FEP-0 / PRE-02 设计系统预研
> 验证基线：`eaafe6723a97daa9d47d1f3f1b26183bb3e0949f`
> 环境：macOS，Node.js `v24.12.0`，pnpm `10.20.0`
> 证据边界：验证当前仓库内 Design token ADR、token/状态契约、组件清单、Storybook 骨架、WCAG 基础对比度与规范安全文案；未使用生产凭据、外部服务或发布授权。

## 1. 开始状态与锁文件

- 开始时 `git status --short --branch` 为 `## main...origin/main`，工作区和暂存区均为空。
- 当前提交为 `eaafe6723a97daa9d47d1f3f1b26183bb3e0949f`。
- 检查 `Cargo.lock`、`buf.lock`、`engines/uv.lock`、`pnpm-lock.yaml`、`forks/vibe-trading/repository.lock.json` 与 `third_party/*/baseline.lock.json`；本任务未产生锁文件差异。
- 依赖安装或升级不属于本次变更；Storybook、Radix、React 等沿用仓库已锁定版本。

## 2. 发现与修复

1. 旧脚本实际只检查 32 个对比度配对，但文档声称 36/36；缺少 dark/light 焦点环分别相对 surface 0/1 的 4 个非文本对比度检查。
2. 旧 i18n Gate 只要求 `safety.* >= 18`，删除规范 key 后补任意假 key 仍可能通过。
3. token schema、密度、断点、状态枚举与 `stateColor` 的完整映射没有进入可执行 Gate。
4. 组件清单统计写成“18 通用 + 28 领域”，与当前文档实际 19 个通用条目、25 个领域条目不一致，且未说明斜杠分组并不代表逐项实现。
5. Storybook 插件、扫描范围、双主题/双语、四视口和七个 StateBadge 基准 Story 只有配置，没有防回退检查。

本次将上述边界固化为 `quantos-pre02/v1`：精确校验冻结 token、36 组 WCAG 配对、18 条规范安全文案、占位符一致性、19/25 组件清单条目以及 Storybook 骨架；新增四类故意破坏测试并接入 Frontend Baseline CI。

## 3. 验证命令与结果

| 命令 | 结果 | 关键输出 |
|---|---|---|
| `pnpm check:pre02` | PASS | 36 WCAG pairs；18 safety keys；19 common rows；25 domain rows；7 baseline stories |
| `pnpm test:pre02` | PASS | 5/5；包含精确安全 key、状态色、焦点对比度、390 视口四类负向测试 |
| `pnpm --filter @sumalpha/ui lint` | PASS | UI 源码与测试 lint 通过 |
| `pnpm --filter @sumalpha/ui typecheck` | PASS | UI TypeScript 检查通过 |
| `pnpm --filter @sumalpha/ui test` | PASS | 2 个测试文件、7 个测试通过 |
| `pnpm --filter @sumalpha/ui build-storybook` | PASS | Storybook 8.6.18 静态构建成功 |
| `pnpm lint` | PASS | 8 个 workspace 项目 lint 全部通过 |
| `pnpm test` | PASS | 22 个测试文件、109 个测试全部通过；SSE 用例经授权使用本机回环端口 |
| `node scripts/check-development-plans.mjs --fresh-review` | PASS | 计划结构通过；平台加载与模型复审仍为 `NOT_RUN` |
| `node scripts/check-pre01.mjs` | PASS | 上游 PRE-01 依赖 Gate 仍通过 |
| `bash scripts/check-lockfiles.sh` | PASS | 必需锁文件存在且本任务无锁文件差异 |

执行 pnpm 时显式使用 Node 24.12.0 的 Corepack shim 路径，确保实际版本为仓库固定的 pnpm 10.20.0，不以宿主机 pnpm 11.21.0 绕过版本约束。

## 4. Gate 结论

- **PRE-02 repository Gate：PASS。** 三项必需产出均存在，且核心约定已具备可重放正向和负向验证。
- **PRE-02 development status：COMPLETED。** 表示设计系统预研和仓库 Gate 完成，不代表 44 个组件清单条目均已实现。
- **WCAG 2.2 AA 基础检查：PASS（36/36）。** 仅覆盖冻结 token 的文字、安全状态、图表与焦点环配对，不等于全页面浏览器可访问性验收。
- **通用安全文案：PASS（18/18）。** 规范中文原文、双语 key、非空值与占位符一致性均受 Gate 保护。
- **GPT-6 Astra 功能复审：NOT_STARTED / NOT RUN。** 未伪造模型复审或 Codex 平台加载证据。

## 5. 未决风险

1. Storybook 的 axe addon 已配置，但本次静态构建不会自动执行所有 Story 的浏览器 axe 扫描；完整 axe、键盘、焦点、读屏和 200% 缩放仍属于组件/页面实现阶段验收。
2. 组件清单是预研范围与验收边界，不是逐组件实现完成清单；领域组件八态覆盖随 `UI-Pxx` 任务关闭。
3. Storybook 构建存在 Vite 对 `use client`/source map 和大于 500 kB 文档工具 chunk 的非阻断警告；未发现构建失败，且该产物不是 Terminal 生产 bundle。
4. 2026-08-14 的 G0 六方确认属于历史记录；本次没有重新签署，也未执行真实浏览器视觉回归或外部发布。

## 6. 下一可执行任务

按执行计划依赖顺序为 **PRE-03：技术栈落地**。开始前应保持 `pnpm check:pre01`、`pnpm check:pre02` 与各自负向测试通过；PRE-03 需独立验证依赖锁、最小构建、Web/Desktop 同路由 smoke 和新环境 30 分钟 bootstrap 边界。
