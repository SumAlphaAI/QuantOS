# UI-P20 限定高保真功能待确认稿

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:UI-P20",
    "stage": "DEVELOPMENT",
    "sourceCommit": "cb6965f002b1550e8d16eea81c00225bd1309eb1",
    "inputsDigest": "sha256:4546ecb3e235b244bf0e2d79b72da07726c616294ebe0fa129259bd0f7abda19",
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

状态PENDING。只确认上述冻结源码及attempt-02本机功能范围；inputsDigest绑定inputs.json原始字节。后续证据封存HEAD、INTEGRATION/RELEASE不在此范围。没有用户确认原文，不生成CONFIRMED或伪造签署。按[统一确认规程](../../../gate-records/user-acceptance-confirmation-workflow.md)保留待确认。

- Product：P20三栏/四阶段、意图只读审阅、风险申请、独立审批状态及Command提交、证据关联/摘要与明确未知/拒绝状态。
- Frontend：canonical符号深链、来源核查/锁定、阶段互斥、原意图内容与对象版本重验、未知锁定与原键恢复、失权清空、明暗桌面/平板/手机。
- BFF：OpenAPI1.16无更改；复用当前C07-C09/C12/C13 owner，真实server状态command_ready/submitted、correlation/owner匹配C08及C09事实，不推断generic jobId。
- QA：151前端/消费者、28执行、24Node、11Chromium、6axe零violations/12截图；初始失败与原范围PASS保留，命令/log/source/binary/build/图/hash可核验。
- Security：C01/CSRF/幂等和最小body；无自批、无前端签名、无越权query；正文不保存MFA码或原key，回环reference替身，未使用生产凭据/推送/部署。
- Risk：资金/深度/TIF等未提供不假造；最终风险/权限/额度/有效期由服务端核验。风险202非批准，命令202非成交；意图变化/拒绝/过期/失权阻断；submitted只读。

遗留：4组axe incomplete/40图标节点待人工核查；真实IdP/目标DB/RLS/持久恢复/真实risk与venue/远程CI/性能长稳/完整I5/发布均NOT_RUN。人工读屏/原生200%缩放/跨OS/其他浏览器/跨会话恢复未验证，未做像素级自动视觉diff。正式INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED；下一FE:UI-P11开发允许。
