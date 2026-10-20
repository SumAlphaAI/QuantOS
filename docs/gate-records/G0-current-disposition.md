# G0 当前遗留子项处置（2026-10-20）

历史十项的 owner、日期、兼容策略和逾期事实仍保存在原评审记录。以下按当前一期 Web 与阶段门禁拆分；检查点是最晚消费边界，不冒充 owner 新签署的日历承诺。未来子项没有被关闭，当前工程交付也没有把历史整项改成 CLOSED。

子项 stage 表示工作阶段，deadline.stage 表示消费门禁阶段。设计须在页面进入 Sprint 前补齐；FEP-1 INTEGRATION 检查点只是其外层消费期限。

结构化来源：[G0-current-disposition.json](./G0-current-disposition.json)。当前范围确认由 Codex 拟稿、项目用户一人确认；文稿待确认，见[统一流程](./user-acceptance-confirmation-workflow.md)。

| 子项 | 范围 | 阶段 / 最晚门禁 | Owner | 状态 | 兼容策略 |
|---|---|---|---|---|---|
| G0-L01-1 | Backtest SSE schema/path/provider | DEVELOPMENT / FE:BFF-FE-004 | BFF TL + Strategy owner | IMPLEMENTED_ENGINEERING | Backtest轮询与SSE使用同一冻结run、权限及deadline；有限参考流不代表完整UI、真实worker或持久恢复。 |
| G0-L02-1 | C02 Command published operations | DEVELOPMENT / FE:BFF-FE-002 | BFF TL + Observability owner + Auth owner | IMPLEMENTED_ENGINEERING | Command仅为授权只读投影，遵循来源最早deadline和stream命名空间；不记录risk decision或授予执行权限。 |
| G0-L02-2 | C17 phase-one generated contract and reference provider | DEVELOPMENT / FRONTEND-GATE:G0 | BFF TL + Observability owner + Auth owner | IMPLEMENTED_ENGINEERING | 按 BFF-FE-001 的实际工程范围引用；目标发布另验。 |
| G0-L03-1 | C12 market contracts/provider | DEVELOPMENT / FE:BFF-FE-005 | BFF TL + Market Data owner + Portfolio owner | IMPLEMENTED_ENGINEERING | 市场契约/参考provider已实现；报价不执行交易，真实来源许可、时效、撤权和R01 B01/FA-H01风险继续保留。 |
| G0-L03-2 | C14 performance contracts/provider | DEVELOPMENT / FE:BFF-FE-008 | BFF TL + Market Data owner + Portfolio owner | IMPLEMENTED_ENGINEERING | Performance使用Shadow授权账本/估值快照及独立report/ticket期限；本机能力不代表真实数据库、worker或完整联调。 |
| G0-L04-1 | C10 generated audit/export contract and reference provider | DEVELOPMENT / FRONTEND-GATE:G0 | BFF TL + Audit owner + Execution owner + Recon owner | IMPLEMENTED_ENGINEERING | 复用已发布 C10；导出权限与目标发布仍独立验收。 |
| G0-L04-2 | C13 trade preflight contract and provider | DEVELOPMENT / FE:BFF-FE-006 | BFF TL + Audit owner + Execution owner + Recon owner | IMPLEMENTED_ENGINEERING | 已发布preflight是只读风险preview，不写最终decision、不消费审批；最终执行权限由独立命令路径校验，禁止高风险mock冒充执行验收。 |
| G0-L04-3 | C15 ledger/reconciliation contracts/provider | DEVELOPMENT / FE:BFF-FE-009 | BFF TL + Audit owner + Execution owner + Recon owner | IMPLEMENTED_ENGINEERING | Shadow参考对账/版本化账本与同源schema已验证；不标真实持久事务、自动修复或目标联调完成。 |
| G0-L05-1 | C11 operations/admin provider | DEVELOPMENT / FE:BFF-FE-010 | BFF TL + Ops owner + Observability owner | IMPLEMENTED_ENGINEERING | 运维/admin当前本机权限、MFA/CSRF、幂等/CAS和成员撤权已验证；未知capability默认拒绝，不标实际部署/运维授权。 |
| G0-L05-2 | C16 alerts provider | DEVELOPMENT / FE:BFF-FE-010 | BFF TL + Ops owner + Observability owner | IMPLEMENTED_ENGINEERING | 告警/订阅使用已发布schema和当前身份/范围/期限；参考事件不代表真实通知渠道或全链监控验收。 |
| G0-L06-1 | Real staging IdP Web acceptance | RELEASE / RELEASE-GATE:BETA | Auth owner + Frontend TL + Security | DEFERRED | 本地 OIDC callback 只证明 PoC；真实 IdP 在 RELEASE 记录。 |
| G0-L06-2 | Desktop system-browser callback | PHASE_TWO / FE:BFF-DESKTOP-001 | Auth owner + Frontend TL + Security | DEFERRED | P16 与 Desktop 二期隔离；一期不开放桌面登录 flag。 |
| G0-L07-1 | Per-page seven-state design approval | DEVELOPMENT / FE:FEP-1 | Product/Design owner + QA | PENDING | 每页进入对应 Sprint 前补齐七态；PRE-01 文字场景不冒充高保真稿。 |
| G0-L08-1 | Linux visual baselines and sabotage | DEVELOPMENT / FE:PRE-06 | QA | IMPLEMENTED_ENGINEERING | 现有 Linux fixtures 校验；每次 UI 变更重跑，不能当完整浏览器矩阵。 |
| G0-L08-2 | Full platform visual matrix | RELEASE / RELEASE-GATE:BETA | QA | DEFERRED | 保留缺失平台状态；RELEASE 不以本机 Chromium 代替完整矩阵。 |
| G0-L09-1 | Current static JS budget gate | DEVELOPMENT / FE:PRE-06 | Frontend Performance owner | IMPLEMENTED_ENGINEERING | 超预算必须 ADR 与拆包复测；持续 CI 阻断。 |
| G0-L09-2 | Release performance revalidation | RELEASE / RELEASE-GATE:BETA | Frontend Performance owner | DEFERRED | 候选版本实测首屏与长稳；开发预算不冒充发布性能验收。 |
| G0-L10-1 | Production adapter import prohibition | DEVELOPMENT / FRONTEND-GATE:G0 | Frontend TL + 对应 BFF owner | IMPLEMENTED_ENGINEERING | 生产页面禁止四类 legacy adapter，默认 fixture 仅在 tests 中组装。 |
| G0-L10-2 | Legacy adapter removal by owning domain | DEVELOPMENT / PROVIDER:ALL | Frontend TL + 对应 BFF owner | IMPLEMENTED_ENGINEERING | 四类生产 backend 与旧客户端构造器已移除；场景状态仅存 tests/fixtures，经生成 operation/schema adapter 校验，生产仅保留 UI 兼容类型。 |

IMPLEMENTED_ENGINEERING 的实际执行结果由本轮 G0 功能 manifest 绑定；引用文件只是来源，不独立证明运行 PASS。RELEASE 与 PHASE_TWO 继续保留未验收；PROVIDER:ALL 未 READY 前不启动新业务页面。

2026-10-20：仅8项API工程条目由PENDING映射为IMPLEMENTED_ENGINEERING，依据已确认的a045f15c/fce29312原范围回执；新G0当前核证不改绑其HTTP/原生通过。原台账字节另存本轮preflight并可由Git取回。其余11条逐项保持；G0-L10-2仍PENDING且消费期限PROVIDER:ALL，未移除的4类legacy fixture不可因8项同步而视为完成。G0新范围仍待项目用户确认，ALL不得自动READY。

2026-10-20 后续：原 G0 用户确认已单独收口并绑定 e4434952/f7141e4b；本次仅另更新 G0-L10-2 为 IMPLEMENTED_ENGINEERING。四类类实现及旧客户端构造器从生产包移除，UI 场景迁至生成契约测试 adapter。其他18项保持；历史整项不 CLOSED。当前功能输入已变化，旧批准不改绑到迁移后输入；需当前确认与门禁，ALL不自动READY。
