# UI506 限定功能待确认稿

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:UI-506",
    "stage": "DEVELOPMENT",
    "sourceCommit": "9847d568dd35eab57ab7582e735082fdaf367d88",
    "inputsDigest": "sha256:91708e0e2b85cd3385bd1726425c282c1651b0c1ada8bc56016f5b140d211a88",
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

状态PENDING。只覆盖上述冻结源码/inputs.json原始摘要及attempt-01的本机功能范围，不包括后续封存HEAD或正式INTEGRATION/RELEASE；没有用户确认原文，不生成CONFIRMED。按[统一确认规程](../../../gate-records/user-acceptance-confirmation-workflow.md)保留待确认。

- Product：对账运行/差异/账本与重跑功能完整；不提供人工改账，不将暂定/202/无返回差异当关闭证明。P22高保真单独开发。
- Frontend：精确路由/scope、原子事实、有限分页/流、金额/JSON词面精度、明暗响应布局与键盘横滚；当前事实过期停止新重跑，未知结果锁定并原请求恢复，失权清除。
- BFF：契约1.16.0及后端未改；C15来源不可变/有效期/CAS/幂等，C14 Run与actual sourceHash精确关联、C16例外hash/domain/scope匹配、C10审计根/retention/分页；缺少实际阳性join如实NOT_RUN。
- QA：69前端/消费者、18 C15、10 C14、20 C16、25 Node、10 Chromium通过；4axe无violations，2mobile incomplete/132节点待人工完整复核。原失败/诊断保留ORIGINAL_SCOPE_ONLY，版本/构建/日志hash可核验。
- Security：C01双读/撤销，最短会话/核查deadline，CSRF/actor/session/原幂等键，不信任查询参数或source ref授权；白名单环境、哈希网络记录，无生产凭据/推送/部署。
- Risk：账本事实只读；202只受理，重跑不关闭差异，provisional/expired不终结风险；Order/Fill/C16缺源不借用其他账户/模式补造链接。

遗留：实际C09–C15和C15–C16阳性join、真实IdP/目标DB/RLS/持久恢复/venue/远程CI/性能长稳/完整I6/发布NOT_RUN，2组axe incomplete与人工读屏/原生缩放/跨OS/其他浏览器未验证。正式INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED；下一开发任务FE:UI-P22仅允许开发。
