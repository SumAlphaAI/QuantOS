# UI-P11 限定高保真功能待确认稿

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:UI-P11",
    "stage": "DEVELOPMENT",
    "sourceCommit": "ad49394ea9b691646fc7c791413e618e8f19ba8a",
    "inputsDigest": "sha256:cfd8308c3d81014a1ad0f425241d704b459c21e484c8de544d34fadf923274b3",
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

状态PENDING。仅确认上述冻结源码与attempt-02本机功能范围，inputsDigest绑定inputs.json原始字节，不包含后续封存HEAD、正式INTEGRATION/I5窗口或RELEASE。没有用户确认原文，不生成CONFIRMED。按[统一确认规程](../../../gate-records/user-acceptance-confirmation-workflow.md)保留待确认。

- Product：P11订单目录/执行详情/Order-Fill轨迹、部分成交/拒绝/撤单/断流回补和来源链/对账只读提示；缺失字段不填假数据，统计仅已加载子集。
- Frontend：明暗/桌面平板手机、精确剩余/进度、可聚焦横滚、稳定截图、原键恢复/未知锁定/失权清理、旧Command引用兼容入口。
- BFF：C09/C10/C15契约不变；C10当前授权correlation绑定与分页，C15同scope精确ref匹配、不写账/不重跑；reference实际跨模式join无法提供，保持NOT_RUN。
- QA：63前端/消费者、28执行宿主、2核心partial/reject、24Node、14Chromium、6axe零violations；12实际布局+2合成状态截图，原失败/诊断/原范围PASS不改绑，source/binary/build/日志/hash可核验。
- Security：C01/CSRF/幂等和有限SSE、scope/资源/correlation拒绝、C10 retention清理；网络仅hash、固定MFA仅控制夹具，无生产凭据/推送/部署，ref不能授权，未知不换键。
- Risk：202非成交/非已撤销，部分成交不当全成，终态不回退/Fill不删；风险/权限/有效期仍服务端核验。对账暂定/过期/整批差异不视为本单Clean。

遗留：C09-C15实际同scope精确阳性join NOT_RUN，6组axe incomplete/50节点待人工核验；真实IdP/目标DB/RLS/持久恢复/真实venue/远程CI/性能长稳/完整I5与发布NOT_RUN，人工读屏/原生200%缩放/跨OS/其他浏览器/真实触控未验证。正式INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。下一UI506仅开发准入允许。
