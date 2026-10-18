# 待ProjectUser确认：当前 A1 / G0 工程冻结范围

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "status": "PENDING",
  "request": {
    "nodeId": "FRONTEND-GATE:G0",
    "stage": "DEVELOPMENT",
    "inputsDigest": "sha256:801ccc494c379ba4d52141bf987ecead1b3c35e14578d68ddb44f23efdbeb09a",
    "sourceCommit": "b80835dff9ee07efd9aaef3c704f32d95e134233",
    "reviewDimensions": [
      "Product",
      "Frontend",
      "BFF",
      "QA",
      "Security",
      "Risk",
      "Domain"
    ]
  },
  "reviewDimensions": [
    "Product",
    "Frontend",
    "BFF",
    "QA",
    "Security",
    "Risk",
    "Domain"
  ]
}
```

状态PENDING。Codex只拟稿，不自行批准；任务执行授权不视为当前范围验收答复。

拟确认内容：我已审阅冻结源码 b80835dff9ee07efd9aaef3c704f32d95e134233、freeze.json摘要 sha256:801ccc494c379ba4d52141bf987ecead1b3c35e14578d68ddb44f23efdbeb09a 与27组当前功能/直接影响证据，确认API1.7.0的70个published与38个planned分别登记、62schemas/六类生成产物一致、17契约/22页追踪关系及14最低schema面，Web/OIDC/SSE和权限/幂等/审计边界，以及19项owner/期限/兼容安排。38项planned未升级为已实现，reference HTTP仅证明C01/C17/C10已实现范围。

工程结果：Node278项分组执行、client/contract110（含7项真实loopback SSE）、Rust26、38次reference HTTP schema记录、Chromium11均通过；新Terminal编译/lint/typecheck、资源/视觉/axe、客户端秘密扫描及静态bundle预算通过。分组可能覆盖同一行为，不相加为唯一案例数。首轮由Codex安全中断本机编译停等，原始日志/栈保留；第二轮27组通过但交付入口ESM等待环退出13，准入已撤回且原件保留；第三轮修复后完整重跑27组，并在原子状态更新收口实际通过7项激活入口验证，不拼接结果。

| 维度 | 当前事实与边界 |
| --- | --- |
| Product | 当前A1工程完成，可按计划继续A2 API功能；不放行新页面、PROVIDER:ALL或发布。 |
| Frontend | 公共生成client/schema/MSW、生产导入约束、页面追踪及Terminal/OIDC/SSE PoC。 |
| BFF | cookie/上下文、错误、cursor/sort/filter、202job、Idempotency-Key、If-Match/ETag、correlation与SSE统一面；C01/C17/C10为owned reference。 |
| QA | 27组同源码当前范围，精确命令/日志/HTTP产物摘要、冻结清单和拒绝用例；无上游全闭包重验。 |
| Security | 调用者凭据剥离、仅public mock、私有app dotenv拒绝，服务只绑定loopback；无实际生产/目标凭据。 |
| Risk | actor/tenant/workspace由服务端负责，权限/陈旧版本/幂等冲突/撤权拒绝；不签发实际交易权限。 |
| Domain | schema/domain元数据与最低冻结面、未实现owner/期限/兼容安排保留，不以命名或mock替代provider。 |

本稿确认对象是当前工程冻结范围。G0与FEP-0的独立阶段准入仍NOT_GRANTED，严格ready入口拒绝；历史G0确认不迁移。实际答复后须保存原话、身份/时间、文稿与范围摘要，并按当前范围完成各独立检查点准入，不自动把本稿变为READY。项目用户一人可确认或修改，无需收集多个角色回执。

范围排除：完整F03远程插件代码生成及独立F03/F05/F06/F0/P0/六PRE重新验收、实际Supabase/IdP/RLS/持久事务/目标BFF、A2–A6全部provider、新页面完整联调/全平台矩阵、性能/长稳/部署/同SHA hosted CI和正式发布。以上NOT_RUN或NOT_REVALIDATED；不会因用户确认变成PASS。A1正式七类staging与最终确认仍DEFERRED_TO_FINAL_REVIEW。参考 docs/gate-records/user-acceptance-confirmation-workflow.md。
