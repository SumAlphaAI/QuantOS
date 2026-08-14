# PRE-06 执行总结与验收自检

> 任务：PRE-06 测试基线（FEP-0）  状态：交付待评审
> 版本：1.0  日期：2026-08-14

## 1. 交付物

| 要求产出 | 交付 | 位置 |
|---|---|---|
| MSW contract fixtures | schema 驱动 fixture（command-center 默认/陈旧/403、proposal），自著 BFF schema 2 个 + proto schema 打包复用；敏感字段字典；validate.mjs（schema+领域不变量+敏感字段三层校验）；MSW handlers（local-mock 用） | [tests/contract/](../tests/contract/contract.test.ts) |
| Playwright project | chromium（PR）/ FULL_MATRIX 全矩阵；webServer 服务 PRE-03 构建产物；基线 spec（路由/axe/视觉） | [playwright.config.ts](../playwright.config.ts)、[tests/e2e/command.spec.ts](../tests/e2e/command.spec.ts) |
| axe | @axe-core/playwright，严重/高等级违规为 0 | 同上（实测通过） |
| 视觉基线 | 1440 深主题基线截图已生成并入库；阈值 ≤0.5% | tests/e2e/command.spec.ts-snapshots/ |
| 性能预算 | 共享首屏 JS gzip ≤250KB、单 chunk ≤200KB、CSS ≤60KB | [check-perf-budget.mjs](../scripts/check-perf-budget.mjs)（`pnpm check:perf`） |
| 测试目录 | tests/contract、tests/e2e（后续 UI-Pxx 逐页扩充） | tests/ |
| CI job | Frontend Baseline workflow：12 步全链（token/env/contract/lint/typecheck/unit/build/smoke/perf/e2e/sabotage） | [.github/workflows/frontend-baseline.yml](../.github/workflows/frontend-baseline.yml) |

## 2. 完成标准自检（实测）

完成标准：**故意破坏 schema、权限、敏感字段或视觉基线能使 CI 失败** —— 由 `pnpm sabotage:pre06` 实测四类全部捕获：

| 破坏类型 | 破坏内容 | 捕获机制 | 实测 |
|---|---|---|---|
| schema | 缺 required 字段（failedRuns 等） | ajv contract 校验 | 捕获（`must have required property 'failedRuns'`） |
| 权限 | TradeProposal `executable=true`（违反 A02） | 领域不变量校验 | 捕获（`executable 必须恒为 false`） |
| 敏感字段 | 注入 `venueApiKey` | 敏感字段字典负向扫描 + additionalProperties | 捕获 |
| 视觉基线 | 5% 像素变更 | pixelmatch diff > 0.5% 阈值 | 捕获（diff=5.00%） |

各项检查自身全绿：contract 8/8、Playwright 3/3（路由/axe/视觉）、性能预算 3/3（首屏 gzip 234.7KB ≤250KB，余量 6%）。

## 3. 排障记录

1. ajv draft-07 无法编译 proto schema（draft 2020-12）→ 双 Ajv 实例按 `$schema` 分流。
2. proto 提取 schema 以 `#/definitions/<title>` 互引且各带 `$id` → 打包 definitions 并剥离 `$id` 保持解析域。
3. BFF 自著 schema 相对 `$id` 被拒 → 改绝对 URI。
4. 视觉基线首跑无快照失败 → `-u` 生成基线后复跑通过（CI 中基线已入库）。

## 4. 边界与遗留

1. fixture 当前由"PRE-04 字段字典转化的自著 schema + proto schema"驱动；BFF-FE-000 冻结后，handlers 与 schema 由同一 OpenAPI 生成替换（执行计划 6.1），fixture 数据保持不变。
2. 共享首屏 gzip 234.7KB，距 250KB 预算余量仅 6%——FEP-1 引入运行时依赖后须做拆包并复核预算（ADR 门槛）。
3. 视觉基线仅覆盖 /command PoC；七态视觉基线随各 UI-Pxx 任务补齐（1280/1440/768/390、深浅主题、危险确认）。基线按平台入库（当前 darwin）；linux 基线需 QA 在 linux runner 生成提交——缺失平台自动跳过并告警（CI 不会假绿也不会假红），视觉门禁有效性由 sabotage 自检独立保证。
4. axe 当前覆盖 PoC 页；全量页面级 axe 随页面交付执行。
5. Playwright 全矩阵（Firefox/WebKit）以 `FULL_MATRIX=1` 夜间运行，需另配 nightly schedule（建议并入 PRE-06 后续 CI 完善）。
6. 本任务交付物并入 G0 联合评审。

## 5. FEP-0 状态总览

PRE-01–PRE-06 全部交付完成。G0 放行仍依赖：六方联合评审签署（PRE-01 评审记录已立案）、BFF-FE-000 版本化 OpenAPI 冻结、四个 PoC 中的 OIDC callback/SSE 断线续传/Tauri 深链真实环境验证、InMemory*Backend 迁移标记。
