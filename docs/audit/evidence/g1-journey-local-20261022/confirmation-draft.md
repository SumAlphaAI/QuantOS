# G1-REC-02 本机旅程完整确认稿

状态 **PENDING**。唯一确认人为项目用户，Codex拟稿/技术核验/记录，不自行批准。本稿仅限定同候选本机reference组合，不申请整个G1/FEP-1、I2、真实环境或发布准入。

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FRONTEND-GATE:G1",
    "stage": "INTEGRATION",
    "sourceCommit": "38569928f3557f80ca8bf3717d1f77882cf1e5ae",
    "inputsDigest": "sha256:9eb8f96ac9cceae677b1a8c191b8aed997b27a8e96185ec456315406c14381ac",
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

工程 `38569928f3557f80ca8bf3717d1f77882cf1e5ae`、577项冻结输入，scope摘要 `sha256:9eb8f96ac9cceae677b1a8c191b8aed997b27a8e96185ec456315406c14381ac`。见[范围](./scope.json)、[原工程回执](./receipt.json)、[旅程矩阵](./journey-matrix.json)、[原始命令](./attempt-01/executions.json)、[报告](../../G1-REC02-local-journey-review-2026-10-22.md)、[保留边界](./retained-boundaries.json)及[全部尝试](./attempt-history.json)。文档/确认提交不将原工程改绑到新HEAD。

1. Product：登录→Command→P15资料/通知/安全→P17历史/真实下载的本机链及CAS、未知结果、202受理重读、429、401/403、断流/离线恢复均有实际浏览器组合；恢复不自动重放写入，旧草稿不跨失效身份。
2. Frontend：实际前端登录/回调执行一次性pending消费和PKCE、safe return；IdP和session建立由明确loopback替身提供，真实身份与Cookie/CORS仍NOT_RUN。P17实际点击短链/附件，未通过response interception伪造内容。导出创建通过NODE_CONTROL_PORT，尚不声称完整导出创建UI。
3. BFF：为完成审计关联，reference settings旧格式审计改接现有结构化C10格式，原action别名/计数保持，保存correlation与安全202 auditRef均可查询；不记录资料原文/MFA/幂等秘密，幂等重放不重复追加。没有更改live provider或目标数据库规则。
4. QA：最终同SHA的9限定命令全部exit0：16身份/设置+14审计/导出Rust、10 Chromium旅程、77门禁负向、typecheck/lint、BFF/Terminal各一必要构建与计划检查。实际4743字节附件hash=签发元数据=传输原内容，旧ticket410；audit payload hash与关联核对。原失败/EPERM/7通过3失败及中间源码未完整冻结局限保留，预检PASS不拼入最终证据。
5. Security：真实reference CAS/401/403/MFA429、202事实重读和commit后响应丢失经验证；明确重试沿用相同意图/版本/幂等键，取消不保证服务端回滚。短2秒429恢复为合成，真实60秒冷却到期NOT_RUN。纯transport断开可能被Chromium透明重试，原失败证明保留；应用层无自动重放，服务端幂等仍必须。
6. Risk：本轮PASS_LOCAL_JOURNEY_WITH_EXPLICIT_PORT_SUBSTITUTIONS、确认PENDING；G1/FEP-1 NOT_READY_GAPS_OPEN、INTEGRATION NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。Firefox/WebKit阻塞及全部原NOT_RUN/incomplete/失败不变，完整无替身G1/真实IdP/MFA/DB/Storage/CORS/持久撤销/live流/领域实时/目标授权、人工读屏/原生200%、设备/OS/CI/性能长稳/后台调度/RELEASE均未执行。DL与REC-01确认仍各自原SHA，P15仍待独立确认；其余4项义务保留。下一G1-DEP-01。无生产凭据、目标调用、推送或部署。

用户确认本稿只满足此范围人工确认，不将NOT_RUN转PASS，也不提高G1/FEP-1联调或发布验收状态。
