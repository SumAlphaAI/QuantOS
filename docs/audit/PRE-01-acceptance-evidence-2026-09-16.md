# PRE-01 验收证据（2026-09-16）

> 任务：FEP-0 / PRE-01 需求拆解
> 验证基线：`8b3d817d05d9dfcf3093bc5c56fec3ce6fa304b3`
> 环境：macOS，Node.js `v24.12.0`，pnpm `10.20.0`
> 证据边界：仅验证当前仓库的需求拆解文档、结构 Gate、负向回归与锁文件不漂移；未调用生产凭据、外部服务、发布、部署、Codex 平台模型复审或真实 BFF/provider。

## 1. 开始状态与锁文件

- 开始时 `git status --short --branch` 为 `## main...origin/main`，工作区和暂存区均为空。
- 检查范围：`Cargo.lock`、`buf.lock`、`engines/uv.lock`、`pnpm-lock.yaml`、`forks/vibe-trading/repository.lock.json`、`third_party/*/baseline.lock.json`。
- `git diff --name-only -- <上述锁文件>` 无输出；本任务未修改任何依赖或基线锁文件。
- 代表性 SHA-256：`pnpm-lock.yaml` = `90d7bfaa8e8ba4b859821257a78d9ede25a8d9f8f28de3500e09c27cbfc78624`；`Cargo.lock` = `fc09180f75fb0d2bc58771dd6ee7a823e99bf0fd3900fcde22d4ae7b7242d654`；`buf.lock` = `dd67624b16fa20c7f3d9cb1ff150a3690425c3de5325f0f6b4bf045df7772db6`。

## 2. 发现与修复

旧文档把官网 7 页合并成 `ACC-WEB-S1..S7`，因此实际只有 `GS 7 + 官网聚合 7 + Terminal 23 × 7 = 175` 条页面状态，却声称 `31 × 7 = 217`。这不满足“每页至少有默认/加载/空/错误/无权/陈旧/离线状态”。

本次修复：

1. 为 WEB-01–WEB-07 分别定义 S1–S7，形成 49 条官网逐页场景，总数恢复为真实的 217 条。
2. 将官网路由矩阵绑定明确页面 ID，并把追踪表由“官网”聚合行展开为 7 条逐页映射。
3. 新增 `quantos-pre01/v1` 检查器，强制校验 31 页、Story 必填字段、路由/权限维度、每页七态、逐页追踪与唯一性。
4. 新增 4 个 Node 测试，其中 3 个负向破坏用例证明 Gate 对缺状态、非法 Story 优先级和缺追踪行 fail closed。
5. 将检查器接入 Frontend Baseline CI；PRE-01 `development_status` 更新为 `COMPLETED`，模型复审仍为 `NOT_STARTED`。

## 3. 验证命令与结果

| 命令 | 结果 | 关键输出 |
|---|---|---|
| `bash scripts/check-lockfiles.sh` | PASS | 依赖锁与基线锁检查通过 |
| `node scripts/check-pre01.mjs` | PASS | 31 pages；130 stories；217 scenarios；7 states/page；31 trace rows |
| `node --test scripts/tests/check-pre01.test.mjs` | PASS | 4/4；含 3 个故意破坏回归 |
| `node scripts/check-development-plans.mjs` | PASS | `quantos-plan-review/v1` 结构通过；平台加载/模型复审仍为 `NOT_RUN` |
| `node scripts/check-g0-records.mjs` | PASS | 历史六方确认记录与 10 条有日期兼容台账结构通过 |
| `node --check scripts/check-pre01.mjs` | PASS | 新检查器语法通过 |
| `PATH=/Users/anray/.nvm/versions/node/v24.12.0/bin:/opt/homebrew/bin:/usr/bin:/bin pnpm lint` | PASS | 8 个 workspace 项目的 lint 全部通过 |
| `PATH=/Users/anray/.nvm/versions/node/v24.12.0/bin:/opt/homebrew/bin:/usr/bin:/bin pnpm test` | PASS | 22 个测试文件、109 个测试全部通过 |

补充说明：全量测试首次在受限沙箱内执行时，4 个真实 HTTP SSE 用例因无法监听 `127.0.0.1` 报 `EPERM` 并超时；经授权仅在沙箱外重跑同一测试命令后 4/4 立即通过，全量结果为 109/109。该重跑只使用本机回环端口，未访问生产环境或外部服务。根脚本使用明确的 Node 24.12.0 shim 路径，避免用户 PATH 中 pnpm 11.21.0 覆盖仓库固定的 pnpm 10.20.0。

## 4. Gate 结论

- **PRE-01 repository Gate：PASS。** 需求拆解产物完整且可由本地命令重放，错误覆盖统计已关闭。
- **PRE-01 development status：COMPLETED。** 仅代表需求拆解代码/文档 Gate 完成。
- **GPT-6 Astra 功能复审：NOT_STARTED / NOT RUN。** 未伪造模型复审结果。
- **FEP-0 / G0 整体 Gate：不由本任务重新判定。** PRE-02–PRE-06、OpenAPI/provider、双端 PoC 与组织签署仍是独立证据层。

## 5. 未决风险

1. `design/` 的 23 组页面是否具备逐态高保真稿未在本任务执行视觉验收；文字场景通过不等于设计稿或 UI 实现通过。
2. 页面 BFF/provider、真实权限、SSE、OIDC 与 Web/Desktop 运行时未在本任务联调；mock/文档不能替代目标环境证据。
3. 2026-08-14 的组织签署是历史记录；本次修订未重新取得六方签署，也未验证其中历史截止项的当前外部状态。
4. 当前用户 PATH 的首个 `pnpm` 为 11.21.0，而仓库固定 10.20.0；本次以 Node 24.12.0 的 Corepack shim 明确执行并通过。后续本地执行需保持同一 PATH 或修正宿主机 shim，不能通过修改仓库版本约束绕过。

## 6. 下一可执行任务

按依赖顺序为 **PRE-02：设计系统预研**。执行前应读取 PRE-01 的 217 条逐页状态基线，并保持 `pnpm check:pre01` 通过；PRE-02 应产出 Design token ADR、组件清单和 Storybook 骨架，不提前宣称页面实现或真实集成完成。
