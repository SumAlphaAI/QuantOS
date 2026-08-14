# G0 放行条件核查报告（2026-08-14，终核）

> 依据：[前端开发执行计划 3.2 节](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md)
> 结论：**G0 五项条件全部满足，可以进入 FEP-1 页面功能开发。**
> 签署后遗留项不属于 G0 最低冻结面，但受 [G0 联合评审记录](./G0-PRE-01-review-record.md) 第 3 节的 owner、日历截止日和兼容策略约束。

## 1. 核查方法与结果

只采用仓库内可定位的契约、代码、CI、测试和经用户确认的组织责任人签署记录；计划、建议或待办本身不作为通过证据。

| # | G0 条件 | 结果 | 可复现证据 |
|---|---|---|---|
| 1 | BFF 发布版本化 OpenAPI，冻结会话/上下文、Research、DataSnapshot、Strategy、Portfolio/Risk、Proposal/Approval/Order 与统一错误模型；mock 不另建 schema | ✅ | `bff/openapi/quantos-bff.v1.yaml` 1.0.0，42 operations、30 schemas；GAP-01/03–09 Closed；`pnpm check:bff-openapi`、`pnpm check:bff-generated`、`pnpm check:bff-contract-coverage` 全绿；transition 自著 schema 已删除 |
| 2 | 生成 client 与 Proto/JSON Schema 一致性检查进入 CI；InMemory backend 迁移或标记待删除 | ✅ | OpenAPI 生成 TypeScript client、JSON Schema、operation manifest、MSW；CI 执行生成漂移和页面覆盖检查；`pnpm proto:check` 实际重生成 Rust/Python/TS/OpenAPI/48 JSON Schema 后检查 git drift；四组 InMemory backend 均 `@deprecated` 且页面禁用 |
| 3 | 页面台账可追踪页面 → 前端任务 → BFF 契约 → 后端计划任务 → 测试用例 → Gate | ✅ | `PRE-01-acceptance-scenarios.md` 第 6 节覆盖 31 个页面单元；Page API Coverage 的冻结域 42/42 operation 引用由 CI 校验 |
| 4 | Web/Desktop 共享页面、OIDC callback、SSE 断线续传、Tauri 深链四个 PoC 均通过 | ✅ | PRE-03 smoke 10/10；OIDC Chromium 4/4；SSE 7/7；Tauri Rust 4/4 + 深链重新鉴权 Chromium 4/4；详见 [Tauri 深链证据](./G0-tauri-deep-link-evidence.md) |
| 5 | 产品、前端、BFF、QA、安全、风控签署；未冻结项有 owner、截止日、兼容策略 | ✅ | 用户确认六方真实组织责任人均于 2026-08-14 完成确认；[联合评审记录](./G0-PRE-01-review-record.md) 已勾选通过，并逐项登记签署后遗留工作 |

## 2. 关键实现状态

### 契约与生成

- BFF OpenAPI 1.0.0 冻结 G0 最低范围 C01/C03–C09。
- `pnpm generate:bff` 从同一 OpenAPI 生成正式 client types、组件 JSON Schema、42-operation manifest 与 MSW handlers。
- `make bff-contract-check` 同时执行 OpenAPI 结构、生成漂移与页面契约覆盖检查；主 CI 和 Frontend Baseline CI 均已接入。
- `pnpm proto:check` 执行 Buf format/lint/build/breaking，并重新生成、检查 Rust/Python/TS SDK、service OpenAPI 与 JSON Schema 漂移。

### 四个 PoC

| PoC | 结果与边界 |
|---|---|
| Web/Desktop 共享页面 | Tauri `frontendDist` 与 Web 使用同一 `apps/terminal/out`；`/command` 和深链授权 Gate 同属该产物 |
| OIDC callback | PKCE S256、state 校验、return path 消毒、内存会话、安全错误与 URL 无 token 已验证；staging 真实 IdP 属签署后 FEP-1 遗留，不以 mock 标记 Integrated |
| SSE 断线续传 | sequence 去重、gap 回补、afterSequence、permission_revoked/403 终态与无重复副作用 7/7 |
| Tauri 深链 | 冷启动 `get_current`、运行中 `on_open_url`、Rust 白名单消毒、BFF `/v1/session` 重新鉴权、2xx/401/403/5xx fail-closed 导航均已验证；原始 URL 不进入 Webview |

## 3. 签署后遗留项

完整台账以 [G0 联合评审记录第 3 节](./G0-PRE-01-review-record.md)为唯一事实来源，包含：

- Backtest SSE v1.1；
- C02/C10–C17 各阶段页面契约；
- staging 真实 IdP 与签名桌面包系统浏览器回跳；
- FEP-1 页面七态稿、Linux 视觉基线、首屏 JS 预算复核；
- deprecated InMemory adapter 删除/生成接口 adapter 化。

这些事项有明确责任角色、2026-08-21 至 2026-10-09 的具体截止日和失败兼容策略。对应页面未达到自己的 DoR/Gate 时仍不得进入该页面 Sprint，也不得标记 Integrated/Done。

## 4. 放行结论

截至 2026-08-14，本报告未发现 G0 3.2 的剩余阻断项。允许进入 FEP-1，但放行不等于后续页面契约或真实环境联调自动完成；每个页面仍须遵守 Page API Coverage、阶段 Gate 和联合评审遗留项的兼容策略。
