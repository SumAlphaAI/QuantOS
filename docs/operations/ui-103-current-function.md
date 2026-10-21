# UI-103 当前组件功能复核

范围是 `@sumalpha/ui` 六个基础组件、ThemeProvider/I18nProvider、`@sumalpha/domain-ui` 三个领域指示器，及它们在 Storybook 中的真实 React/Radix/浏览器组合。无业务接口；fixture callback 不代表交易命令、MFA 服务校验或 provider 联调。功能回归仅覆盖直接消费者 Terminal `/command` 的路由、领域组件和 axe，不重新执行全闭包。

使用 `node scripts/ui-103-functional-review.mjs --run docs/audit/evidence/ui-103-local-20261021/function-attempt-NN`。先在 main 提交功能输入，脚本验证 Git SHA/逐文件摘要；凭据环境被白名单过滤，只使用 local-mock public 配置。执行一次 Storybook 与一次 Terminal build。Playwright `CI=1`、0 retries、禁止复用服务器；组件故事使用独立随机 loopback 端口，阻断外部请求。新尝试目录不可覆盖。

`node scripts/ui-103-functional-review.mjs --verify` 只核验同一功能输入、直接前提原件版本和摘要、完整命令/退出码/日志摘要、浏览器产物与分阶段状态；不重新运行上游。17个前提按原回执保存为 reference-only，不声称当前上游 READY。G0/ALL 旧 READY/确认仍绑定4fdc67b4，UI输入发生变化后当前计划记录恢复 NOT_ASSESSED，原始文件不改写，不因本任务自动要求全链重跑。

组件执行 PASS、组件组合 PASS、INTEGRATION 阶段 READY、正式 ACCEPTED 分开记账。浏览器 accessibility tree/axe 是自动化读屏代理，不能代替人工 VoiceOver/NVDA 读屏。200% 使用1440物理宽度对应720 CSS像素回流等价检查；它不是浏览器原生缩放菜单或辅助设备人工验收。截图为新捕获、人工逐图检查的组件证据，尚未形成跨平台视觉回归基线。

本轮保持 UI-103 INTEGRATION NOT_ASSESSED；人工读屏 NOT_RUN、新完整稿 PENDING，完整业务联调/RELEASE/远程同SHA CI NOT_RUN。用户确认原文稿后，按统一确认规程保存答复及版本绑定；人工确认不能把未执行读屏改成PASS。下一功能为 UI-VIS-000，但严格 INTEGRATION 准入仍须本节点独立收口。

危险确认只能做前端完整短语/6位格式和单次提交保护；业务调用方必须执行真实 recent-auth/MFA、RBAC、版本、有效期、幂等与服务端最终风险检查。未知风险/连接状态保持阻断或离线只读呈现。数据表是受控服务器数据组件，排序/过滤/翻页由调用方处理；仅把受控状态写入URL，不提供URL初始化解析。
