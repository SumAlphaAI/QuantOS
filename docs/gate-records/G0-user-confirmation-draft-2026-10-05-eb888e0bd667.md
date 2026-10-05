# G0 DEVELOPMENT 用户确认文稿（2026-10-05）

状态：待用户确认。拟稿：Codex。唯一确认人：项目用户。本文件不生成批准记录。

## 确认对象

确认当前 API 1.5.0、一期 Web 的 G0 最低冻结面、工程/追踪要求、Web/OIDC/SSE 开发 PoC 与遗留安排。共 62 个 published 操作；46 个 planned 操作不视为已实现。完整清单与输入摘要见 [范围请求](./G0-user-scope-request-2026-10-05-eb888e0bd667.json)。

## 审阅要点

- 产品：确认一期 Web 与开发阶段范围、planned 与二期排除项。
- 前端：确认页面追踪、生成客户端、生产导入边界及基本浏览器/a11y/视觉范围。
- BFF：确认 API 1.5.0 最低冻结面、同源 schema/mock、错误与安全输入。
- QA：当前功能输入的工程执行和依赖核验见独立 G0 工程回执；FEP-0 整改新增 F0 当前功能回执与里程碑校验。你确认范围后仍须内容门禁通过，旧回执不可替代变更后工程准入复评。
- 安全：确认 cookie/CSRF/OIDC/SSE 等开发安全范围；mock IdP、loopback 服务不代表真实 staging。
- 风控：确认开发回执不会开启 testnet/实盘权限；未完成 provider、业务联调和发布验收仍按原计划。

## 遗留与准入条件

19 个遗留子项的负责人、阶段、消费期限和兼容策略按 [当前台账](./G0-current-disposition.md) 保留。你的确认关闭当前范围确认待办；阶段 READY 还需当前工程及依赖门禁通过，新页面还需 PROVIDER:ALL。真实部署/IdP、发布性能/长稳、同 SHA hosted CI、用途许可与发布确认分别在 RELEASE 完成。

## 待确认内容

建议回复：“确认 G0 DEVELOPMENT 文稿”。这仅确认本稿的当前功能范围和遗留安排；不确认所有后续任务或发布通过。如需修改，可直接指出修改项。确认后由 Codex 记录你的原始答复、时间、本文摘要与范围摘要，按门禁推进，无需你填写六份角色文件。

范围摘要：`sha256:eb888e0bd6676bc8d60972db81209dfafedad9ddb6aea9e17be3b8d0cb1ffe40`。功能输入变化须更新文稿；仅补充确认记录不更改已确认范围。

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "draftedBy": "Codex",
  "request": {
    "nodeId": "FRONTEND-GATE:G0",
    "stage": "DEVELOPMENT",
    "inputsDigest": "sha256:eb888e0bd6676bc8d60972db81209dfafedad9ddb6aea9e17be3b8d0cb1ffe40",
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
