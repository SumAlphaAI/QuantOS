# BFF-FE-006 / A4 完整确认稿（待项目用户确认）

```json
{
  "nodeId": "FE:BFF-FE-006",
  "stage": "DEVELOPMENT",
  "sourceCommit": "590f1f8f4f3561e38e1900adc3764a515fbdef1d",
  "inputsDigest": "sha256:68bcf0f7bf04032d5df8f949b2ca96c5d0027ba97f9984620172d248d2f53c58",
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

本稿供项目用户一人确认，覆盖Product、Frontend、BFF、QA、Security、Risk六个复核维度；当前PENDING，Codex不自行批准。确认只覆盖下述冻结本机功能，不是正式ACCEPTED、完整联调、发布或runtime许可。

Product：C06-C09/C13二十项Portfolio/Risk、Proposal、Approval、command-ref、Order和preflight/capabilities API本机功能完成。Shadow只读/kill、Paper无venue submit；没有新增数据用途、标的、生产账户或运行时长授权。

Frontend：OpenAPI1.8.0的73操作/64schema与六生成产物同步；真实generated consumer通过Context/account/actor绑定、独立审批、丢回复恢复、control ref刷新、SSE去重/缺口/撤权与审计关联。202不产生订单/成交成功状态；新增consumer行25/25、分支33/33，100%。完整P08-P11/P20 UI和G5/FEP-5联调NOT_RUN。

BFF：真实X01-X04模块组合，短时签名命令仅服务端保管；原子当前风险、审批单次消费、幂等唯一签发及1000次Paper下游幂等均验证。Fill幂等更新读模型，业务Order.intent与内核类型分离。过期后control ref不延长submit授权；晚撤单202仅受理，实际事实expired/拒绝。

QA：当前源码590f1f8f4f3561e38e1900adc3764a515fbdef1d，899输入、16/16组、78 Rust、146 Node、48 consumer/契约、20 API/1085实际HTTP与基本Chromium、5/5门禁入口PASS。attempt01-04失败保留；仅attempt05为当前候选证明，未拼接旧READY。历史十万体量回放及无关闭包NOT_RUN。

Security：浏览器不能注入actor/tenant/mode或命令载荷；server Context与资源绑定、CSRF、权限、独立审批MFA/近期验证、proof单次使用、版本和有效期拒绝均有当前负向证据。默认live无host返回503；真实Supabase/Auth/RLS、持久事务与跨实例/重启恢复、密钥和目标安全验收NOT_RUN。原52,906文件及所有原确认保持原字节。

Risk：allow/deny/approval-required、过期、重复、数据陈旧、kill switch及职责分离验证；当前数据/审批变化在签发/提交拒绝。真实feed/来源许可撤权与FX/财务精度未验，继承X01 f64/自有USD合成边界，非USD非零费用拒绝。不得扩展为真实venue/testnet/生产执行许可。

PROVIDER:A3原确认只覆盖4580bac源码与93d66ad原稿/回执；十直接前置NOT_REVALIDATED/referenceOnly，不重新放行其独立Gate。当前BFF006_SCOPE_LOCAL DEVELOPMENT READY；businessIntegration=NOT_RUN，releaseAcceptance=NOT_RUN，formalAccepted=false，runtimeAdmission=DENIED。当前无生产凭据、目标数据库或外部发布操作。

确认依据：[报告](../../BFF-FE-006-functional-review-2026-10-18.md)、[manifest](./manifest.json)、[逐组结果](./review-results.json)、[控制矩阵](./control-matrix.json)、[证据索引](./evidence-index.json)。请项目用户确认或直接修改本稿；原答复、文稿hash及范围摘要随后存入独立账本再执行确认门禁。
