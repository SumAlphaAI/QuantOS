# UI-P07 限定高保真页面待确认文稿

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:UI-P07",
    "stage": "DEVELOPMENT",
    "sourceCommit": "636f46a45ff464010f7776a5f0c87b5e34b087d4",
    "inputsDigest": "sha256:ee766d0fcd68f4cfca1021299be735ac5d8ca0de00fcd35bda9d65a4f56bbd81",
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

确认对象：应用、测试、18张视觉基线与门禁候选 `636f46a45ff464010f7776a5f0c87b5e34b087d4`，限定当前本机reference高保真页面。原始证据 `attempt-01`、`receipt.json`，完整输入645项、最终产物65项。工程Gate **PASS_UI_P07_CURRENT_PAGE**；确认PENDING，不接受之后HEAD或完整联调/发布。

| 审阅维度 | 限定确认范围 |
| --- | --- |
| Product | 回测详情/Release目录/详情三路由，固定输入、六指标、四页签、真实成本图、不可变包、服务端审批时间线与allowedTargets；设计缺少真实数据的区域明确缺项 |
| Frontend | 冻结Terminal shell/语义token、亮暗主题、1672/1024/390响应式；18张已提交基线独立比较，六张审批/目标补充截图；键盘页签/成交分页/全文哈希复制；目录搜索只作用本页 |
| BFF | 实际C05/C08 reference宿主；Release绑定报告通过既有参数/快照/hash校验及C08一致性后才显示；C10仅真实correlationId路由链接，未重验Audit完整链路；245个Rust输入和旧binary逐项摘要相同，未在P07重建或重验Rust |
| QA | 141功能/真实consumer、17门禁/路由、14Chromium通过；types/lint/Terminal构建/client-secret/计划通过；独立18基线比较无更新；22axe扫描0violations/22incomplete，未宣称读屏或完整视觉验收 |
| Security | C01/capability/CSRF/有效期/不可变性、未知创建/申请原键重试沿用且直接回归通过；失权/离线清除、恢复只读不重放；审批决策仅独立reference actor控制，不是产品自批 |
| Risk | 后端批准且未过期才可选受支持Paper/Shadow；仅页面内存，未发送部署/交易；202≠批准；没有净值/基准/回撤时序，未合成收益，成本图不作为财务/审批决策依据 |

当前22条incomplete（P07矩阵18，直接回归4）、历史UI303零、UI302 12、P06 18、前次UI301回归12及原UI301 8条分别保留，均为扫描记录数，未去重、未关闭。预检失败原始记录保留，预检基线种子不作验收。

UI303用户确认原文已在5d9d006e绑定c1774a74/3a66e307和原稿/摘要；不改写旧receipt的PENDING或其历史P07 NOT_RUN。本轮P07结论单独属于新候选。真实IdP/MFA/cookie/CORS、目标数据库/Storage/持久恢复、生产hosting、Firefox/WebKit、人工读屏/native200%、跨OS、Storybook构建、远程CI、性能/容量/长稳、完整联调/发布与部署交易全部NOT_RUN。reference身份cookie/TLS CORS桥为显式替代。

请求项目用户仅确认上述当前页面限定候选。stage_gate=INTEGRATION/NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED，currentHeadAcceptance=NOT_CLAIMED；本稿不授予G3 READY、生产或外部发布。下一检查点FRONTEND-GATE:G3组织I3完整业务联调/CORE:S04复审；UI401 Market Catalog/Watchlist/VenueQuote可按功能开发规程独立推进。
