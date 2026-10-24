# FEP-5 浏览器证据复核

实际查看 attempt-03（源码 654326559622c5c20653fbf3de1a13637666bcbe）四张新场景截图：fep5-paper-journey.png、fep5-small-screen-order.png、fep5-approval-correlation-synthetic.png、fep5-small-screen-unknown.png。该复核限于本机 Chromium、合成数据和回环身份桥。

- Audit 桌面图可见当前授权范围内完整链的 4 个节点：risk-evaluation、approval decision、Command、cancel-request；不是 venue/数据库全链或全局完整证明。
- 390px Order 图可见 accepted、Fill 0、只读时间线与订单量；无撤单入口/弹窗，未把受理显示为成交。该图只覆盖当前首屏，并非所有详情区域的排版验收。
- 损坏 correlation 后桌面审批图保留原待审事实，未显示批准成功回执，动作禁用；手机图为同场景首屏，无签署动作。
- unknown 区域在上述截图首屏外，不能据截图声称已视觉验收该区域。实际用例对 unknown 区域、无成功回执、小屏无恢复按钮/无假过期提示、返回桌面原 key/body 恢复均作 DOM/网络断言。

P10/P20 原有高保真响应式、键盘与 axe 直接用例另有当前源码截图和扫描 JSON。自动 violations=0 不等于人工 WCAG 全部通过；incomplete 保留并在 result.json 汇总为跨扫描出现次数，不是独立缺陷数量。实际颜色、读屏、原生 200% 缩放、Firefox/WebKit、跨系统及真实触控均未在本任务验收。没有更新参考设计图，也没有将旧截图改绑为新源码。
