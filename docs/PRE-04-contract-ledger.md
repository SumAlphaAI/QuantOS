# PRE-04 契约台账：C01–C17 接口盘点

> 任务：PRE-04 接口盘点（FEP-0）  版本：1.0  日期：2026-08-14
> 依据：执行计划第 5 节；开发计划 F03/F05–F09、R02–R04、S01–S04、X01–X06、L01–L03；现有 proto/api-client 盘点
> 配套：[OpenAPI gap list](./PRE-04-openapi-gap-list.md)、[字段字典](./PRE-04-field-dictionary.md)、[Page API Coverage 登记表](./PRE-01-page-api-coverage-register.md)

## 1. 现有覆盖盘点（2026-08-14 核查）

| 资产 | 现状 | 可用于页面契约的程度 |
|---|---|---|
| `proto/quantos/{common,research,strategy,trading,engine,events}/v1` | F03 已冻结：17 个领域 message、14 个枚举、EngineService（5 RPC）、EventLedgerService（2 RPC） | 领域对象事实来源；字段字典以 proto 为锚。缺：会话/上下文、页面聚合、市场/K线、Performance/Report、对账页面模型、告警、运维/Admin、设置/平台消息 |
| `proto/openapi/quantos.swagger.json` | 仅 7 个 operation（EngineService_*、EventLedgerService_*） | 服务级契约，**不是** P01–P23 页面 BFF OpenAPI |
| `proto/jsonschema/v1*.schema.json`（48 个） | 由 proto 提取 | 字段字典与 fixture validator 输入 |
| `packages/api-client/src/gen/*` | Buf 生成 TS 类型（三语言 SDK 之一） | 生成层；页面不得手写重复 DTO |
| `packages/api-client/src/{terminal,strategy,execution,ops}.ts` | 手写 4 组 `InMemory*Backend`（TerminalBackend 5 能力、StrategyBackend、ExecutionBackend、OpsBackend 9 方法） | **fixture 级**，执行计划 1.3 明确不能作生产接口契约；G0 前须迁移为实现生成接口的测试 adapter 或标记删除 |
| 页面级 BFF OpenAPI | **不存在**（执行计划 1.4 核查结论 2） | BFF-FE-000–011 关闭 |

## 2. 契约台账（C01–C17）

图例：proto 覆盖 = 领域对象是否已有 proto 锚（对象级/部分/无）；契约状态按 6.4 节 `Draft → Reviewed → Mocked → Implemented → Integrated → Verified`；责任人 = BFF TL 主责 + 领域 co-owner（角色）。

| 契约 | Query | Command | Realtime | 后端任务 | proto 覆盖 | OpenAPI gap | 责任人 | mock 状态 |
|---|---|---|---|---|---|---|---|---|
| C01 Session/Context | session、workspace/account context、capabilities | reauth、MFA challenge、logout、access request | 权限/capability 变更断开通知 | F06、L03 | 部分（CommandMetadata/ActorRef/RuntimeMode；缺 Session/Context 消息） | GAP-01 | BFF TL + Auth owner（F06） | Draft；无 fixture（手写 TerminalSession 待迁移） |
| C02 Command Center | command summary 聚合 | 无（只读聚合页，设计决策） | authorized event projection | F09、R03、X01–X06 | 无（页面聚合模型新增） | GAP-02 | BFF TL + Observability owner（F09） | Draft；InMemory `getCommandCenterView` fixture |
| C03 Research Runtime | research list/get | create（幂等）、cancel | SSE stream/replay（sequence/afterSequence） | F07/F08、R03、U01 | 部分（ResearchArtifact；EngineService 流为服务级） | GAP-03 | BFF TL + Runtime owner（F07） | Draft；InMemory research fixture；Engine swagger 仅服务级 |
| C04 Snapshot/Artifact | snapshot list/get、artifact/attachment get | 无（只读，设计决策；导出走 C10） | 无（快照不可变，设计决策） | R02/R03、F05 | 对象级（DataSnapshot/ResearchArtifact/DataSourceRef/DataQuality） | GAP-04 | BFF TL + Data owner（R02） | Draft；InMemory snapshot fixture |
| C05 Strategy | strategy list、draft get、backtest get、release list/get | draft save（expectedVersion/409）、static check、backtest create、release create、approval submit、rollback request | backtest queue/run stream | S01–S04 | 对象级（StrategyRelease/Signal/DeploymentTarget；缺 Draft/Backtest 页面模型） | GAP-05 | BFF TL + Strategy owner（S01–S04） | Draft；InMemory strategy fixture |
| C06 Portfolio/Risk | portfolio/risk query | kill switch（DangerConfirm+MFA+签名） | authorized portfolio/risk projection、kill switch 广播 | X01/X02 | 对象级（Position；缺 Portfolio/Risk 读模型消息） | GAP-06 | BFF TL + Risk owner（X02） | Draft；InMemory portfolio/risk fixture |
| C07 Proposal/Risk Evaluation | proposal list/get | request evaluation（proposal/version/context hash） | proposal 状态 stream | R04、X02 | 对象级（TradeProposal/RiskDecision/RiskVerdict；**缺 counter_views 字段**） | GAP-07 | BFF TL + Risk owner（X02） | Draft；InMemory proposal fixture |
| C08 Approval/MFA | approval list/get | decide（签名+MFA challenge ref）、reauth | 无（拉取式，决策：操作前强制刷新版本/有效期） | F06、X03、L03 | 部分（RiskDecision；缺 Approval 消息） | GAP-08 | BFF TL + Auth owner（F06） | Draft；InMemory approval fixture |
| C09 Command/Order | order list/get | submit command ref（Idempotency-Key）、cancel request | order event stream（sequence） | X03/X04、L01 | 对象级（TradeCommand/Order/Fill/OrderStatus） | GAP-09 | BFF TL + Execution owner（X03/X04） | Draft；InMemory order fixture |
| C10 Audit/Export | audit search、evidence chain get | export create/poll/download（异步 job，轮询契约） | 无（轮询，设计决策） | F05、X06 | 部分（EventEnvelope/EventLedgerService 为服务级；缺搜索/导出页面模型） | GAP-10 | BFF TL + Audit owner（F05/X06） | Draft；InMemory audit/export fixture；events swagger 仅服务级 |
| C11 Ops/Admin | service health、incident list/get、member/policy/capability/flag query | approved runbook actionId、治理 CRUD（版本化、双人审批） | health/alert 广播 | F06/F09、X06 | 无（页面模型新增；Capability 可复用 engine.v1） | GAP-11 | BFF TL + Ops owner（F09） | Draft；InMemory ops/admin fixture |
| C12 Market/Candle | catalog/watchlist、venue quote、candle series/history | watchlist save、告警订阅（经 C16） | quote/candle realtime（断流定格回补） | R01/R02、L01 | 无（缺 Instrument/VenueQuote/Candle 消息） | GAP-12 | BFF TL + Market data owner（R01/R02） | Draft；无 fixture（需新建） |
| C13 Trade Preflight | order capabilities、preflight/risk refresh | 无（preflight 为查询；提交走 C07/C08/C09，决策） | quote/preflight refresh push | X01–X03、L01 | 部分（复用 trading.v1 对象；缺 preflight 模型） | GAP-13 | BFF TL + Execution owner（X03） | Draft；无 fixture（需新建） |
| C14 Performance/Report | performance summary/series/attribution | report create/poll/download（异步 job） | 报表完成通知（经 C16） | X01/X05，需 BFF 新增页面模型 | 无（缺 Performance/Report 消息；MoneyValue/DecimalValue 可复用） | GAP-14 | BFF TL + Portfolio owner（X01） | Draft；无 fixture（需新建） |
| C15 Reconciliation | recon list/get、break list/get、ledger entries | request rerun（幂等；无 edit-ledger operation） | recon status stream | X05 | 无（缺 ReconRun/Break/LedgerEntry 消息） | GAP-15 | BFF TL + Recon owner（X05） | Draft；无 fixture（需新建） |
| C16 Alert/Notification | alert list/get、subscriptions | ack/unack（不代表 resolved）、subscription save | alert stream（授权/去重/限速） | F09、X05/X06 | 无（缺 Alert 消息；EventKind 可参考） | GAP-16 | BFF TL + Observability owner（F09） | Draft；无 fixture（需新建） |
| C17 Settings/Platform | profile/session/device/notification/download query、platform capabilities | profile save、session/device revoke、MFA setup、cache clear、update check、diagnostic job | session 撤销实时失效推送 | F06、F09、L02/L03 | 无（缺 Profile/Session/Device/PlatformCapability 消息） | GAP-17 | BFF TL + Auth owner（F06）+ Platform owner（L02） | Draft；无 fixture（需新建） |

## 3. P0 页面 Query/Command/Realtime 依赖完备性矩阵

覆盖 PRE-01 台账全部 17 个 P0 页面 + 全局壳；每格为契约引用，"无"均为已记录的设计决策而非待定项。

| 页面 | Query | Command | Realtime |
|---|---|---|---|
| GS 全局壳 | C01 session/context/capabilities | C01 reauth/MFA/logout | C01 权限变更断开 + C16 全局告警流 |
| P01 身份访问 | C01 session/context | C01 OIDC 登录、MFA、logout、access request | 无（认证页无实时通道；会话失效由 401 驱动） |
| P02 Command Center | C02 summary | 无（只读聚合） | C02 authorized event projection |
| P03 Research 列表/新建 | C03 list | C03 create/cancel | 无（创建后转 P04 详情订阅） |
| P04 Research/Artifact 详情 | C03 get + C04 artifact get | C03 cancel | C03 SSE stream/replay |
| P05 数据快照 | C04 snapshot list/get | 无（只读） | 无（快照不可变） |
| P06 Strategy 目录/Lab | C05 strategy list/draft get | C05 draft save、static check | 无（回测状态经 P07 stream） |
| P07 Backtest/Release | C05 backtest get、release list/get | C05 backtest create、release create、approval submit（C08）、rollback request | C05 backtest stream |
| P08 Portfolio/Risk | C06 portfolio/risk | C06 kill switch | C06 授权投影 + kill switch 广播 |
| P09 Proposals | C07 proposal list/get | C07 request evaluation | C07 proposal 状态 stream |
| P10 Approvals | C08 approval list/get | C08 decide/MFA/reauth | 无（拉取式；操作前强制刷新） |
| P11 Orders | C09 order list/get | C09 cancel request | C09 order event stream |
| P12 Audit/Export | C10 search/chain | C10 export create/poll/download | 无（异步 job 轮询契约） |
| P15 设置 | C17 profile/session/device query | C17 save/revoke/MFA setup | C17 会话撤销实时失效 |
| P18 Markets | C12 catalog/quote | C12 watchlist save（订阅经 C16） | C12 quote realtime |
| P19 K 线 | C12 candle series/history | 无（只读分析；受控导出经 C10） | C12 candle realtime |
| P20 Trade Ticket | C13 order capabilities/preflight + C12 quote | C07 request evaluation → C08 approval → C09 submit command ref | C13 preflight/quote refresh |
| P22 Reconciliation | C15 recon/break/ledger query | C15 request rerun | C15 status stream |

结论：17/17 P0 页面 + 全局壳的 Query/Command/Realtime 依赖全部显式登记，无"待开发时再定"项。

## 4. 接口责任人总表

| 角色 | 责任范围 | 签署事项 |
|---|---|---|
| BFF TL | 全部 C01–C17 契约主责；BFF-FE-000 基线 | OpenAPI、错误 envelope、权限裁剪、幂等、实时回补、correlation/审计 |
| Auth owner（F06/L03） | C01、C08、C17（共） | OIDC/MFA/recent-auth、职责分离、会话撤销 |
| Runtime owner（F07/F08） | C03 | 任务/流式/取消/恢复语义 |
| Data owner（R02） | C04、C12（共） | 快照质量/许可/时效阻断 |
| Strategy owner（S01–S04） | C05 | 草稿版本/409、验证阻断、allowedTargets |
| Risk owner（X02） | C06、C07 | 风险结论权威、kill switch |
| Execution owner（X03/X04/L01） | C09、C13 | command ref、订单事实流、preflight |
| Portfolio owner（X01） | C14（共） | 读模型口径、provisional |
| Recon owner（X05） | C15、C16（共） | 对账差异状态、禁改账 |
| Audit owner（F05/X06） | C10 | 证据链、脱敏、导出审计 |
| Observability owner（F09） | C02、C11、C16 | 聚合预算、健康投影、告警授权/去重/限速 |
| Market data owner（R01/R02） | C12 | 行情来源/venue/asOf/quality |
| Platform owner（L02） | C17（共） | Desktop/Web capability 一致 |
| QA | 全部契约的 consumer/provider contract | fixture 与 staging 一致性 |
| Security | 全部契约敏感字段负向扫描 | 密钥/token/敏感载荷不进入 schema |

## 5. mock 状态汇总

| mock 形态 | 契约 | 状态与迁移要求 |
|---|---|---|
| 手写 InMemory fixture（已存在） | C02–C09、C10、C11 部分 | 仅作场景 fixture；BFF-FE-000 冻结后须由同一 OpenAPI 生成 MSW 替换；InMemory*Backend 迁移为生成接口的测试 adapter 或标记删除（G0 条件） |
| 服务级 swagger（可作 fixture 参考） | C03、C10 部分（Engine/EventLedger 7 operation） | 仅覆盖服务层，不代表页面 BFF；页面 mock 仍需页面级 schema |
| 无 fixture（需新建） | C01、C12、C13、C14、C15、C16、C17 | BFF-FE-000 冻结 schema 后由生成式 MSW 提供成功/拒绝/冲突/限流/断流/陈旧/权限场景（执行计划 6.1） |
