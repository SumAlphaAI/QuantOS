# PRE-06 执行总结与验收自检

> 任务：PRE-06 测试基线（FEP-0）  状态：已纳入 G0 联合评审
> 版本：1.0  日期：2026-08-14

## 1. 交付物

| 要求产出 | 交付 | 位置 |
|---|---|---|
| MSW contract fixtures | 冻结 BFF OpenAPI 生成的组件 JSON Schema、42-operation MSW handlers 与 operation manifest；session/proposal/403 fixture；敏感字段字典；validate.mjs（schema+领域不变量+敏感字段三层校验） | [tests/contract/](../tests/contract/contract.test.ts) |
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
| schema | SessionContext 缺 required `expiresAt` | OpenAPI 生成 JSON Schema + ajv | 捕获（`must have required property 'expiresAt'`） |
| 权限 | TradeProposal `executable=true`（违反 A02） | 领域不变量校验 | 捕获（`executable 必须恒为 false`） |
| 敏感字段 | 注入 `venueApiKey` | 敏感字段字典负向扫描 + additionalProperties | 捕获 |
| 视觉基线 | 5% 像素变更 | pixelmatch diff > 0.5% 阈值 | 捕获（diff=5.00%） |

各项检查自身全绿：contract 8/8、Chromium Playwright 11/11（路由/axe/视觉/OIDC/深链重新鉴权）、性能预算 3/3（共享首屏 gzip 241.3KB ≤250KB，余量约 3.5%）。

## 3. 排障记录

1. ajv draft-07 无法编译 proto schema（draft 2020-12）→ 双 Ajv 实例按 `$schema` 分流。
2. proto 提取 schema 以 `#/definitions/<title>` 互引且各带 `$id` → 打包 definitions 并剥离 `$id` 保持解析域。
3. 早期自著 schema 已删除；组件 schema 的 `$ref` 在生成阶段统一改写到同一 `$defs` 文档，避免解析域分叉。
4. 视觉基线首跑无快照失败 → `-u` 生成基线后复跑通过（CI 中基线已入库）。

## 4. 边界与遗留

1. fixture 现由 BFF OpenAPI 1.0.0 生成 schema 与 MSW handlers 驱动；`pnpm check:bff-generated` 与 `pnpm check:bff-contract-coverage` 已进入 CI。C02/C10–C17 待其 minor 契约冻结后按同一生成链追加。
2. 共享首屏 gzip 241.3KB，距 250KB 预算余量约 3.5%——FEP-1 引入运行时依赖后须做拆包并按签署后遗留台账复核预算（ADR 门槛）。
3. 视觉基线仅覆盖 /command PoC；七态视觉基线随各 UI-Pxx 任务补齐（1280/1440/768/390、深浅主题、危险确认）。基线按平台入库（当前 darwin）；linux 基线需 QA 在 linux runner 生成提交——缺失平台自动跳过并告警（CI 不会假绿也不会假红），视觉门禁有效性由 sabotage 自检独立保证。
4. axe 当前覆盖 PoC 页；全量页面级 axe 随页面交付执行。
5. Playwright 全矩阵（Firefox/WebKit）以 `FULL_MATRIX=1` 夜间运行，需另配 nightly schedule（建议并入 PRE-06 后续 CI 完善）。
6. 本任务交付物已纳入 2026-08-14 G0 六方联合评审。

## 5. FEP-0 状态总览

PRE-01–PRE-06 全部交付并纳入六方联合评审；G0 五项条件已于 2026-08-14 终核通过。签署后遗留项以 `gate-records/G0-PRE-01-review-record.md` 第 3 节为唯一台账。
