# UI-P22 限定高保真功能待确认稿

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:UI-P22",
    "stage": "DEVELOPMENT",
    "sourceCommit": "8c0286fa0a6ea6e2a5e55a5514c7ad6d024b8a10",
    "inputsDigest": "sha256:d9c85293bf2fe03e96a1dbd7342a410991085d7dd990c751a4ff275db6e6ecd7",
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

状态PENDING。范围仅上述冻结源码、inputs.json原始摘要及attempt-02本机高保真功能，不含后续封存HEAD、正式INTEGRATION/G5/I6/FEP-5或发布。没有用户确认原文，不生成CONFIRMED；按[统一确认规程](../../../gate-records/user-acceptance-confirmation-workflow.md)保存。

- Product：对账上下文、摘要、差异表/详情、Funds Ledger与实际证据/Runbook/重跑；缺失字段和不支持动作明确标记，不能手工改账。
- Frontend：明暗1440/768/390、局部横滚与金额列、精确deep link/状态/过滤、原精度、未知锁定与原请求恢复、失权清理；只读账户/模式不可注入。
- BFF：UI506运行时、C09/C10/C15及owner未改；来源/审计/有效期/幂等沿用；实际C09–C15和C15–C16正向join缺源NOT_RUN，不补造关系。
- QA：72前端/实际消费者、25Node、14Chromium通过，6axe无violations；6组incomplete/236节点待完整人工复核；16实际布局/金额列+1合成closed+1移动单元格图，原失败/诊断保留，SHA/hash可复核。
- Security：C01双读/撤销/最短deadline，CSRF/actor/session/原键与版本重读；无生产凭据、推送或部署；回环身份/CORS代用明确标记，source ref不能授权。
- Risk：202仅受理，provisional/过期/空差异不视为终结，原值不转浮点计算余额；无调查说明保存/导出契约则禁用，不伪造回报、处置人或健康。

原attempt-01原范围PASS与移动空白截图不支持最终高保真结论，保持ORIGINAL_SCOPE_ONLY；新候选attempt-02另行执行。真实IdP/目标DB/RLS/Storage/venue/持久恢复/同SHA远程CI/性能长稳/完整I6/发布NOT_RUN，人工读屏/原生200%缩放/其他浏览器/跨OS/真实触控未验证。开发IMPLEMENTED_PENDING_ACCEPTANCE；正式INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED；下一FE:UI-402仅开发准入允许。
