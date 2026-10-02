# PRE-04 契约台账：C01–C17 接口盘点

> 任务：PRE-04 接口盘点（FEP-0）  版本：1.2  日期：2026-10-02
> 依据：执行计划第 5 节；开发计划 F03/F05–F09、R02–R04、S01–S04、X01–X06、L01–L03；现有 proto/api-client 盘点
> 配套：[OpenAPI gap list](./PRE-04-openapi-gap-list.md)、[字段字典](./PRE-04-field-dictionary.md)、[Page API Coverage 登记表](./PRE-01-page-api-coverage-register.md)

## 1. 现有覆盖盘点（2026-10-02 核查）

| 资产 | 现状 | 可用于页面契约的程度 |
|---|---|---|
| `proto/quantos/{common,research,strategy,trading,engine,events}/v1` | 6 个 proto 文件：38 个领域 message、15 个枚举、2 个 service、7 个 RPC | 领域对象事实来源；字段字典以 proto 为锚。缺：会话/上下文、页面聚合、市场/K线、Performance/Report、对账页面模型、告警、运维/Admin、设置/平台消息 |
| `proto/openapi/quantos.swagger.json` | 仅 7 个 operation（EngineService_*、EventLedgerService_*） | 服务级契约，**不是** P01–P23 页面 BFF OpenAPI |
| `proto/jsonschema/v1*.schema.json` | 由 proto 提取，共 50 个 JSON Schema（F03 新增 DeploymentTarget、StrategyRelease） | 字段字典与 fixture validator 输入 |
| `packages/api-client/src/gen/*` | Buf 生成 TS 类型（三语言 SDK 之一） | 生成层；页面不得手写重复 DTO |
| `packages/api-client/src/{terminal,strategy,execution,ops}.ts` | 手写 4 组 `InMemory*Backend`（TerminalBackend 9 方法、StrategyBackend、ExecutionBackend、OpsBackend 9 方法） | **fixture 级**，执行计划 1.3 明确不能作生产接口契约；G0 前须迁移为实现生成接口的测试 adapter 或标记删除 |
| `bff/openapi/quantos-bff.v1.yaml` | 1.3.0，62 个 operation、51 个 schema；覆盖 C01/C03–C10，并覆盖 C17 的 P15/P17 面 | 由同一契约生成 TS client、组件 JSON Schema、62-operation manifest 与 MSW handlers；C01/C10/C17 Web 有本地参考 provider；C02/C11–C16 及 C04 附件/C05 实时能力仍由 catalog 的46个 planned operation 承接 |

## 2. 契约台账（C01–C17）

图例：proto 覆盖 = 领域对象是否已有 proto 锚（对象级/部分/无）；契约状态按 6.4 节 `Draft → Reviewed → Mocked → Implemented → Integrated → Verified`；责任人 = BFF TL 主责 + 领域 co-owner（角色）。

| 契约 | Query | Command | Realtime | 后端任务 | proto 覆盖 | OpenAPI gap | 责任人 | mock 状态 |
|---|---|---|---|---|---|---|---|---|
| C01 Session/Context | session、workspace/account context、capabilities | reauth、MFA challenge、logout、access request | 权限/capability 变更断开通知 | F06、L03 | 部分（CommandMetadata/ActorRef/RuntimeMode；缺 Session/Context 消息） | GAP-01 | BFF TL + Auth owner（F06） | Implemented（本地参考 provider；目标环境 NOT RUN / NO RECEIPT） |
| C02 Command Center | command summary 聚合 | 无（只读聚合页，设计决策） | authorized event projection | F09、R03、X01、X02、X03、X04、X05、X06 | 无（页面聚合模型新增） | GAP-02 | BFF TL + Observability owner（F09） | Inventory Fixture（未发布 OpenAPI；不得升级 Implemented） |
| C03 Research Runtime | research list/get | create（幂等）、cancel | SSE stream/replay（sequence/afterSequence） | F07、F08、R03、U01 | 部分（ResearchArtifact；EngineService 流为服务级） | GAP-03 | BFF TL + Runtime owner（F07） | Contract Mocked（已发布面同源生成 client/schema/MSW；未配置场景返回501；planned 能力未冻结） |
| C04 Snapshot/Artifact | snapshot list/get、artifact/attachment get | 无（只读，设计决策；导出走 C10） | 无（快照不可变，设计决策） | R02、R03、F05 | 对象级（DataSnapshot/ResearchArtifact/DataSourceRef/DataQuality） | GAP-04 | BFF TL + Data owner（R02） | Contract Mocked（已发布面同源生成 client/schema/MSW；未配置场景返回501；planned 能力未冻结） |
| C05 Strategy | strategy list、draft get、backtest get、release list/get | draft save（expectedVersion/409）、static check、backtest create、release create、approval submit、rollback request | backtest queue/run stream | S01、S02、S03、S04 | 对象级（StrategyRelease/Signal/DeploymentTarget；缺 Draft/Backtest 页面模型） | GAP-05 | BFF TL + Strategy owner（S01–S04） | Contract Mocked（已发布面同源生成 client/schema/MSW；未配置场景返回501；planned 能力未冻结） |
| C06 Portfolio/Risk | portfolio/risk query | kill switch（DangerConfirm+MFA+签名） | authorized portfolio/risk projection、kill switch 广播 | X01、X02 | 对象级（Position；缺 Portfolio/Risk 读模型消息） | GAP-06 | BFF TL + Risk owner（X02） | Contract Mocked（已发布面同源生成 client/schema/MSW；未配置场景返回501；planned 能力未冻结） |
| C07 Proposal/Risk Evaluation | proposal list/get | request evaluation（proposal/version/context hash） | proposal 状态 stream | R04、X02 | 对象级（TradeProposal/RiskDecision/RiskVerdict；counter_views 已增补） | GAP-07 | BFF TL + Risk owner（X02） | Contract Mocked（已发布面同源生成 client/schema/MSW；未配置场景返回501；planned 能力未冻结） |
| C08 Approval/MFA | approval list/get | decide（签名+MFA challenge ref）、reauth | 无（拉取式，决策：操作前强制刷新版本/有效期） | F06、X03、L03 | 部分（RiskDecision；缺 Approval 消息） | GAP-08 | BFF TL + Auth owner（F06） | Contract Mocked（已发布面同源生成 client/schema/MSW；未配置场景返回501；planned 能力未冻结） |
| C09 Command/Order | order list/get | submit command ref（Idempotency-Key）、cancel request | order event stream（sequence） | X03、X04、L01 | 对象级（TradeCommand/Order/Fill/OrderStatus） | GAP-09 | BFF TL + Execution owner（X03/X04） | Contract Mocked（已发布面同源生成 client/schema/MSW；未配置场景返回501；planned 能力未冻结） |
| C10 Audit/Export | audit search、correlation/causation evidence chain get | export create/status/cancel/download metadata（异步 job，轮询契约） | 无（轮询，设计决策） | F05、X06 | 部分（EventEnvelope/EventLedgerService 为服务级；页面模型由 OpenAPI 1.3.0 补齐） | GAP-10 | BFF TL + Audit owner（F05/X06） | Implemented（本地参考 provider；目标环境 NOT RUN / NO RECEIPT） |
| C11 Ops/Admin | service health、incident list/get、member/policy/capability/flag query | approved runbook actionId、治理 CRUD（版本化、双人审批） | health/alert 广播 | F06、F09、X06 | 无（页面模型新增；Capability 可复用 engine.v1） | GAP-11 | BFF TL + Ops owner（F09） | Draft（未发布 OpenAPI；无同源业务 fixture） |
| C12 Market/Candle | catalog/watchlist、venue quote、candle series/history | watchlist save、告警订阅（经 C16） | quote/candle realtime（断流定格回补） | R01、R02、L01 | 无（缺 Instrument/VenueQuote/Candle 消息） | GAP-12 | BFF TL + Market data owner（R01/R02） | Draft（未发布 OpenAPI；无同源业务 fixture） |
| C13 Trade Preflight | order capabilities、preflight/risk refresh | 无（preflight 为查询；提交走 C07/C08/C09，决策） | quote/preflight refresh push | X01、X02、X03、L01 | 部分（复用 trading.v1 对象；缺 preflight 模型） | GAP-13 | BFF TL + Execution owner（X03） | Draft（未发布 OpenAPI；无同源业务 fixture） |
| C14 Performance/Report | performance summary/series/attribution | report create/poll/download（异步 job） | 报表完成通知（经 C16） | X01、X05 | 无（缺 Performance/Report 消息；MoneyValue/DecimalValue 可复用） | GAP-14 | BFF TL + Portfolio owner（X01） | Draft（未发布 OpenAPI；无同源业务 fixture） |
| C15 Reconciliation | recon list/get、break list/get、ledger entries | request rerun（幂等；无 edit-ledger operation） | recon status stream | X05 | 无（缺 ReconRun/Break/LedgerEntry 消息） | GAP-15 | BFF TL + Recon owner（X05） | Draft（未发布 OpenAPI；无同源业务 fixture） |
| C16 Alert/Notification | alert list/get、subscriptions | ack/unack（不代表 resolved）、subscription save | alert stream（授权/去重/限速） | F09、X05、X06 | 无（缺 Alert 消息；EventKind 可参考） | GAP-16 | BFF TL + Observability owner（F09） | Draft（未发布 OpenAPI；无同源业务 fixture） |
| C17 Settings/Browser Platform | profile/session/device/notification/download query、browser policy | profile save、session/device revoke、MFA setup/revoke、notification prefs save | session 撤销实时失效推送 | F06、F09、L03 | 部分（会话元数据复用 common.v1；Web 页面模型以 OpenAPI 为准） | GAP-17 | BFF TL + Auth owner（F06/L03） | Implemented（本地参考 provider；目标环境 NOT RUN / NO RECEIPT） |

## 3. P0 页面 Query/Command/Realtime 依赖完备性矩阵

覆盖 PRE-01 全一期 22 个 P0 页面 + 全局壳，共23单元；静态页面和本地跳转也记录理由明确的“无”。已发布/计划 operation 依赖分别按 catalog 解释，不以登记替代实现。

| 页面 | Query | Command | Realtime |
|---|---|---|---|
| GS 全局壳 App Shell | C01 session/context/capabilities + C02 command summary + C17 profile/theme/browser policy | C01 reauth/MFA/logout + C17 profile/notification save | C01 权限撤销 + C16 全局告警流 |
| WEB-01 官网首页 | 无（静态首页内容，无服务端 Query） | 无（CTA 为本地导航） | 无（静态内容无实时通道） |
| WEB-02 官网产品页 | 无（静态产品内容） | 无（本地导航） | 无（静态内容无实时通道） |
| WEB-03 官网架构与安全页 | 无（静态架构与安全内容） | 无（本地导航） | 无（静态内容无实时通道） |
| WEB-06 官网访问申请页 | 无（公开表单无预读业务数据） | C01 submitAccessRequest（防滥用/限速/受理反馈） | 无（申请反馈由同步响应驱动） |
| WEB-07 官网登录页 | 无（官网登录入口不读取受保护数据） | C01 本地跳转 Terminal /login 后执行 SSO/OIDC；不新增官网 command | 无（登录入口无实时通道） |
| P01 身份、访问与恢复 | C01 session/context | C01 OIDC 登录、MFA、logout、access request | 无（认证页无实时通道；会话失效由 401 驱动） |
| P02 Command Center | C02 summary + C06 portfolio/risk KPIs + C16 alerts | 无（只读聚合；处置经对应详情页） | C02 authorized event projection + C06 risk projection + C16 alert stream |
| P03 Research 列表与新建 | C03 list + C04 snapshot list/get | C03 create/cancel | 无（创建后转 P04 详情订阅） |
| P04 Research 与 Artifact 详情 | C03 get + C04 artifact get + C10 evidence chain | C03 cancel + C10 export create/status/download | C03 SSE stream/replay |
| P05 数据快照目录与详情 | C04 snapshot list/get | C16 数据质量告警订阅 saveSubscription（planned） | 无（快照不可变；告警经全局 C16） |
| P06 Strategy 目录与 Lab | C05 strategy list/draft get | C05 draft save、static check | 无（回测状态经 P07 stream） |
| P07 Backtest 详情与 Release | C05 backtest/release get + C08 approval get + C10 audit/evidence chain | C05 backtest/release create/rollback + C08 decide + C10 export | C05 backtest stream（planned subscribeBacktestRun） |
| P08 Portfolio 与 Risk | C06 portfolio/risk | C06 kill switch | C06 授权投影 + kill switch 广播 |
| P09 TradeProposal 列表与详情 | C07 proposal list/get + C10 evidence chain | C07 request evaluation + C10 export | C07 proposal 状态 stream |
| P10 Approvals 与 RiskDecision | C07 proposal/evaluation context + C08 approval list/get + C10 audit/evidence chain | C08 decide/MFA/reauth + C10 export | 无（拉取式；操作前强制刷新） |
| P11 Orders 与执行详情 | C09 order list/get + C10 audit/evidence chain + C15 reconciliation references | C09 cancel request + C10 export | C09 order event stream |
| P12 Audit Explorer 与导出 | C10 search/chain | C10 export create/poll/download | 无（异步 job 轮询契约） |
| P15 Profile、安全与通知 | C01 session/context + C17 profile/session/device/security/preferences | C01 reauth/MFA + C17 profile/preferences save/session/device/factor revoke | C17 会话撤销实时失效 |
| P18 Markets 总览与标的详情 | C12 catalog/quote | C12 watchlist save + C16 alert subscription save（planned） | C12 quote realtime |
| P19 K 线与市场分析 | C12 candle series/history + C09 linked order markers | C10 受控导出 create/status/download | C12 candle realtime |
| P20 Trade Ticket 受控下单 | C13 order capabilities/preflight + C12 quote | C07 request evaluation → C08 approval → C09 submit command ref | C13 preflight/quote refresh |
| P22 Reconciliation 与账本 | C15 recon/break/ledger query + C09 linked order facts + C10 audit/evidence chain | C15 request rerun + C10 export | C15 status stream |

结论：23/23 单元逐格登记；所有 PRE-01 辅助契约均有依赖或决策。

## 4. 接口责任人总表

| 角色 | 责任范围 | 签署事项 |
|---|---|---|
| BFF TL | 全部 C01–C17 契约主责；BFF-FE-000 基线 | OpenAPI、错误 envelope、权限裁剪、幂等、实时回补、correlation/审计 |
| Auth owner（F06/L03） | C01、C08、C17（共） | OIDC/MFA/recent-auth、职责分离、会话撤销、Web browser policy |
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
| QA | 全部契约的 consumer/provider contract | fixture 与 staging 一致性 |
| Security | 全部契约敏感字段负向扫描 | 密钥/token/敏感载荷不进入 schema |

## 5. mock 状态汇总

| mock 形态 | 契约 | 状态与迁移要求 |
|---|---|---|
| OpenAPI 生成 client/schema/MSW | C01/C03–C10/C17（P15/P17） | 62 个 handler 与 51 个组件 schema 均由 1.3.0 生成；生成漂移和页面覆盖由 CI 阻断 |
| 服务级 swagger（可作 fixture 参考） | C03、C10 部分（Engine/EventLedger 7 operation） | 仅覆盖服务层，不代表页面 BFF；页面 mock 仍需页面级 schema |
| 独立场景数据 fixture | C01 session、C02 command-center、C07 proposal | 共 5 个有效场景文件；C02 仅 Inventory Fixture，不能冒充已冻结 OpenAPI |
| 无专用数据 fixture | C03–C06、C08–C17 | 已冻结域可由生成式 MSW 承载结构，但仍需按 PRE-06 补成功/拒绝/冲突/限流/断流/陈旧/权限场景；未冻结域先冻结 OpenAPI |

## 6. 控制来源与二期承接

[盘点基线](./PRE-04-inventory-baseline.json)固定本轮来源摘要、角色/任务、P0逐格决策、计划字段与本地实现依据。源版本变化必须显式复核基线；生成字段字典不会更新基线。逐项关闭见[整改记录](./audit/PRE-04-remediation-2026-10-02.md)。

一期C17只含P15/P17；原生控制面见[DESK-PRE-04承接表](./DESK-PRE-04-interface-transfer.md)。L02仍为Vault/mTLS/受限执行区安全任务，不作为原生更新或缓存能力的责任任务。
