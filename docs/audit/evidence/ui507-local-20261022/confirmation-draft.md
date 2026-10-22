# I2 UI-507 当前功能完整确认稿

状态 PENDING；唯一确认人为项目用户。Codex拟稿、验证和记录，不代用户确认。本稿只覆盖当前功能工程及明示本机reference组合，不申请 INTEGRATION READY、运行或发布授权，也不作为 UI-P12 开发前置。

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:UI-507",
    "stage": "INTEGRATION",
    "sourceCommit": "9f7552a8305b1fb1b661676d1d67becf1ebb229b",
    "inputsDigest": "sha256:d359eb5c8d55e95ba50d33333a728f8559a676372b38fa31245a25de0b969a3e",
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

工程候选 `9f7552a8305b1fb1b661676d1d67becf1ebb229b`，520项源码/配置输入，输入清单摘要 `sha256:d359eb5c8d55e95ba50d33333a728f8559a676372b38fa31245a25de0b969a3e`。见[技术回执](./receipt.json)、[执行记录](./attempt-02/executions.json)、[确认范围](./scope.json)、[报告](../../UI-507-audit-export-2026-10-22.md)。后续文档/证据提交不改绑本轮工程结果为新HEAD接受。

1. Product：交付原 I2 UI-507 的审计搜索、correlation/causation 链、脱敏载荷、受控异步导出。实际入口 `/audit`、`/exports`；资源引用使用查询参数。高保真和原 UI-P12 路径映射属于下一原任务，不声称本轮完成 UI-P12。
2. Frontend：服务端过滤/游标分页、重置查询、重复/超限/循环/过期拒绝；因果链分段读取与当前授权范围的完整标记；显式状态查询，202不等于ready。桌面创建/取消，小屏查询和授权下载。权限/期限/离线/隐藏等失效清空私有数据与草稿，中止请求，显式恢复只读，不重放写操作。
3. BFF：使用生成C01/C10 client/schema，导出按明确范围、理由、水印、保留期请求。创建/取消经CSRF、MFA、近期认证、幂等键和服务端最终校验；取消前重读状态。未知创建原意图显式重试复用原键；未知取消可读回最终事实。不伪造供应方数据或改写下载URL。
4. QA：同一工程候选11条有界命令：10条预期成功；联调入口1条预期拒绝（exit1）。55项直接测试、6项Chromium实际路由、39项门禁与边界测试通过，retry/skip/flaky均0。Terminal类型、局部lint、单次Terminal/reference构建、客户端秘密扫描和计划检查通过。实际下载4743字节、SHA-256与租约一致，导出创建/内容消费审计可回查。预检失败与原始记录边界保留，不复用预检PASS替代候选执行。
5. Security：身份、工作区、权限、mode/environment、MFA和期限保持绑定；权限由服务端控制，前端不放宽。短时租约同HTTPS BFF origin、opaque路径、最长300秒及保留期，无query/hash、无URL重写；URL只作临时下载交接，不保存历史、遥测或组件状态。secret/MFA/reauth令牌不持久化。429有效冷却，结果未知、撤权和关闭后不自动提交。
6. Risk：本机采用明示reference cookie与CORS替代端口，真实MFA/IdP、cookie/CORS、数据库/storage和目标持久撤权并未验收；人工读屏、原生200%、跨OS/设备、CI、性能/长稳和发布继续NOT_RUN。Firefox环境阻塞、WebKit拦截附件接收阻塞及全部历史NOT_RUN原字节保留，新证据不覆盖历史完整未替代旅程。未知意图只在当前页面内存恢复；离开页面后须通过审计确认服务端事实再创建，不宣称跨重载自动恢复。G1/FEP-1完整联调与发布不提升。

## 唯一确认范围

只确认上述工程SHA/摘要、技术回执、报告与完整稿所列 UI-507 当前功能范围。原159个阶段Gate保持NOT_ASSESSED，正式ACCEPTED=false、runtimeAdmission=DENIED；不将辅助G1事项转成开发前置。没有确认原始答复、approval=null；本轮执行指令不等于批准本稿。若用户确认到达，按统一确认规程原样保存并核对文稿/范围。本稿不授权生产凭据、推送、部署或外部发布；下一 UI-P12 可独立继续开发。
