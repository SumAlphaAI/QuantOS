# G0 评审记录：PRE-01 需求拆解产出物联合评审

> Gate：G0（FEP-0 前期准备 Gate）  关联任务：PRE-01（评审对象），PRE-02–PRE-06 与 BFF-FE-000 状态经 G0 核查报告确认
> 提交日期：2026-08-14  提交人：Frontend（代执行）
> 状态：**已签署通过（2026-08-14，六方组织责任人确认）**
> 记录口径：用户已确认六方真实责任人完成评审；仓库记录组织责任角色与日期，个人身份由组织评审/身份系统留存，不在公开工程文档重复个人信息。

## 1. 评审对象

| # | 产出物 | 版本 | 说明 |
|---|---|---|---|
| 1 | [页面台账与 Story 拆解](../PRE-01-page-ledger-and-stories.md) | 1.0 | 31 页面单元、138 条 story，含 P0/P1、角色、路由、平台、风险级别 |
| 2 | [路由/权限矩阵](../PRE-01-route-permission-matrix.md) | 1.0 | 38 条 Terminal 路由 × 8 角色 + 官网路由 + 领域权限矩阵 |
| 3 | [验收场景表](../PRE-01-acceptance-scenarios.md) | 1.0 | 31 × 7 = 217 条七态场景 + 10 条关键流程场景 + 追踪映射 |
| 4 | [执行总结与风险登记](../PRE-01-summary-and-risks.md) | 1.0 | 完成标准自检、7 项风险、4 项遗留项 |

依据：[前端开发执行计划](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md) 第 3.1 节 PRE-01 完成标准与第 3.2 节 G0 条件。

## 2. 评审检查项（各角色签署范围）

| 角色 | 必须签署的评审点 | 结论 | 签署人/日期 |
|---|---|---|---|
| Product/Design | 页面台账范围与 P0/P1 分层正确；七态场景与设计意图一致；官网合规文案口径可执行；七态稿遗留已认领 | 通过 | Product/Design 组织责任人（用户确认）/ 2026-08-14 |
| Frontend TL | 路由/权限矩阵可实现；平台差异、小屏只读边界清晰；story 粒度可排 Sprint；生成 client 与深链 Gate 可维护 | 通过 | Frontend TL 组织责任人（用户确认）/ 2026-08-14 |
| BFF TL | C01/C03–C09 OpenAPI 1.0.0 冻结；生成与覆盖门禁有效；C02/C10–C17 遗留已认领 | 通过 | BFF TL 组织责任人（用户确认）/ 2026-08-14 |
| QA | 217 条七态 + 10 条流程可转化；sabotage、深链重新鉴权与兼容回归可执行 | 通过 | QA 组织责任人（用户确认）/ 2026-08-14 |
| Security | 默认拒绝、敏感字段、OIDC、深链 URL 消毒及重新鉴权设计通过 | 通过 | Security 组织责任人（用户确认）/ 2026-08-14 |
| Risk/Compliance | Proposal 不可执行、职责分离、kill switch、Paper/Shadow 边界及高风险 mock 限制完整 | 通过 | Risk/Compliance 组织责任人（用户确认）/ 2026-08-14 |

## 3. 评审结论记录

- [x] 六方全部签署通过 → PRE-01 标记为 Done，进入 G0 汇总
- [ ] 有条件通过：遗留项见下表（须有 owner 与截止日）
- [ ] 不通过：退回修订，修订记录追加到本文件第 4 节

| 遗留项 | Owner | 截止日 | 兼容策略 |
|---|---|---|---|
| Backtest SSE v1.1 additive 契约 | BFF TL + Strategy owner | 2026-08-28 | P07 暂用 `getBacktest` 轮询；不得宣称实时联调完成；只从同一 OpenAPI minor 版本再生成 |
| C02/C17 页面契约冻结 | BFF TL + Observability owner + Auth owner | 2026-08-21 | P02/P15/P17 只可做壳与 schema 同源 mock；operationId 未回填前不进对应 Sprint |
| C12/C14 页面契约冻结 | BFF TL + Market Data owner + Portfolio owner | 2026-09-11 | P18/P19/P21 不另建 DTO；冻结前仅设计/fixture 数据，不标 Integrated |
| C10/C13/C15 页面契约冻结 | BFF TL + Audit owner + Execution owner + Recon owner | 2026-09-25 | 审计、交易预检、对账命令只用同 schema mock；高风险验收必须在 staging provider contract 完成 |
| C11/C16 页面契约冻结 | BFF TL + Ops owner + Observability owner | 2026-10-09 | P13/P14/P23 不使用临时 URL/字段；未知能力默认拒绝 |
| Staging 真实 IdP + 桌面系统浏览器回跳 | Auth owner + Frontend TL + Security | 2026-08-21 | mock IdP 仅证明 PoC；真实验证失败时桌面系统浏览器登录 flag 保持关闭，Web 登录不受影响 |
| FEP-1 页面七态高保真稿 | Product/Design owner + QA | 2026-08-21 | 未补齐默认/加载/空/错误/无权/陈旧/离线任一状态的页面不得进入 Sprint |
| Linux 视觉基线 | QA | 2026-08-21 | 缺失平台继续显式告警；sabotage 门禁保持强制，Linux 基线入库前不宣称全平台视觉通过 |
| 首屏 JS 预算复核 | Frontend Performance owner | 2026-08-21 | 超过 gzip 250KB 必须提交 ADR、路由拆包和复测证据，否则 CI 阻断 |
| InMemory adapter 删除/生成接口 adapter 化 | Frontend TL + 对应 BFF owner | 2026-08-28 | 当前类仅 deprecated fixture；页面生产代码只允许生成 BFF client，迁移期间禁止新增调用 |

## 4. 修订记录

| 日期 | 版本 | 修订内容 | 提出方 |
|---|---|---|---|
| 2026-08-14 | 1.0 | 首次提交评审 | Frontend |
| 2026-08-14 | 1.1 | 根据六方责任人确认完成签署记录；补齐全部遗留项 owner、日历截止日与兼容策略 | Frontend（记录执行） |

## 5. G0 汇总关联

本记录与 [G0 readiness assessment](./G0-readiness-assessment.md)、[Tauri 深链证据](./G0-tauri-deep-link-evidence.md)共同构成 G0 放行记录。签署后遗留项不改变 G0 最低冻结面，但受上表 DoR/兼容策略约束。
