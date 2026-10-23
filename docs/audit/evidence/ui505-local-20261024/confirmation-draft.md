# UI-505 限定功能待确认稿

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:UI-505",
    "stage": "DEVELOPMENT",
    "sourceCommit": "fd79185ff224b03fc5af385433e99458368292dc",
    "inputsDigest": "sha256:53cadf6cf5cf7c9e3feb66ad1acaafaf061ec7507c30c81a5c7e52601b9010fd",
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

状态PENDING。仅确认上述冻结源码和attempt-05本机功能范围；inputsDigest绑定inputs.json原始字节。不包含后续证据封存HEAD、正式INTEGRATION或RELEASE。没有用户确认原文，不生成CONFIRMED。按[统一确认规程](../../../gate-records/user-acceptance-confirmation-workflow.md)保留待确认状态。

- Product：Command提交、202独立受理、授权Order/Fill列表详情/事实时间线、撤单、原键恢复、明确拒绝状态落地；不把受理当成交。
- Frontend：来源重验、连续事件/不可变事实/精确字符串数量、8秒窗口、显式续传、失权清除、二次确认、手机控件边界及明暗视图。
- BFF：C09接口未变；前端只传服务端ref；统一Order journal键以回补首次GET前历史；重复提交/撤单各仅一次下游动作，真实Fill溯源保留。
- QA：55前端/消费者、28执行宿主、23Node、8Chromium、4axe零violations；8截图已查；所有失败和原范围PASS不改绑，日志/hash/源码/binary/build可核验。
- Security：C01双读/撤权、账户/mode限制、CSRF/幂等、无前端签名/交易参数拼装；回环合成身份与TLS/cookie/CORS替身，无生产凭据、推送或部署；损坏UTF8尾流不恢复撤单authority。
- Risk：最终权限、风险、额度和有效期由服务端重验；过期引用不可新提交，未知仅恢复原请求；撤单202不改变真实成交、终态不可回退。

遗留：axe两组incomplete/20图标节点待核；真实身份/目标DB/RLS/持久恢复/真实风控与venue/CI/性能长稳/完整I5/发布均NOT_RUN，跨会话恢复与人工读屏/原生200%缩放/跨OS/其他浏览器未验证。UI-P20/UI-P11高保真另行实现。正式INTEGRATION/NOT_ASSESSED，formalAccepted=false、runtimeAdmission=DENIED。下一FE:UI-P20开发允许。
