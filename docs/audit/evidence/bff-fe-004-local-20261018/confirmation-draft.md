# BFF-FE-004 / A4 完整确认稿（待项目用户确认）

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:BFF-FE-004",
    "stage": "DEVELOPMENT",
    "sourceCommit": "8172d825e90c6f7ff63f1107cd002b94a0983c8b",
    "inputsDigest": "sha256:c547a563a7f76b519a64d017185fbb6e080a26cba6870218f0b4a68ffcb9639b",
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

本稿供项目用户一人确认，覆盖 Product、Frontend、BFF、QA、Security、Risk 六个维度；当前 PENDING，Codex 不自行批准。确认仅覆盖冻结本机功能，formalAccepted=false、runtimeAdmission=DENIED；完整联调及发布 NOT_RUN。

Product：C05 十二项 Strategy/Draft、static check、Backtest create/get/stream、Release create/list/get、approval submission、rollback request 本机功能完成。rollback 只受理，不执行部署/venue submit，不扩大数据用途或目标授权。

Frontend：OpenAPI1.9.0 共74操作/64schema，六类生成产物同步。generated consumer 验证丢回复恢复、409保留编辑/显式解决冲突、202不代表回测完成、journal去重/缺口/撤权，以及新鲜已审批 Paper/Shadow targets。新增consumer 行17/17、分支36/36、语句58/58、函数17/17，100%。基本Chromium通过；完整P06/P07/G3/FEP3页面及业务联调NOT_RUN。

BFF：调用真实S01/S02/S03/S04；可信输入由宿主注入，任意源码/未来数据/伪造校验或快照绑定拒绝。Release绑定不可变草稿、参数、源码/镜像/环境及实际回测报告；reportArtifactId可经A3查询。allowedTargets固定paper/shadow，审批采用公共C08独立身份/MFA/单次proof，策略审批不签发TradeCommand；rollback要求同策略且来源/更早目标均有效获批。

QA：源码8172d825e90c6f7ff63f1107cd002b94a0983c8b，925输入、17/17组、93 Rust、160 Node、52 consumer/契约、十二API/1068实际HTTP和1000次幂等重试及基本Chromium、5/5入口PASS。attempt01为已知审计根缺陷后的主动INTERRUPTED；仅attempt02属于当前READY，所有探索失败保留，不拼接历史READY、不执行无关闭包。

Security：权限、CSRF、租户/工作区、版本、有效期、可信Artifact、职责分离及proof跨策略/执行单次消费直接验证；审计根/响应auditRef/cause/actor/route一致。默认live无host503；显式host为进程内租约，审计持久事务失败隔离宿主。真实Supabase/Auth/RLS/Storage、跨实例/重启恢复、OS隔离/来源撤权与目标安全验收NOT_RUN，不能视作持久或运行时准入。

Risk：校验/陈旧快照/未审批/非法target/并发冲突均服务端拒绝；过期release不能审批或用作rollback目标。继承S02 f64指标边界，字符串输出不提升计算精度；真实feed/用途授权、成本校准、性能/容量/长稳及同SHA hosted CI/正式发布均NOT_RUN。无生产凭据或外部发布。

PROVIDER:A3与BFF-FE-006原确认均CONFIRMED，仅各自原源码/原稿/回执范围。九直接前置NOT_REVALIDATED/referenceOnly；共享源码变更后FE006独立当前Gate为NOT_ASSESSED，原确认和回执保持原字节。本稿不授予A4聚合、上游或正式ACCEPTED。原53,062审计/门禁文件逐字节无变化。

依据：[报告](../../BFF-FE-004-functional-review-2026-10-18.md)、[manifest](./manifest.json)、[逐组结果](./review-results.json)、[控制矩阵](./control-matrix.json)、[证据索引](./evidence-index.json)。项目用户确认或提出修改后，Codex保存原始答复并执行原候选确认门禁。下一可执行任务：PROVIDER:A4 当前功能汇总复核。
