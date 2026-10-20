# Legacy 移除控制矩阵

| 控制组 | 当前功能义务 | 结果 |
|---|---|---|
| types | Type-only compatibility models and all direct UI consumers compile | PASS |
| lint | Production fixture/import/security boundary and migrated scenario adapters | PASS |
| api-build | Current production client build; four compatibility modules must emit no runtime | PASS |
| removal | Four production classes/constructors absent; no renamed runtime or fixture re-export; compiled models empty | PASS |
| generated | All six generated contract outputs unchanged | PASS |
| consumers | All29 historical assertions retained; generated schema adapters, public exports, direct client/read-model/auth/SSE/contract regressions | PASS |
| negative | Removal/source/production bypass and existing G0 confirmation refusal regressions; historical fixtures retain original scope | PASS |
| web-poc | One current build and11 Chromium route/mock OIDC/axe/visual cases after production export removal; static JS budget only | PASS |
| original-g0 | Verify actual immutable original G0 approval/engineering closure at original e4434952/f7141e4b, no reexecution or later scope approval | PASS |
| original-all | Verify actual original ALL approval only; no134 API/Rust rerun or new-source rebinding | PASS |
| gate-tests | Current source delta, legacy completion, confirmation scope, logs/commands and atomic publication fail closed | PASS |
| plan-policy | Current local profiles and mandatory CI preserve strict admission | PASS |
| records | Only L10-2 changes beyond approved8 mappings;19 owners/deadlines preserved, future obligations not closed | PASS |
| minimum | Direct G0 minimum contract source check, no upstream Gate reruns | PASS |
| pre01 | Current contract/page/permissions traceability | PASS |
| plans | Both plans and actual stage registrations agree | PASS |

四类InMemory backend、四个旧Backend接口和旧TerminalClient/createTerminalClient运行时构造器移出生产API；四模块只含46个类型声明，其中45个原UI兼容声明主体逐字保持，新增TerminalClient类型替代旧运行时包装器。编译JS只含注释和空export。四个私有场景state仅存tests/fixtures，公开fixture factory统一调用生成operation/schema adapter及生产transport的无网络fetch；fixture与UI投影不代表真实BFF、IdP或执行authority。SSE使用生成StreamEvent校验；202仅accepted，synthetic worker结果单独观察。

原U01/S04/X06/L03断言保留，原模拟M5/审批/取消/SLA用例仅UI fixture行为；实际venue、交易权限、目标性能与持久恢复未获批准。兼容类型与fixture不是生产HTTP DTO；OpenAPI/generated/provider/原生源码字节未变。见[类型保留](./type-preservation.json)、[差异证明](./impact.json)和[ledger](./ledger-review.json)。

G0-L10-2更新IMPLEMENTED_ENGINEERING，历史整项不CLOSED；其他18项、负责人、阶段、期限/closure保持，包括先前8项原API工程绑定。原G0确认收口READY在f7141e4b保留；当前输入变化须新稿确认。当前G0和ALL工程PASS，DEVELOPMENT BLOCKED只剩新范围确认；runtime/page DENIED。
