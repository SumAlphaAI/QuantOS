# A2 / BFF-FE-001 身份、会话与设置 API 当前复审结论

> CI 修复期间说明：下文为 f764bc6 的关闭复核；测试/门禁输入变化后功能准入待当前回执刷新，历史关闭事实保留。

> 再复核日期：2026-10-05（Asia/Shanghai）
> 再复核基线：`f2283fab37386354e19ffe32df2c86a1a7e9676f`；开始时工作区干净。
> 结论：**BFF-FE-001 DEVELOPMENT READY；24/24 控制点满足（100%），20/20 API 满足本任务功能范围。**
> 当前活动问题：**阻塞级 0、高危 0、中危 0、低危 0**。

## 一、任务完成概况

依据[前端执行计划任务卡](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md#task-bff-fe-001)和 [Terminal 设计规格](../SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md) P01/P15，复核原报告六项问题的实现、调用路径、聚焦回归及内容绑定证据，均已关闭。本轮未发现需要追加代码修复的问题。

范围为 C01/C17 的身份与主上下文、MFA/reauth/logout/访问申请、资料与语言/主题、通知偏好、安全状态、会话/设备/因素撤销、撤销 SSE，以及下载元数据和浏览器能力，共 20 个 operation。全仓 API 基线为 **1.5.0 / 62 published operations / 52 schemas**。Desktop/P16、Audit 导出、页面完整业务链、通知投递和签名下载分别按其任务范围验收。

本节点及 BFF-FE-000、CORE:F06、PROVIDER:A1 的内容绑定证据和递归依赖均有效，严格门禁返回 READY、`formalAccepted=false`。闭包共 15 个节点 READY；独立 F0/G0/FEP-0 的历史准入不因本次复核自动迁移。

本轮重新运行本地语义、mutation、transport、正负门禁及计划检查，并核对既有目标证据。**本轮没有重跑 Supabase 或获取 hosted CI 回执**。目标执行仍绑定 `9d67f880`，当前全部 7 个目标源码摘要一致：52 次调用覆盖 20 API、14 项强断言，恢复与清理已核实。环境为已配置 Supabase Auth/PostgreSQL + 本机 live BFF、合成 HTTPS Origin。

历史问题已从主报告移出；[初审归档](BFF-FE-001-findings-archive-2026-10-05.md)与原文逐字节一致，[逐项关闭复核](BFF-FE-001-closed-findings-2026-10-05.md)保存六项依据，[整改记录](BFF-FE-001-remediation-2026-10-05.md)保留实现及各次失败历史。

## 二、完成情况明细统计

沿用初审的 24 个等权 DEVELOPMENT 控制点：仅完整 PASS 计完成，PARTIAL/FAIL 计 0。该比例表示本任务所列功能范围的满足率，不表示全量页面或发布完成率。

| 维度 | 当前统计 |
|---|---:|
| 工程控制点 | 24 PASS / 0 PARTIAL / 0 FAIL，100% |
| C01/C17 operation 明细 | 20 PASS / 0 PARTIAL / 0 FAIL，100% |
| 本任务 DEVELOPMENT 准入 | 1/1 READY |
| 当前活动问题 | 0 |
| 正式整项验收 | 未由本报告批准 |

| ID | 控制点 | 当前结果 |
|---|---|---|
| R01 | C01/C17 20 operation 发布 | PASS |
| R02 | OpenAPI/TS/Zod/MSW 同源 | PASS |
| R03 | P01/P15/owner/二期边界 | PASS |
| R04 | A2 live provider 可运行与覆盖 | PASS |
| R05 | session/context 与恢复 | PASS |
| R06 | profile/locale/theme 保存读回 | PASS |
| R07 | 通知偏好保存读回 | PASS |
| R08 | If-Match/版本冲突 | PASS |
| R09 | challenge 生命周期 | PASS |
| R10 | MFA 失败限流/冷却 | PASS |
| R11 | recent-auth/首因素授权范围 | PASS |
| R12 | logout/cookie/CSRF/Origin | PASS |
| R13 | 匿名访问申请 | PASS |
| R14 | 安全/会话/设备/下载/平台读取正确性 | PASS |
| R15 | 当前会话/最后有效因素保护 | PASS |
| R16 | 幂等响应与观测/审计关联 | PASS |
| R17 | 设备/因素撤销与注册幂等 | PASS |
| R18 | 撤销 SSE/实时失效 | PASS |
| R19 | 401/403/404/资源主体约束 | PASS |
| R20 | consumer runtime schema/default deny | PASS |
| R21 | 错误恢复/超时/取消 | PASS |
| R22 | A2 正负 Gate 的实际业务退化检出 | PASS |
| R23 | CI 接线/前置功能准入/输入绑定 | PASS |
| R24 | 版本/总结/历史与验收边界 | PASS |

逐接口明细及前后状态见[关闭统计](evidence/bff-fe-001-remediation-20261005/final/closure.json)。各项 PASS 仅限明确检查范围：限流/冷却以 reference 实测及 live 源码核对为据；未宣称真实 Auth 全部穷举/并发矩阵或跨实例验证已完成。

| 本轮检查 | 结果 |
|---|---|
| local_contract 及实际语义 | PASS：14 Rust lib（另 1 个 F09 目标测试 ignored）、12 reference、29 consumer |
| 实际业务 mutation | 8/8 拒绝：5 项 live 策略、3 项 reference；均为业务断言失败 |
| 契约负向 | 22/22 PASS |
| A2 阶段正负 | 14/14 PASS |
| transport 辅助回归 | 3/3 PASS |
| A2 / PROVIDER:A1 严格门禁 | READY，源码、执行、目标回执及依赖内容有效 |
| 计划结构与阶段依赖 | PASS；35 项计划负向通过 |

套件范围可能重叠，不累加成总验收用例数。详情见[本轮命令与内容核验](evidence/bff-fe-001-closure-recheck-20261005/recheck.json)和[当前 A2 manifest](evidence/bff-fe-001-remediation-20261005/final/a2.json)。

## 三、活动问题与适用边界

活动问题清单为空：阻塞级 0、高危 0、中危 0、低危 0。已关闭问题的具体表现、影响及修复依据统一保存在历史归档和关闭记录中。

以下是独立验收范围，不计入当前活动缺陷：

| 范围 | 当前边界 |
|---|---|
| PROVIDER:A2/ALL、FEP-1/G1 | 还需对应任务与页面业务链验收；本任务 READY 不自动放行 |
| staging、真实 HTTPS/代理/cookie 浏览器行为 | 本轮 NOT RUN；本机 fetch 不能证明浏览器 Secure/SameSite 策略 |
| hosted CI、部署/回滚、性能及长稳 | 本轮未取得发布候选回执；在 RELEASE 验证 |
| passkey/WebAuthn | 当前 live 仅开放 authenticator；不宣称 passkey 已集成 |
| 多实例 MFA proof、全部角色/多主体并发矩阵 | proof 在进程内，重启需重新 bridge；部署与集成场景另行验证 |
| 人工正式确认 | 按[统一用户确认流程](../gate-records/user-acceptance-confirmation-workflow.md)执行，本报告不代为批准 |

## 四、后续维护建议

本次六项整改已完成，无遗留整改待办。继续开发时保留 live 策略回归、超时/取消恢复、真实 audit/trace 关联及 mutation；功能输入变化后重新评估 A2 和受影响的上游回执。下游按当前严格阶段门禁消费 READY，正式发布另行满足 RELEASE 的环境和确认要求。
