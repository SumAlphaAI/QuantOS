# G0 控制与台账映射

| 子项 | 契约 | 原已确认操作数 | 当前状态 |
|---|---|---|---|
| G0-L01-1 | C05 | 12 | IMPLEMENTED_ENGINEERING |
| G0-L02-1 | C02 | 2 | IMPLEMENTED_ENGINEERING |
| G0-L03-1 | C12 | 7 | IMPLEMENTED_ENGINEERING |
| G0-L03-2 | C14 | 8 | IMPLEMENTED_ENGINEERING |
| G0-L04-2 | C13 | 3 | IMPLEMENTED_ENGINEERING |
| G0-L04-3 | C15 | 7 | IMPLEMENTED_ENGINEERING |
| G0-L05-1 | C11 | 36 | IMPLEMENTED_ENGINEERING |
| G0-L05-2 | C16 | 7 | IMPLEMENTED_ENGINEERING |

8项从PENDING同步工程完成，formalClosed=false；其余11项对象逐项保持；19项负责人/阶段/期限/closure未改；历史10项签署与逾期不关闭。完整操作标识见[结构化映射](./ledger-review.json)。引用原ALL a045f15c/fce29312，未将原证据改绑到本轮源码。

| 当前功能组 | 验证责任 | 工程结果 |
|---|---|---|
| ledger | Exactly8 API engineering dispositions map to confirmed original134-operation proof; other11 items and4 remaining legacy fixture classes remain explicitly unchanged | PASS |
| records | Current19 dispositions match human/policy owner/deadline/stage plus original10 historical rows; no formal G0 activation | PASS |
| minimum | Current17 contract/22 page/134 operation and14 minimum schema freeze; infrastructure only, no upstream Gate execution | PASS |
| pre01 | Current pages, routes, permissions, all published operation source and acceptance traceability | PASS |
| generated | Compare all six generated client/Zod/schema/MSW/native policy outputs; no current API source change | PASS |
| proto | Direct G0 protocol boundary: offline lint/descriptor/breaking against explicit trusted ancestor and JSONSchema; remote codegen/full F03 Gate NOT_RUN | PASS |
| negative | Current G0 scope/contract/import/confirmation/protocol mutation refusal without upstream revalidation | PASS |
| consumers | Current auth/CSRF/generated client/schema/permission/sensitive field/SSE recovery foundation; original unchanged API runtime134 operations remain source-bound reference only | PASS |
| types | Current G0 generated client/Terminal/website foundation types, without whole workspace or upstream builds | PASS |
| lint | Current G0 frontend production import and security boundary static check | PASS |
| web-poc | One current Terminal build plus11 Chromium route/mock OIDC/axe/visual cases, client-secret scan and static JS budget; full UI/target performance NOT_RUN | PASS |
| linux-baselines | Current required Linux snapshot inventory/checksums only; no full platform campaign | PASS |
| confirmation | Actual original ALL human reply/draft/source/receipt binding only; new G0 scope is not implicitly approved | PASS |
| gate-tests | Current ledger/source delta/original proof/log/command/user scope/blocker/atomic publication refusal; L10-2 prevents premature ALL READY | PASS |
| plan-policy | G0 current local profile and ALL G0 reassessment profile register mandatory CI while current blockers deny page admission | PASS |
| plans | Both plan contracts and current stage registration agree without granting unchanged upstream Gates | PASS |

`G0-L10-2`仍PENDING，PROVIDER:ALL消费期限保持；terminal/strategy/execution/ops四个导出的InMemory backend仍在API包。现有生产导入禁令通过不能代替移除和迁移，ALL必须BLOCKED。本轮没有变更runtime/API/OpenAPI/generated字节；详见[差异证明](./impact.json)。

完整UI/业务联调、真实Supabase/PostgreSQL/Auth/RLS/Storage/worker、外部数据许可/撤权/venue、跨实例与重启持久恢复、目标安全/性能/容量/长稳/部署/同SHA hosted CI及Beta/Live发布均NOT_RUN，目标自动化NOT_IMPLEMENTED；DEVELOPMENT工程PASS不表示INTEGRATION或RELEASE通过。
