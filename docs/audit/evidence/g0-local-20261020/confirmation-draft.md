# G0 当前功能复核完整确认稿

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FRONTEND-GATE:G0",
    "stage": "DEVELOPMENT",
    "inputsDigest": "sha256:266e20e793d518283fc24564d91764a1844b35a42181862e99d02cc38a41ee59",
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

状态 **PENDING**，唯一确认人为 ProjectUser；Codex拟稿与核证，不自行批准。按[用户确认规程](../../../gate-records/user-acceptance-confirmation-workflow.md)记录用户实际原答复/时间/文稿及范围摘要，再执行门禁。

确认对象：冻结源码 `e443495217797c8fe8428620f5177efcf876cf69`、1601 个统一工程输入；G0范围 `sha256:266e20e793d518283fc24564d91764a1844b35a42181862e99d02cc38a41ee59`，见[范围附件](./scope-request.json)。不可变[工程原件](./function-attempt-01/function-receipt.json) `sha256:e7e3553b093bb2167b4f9b140bb22468573a633b1556b9790b94282f85653fdb`。范围请求不含sourceCommit字段，实际源码由此工程原件及统一输入验证；本稿不批准后来输入变化。原ALL确认只绑定a045f15c/fce29312，不代替此G0稿。

本轮16组/8入口；Node 346、consumer117/12文件、单次构建与Chromium Web/mock OIDC11例通过。两个严格READY入口按实际阻塞拒绝；见[命令原始日志](./commands-and-results.md)与[控制矩阵](./control-matrix.md)。原API134操作/Rust240/HTTP3015未重跑：严格源差异证明runtime/API/contracts字节未变，原证据按原SHA逐字节核验引用；P0/A1/BFF000仅核验原范围来源，不重授本轮READY，不递归全闭包。

| 审阅维度 | 本稿范围与边界 |
|---|---|
| Product | 一期Web G0最小冻结面、17契约/22页面追踪、134published操作；8项台账工程同步；不是完整页面交付。 |
| Frontend | 生成client/contract/权限/敏感字段/CSRF/SSE恢复，types/lint，Web模拟OIDC/route/axe/视觉和静态预算；完整UI联调未执行。 |
| BFF | 原已确认ALL工程来源、当前API最小冻结和生成输出字节；新旧源码独立绑定，当前没有重新执行134 API。 |
| QA | 冻结源16组和8实际入口、346项Node与117consumer/11浏览器例；来源/命令/日志/哈希/确认/原子发布拒绝测试，失败历史保留。 |
| Security | 当前生成客户端/生产导入边界/cookie/CSRF/错误/敏感字段；无生产凭据；mock IdP与本机SSE不等同真实目标验收。 |
| Risk | Paper/Shadow/202仅accepted与风险读取无新增执行权沿用原API已确认边界；当前无runtime执行变化，不启用venue/Live。 |

## 台账与实际门禁

8项G0-L01-1/L02-1/L03-1/L03-2/L04-2/L04-3/L05-1/L05-2仅变为IMPLEMENTED_ENGINEERING，formalClosed=false。其余11项不关闭，历史十项/签署/逾期保留；G0-L10-2仍PENDING，四类legacy fixture未从生产API包移除，其期限PROVIDER:ALL不后移。

G0_SCOPE_LOCAL工程PASS，DEVELOPMENT **BLOCKED**：G0_CURRENT_SCOPE_CONFIRMATION_PENDING。ALL_G0_REVIEW_LOCAL工程PASS，DEVELOPMENT **BLOCKED**：同项加G0_L10_2_LEGACY_REMOVAL_PENDING。本稿确认只解决G0当前范围批准；实际工程输入未变并通过finalize后才可评估G0 DEVELOPMENT READY。即使G0 READY，ALL仍需完成legacy移除/迁移的当前功能验收；不得只因确认本稿就将ALL READY。页面/runtime DENIED；formalAccepted=false；正式G0历史review_status仍独立NOT_STARTED。

## 未决风险与下一步

真实Supabase/PostgreSQL/RLS/事务/IdP/Auth/MFA/Storage/worker、外部许可/时效/撤权/venue、持久恢复、完整业务/UI联调、目标安全/性能/容量/长稳/部署/同SHA CI、Beta/Live RELEASE均NOT_RUN；目标自动化NOT_IMPLEMENTED。原历史范围未改绑、未执行项不记PASS。无生产凭据、推送或部署授权。

项目用户可直接确认本G0完整稿或提出修改；无需另收集角色回执。收到明确确认后另存原答复与摘要，执行`pnpm finalize:g0-development`核验同一输入及实际批准；移除legacy应作为下一有界功能任务完成必要迁移/直接回归后重新评估ALL。未经确认Codex不填CONFIRMED。
