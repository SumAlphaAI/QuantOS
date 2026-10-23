# UI-P06 限定当前页面待确认文稿

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:UI-P06",
    "stage": "DEVELOPMENT",
    "sourceCommit": "f2854052e55e9df0aca2ce5b0da9993d5839d3b4",
    "inputsDigest": "sha256:107d9d70213cb1a28c6131f4deaa4f4585d84964afe613c94098e9ebe5600185",
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

确认对象为工程 `f2854052e55e9df0aca2ce5b0da9993d5839d3b4` 的P06当前页面功能与本机reference证据，工程Gate=PASS_UI_P06_CURRENT_PAGE；不接受之后HEAD或完整联调/发布。

| 审阅维度 | 确认范围 |
| --- | --- |
| Product | 三条策略路由、卡片/表格目录、Lab三栏、文件与参数编辑、版本/保存/冲突可用；新建端点缺失明示 |
| Frontend | 冻结tokens、深浅主题、1672/1024/390响应式、键盘页签、10张独立视觉比较；7个状态故事源码提供，Storybook构建NOT_RUN |
| BFF | 实际C05 reference目录/草稿/保存；C01权限流；245个Rust输入不变，复用原0642eaad binary；身份cookie与TLS/CORS桥接为替代 |
| QA | 55前端、15门禁/路由、12Chromium全通过；10视觉基线独立重放；预检失败保留，最终只用attempt-01 |
| Security | 权限撤回清除、未知结果同键重试、无效参数切页签保留并禁保存、409不覆盖；实际IdP/DB/Storage未验收 |
| Risk | 草稿不直接交易；未提供静态/依赖/许可结果、回测进度/收益或批准均不推断；UI-302/UI-303保留 |

P06的18次axe扫描为0 violations，18条color-contrast incomplete扫描记录保留；本轮UI301回归另有12条，原确认的8条仍保留，均不等同独立缺陷数或已关闭缺陷。人工读屏/native200%、跨OS、Firefox/WebKit、真实IdP/MFA/CORS、Supabase/RLS/事务/Storage、托管rewrite、远程同SHA CI、性能/容量/长稳、FEP-3/G3完整链与发布均NOT_RUN。

此文稿当前PENDING；项目用户确认后仅满足限定页面人工确认条件。stage_gate保持NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED。UI-301原确认单独绑定0642eaad及0eac15e4，不改绑P06。下一原计划功能为UI-302。
