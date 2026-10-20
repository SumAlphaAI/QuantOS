# G0 legacy 迁移后完整确认稿（含 PROVIDER:ALL 条件评估）

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FRONTEND-GATE:G0",
    "stage": "DEVELOPMENT",
    "inputsDigest": "sha256:8f6826a9effa78b3b41aaef2a45e2cc31d7d806e414c2f27481d0d9668c0bc9b",
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

状态 **PENDING**。拟稿/核证：Codex；唯一确认人：ProjectUser。依据[确认规程](../../../gate-records/user-acceptance-confirmation-workflow.md)第5步，功能输入变化须更新文稿并确认；本稿只绑定下述冻结候选，不能将原批准改绑到新输入。

确认对象：源码 `4fdc67b41b1cf30215ca96a0ac2fe97d6729dc83`、统一工程输入1652文件；当前G0范围 `sha256:8f6826a9effa78b3b41aaef2a45e2cc31d7d806e414c2f27481d0d9668c0bc9b`，见[范围附件](./scope-request.json)。不可变[工程原件](./function-attempt-02/function-receipt.json) `sha256:851a78be0456b84a3717909d8b7b4eb788b555393d995911d2882ba2d8ac5077`。JSON request使用G0 scopeDigest，源码由工程原件与Git字节验证绑定，后续功能输入变化不得沿用此批准。

## 原确认与本轮差异

本会话“人工已确认G0完整确认稿”已原文保存于[原确认记录](../g0-confirmation-20261020/user-confirmation.json)，原e4434952 G0范围在f7141e4b完成READY收口；原稿、工程执行与入口日志字节保留。原ALL确认继续绑定a045f15c/fce29312，原134 API结果未在本轮重跑、未改绑。

本轮删除生产包四类backend/四个旧Backend接口及旧客户端运行时构造器。生产四模块仅保留46个兼容类型声明，原45个UI类型主体不变；所有场景状态/组装仅在测试目录。29项原U01/S04/X06/L03场景断言迁移到生成契约测试adapter，另加6项导出/响应/SSE/隔离拒绝测试。fixture用生成operation metadata、Zod及真实生产transport注入无网络fetch，保持UI投影；不宣称真实provider交付/联调/目标性能。202只accepted；模拟M5 flag不授予实盘能力。

16组通过：Node 323、consumer177/23文件（另3个未启用外部Engine探针SKIPPED，不计PASS）、Web/mock OIDC11例；API client与Terminal各一次构建。8实际入口：6个exit0，G0严格exit1/ALL严格exit2为当前确认待办的预期拒绝。首轮编译产物正则误拒绝的FAIL保留；新源码独立完成16组，未拼接旧PASS。见[命令与日志](./commands-and-results.md)、[控制矩阵](./control-matrix.md)。

| 审阅维度 | 本稿确认范围与边界 |
|---|---|
| Product | 一期Web G0最小冻结面与legacy迁移；仅工程功能，不等于所有页面交付。G0-L10-2工程完成，其他18项/未来义务保留。 |
| Frontend | 生产旧backend/构造器移除、旧UI类型保留、生成契约fixture adapter与29原场景；types/lint/build、基本浏览器与静态预算。 |
| BFF | OpenAPI/generated/provider/原生源码未变；原已确认ALL134操作证据按原SHA验证引用，本轮没有134运行时复验。 |
| QA | 上述16组/8入口；源码和产物移除、改名/重导出/缺产物、schema/SSE/确认/原子回滚拒绝测试；原失败/skip原样保留。 |
| Security | 无生产fixture导入/导出；权限/敏感字段/CSRF/SSE基础直接回归。mock IdP/fixture的MFA/自批拒绝不是正式目标安全验收。 |
| Risk | fixture-only状态及模拟M5不授予Live/venue；原Paper/Shadow/风险预检无新增authority和202语义保持，真实目标恢复/风险边界未关闭。 |

## Gate 与确认效果

原G0确认收口READY仅绑定原范围。迁移后 **G0_LEGACY_SCOPE_LOCAL与ALL_LEGACY_REVIEW_LOCAL均工程PASS、DEVELOPMENT BLOCKED**，唯一阻塞G0_CURRENT_SCOPE_CONFIRMATION_PENDING。旧G0_L10_2_LEGACY_REMOVAL_PENDING已由真实移除/迁移测试消除。

用户明确确认本稿后，Codex另存实际原答复及摘要，执行`pnpm finalize:g0-development`核验原工程输入未变、真实当前G0批准、legacy完成及原ALL批准，然后同时评估当前G0/ALL DEVELOPMENT READY；任何内容失败/漂移仍拒绝。只更新确认与门禁，不重跑无关上游/134 API。新入口日志写独立目录，原pending/工程执行原件保留。本稿批准不授予后来的源码、INTEGRATION/RELEASE、正式ACCEPTED或运行时交易权限。

## 未执行与移交

真实Supabase/PostgreSQL/事务/RLS、真实IdP/Auth/MFA/Storage/worker、外部来源许可/撤权/时效/venue、跨实例和重启持久恢复、完整业务/UI联调、目标安全/性能/容量/长稳/部署/同SHA hosted CI、Beta/Live RELEASE均NOT_RUN；目标自动化NOT_IMPLEMENTED。formalAccepted=false、runtimeAdmission=DENIED；全平台视觉/原生服务/134 API未重跑。无生产凭据、推送或部署授权。

项目用户可直接确认此“G0 legacy迁移后完整确认稿”或提出修改，无需另收集六方回执。下一执行为同源确认收口及ALL严格READY评估；通过后才按计划选择I1页面当前功能复核并核验其前提。
