# FE:UI-103 / I1 当前功能复核完整确认稿

状态：**PENDING**。本稿请求确认当前组件工程事实及明确保留的未执行项，不请求把 INTEGRATION 置 READY。项目用户是唯一确认人；Codex 不代为批准。

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:UI-103",
    "stage": "INTEGRATION",
    "sourceCommit": "804f52d1e5a2202449b05a75ca8a464a65a15eff",
    "inputsDigest": "sha256:09830e77af6513ba1fbb80e22c78ce3a3a7dff35fea56fd53ac1bdf65851b2d5",
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

对象包括 UI 六个基础组件、ThemeProvider/I18nProvider、三类 domain-ui 指标及 Storybook 真实组合。工程源为 `804f52d1e5a2202449b05a75ca8a464a65a15eff`，233项输入；回执摘要 `sha256:465407e1abe559555b00b8bef049a935c1aef2ff27d49f5cf2a0a3c92d1d33ca`。仅汇总器与其测试修复于 `c5d16d00`，独立27项测试PASS；原15组工程执行保留原源码与日志，没有重跑/改绑。[机器回执](./receipt.json)、[原始执行](./function-attempt-01/executions.json)、[工具修复](./function-attempt-01/tool-repair/proof.json)。

| 审阅维度 | 已核验事实与范围 |
|---|---|
| Product | 表格长数据滚动后短数据替换可恢复；受控过滤/排序/翻页、显示列、证据展开；无业务API、venue或交易动作 |
| Frontend | 双主题/双语上下文、唯一标题ID、实测左右固定偏移；390px宽表内部滚动、弹窗盒模型/层级修复；10张最终截图逐图检查 |
| BFF | UI-103不绑定业务接口；17直接前提按不可变原件只读核验；原provider/BFF API结果未重新执行、未授予新HEAD READY |
| QA | 15组限定命令均exit0；50单测/3既有外部探针跳过；危险短语/MFA策略4/4分支及行/函数/语句100%；87原Node测试；Terminal Chromium3例；60故事双主题、127 axe扫描无报告违规；保留49次incomplete扫描记录 |
| Security | 空/空白确认配置拒绝、精确短语/6位MFA格式、同步提交锁、pending禁止退出、错误脱敏/MFA清空/恢复；焦点陷阱、初始取消、退出回焦；真实身份/MFA及服务端最终校验由业务调用方承担 |
| Risk | 未知风险阻断，未知连接退为离线只读；无生产凭据、数据库连接、外发、推送或部署；runtimeAdmission DENIED |

当前结论：功能实现 PASS，限定组件组合 PASS；**UI-103 INTEGRATION NOT_ASSESSED、formalAccepted=false**。人工 VoiceOver/NVDA 读屏 NOT_RUN；1440→720 CSS像素的200%等效回流PASS，但原生浏览器200%菜单缩放 NOT_RUN；跨浏览器/跨平台视觉回归、完整业务联调、目标环境、远程同SHA CI、性能/长稳、发布均 NOT_RUN。新用户确认不代替这些技术检查。

G0/ALL 原确认仍属于4fdc67b4，旧文件保持原样；本轮共享UI输入变化后仅恢复当前计划阶段为NOT_ASSESSED，未否认其原范围READY，也不触发无关全闭包。55,142个既有audit/gate路径无改写。

后续顺序：保存本稿项目用户确认；补人工读屏和原生200%检查后独立评估UI-103 INTEGRATION。下一开发项为UI-VIS-000 / I1的当前功能复核，按功能阶段影响范围推进；严格整阶段准入仍不能越过未完成义务。
