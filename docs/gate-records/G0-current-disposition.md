# G0 当前遗留子项处置（2026-10-05）

历史十项的 owner、日期、兼容策略和逾期事实仍保存在原评审记录。以下按当前一期 Web 与阶段门禁拆分；检查点是最晚消费边界，不冒充 owner 新签署的日历承诺。未来子项没有被关闭，当前工程交付也没有把历史整项改成 CLOSED。

结构化来源：[G0-current-disposition.json](./G0-current-disposition.json)。六方当前范围确认仍待补。

| 子项 | 范围 | 阶段 / 最晚门禁 | Owner | 状态 | 兼容策略 |
|---|---|---|---|---|---|
| G0-L01-1 | Backtest SSE schema/path/provider | INTEGRATION / FE:BFF-FE-004 | BFF TL + Strategy owner | PENDING | 保留 getBacktest 同源轮询；SSE 未交付不得标实时 Integrated。 |
| G0-L02-1 | C02 Command planned operations | INTEGRATION / FE:BFF-FE-002 | BFF TL + Observability owner + Auth owner | PENDING | 只用同源命名与 fixture；发布 schema/provider 前不进入业务集成。 |
| G0-L02-2 | C17 phase-one generated contract and reference provider | DEVELOPMENT / FRONTEND-GATE:G0 | BFF TL + Observability owner + Auth owner | IMPLEMENTED_ENGINEERING | 按 BFF-FE-001 的实际工程范围引用；目标发布另验。 |
| G0-L03-1 | C12 market contracts/provider | INTEGRATION / FE:BFF-FE-005 | BFF TL + Market Data owner + Portfolio owner | PENDING | 许可证约束与默认拒绝；不得另建 DTO。 |
| G0-L03-2 | C14 performance contracts/provider | INTEGRATION / FE:BFF-FE-008 | BFF TL + Market Data owner + Portfolio owner | PENDING | 估值快照与账本语义同源；未交付不标 Integrated。 |
| G0-L04-1 | C10 generated audit/export contract and reference provider | DEVELOPMENT / FRONTEND-GATE:G0 | BFF TL + Audit owner + Execution owner + Recon owner | IMPLEMENTED_ENGINEERING | 复用已发布 C10；导出权限与目标发布仍独立验收。 |
| G0-L04-2 | C13 trade preflight planned extension | INTEGRATION / FE:BFF-FE-006 | BFF TL + Audit owner + Execution owner + Recon owner | PENDING | 已有 Proposal/Order 不能替代 planned preflight；禁止高风险 mock 验收。 |
| G0-L04-3 | C15 ledger/reconciliation contracts/provider | INTEGRATION / FE:BFF-FE-009 | BFF TL + Audit owner + Execution owner + Recon owner | PENDING | 只用版本化账本与同 schema fixture，不标目标联调完成。 |
| G0-L05-1 | C11 operations/admin provider | INTEGRATION / FE:BFF-FE-010 | BFF TL + Ops owner + Observability owner | PENDING | 无临时 URL/字段；未知 capability 默认拒绝。 |
| G0-L05-2 | C16 alerts provider | INTEGRATION / FE:BFF-FE-010 | BFF TL + Ops owner + Observability owner | PENDING | 禁止以 planned 名称冒充告警运行；仅同源 fixture。 |
| G0-L06-1 | Real staging IdP Web acceptance | RELEASE / FRONTEND-GATE:G0 | Auth owner + Frontend TL + Security | DEFERRED | 本地 OIDC callback 只证明 PoC；真实 IdP 在 RELEASE 记录。 |
| G0-L06-2 | Desktop system-browser callback | PHASE_TWO / FE:BFF-DESKTOP-001 | Auth owner + Frontend TL + Security | DEFERRED | P16 与 Desktop 二期隔离；一期不开放桌面登录 flag。 |
| G0-L07-1 | Per-page seven-state design approval | DEVELOPMENT / FE:FEP-1 | Product/Design owner + QA | PENDING | 每页进入对应 Sprint 前补齐七态；PRE-01 文字场景不冒充高保真稿。 |
| G0-L08-1 | Linux visual baselines and sabotage | DEVELOPMENT / FE:PRE-06 | QA | IMPLEMENTED_ENGINEERING | 现有 Linux fixtures 校验；每次 UI 变更重跑，不能当完整浏览器矩阵。 |
| G0-L08-2 | Full platform visual matrix | RELEASE / FRONTEND-GATE:G0 | QA | DEFERRED | 保留缺失平台状态；RELEASE 不以本机 Chromium 代替完整矩阵。 |
| G0-L09-1 | Current static JS budget gate | DEVELOPMENT / FE:PRE-06 | Frontend Performance owner | IMPLEMENTED_ENGINEERING | 超预算必须 ADR 与拆包复测；持续 CI 阻断。 |
| G0-L09-2 | Release performance revalidation | RELEASE / FRONTEND-GATE:G0 | Frontend Performance owner | DEFERRED | 候选版本实测首屏与长稳；开发预算不冒充发布性能验收。 |
| G0-L10-1 | Production adapter import prohibition | DEVELOPMENT / FRONTEND-GATE:G0 | Frontend TL + 对应 BFF owner | IMPLEMENTED_ENGINEERING | 生产页面禁止四类 legacy adapter，默认 fixture 仅在 tests 中组装。 |
| G0-L10-2 | Legacy adapter removal by owning domain | INTEGRATION / PROVIDER:ALL | Frontend TL + 对应 BFF owner | PENDING | 迁移对应域 scenario 到生成 adapter 后再删除；现有类明确 deprecated fixture。 |

IMPLEMENTED_ENGINEERING 的实际执行结果由本轮 G0 功能 manifest 绑定；引用文件只是来源，不独立证明运行 PASS。RELEASE 与 PHASE_TWO 继续保留未验收；PROVIDER:ALL 未 READY 前不启动新业务页面。
