# G0 当前功能冻结独立完整确认稿

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FRONTEND-GATE:G0",
    "stage": "DEVELOPMENT",
    "inputsDigest": "sha256:a71f3008836d7857c39c487e20537c91ef7ce284d87caeac98e3166213e10066",
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

状态 **PENDING**。本稿独立于ALL/A6旧确认，不修改旧G0文稿或登记。冻结源码 `a045f15cddf2be6abca36fff003936602ce80985`；[当前工程回执](./manifest.json) `sha256:76e022715b8b4c9bff2cf78539ff9c8e1afa3a1b1d5ac77ce5c9f7ce83e521fb`；[精确G0请求](./g0-scope-request.json) `sha256:a71f3008836d7857c39c487e20537c91ef7ce284d87caeac98e3166213e10066`，本文件摘要以实际用户确认时读取原件计算。

G0范围为一期Web当前已发布最小契约、页面/字段追踪、生产导入边界、Web/模拟OIDC/SSE工程PoC。当前OpenAPI1.14.0，134项published、0planned，17契约/113schemas/22页面、14个最小schema和6类生成产物；19条处置的owner/deadline/兼容策略明确。覆盖功能、失败与边界完整事实见[ALL完整稿](./confirmation-draft.md)、[控制矩阵](./control-matrix.md)、[实际命令](./commands-and-results.md)，均作为本稿审阅附件。

| 审阅维度 | 本G0确认对象 |
|---|---|
| Product | 当前已发布API最小集、页面/业务操作追踪、0planned；页面开发前提仍需ALL独立门禁。 |
| Frontend | 当前生成client/Zod/MSW/JSONSchema、静态导入与Web route/模拟OIDC/SSE PoC；11个基础浏览器例不替代完整UI。 |
| BFF | 六生成摘要/17契约/134项、默认错误/权限边界及19条兼容处置；组件原回执只参考，不给独立当前READY。 |
| QA | 同源码20组和实际入口；首轮PRE01真实失败已保留，修复后新候选独立通过；G0/ALL当前确认仍PENDING。 |
| Security | 白名单环境、敏感字段检查、隔离/身份撤权、公开访问申请例外；真实IdP/RLS/部署安全NOT_RUN。 |
| Risk | 不改变交易权限、风险决策或Paper/Shadow/Live边界；外部来源许可与目标恢复仍待验收。 |

G0本轮核证的是当前功能冻结最小范围，未调用G0独立严格Gate；该独立stage仍NOT_GRANTED，所需额外工程/阶段义务须按适用范围另行验证，确认本稿不能自动授予独立G0 READY。

只有项目用户明确确认本独立G0稿，Codex才保存原答复、文稿和request摘要并执行门禁；确认本稿不能替代ALL技术验证或FEP-0/完整INTEGRATION/RELEASE验收。工程PASS不等于阶段READY；当前G0登记PENDING、正式状态NOT_STARTED/NOT_GRANTED，ALL BLOCKED。旧A1/G0历史确认不复用。

未执行：真实Supabase/Auth/Storage/外部数据源与venue、持久/跨实例恢复、完整业务/UI、目标安全/性能/长稳/部署/同SHA CI/发布；全部NOT_RUN，自动化NOT_IMPLEMENTED。runtime DENIED，不使用生产凭据，不推送或部署。用户确认不可将这些项转成PASS。

G0附加未决项：原19条台账有8项API工程条目仍PENDING（Backtest SSE、C02、C12、C14、C13、C15、C11、C16）。本轮真实API证据已PASS，但原台账未自动变为IMPLEMENTED_ENGINEERING/CLOSED；见[逐项复核映射](./g0-disposition-recheck.json)。映射仅供G0独立当前复核，不授予G0或页面准入；后续须同步当前处置和适用残留、绑定范围及实际用户确认后再执行门禁，不能仅确认ALL稿即READY。

版本补强：第三轮c3203f95的20组和5入口已通过并保留；索引复核发现244个G0附件文件未在ALL主输入中，实际原Git字节均与c3203f95一致（[复核记录](./preflight/g0-source-binding-recheck.json)）。现已将附件功能输入并入统一源清单，加入拒绝测试，在本稿最终候选重新独立完成当前20组；第三轮不改绑为新候选。
