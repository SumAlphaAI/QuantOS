# FE:UI-VIS-000 / I1 当前功能复核完整确认稿

状态：PENDING。项目用户唯一确认；Codex不自行批准。本稿确认共用视觉功能工程事实及未执行项，不请求INTEGRATION READY或正式ACCEPTED。

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:UI-VIS-000",
    "stage": "INTEGRATION",
    "sourceCommit": "45f3a307f22b4281203e8bfb314c02181402e92e",
    "inputsDigest": "sha256:4272bd363423b52b34aaa104af20e81a105b8f7120751570ba2dd11adb5fe3d2",
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

工程源 `45f3a307f22b4281203e8bfb314c02181402e92e`、244项输入，摘要 `sha256:4272bd363423b52b34aaa104af20e81a105b8f7120751570ba2dd11adb5fe3d2`。[原始执行](./function-attempt-03/executions.json)、[机器回执](./receipt.json)、[直接前提](./direct-prerequisites.json)、[截图审阅](./visual-review.json)。原UI-103确认绑定804f52d1工程与f002eedd原稿，人工读屏/原生200%保留NOT_RUN；未改写其原稿/原receipt。

| 维度 | 可确认事实与边界 |
|---|---|
| Product | 按P02/P20 v3层次提供共享壳、导航、顶栏、状态条、栅格、面板、表单、图表；P20组合为明确fixture，不提前实现下单流程 |
| Frontend | `ui/Workspace`、`workspace.css`、非状态workspace token及`domain-ui/chrome`；Command/Settings实际复用，集中面板边框/背景与14/13/24px排版；深浅主题及768/390回流 |
| BFF | 15直接前提按不可变原件只读核验；C01/C16/C17由调用方负责业务权限与契约，本任务无新BFF接口/外部调用；原API READY不改绑 |
| QA | 最终10组exit0；78单测/3既有外部引擎探针跳过；79 Node测试；直接Command/Settings Chromium13例；8故事双主题+真实Portal/回流共20 axe扫描，报告违规0、19次color-contrast incomplete保留；10图逐图检查 |
| Security | 主工作区只读标识、未知模式UNKNOWN/只读展示；调用方授权导航不扩权；键盘跳转/折叠不丢字段、图表数据表、MFA短语确认/取消焦点、离线禁写及小屏隐藏危险入口；真实服务端权限仍独立 |
| Risk | 冻结状态枚举/安全文案/语义色不变；装饰强调色独立token；图表拒绝无效值并规范化极端数值；未使用生产凭据、未连DB、未推送或部署，runtime DENIED |

本机Chromium/Darwin3张1440业务页面基线重新初始化后，同构建实际比较2例通过。旧3PNG与旧manifest保存在visual-baseline-migration/before；初始化不是旧图匹配通过。其他浏览器及Linux基线仍是历史原件，尚未迁移到本次视觉，当前完整CI比较可能拒绝；禁止复制Darwin截图冒充Linux。RELEASE设计签署NOT_RUN。

失败保留：首轮lint发现漏接Settings通知区域，已恢复；development-02浅色PAPER背景造成4.41对比度，已修复；function-attempt-01 Storybook decorator类型TS2742失败；attempt-02 CSS zoom=2时390px产生409px溢出，保留trace。最终45f3a307复验通过，不拼接前两轮为PASS。

功能实现与限定组件组合PASS；**INTEGRATION NOT_ASSESSED、formalAccepted=false**。人工读屏、原生200%缩放、跨平台/跨浏览器视觉迁移、真实BFF/IdP业务联调、远程同SHA CI、目标环境、性能/长稳、RELEASE均NOT_RUN。CSS zoom=2及720CSS像素回流通过不能代替原生缩放。19次axe incomplete未晋级人工通过。

请确认上述工程事实与未执行边界。确认不自动升级任何NOT_RUN/阶段READY。下一开发项FE:UI-102 / I1当前功能复核；完整阶段准入仍独立收口。
