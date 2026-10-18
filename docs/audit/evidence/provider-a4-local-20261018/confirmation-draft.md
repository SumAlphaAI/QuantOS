# PROVIDER:A4 完整确认稿（待项目用户确认）

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "PROVIDER:A4",
    "stage": "DEVELOPMENT",
    "sourceCommit": "c9deac5b465c2146a1dfd0c316cbe47607f20451",
    "inputsDigest": "sha256:24e5b5eb6818cb16b9137df23282e5d5b757fdbf5dac0ba032a3219e63c9c9e6",
    "reviewDimensions": [
      "Product",
      "Frontend",
      "BFF",
      "QA",
      "Security",
      "Risk"
    ]
  },
  "reviewDimensions": [
    "Product",
    "Frontend",
    "BFF",
    "QA",
    "Security",
    "Risk"
  ]
}
```

本稿由项目用户一人确认，覆盖Product、Frontend、BFF、QA、Security、Risk六维度；当前PENDING，Codex不自行批准。仅冻结源码c9deac5b465c2146a1dfd0c316cbe47607f20451与953功能输入，不批准当前新HEAD、完整业务联调或发布；formalAccepted=false、runtimeAdmission=DENIED。

Product：本机C05–C09/C13的32项API当前功能汇总完成。Strategy/Backtest/Release与Portfolio/Risk/Proposal/Approval/Order路径可按各自受控权限消费；Paper提交/取消与Shadow只读边界不变，rollback只受理请求。Strategy审批不签发TradeCommand；本轮不声称页面Release已通过部署/worker安装到执行账户。

Frontend：OpenAPI1.9.0共74操作/64schema、六类生成产物一致。新同一provider的generated consumer验证混合审批、独立proof、命令丢回复后原键恢复、Backtest/Order事实、A3 Artifact和F05闭链、注销后双流401。53项consumer/契约、11文件通过；两个helper模块行42/42、关键分支69/69、语句102/102、函数27/27均100%。两项基本Chromium通过；完整P06-P11/P20及G3/G5/FEP3/FEP5页面链NOT_RUN。

BFF：修复授权StrategyHost隔离后公共审批页仍成功输出旧策略事实、策略独立读取不当依赖执行授权、混合游标不绑定当前角色/能力三处边界。隔离时授权公共列表503，执行独立路由与execution-only最小权限保留；strategy-only读取可独立路由。旧页冻结的数据不冻结权限，撤销Strategy读能力后旧游标拒绝。新六项组合回归、直接Strategy18/Execution16/A2 providers29全部通过。

QA：冻结953输入、16/16检查及7/7实际入口通过；Rust69、Node180、consumer/契约53，32API/2153条本轮HTTP，每项成功401/403/schema、两个1000次幂等campaign和基本Chromium。首轮34d683ae在撤权复现失败后主动中断，gate-tests未完成、后续两组未运行；所有失败/中断保留。仅function-attempt-02用于READY，不拼接历史结果，不执行无关闭包。

Security：共享MFA/proof跨Strategy/Trade单次消费、最小权限、职责分离、版本/游标/有效期/CSRF/租户边界、唯一审计根、丢回复幂等恢复与logout拒绝按影响范围验证。live使用checked projection，默认无可信宿主503；真实Supabase/Auth/MFA/RLS/Storage、持久跨实例/重启事务及OS/密钥/许可撤权隔离NOT_RUN。

Risk：当前风险、陈旧数据、kill、无审批与过期引用拒绝，Paper/Shadow无venue submit；两个宿主为独立可信合成输入的进程内租约，不作为完整部署/信号链证明。保留S02/X01 f64、固定USD与非零异币费用拒绝边界。真实feed、目标容量/性能/长稳/部署及同SHA hosted CI/正式发布NOT_RUN。无生产凭据或外部发布。

FE006/FE004与A3原确认均CONFIRMED，仅各自原稿/原源码/回执范围。三个直接前置referenceOnly/NOT_REVALIDATED，独立当前Gate仍NOT_ASSESSED；只有PROVIDER:A4的A4_SCOPE_LOCAL DEVELOPMENT READY，全图1 READY/158 NOT_ASSESSED/0 BLOCKED。53,148个本轮前既存audit/gate文件原字节保持。

依据：[本轮报告](../../PROVIDER-A4-functional-review-2026-10-18.md)、[manifest](./manifest.json)、[结果](./review-results.json)、[24项控制](./control-matrix.json)、[证据索引](./evidence-index.json)。用户确认或修改后保存原始答复并执行原候选确认门禁。下一可执行任务：FE:BFF-FE-009 / A5：Reconciliation 与账本 API。
