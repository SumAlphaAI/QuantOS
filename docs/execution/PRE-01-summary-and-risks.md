# PRE-01 执行总结、风险登记与验收自检

> 任务：PRE-01 需求拆解（P0 / 一期 Web）；开发状态：`COMPLETED`；指定模型复审：`NOT_STARTED`。
> 版本：1.3；日期：2026-10-02；依据：前端执行计划 v3.2。
> 主产物：[页面台账](./PRE-01-page-ledger-and-stories.md)、[路由/权限矩阵](./PRE-01-route-permission-matrix.md)、[验收场景](./PRE-01-acceptance-scenarios.md)。

## 1. 完成标准自检

| 要求 | 当前产物 | 验收边界 |
|---|---|---|
| 官网、一期 Terminal、全局壳、关键流程拆解为 Web Story | 30 页面单元；124 页面 Story + 8 流程 Story = 132 | 只验需求定义，不宣称页面运行通过 |
| 每项标注 P0/P1、角色、路由、风险 | 全部 132 Story 有明确字段；8 流程另有涉及页面和分步职责 | 角色在需求矩阵中冻结，实际权限仍由服务端裁决 |
| 页面台账与范围 | GS 1 + 官网 7 + Terminal 22 = 30/30 | P16/原生 Story 由二期承接 |
| 路由/权限矩阵 | 29 组 Terminal 路由 + 官网 7 页，8 角色 | 组合行与完整路由数分开；P10 仅审批人、P13 运/管、P14 管 |
| 每页七态 | 30×7=210 独立场景；另 10 流程场景 | 七态定义不等于 UI、视觉或 E2E 验收 |
| 页面追踪 | 30 行；现行 task、逻辑契约 owner、场景和 Gate 可解析 | planned operation 不等于 schema/provider 完成 |
| Web 离线 | 当前内存已加载非敏感数据只读，默认无持久领域缓存；禁写、禁认证交换/导出、不自动提交 | 原生加密缓存只由二期验证 |

`pnpm check:pre01` 使用 [需求规则基线](./PRE-01-requirements-baseline.json)，同时核对一期 catalog 与当前计划；检查字段、Story 唯一/完整集合、路由、权限、流程、冻结安全条件、任务引用、operationId 到页面契约映射与契约 owner。规则变更须同步规格/产物并重新评审，不能仅修改门禁以容纳错误要求。`pnpm test:pre01` 验证缺状态、错误角色/路由、重复 Story、删流程、越权、安全语义篡改、缺 owner 等负向情况。

## 2. 下游衔接与阶段边界

- 当前 PRE-01 只关闭仓库需求拆解范围。P0 准备检查点、A1、正式 G0、PROVIDER:ALL 与每页运行验收按最新计划独立关闭。
- PRE-04 读取本台账的实际 P0 页面；PRE-06 测试输入按 210 七态及 10 流程场景逐步建立，不强制原生运行。
- [接口覆盖登记](./PRE-01-page-api-coverage-register.md) 区分 operation published/planned；当前 OpenAPI 1.4.0 为 62 operations、51 schemas，引用检查只证明仓库覆盖。
- [二期承接表](./DESK-PRE-01-requirements-transfer.md) 保留原生 Story/场景 ID、原生流程扩展与新任务追踪，不授权 Desktop 启动或发布。

## 3. 当前风险登记

| 风险 | 等级 | 责任角色 | 处置与独立验收边界 |
|---|---|---|---|
| 七态高保真稿/真实页面尚需验收 | 高 | Product/Design + QA | 一期 22 组 Terminal 设计输入需逐态与 UI-VIS/page Gate 对齐；文字定义不代视觉通过 |
| planned API 或缺 provider/staging 回执 | 高 | BFF TL + domain owner | 逐 operation 与 A2–A6 交付一致；新页面须正式 G0 与 PROVIDER:ALL |
| 风控、审批、命令、订单、审计目标环境验收 | 高 | FE/BFF TL + Security/Risk + QA | mock 仅用于 UI，真实权限/MFA/幂等/回补/审计另有 Gate |
| 官网合规和性能 | 中 | Product/Compliance + QA | ST-WEB-08 保留禁用词与 Lighthouse/LCP 要求，页面阶段独立复验 |
| 角色需与服务端 policy 对齐 | 高 | Security/BFF TL | 当前需求默认拒绝；任何扩权需正式需求变更与 policy 证据 |
| 小屏与离线安全 | 高 | FE TL + QA | <768px 隐藏高风险入口；Web 无持久领域缓存/写队列；逐页负向验收 |
| 历史 G0 遗留项已过期 | 中 | G0 各 owner | [当前治理记录](../gate-records/G0-current-governance.json) 逐项保留日期、owner、状态；缺完整回执则逾期待补证/重排 |

## 4. 复审、历史签署与统计版本

- 2026-08-14 六方用户确认的签署记录予以保留，仅适用历史范围；不将其扩展到 2026-10-02 修订产物。参见 [历史记录与当前状态](../gate-records/G0-PRE-01-review-record.md)。
- 42 operations 是历史 OpenAPI 1.0.0 数量；2026-09-16 的 31/130/217/31 是旧双端结构基线。当前一期为 30/124/210/30，另 8 流程 Story 和 10 流程场景。
- 指定模型复审、六方重新签署、远程 CI、浏览器/真实 IdP/provider/staging/数据库验收未由本次文档修复执行，保持 `NOT RUN / NO NEW RECEIPT`。
- 当前工程复验见 [全面复审报告](../audit/PRE-01-comprehensive-review-2026-10-02.md)；历史发现保留在 [历史报告](../audit/PRE-01-comprehensive-review-history-2026-10-02.md)，上一轮结果见 [整改复验报告](../audit/PRE-01-remediation-validation-2026-10-02.md)。本轮补齐 P05/P21 的 operation 追踪并增加负向回归，不覆盖旧证据。

2026-10-05 人工验收流程更新：当前及后续原六方/多角色验收确认统一按[用户确认流程](../gate-records/user-acceptance-confirmation-workflow.md)，由 Codex 拟稿、项目用户单人确认。本文此前多人签署描述保留历史口径；当前要求以新规程为准，实际测试/目标证据仍独立验收。
