# FE:UI-101 / I1 当前功能复核完整确认稿

状态PENDING。唯一项目用户确认，Codex不自行批准；确认当前工程事实和未执行边界，不申请INTEGRATION READY或正式ACCEPTED。

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:UI-101",
    "stage": "INTEGRATION",
    "sourceCommit": "4423badb596862d006be1b77318a4828b002e3e0",
    "inputsDigest": "sha256:ce732daed5ce897dbca9033ea073049f7f6e91f510a2d7e4d01f9ceb90e0fb46",
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

工程 `4423badb596862d006be1b77318a4828b002e3e0`，503项输入，摘要 `sha256:ce732daed5ce897dbca9033ea073049f7f6e91f510a2d7e4d01f9ceb90e0fb46`。[机器回执](./receipt.json)、[原始执行](./function-attempt-03/executions.json)、[直接前提](./direct-prerequisites.json)、[完整报告](../../UI-101-current-function-review-2026-10-21.md)。报告后续文档提交不改绑已测工程SHA。

| 维度 | 可确认事实与边界 |
|---|---|
| Product | 主工作区/账户/mode/freshness/risk/连接只读展示；真实上下文无伪造名称；完整P02业务交互与实时页面独立，不声称完成 |
| Frontend | 显式mock与非mock分离、无fixture回退；六步守卫逐步短路；刷新/恢复/过期重验并撤下旧投影；取消/迟到不回填；短上下文标签保留完整ID title |
| BFF | 生成C01/context/C02及运行时schema；实际ops.read权限、账户/mode与有效期绑定；真实本机Rust reference4会话组合通过，浏览器服务端响应为受控fixture；目标持久BFF/真实IdP未验证 |
| QA | 最终12组exit0，55单测/组合、16Node负向、mock17+BFF14浏览器；types/lint/BFF bin与两必要前端配置构建通过；精确本机PNG初始化1例再同构建none比较1例，初始化不当作旧图匹配 |
| Security | 失败停止后续请求；401清内存并登录、403/404同隐蔽页、5xx维护；unknown/null不补零或擅自fresh；无写调用、无自动旧意图重放；快照连接不冒充实时订阅 |
| Risk | INTEGRATION NOT_ASSESSED、formalAccepted=false、runtime DENIED；人工读屏/原生200%、目标环境/真实认证、远程CI、性能长稳、RELEASE仍NOT_RUN；未使用生产凭据、未推送/部署 |

15直接前提均只读引用原件，不递归重跑完整上游；UI102用户确认绑定fd2f3e64工程/50eb2f6b原稿包，原稿与receipt不改写，人工读屏及原生200%仍NOT_RUN。55,396既有audit/gate路径无修改。

首轮自动测试通过但图审发现1723px UUID撑宽，独立FAIL保留；第二轮图审CHANGES_REQUESTED保留normal风险红字和容差内旧底栏基线问题。最终4423badb修复后14例非mock含桌面/390/CSS zoom=2与健康风险断言通过，两张最终图已由Codex逐图查看。仅本机Chromium/Darwin Command PNG更新，原UI-VIS PNG/catalog及各轮before/after保留；其他OS/浏览器视觉未迁移，完整远程CI仍可能拒绝。

BFF页面axe违规0，2条incomplete（aria-prohibited-attr1节点、color-contrast20节点）原样保留，不升级人工通过。CSS zoom=2不代替原生200%缩放。真实IdP/MFA、目标数据库/服务端撤销持久性、浏览器→真实服务完整业务联调、SSE页面接入、完整P02/发布设计验收未完成；本次读取适配分支的integrated标签不是阶段准入。

请确认上述工程事实与未执行边界。确认不消除NOT_RUN、不授予新HEAD或阶段READY。下一开发项FE:UI-104 / I1当前功能复核，完整P02/G1义务独立收口。
