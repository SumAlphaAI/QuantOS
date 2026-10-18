# BFF-FE-008 / A5 完整确认稿

状态：**PENDING_USER_CONFIRMATION**。本稿由Codex拟定，仅项目用户可确认，不自动批准。

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:BFF-FE-008",
    "stage": "DEVELOPMENT",
    "sourceCommit": "d926c246d33ee766fe02d07aa8ef68c83a059f6c",
    "inputsDigest": "sha256:837a6ef3585cc38f79a5feda4789c95828d663fd776409681fc4c30ae680a92e",
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

确认范围：冻结源码 `d926c246d33ee766fe02d07aa8ef68c83a059f6c`，1015输入、15组当前功能/直接影响与5个实际入口通过；只授予BFF008_SCOPE_LOCAL DEVELOPMENT功能范围。A4与BFF009原确认仍绑定各自原版本，五直接前置没有重授当前READY；BFF009因共享变化撤回NOT_ASSESSED。完整业务联调、G4/FEP4与发布验收不由本稿替代。

- Product：八接口覆盖summary/series/attribution、create/status/get/grant/content。P&L、simple return、观测峰谷最大回撤、期间新增fees、归因及残差来自同一实际账本版本。只支持USD/simple，twr/mwr、FX及外部现金流模型未准入；seed现金流变化明确拒绝。period支持custom、week/month/quarter/year及UTC calendar/rolling；缺覆盖或任一点未取得匹配X05证明时强制provisional。不得把provisional显示成已对账。
- Frontend：六类生成client/schema/MSW已同步；真实生成consumer丢回复后用原键恢复，保持decimal字符串、hash/size及meta/body版本一致，拒绝跨账户与篡改。基本Chromium通过；完整P21 UI、C16完成通知、全浏览器矩阵NOT_RUN。
- BFF：owner注入X01实际projection，验证快照与C15 actual Book逐项同源；每点保留估值hash、账本hash、runId/asOf，拒绝改账/浏览器源数据。scope沿用C15 Shadow和execution.operate；Owner/Operator/Service可用，Viewer拒绝，不扩核心权限。报告actor/session绑定、15分钟、immutable version1；status执行本进程queued待办一次，未完成get/download409。只允许本机进程租约内恢复。
- QA：Rust 52、Node 159、consumer/契约44/7文件通过；八API 146条HTTP含逐项401/403/schema和100原键重试；40并发唯一job，1000 native重复；helper19/19行及30/30分支100%。最终回执绑定本稿源码；先前失败与停止记录保留，不算PASS，不拼接旧READY。
- Security：实际JSON字节hash/size校验，同源actor/session ticket60秒、report15分钟到期410，撤权401，跨actor隐藏404；CSRF、scope、权限与source lease拒绝通过。reference使用明确合成Shadow源及真实X01/X05核心，live无host503；live F05失败quarantine代码接线已编译，真实目标事务/私有Storage/Auth/RLS验证NOT_RUN。没有生产凭据、外部发布或venue submit。
- Risk：X01 f64按核心容差与X05 Decimal比较，18位输出不提高上游精度；只提供观察点回撤，不推断未观察峰谷。当前租约最多1000样本/jobs/tickets、60秒完整覆盖间隔，长周期可能partial；C15每点匹配日结证明/有效期采取保守provisional，不能替代完整长期对账链。完整业务联调、真实DB/Auth/Storage、跨实例/重启持久worker恢复、真实数据源许可、性能/容量/长稳/部署/同SHA hosted CI与正式发布NOT_RUN，runtimeAdmission=DENIED，formalAccepted=false。

验收证据：[完整报告](../../BFF-FE-008-functional-review-2026-10-18.md)、[manifest](./manifest.json)、[24项限定控制](./control-matrix.json)、[结果](./review-results.json)、[变更文件](./changed-files.txt)、[证据索引](./evidence-index.json)。原53,344个audit/gate文件byte-for-byte保持，见[历史保留](./history-preservation.json)。

建议确认答复：“确认BFF-FE-008完整确认稿，仅确认所列DEVELOPMENT功能范围及未验收边界；不授予新HEAD、上游、完整联调、运行或发布准入。”
