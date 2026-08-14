# G0 放行条件核查报告（2026-08-14）

> 依据：[前端开发执行计划 3.2 节](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md) G0 五项条件
> 结论：**G0 未通过，暂不可进入页面功能开发**（2026-08-14 二核：条件 2/4 大幅推进后，仍余条件 1、5 与 PoC 真实环境验证）。
> 阻断项均有明确责任人与建议截止日（见第 3 节），补齐后复核。

## 0. 进展记录（2026-08-14 二核）

| 未冻结项 | 状态 | 证据 |
|---|---|---|
| #2 counter_views proto 增补 | ✅ 已关闭 | [trading.proto](../../proto/quantos/trading/v1/trading.proto) field 16 非破坏新增；三语言 SDK + swagger + JSON Schema 已重生成；`pnpm proto:check`（Buf breaking）通过；字段字典改锚 proto |
| #3 InMemory*Backend 标记 | ✅ 已关闭 | 四组类全部 `@deprecated` 标记"待删除/仅 fixture/页面禁用"（[terminal.ts](../../packages/api-client/src/terminal.ts) 等）；迁移或删除随 BFF-FE-000 执行 |
| #4 OIDC callback PoC | ✅ PoC 通过（mock IdP）；真实 IdP 验证遗留 | [flow.ts](../../apps/terminal/src/auth/flow.ts)（PKCE S256/return path 消毒/内存会话/安全错误）+ /login、/auth/callback；vitest 7 项 + Playwright 4 项（state 不匹配/跨站 return_to/error 不泄露/URL 无 token）全过。**遗留：staging 真实 IdP + 桌面系统浏览器回跳验证（随 P01）** |
| #5 SSE 断线续传 PoC | ✅ 通过 | [sse.ts](../../packages/api-client/src/sse.ts)：sequence 去重、gap 触发 afterSequence 回补、权限撤销/403 终态关闭；真实 HTTP SSE 测试 7/7 |

## 1. 核查方法

对仓库现状逐项取证（文档、配置、CI、代码与实测记录），不以计划或意向作为通过依据。

## 2. 逐项结论

### 条件 1：BFF 发布版本化 OpenAPI（会话/上下文、Research、DataSnapshot、Strategy、Portfolio/Risk、Proposal/Approval/Order、统一错误模型）——❌ 未达成（提案已起草，待 BFF TL 评审冻结）

证据：
- 仓库现有 [quantos.swagger.json](../../proto/openapi/quantos.swagger.json) 仅含 7 个服务级 operation（`EngineService_*`、`EventLedgerService_*`），无页面级 BFF OpenAPI。
- **进展（2026-08-14）**：BFF-FE-000 基线提案已起草——[quantos-bff.v1.yaml](../../bff/openapi/quantos-bff.v1.yaml)（OpenAPI 3.1，42 operations，覆盖 C01/C03–C09 + 统一错误模型），结构校验通过（[提案说明](../BFF-FE-000-openapi-proposal.md)）；GAP-01/03–09 转 In Design。**冻结与发布属 BFF TL 职责，未冻结前条件仍不满足。**
- ~~新发现 proto 缺口：`TradeProposal` 缺 `counter_views` 字段~~ → 已增补 field 16（见进展记录 #2）。

要求："未实现接口允许 mock，但 schema 不允许另起一套"——当前 mock schema 为过渡自著版，已在 PRE-06 遗留项 1 登记替换义务，合规；但 BFF 版本化 OpenAPI 本体不存在，条件不满足。

### 条件 2：生成 client 与 Proto/JSON Schema 一致性检查进入 CI；InMemory*Backend 迁移或标记待删除——✅ 达成（2026-08-14 二核）

- ✅ proto 一致性已入 CI：[ci.yml](../../.github/workflows/ci.yml) 执行 `make proto-check`（Buf breaking + 生成检查）；TS 生成类型在 packages/api-client/src/gen 由 Buf 产出。
- ✅ 四组 `InMemory*Backend` 已全部 `@deprecated` 明确标记"待删除（仅 fixture，页面禁用）"；迁移为生成接口测试 adapter 或删除随 BFF-FE-000 执行（第 3 节 #3 已关闭）。

### 条件 3：页面台账可追踪 页面 → 前端任务 → BFF 契约 → 后端计划任务 → 测试用例 → Gate——✅ 达成

- [验收场景表第 6 节](../PRE-01-acceptance-scenarios.md)：31 页面 ×（UI 任务、C 契约、BFF-FE 任务、后端 F/R/S/X/L 任务、ACC 场景、Gate）全链映射。
- [契约台账](../PRE-04-contract-ledger.md) 与 [Page API Coverage 登记表](../PRE-01-page-api-coverage-register.md) 提供 operationId 回填位。

### 条件 4：四个 PoC 通过——⚠️ 部分达成（3.5/4，2026-08-14 二核）

| PoC | 结论 | 证据 |
|---|---|---|
| Web/Desktop 共享页面 | ✅ 通过 | PRE-03：双端共享 `apps/terminal/out` 同一产物；[smoke 7/7](../../scripts/pre03-smoke.mjs)（/command 双端路由一致、frontendDist 同一产物） |
| OIDC callback | ✅ 通过（mock IdP）；真实 IdP 验证遗留 | PKCE S256（RFC 7636 向量）、state 校验、code_verifier 交换、return path 消毒、内存会话、错误不泄露、URL 无 token；vitest 7 项 + [Playwright 4 项](../../tests/e2e/auth-callback.spec.ts)全过。遗留：staging 真实 IdP + 桌面系统浏览器回跳（随 P01 验收） |
| SSE 断线续传 | ✅ 通过 | [sse.ts](../../packages/api-client/src/sse.ts) 真实 HTTP SSE 测试 7/7：去重、乱序丢弃、gap 回补、权限撤销/403 终态、断流续传无重复副作用 |
| Tauri 深链 | ⚠️ 配置级通过，缺真实投递验证 | `quantos://` 已在 [tauri.conf.json](../../apps/terminal-desktop/src-tauri/tauri.conf.json) 注册且 smoke 校验；真实 `tauri dev` 窗口 + 深链投递 + BFF 重新鉴权验证需 GUI 会话（第 3 节 #6，人工验证项） |

### 条件 5：六方签署 G0 记录；未冻结项有责任人、截止日和兼容策略——❌ 未达成

- [G0-PRE-01-review-record](./G0-PRE-01-review-record.md) 已立案，但六方签署全部为"待评审"，无一方完成签署（签署须各角色 owner 本人完成，无法代签）。
- 未冻结项的责任人已在各 PRE 风险登记中分配角色，但**缺统一截止日与兼容策略汇总**——本报告第 3 节补齐该汇总，供评审签署时一并确认。

## 3. 未冻结项汇总（责任人 / 建议截止日 / 兼容策略）

| # | 未冻结项 | 责任人 | 建议截止 | 兼容策略 |
|---|---|---|---|---|
| 1 | BFF-FE-000 版本化 OpenAPI 基线（GAP-00 统一基线 + C01/C03–C07/C09 优先）——**提案已起草（42 ops，校验通过），待 BFF TL 评审冻结** | BFF TL（Frontend TL/QA/安全/领域 owner 联签） | FEP-0 W2 末 | 未实现接口用同 schema MSW mock；页面只可标记 UI Complete，不得 Integrated |
| ~~2~~ | ~~counter_views proto 增补~~ ✅ 已关闭（2026-08-14） | Risk owner（X02）+ BFF TL | – | 已按兼容策略执行：proto field 16 非破坏新增，Buf breaking 通过 |
| ~~3~~ | ~~InMemory*Backend 标记~~ ✅ 已关闭（2026-08-14） | Frontend TL | – | 已标记 @deprecated；迁移/删除随 BFF-FE-000 |
| ~~4~~ | ~~OIDC callback PoC（mock）~~ ✅ PoC 已通过；真实 IdP 验证移交 P01 | Auth owner（F06）+ Frontend TL | FEP-1 W3（真实 IdP） | mock PoC 已锁定语义；staging 真实 IdP + 桌面回跳随 P01 验收 |
| ~~5~~ | ~~SSE 断线续传 PoC~~ ✅ 已通过（2026-08-14） | BFF TL + Runtime owner（F07） | – | PoC 语义冻结于 sse.ts；BFF 契约以其为准定义 stream envelope |
| 6 | Tauri 深链真实投递验证（GUI 会话） | Frontend TL + Security | FEP-1 W3 前 | 人工验证记录归档；自动化保持 cargo check + 配置 smoke |
| 7 | 六方 G0 签署 | 产品/前端/BFF/QA/安全/风控各自 owner | #1、#6 齐备后 2 个工作日内 | 有条件通过须逐条登记遗留项（owner+截止日） |
| 8 | linux 视觉基线生成入库 | QA | FEP-1 前 | 缺失平台自动跳过并告警，门禁有效性由 sabotage 自检保证 |
| 9 | 首屏 JS 预算余量复核（当前 238.9/250KB） | FE Performance owner | FEP-1 首 Sprint | 超限须 ADR + 拆包证据 |

## 4. 复核方式

1. 第 3 节 1–6 项补齐后，重跑：`pnpm smoke:pre03`、`pnpm test:contract`、`pnpm exec playwright test`、`node scripts/pre06-sabotage-check.mjs`、PoC 验证记录归档。
2. 六方在 [G0-PRE-01-review-record](./G0-PRE-01-review-record.md) 完成签署（本报告第 3 节作为"未冻结项"附件）。
3. 全部满足后更新本报告结论为"G0 通过"，方可进入 FEP-1 页面功能开发。
