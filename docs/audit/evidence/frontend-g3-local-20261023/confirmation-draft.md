# G3 / CORE:S04 限定本地联调复审待确认文稿

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FRONTEND-GATE:G3",
    "stage": "INTEGRATION",
    "sourceCommit": "9a463495f7324b5f218bd3d0edd79baebb0f651c",
    "inputsDigest": "sha256:b18bf23686bde37366bef5578a750291074fc1bbdfee5f45b28d214f24df5eb9",
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

确认对象：最终源码/工具/页面候选 `9a463495f7324b5f218bd3d0edd79baebb0f651c` 的本地显式替代组合及attempt-04证据；BFF功能修复源6ff11941、Web工具e50b11af/3d8f9775、审计排版9a463495。工程Gate PASS_G3_OWNED_LOCAL_COMPOSITION；完整G3/CORE:S04仍NOT_READY，阶段NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED、currentHeadAcceptance=NOT_CLAIMED。本稿PENDING，不代项目用户确认。

| 审阅维度 | 限定范围与未闭合边界 |
| --- | --- |
| Product | 20份实际自有Strategy Lab IPC产物，经Artifact/Lab/回测/报告/Release/审批/目标/Audit完成20个独立策略与Release；相同模板，不是20种算法。R03 worker注册仍由可信宿主替代 |
| Frontend | P06/P07成功、拒绝、只读/失权/离线/未知结果恢复与18既有基线比较；修复Audit真实长事件重叠并加DOM断言；36axe扫描0violation/36incomplete，未声称人工无障碍完整矩阵 |
| BFF | 真实C04/C05/C08/C10与S01–S04组合，DecimalString极小数和JS整数表示往返修复；报告/参数/source/image/hash及evidenceRefs核对；C10完整只指本次correlation，未证明全局研究到Release因果图 |
| QA | 最终Web1003 passed/3 skipped、91门禁、44Chromium、S04 TCP6/6；原6ff Rust730 passed/14 ignored与Python1908 passed仅输入未变参考，未改绑新SHA；失败/中断/人工发现均保留 |
| Security | 100未验证/未审批拒绝、100来源伪造、隔离/会话/能力/CSRF、scope/hash/有效期与原键重试；20并发1成功19个409；审批测试actor/MFA为reference替代，不是产品自批或真实IdP验收 |
| Risk | 批准有效期内仅选后端Paper/Shadow，未批准/拒绝/过期均阻断；两原生消费者只是本地配置/重放，无外部部署或交易；金额字符串、非安全整数和不可变hash不放宽 |

当前36及前次G3 36、P07 22、UI303零、UI302 12、P06 18、前次UI301回归12、原UI301 8条incomplete分别保留，不去重、不关闭；全部旧NOT_RUN保持原文件。真实R03 worker→策略注册、无替代身份/Cookie/CORS、完整跨模块因果证据未完成；全部目标数据库/Storage/持久恢复/hosting、Firefox/WebKit、人工读屏/native200%、跨OS、Storybook、CI、性能长稳、完整联调验收与发布均未执行。用户确认仅满足本轮限定文稿人工确认条件，不能将这些NOT_RUN或依赖阶段自动放行。

原P07确认已绑定636f46a4/5a20e7d5并提交b3605d85；旧稿/receipt不改写。本轮不接受随后HEAD或完整G3，未使用生产凭据、未推送或发布。下一闭环G3-INTEGRATION-01；可独立继续原任务UI-401。
