# CORE-GATE:X3 当前执行与治理闭环评估

2026-10-26，依据主计划 X3 完整清单和 AGENTS.md，在 main 修复当前缺陷并评估本机真实模块组合。完整三项清单和正式阶段不因文档/工具通过而提升。范围、缺口与原始结果分别见[机器清单](../execution/core-x3-current-assessment.json)和[证据](../audit/evidence/core-x3-local-20261026/)。

## 当前修复

Reconciliation runtime 原来依赖解析后的 JSON 错误和调用方回调清理状态；非 JSON 401/403 会在解析之前抛出，工作区切换/本地监视器失效也可能留下已读账本、关联证据或未知 rerun。现在在 transport 层读取状态即中止生命周期、清空所有私有事实/游标/未知意图/回执并通知调用方；不要求 invalidate 回调再负责 close。原始错误字节不改写成虚构 provider JSON；SDK 的取消/网络包装由本地已记录拒绝状态恢复成当前请求的 401/403。失效后必须新建 runtime，不可借 load 换作用域恢复旧事实。

原 rerun 恢复保存 CSRF 后未复核当前值；现在提交前比较，轮换时拒绝并清除旧意图。暂时 C01 503 不等同撤权，仍保留未知原意图；只允许显式原 key/body/version 恢复，既有 202 不是对账完成/关闭证明。六项新增真实 reference consumer 测试覆盖这些分支及原键恢复，直接 UI506/C14/P22 回归维护权限、精度、有效期、gap、CAS、离线及拒绝边界。

## 原生组合和 C15 投影

BFF 的 cfg(test) 模块复用 execution-gateway 的 X3 聚合真实实现和黄金输入：实际 X03 签名→OperationsService→自有 PaperKernel→X04 Fill/anchor→X01 仓位，独立 ShadowRunner 从相同初始基准计算 Decimal 账本。只对该固定账户/品种/方向/数量进行显式 ID 对应，不复制 Paper 财务结果当期望。金额为 cash=999000、BTC=1010，实际下游提交一次；32 并发重放/对账、同租约服务重建/journal 恢复无新 IO；20 类差异逐类发现/拒绝无证明关闭/修复/复发重开；kill/stale/撤权/venue 来源拒绝和独立批准恢复沿现有边界验证。

新增组合把这份实际 expected/actual Book 交给真实 ReconciliationHost 的可信 constructor/handler，核对 C15 ledger sourceHash 等于 actualBook.content_hash、原始 Fill 引用和金额；同一 rerun 32 次恢复不增加交易 submit，越账户/能力拒绝。该入口只存在于测试模块，没有新增产品 HTTP 控制口；这里的可信 AuthContext 不是浏览器身份，C15 host 返回的 auditRef 也不是已贯通 native 审计与 C10 的证明。production lib/路由不注入样例账本。

另运行自有 Paper stdio 实际子进程和 X05 read-adapter、flow、worker 测试，不把内存 journal/同 gateway lease 的恢复称为跨进程持久恢复。源代码测试桥只复用 current fixture/helper；外部 Nautilus/Agent 未安装或执行。

## Web 实际本机组合

一个 Paper reference BFF 进程验证 P10 独立 Approver MFA、Operator Command/撤单丢失响应同键恢复、C10 完整链与原始水印导出（直接复用 X06 场景在当前候选执行）。另一个 Shadow reference BFF 同实例验证 C15 原账本与 C14 point 的 runId/sourceHash 对应、受控 rerun 未知恢复及 C10 根、冻结 C14 报表下载/Audit、C11 InspectHealth 和 Owner 治理页面。新增浏览器 403 拒绝验证未知 rerun 和私有账本清除，无后续业务重放。网络仅 loopback，非本机请求记录并拒绝。

两条 Web 链和原生组合分别标识来源，不以 reference Paper accepted/mock/fills=[] 替代原生真实 Fill，不以 Shadow reference seed 冒充该 Paper 订单账本。native Book→C15 handler 的阳性不代表 native Book→真实浏览器生产路由或 C09/C15 公共持久 ledger；C15/C16 的同 source 阳性仍缺少来源，不补造告警匹配。C11 观察与 C09/原生交易事实仍分离。

## TP12 范围与验证规程

当前静态评估复核固定来源的七条禁止耦合规则、六面接口、八个 DESIGN_HYPOTHESIS 威胁映射与所有生产 runtime 输入；实际 Agent UDS、自有请求/权限字段注入拒绝、SignedExecutionGateway 净化/当前复核和无重复提交按当前测试执行。结论 reference_only / runtimeAdmission DENIED，不导入或执行上游、不授予工具/venue 权限。机器工具继续报告 postTp07IntegrationFullReview=NOT_RUN；TP07 完整业务集成、真实 OS 出网/凭据隔离、最新供应链/CVE/法律分发及受限 trace 完整复审没有在本轮伪关闭。

执行入口：

```sh
node scripts/core-x3-review.mjs --run docs/audit/evidence/core-x3-local-20261026/attempt-NN
node scripts/core-x3-review.mjs --verify
node --test scripts/core-x3-review.test.mjs
```

记录器绑定已提交源码、当前输入/二进制/实际命令和日志，使用工具白名单/离线 Cargo/固定 pnpm/工程 Python venv（不使用缺 tomllib 的系统 Python）。28 组当前检查包括真实原生组合/过程、C15/C14、X05、TP07/TP12 边界、8 个 consumer 文件、类型/lint/格式、当前 Terminal 构建、13 个 Chromium 场景及计划/阶段拒绝。具体计数以原始结果为准；失败/中断和未执行项不覆盖、不计 PASS。无需先重跑历史 X3-SERVICE、X06 或上游 Gate 的全部 campaign，不运行全仓/F05/F07/LLVM/三轮独立构建要求。修改 Web runtime 后新建 Web 构建，历史 X06/S2/TP12 只保留原范围。

## Gate 和移交

工程评估 `PASS_OWNED_LOCAL_X3_EXECUTION_GOVERNANCE_LOOP` 仅针对当前范围。完整 X3 `PARTIAL_WITH_EXPLICIT_PORT_SUBSTITUTIONS / NOT_READY_GAPS_OPEN`，INTEGRATION NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED，Beta candidate NOT_READY；三项完整业务清单不勾选。用户确认文稿独立保留 PENDING，不自签 ACCEPTED。

仍待：共同持久事实源/审计、研究 Release→Proposal→命令完整激活链、C15/C16 阳性、P13 七服务/完整遥测及 P14 元数据/历史/审批/导出/实时能力，真实 IdP/MFA/RLS、数据库事务/outbox/跨实例恢复、全仓与全浏览器/人工无障碍、完整 TP07 集成后的 TP12 复审。10 个实际交易日 Shadow/日终未解释差异=0、实际 Supabase/venue/testnet、OS 安全/部署/性能/长稳/同 SHA 远程 CI/发布全部 NOT_RUN。未用生产凭据、未创建本地数据库、未推送或外部发布。

下一可执行原项：FRONTEND-GATE:G7 的 I9 当前 Web Beta 业务闭环评估（DEVELOPMENT），不得凭本轮结果宣告 G7/FEP-7/Beta 通过。
