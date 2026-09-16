# PRE-06 Web 测试基线

> 任务：FEP-0 / PRE-06 测试基线
>
> 状态：当前仓库开发完成（Web-only）
>
> 版本：2.0
>
> 日期：2026-09-16

## 1. 范围与分层

一期 Gate 覆盖官网与 Web Terminal：BFF contract fixture、MSW、组件/契约测试、Chromium/Firefox/WebKit E2E、axe、视觉基线完整性与性能预算。Desktop 原生构建、Tauri 深链、签名、分发与自动更新属于第二期，仅在手动 `desktop-phase2.yml` 中保留独立入口，不参与一期 PR/CI Gate。

## 2. 交付物

| 基线 | 实现 | Gate |
|---|---|---|
| BFF/MSW contract | OpenAPI `1.1.0`，55 operations / 41 schemas；未配置 operation 默认 501；覆盖 403、409、429、可执行性不变量与敏感字段 | `pnpm test:contract`、`check:bff-generated`、`check:bff-contract-coverage` |
| 浏览器 E2E | Terminal 与官网各注册 Chromium / Firefox / WebKit，固定 1440×900 桌面 viewport，同时覆盖 390px 与 200% 缩放场景 | `test:browser`、`test:browser:website` |
| 无障碍 | axe WCAG 2 A/AA，serious/critical 为阻断；可滚动下载区域可键盘聚焦 | Playwright spec |
| 视觉 | 5 个入库 PNG 由 manifest 冻结 SHA-256、尺寸、scope 与 `0.5%` 差异阈值 | `pnpm check:visual-baselines`、`pnpm sabotage:pre06` |
| 性能 | 共享首屏 JS gzip ≤250KB，单 chunk ≤200KB，CSS gzip ≤60KB | `pnpm check:perf` |
| 结构/边界 | 一期 Web workflow、三浏览器、视觉完整性、性能预算、Desktop 隔离及契约数量均有正向/负向 Gate | `pnpm check:pre06 && pnpm test:pre06` |

## 3. 可破坏验收

`pnpm sabotage:pre06` 对真实验收链逐项破坏：

| 破坏类型 | 破坏内容 | 预期拒绝 |
|---|---|---|
| schema | `SessionContext` 删除必需字段 | JSON Schema 校验拒绝 |
| 权限/交易边界 | `TradeProposal.executable=true` | 领域不变量拒绝 |
| 敏感字段 | 注入 `venueApiKey` | 敏感字段扫描与 schema 拒绝 |
| 视觉基线 | 篡改实际入库 PNG 约 5% 像素 | SHA-256 完整性与 pixel diff 均拒绝 |

`test:pre06` 额外证明删除官网 Gate、重新耦合 Desktop、纳入 Desktop 深链 spec、缩减 operation、破坏视觉完整性或放宽性能预算都会 fail closed。

## 4. 当前实测基线

- contract：12/12 通过；BFF 生成与 coverage Gate 为 55 operations / 41 schemas。
- Terminal：Chromium 27/27；Firefox 24 通过、3 个缺失对应平台快照的视觉用例跳过；WebKit 25 通过、2 个缺失对应平台快照的视觉用例跳过。
- 官网：Chromium、Firefox、WebKit 各 18/18 通过。
- 视觉：5 个入库快照的 hash、尺寸与 inventory 通过；文件名中的 `1440` 与实际 1440px 宽一致。
- 性能：共享首屏 JS 138.8KB、最大 chunk 58.1KB、CSS 10.7KB，均低于预算。

## 5. 验收边界

- 上述浏览器结果是 macOS 本地重放；GitHub Actions 和 Linux runner 本轮未运行。
- 视觉 spec 只在存在相同浏览器/平台快照时比较像素；所有已入库 PNG 无论运行平台都必须通过 manifest hash/尺寸/inventory Gate。当前不把缺失的 Linux 快照记为已验收。
- 未使用 staging/生产凭据，未发布、部署或生成外部验收回执。
- GPT-6 Astra 功能复审仍为 `NOT_STARTED / NOT RUN`；开发完成不等于联合签署或 G0 全部条件已关闭。

## 6. 下一任务

P0 仓库准备工作完成后，按执行计划进入 **BFF-FE-000：页面 BFF OpenAPI 基线**。该任务仍需满足 `CORE:F03/F05/F06` 依赖，且不得以 PRE-06 mock/consumer Gate 代替 provider 实现或 staging 验收。
