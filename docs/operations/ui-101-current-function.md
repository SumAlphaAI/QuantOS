# UI-101 当前功能复核范围

`node scripts/ui-101-review.mjs --run docs/audit/evidence/ui-101-local-20261021/function-attempt-NN` 只在工程输入已提交后执行；保存完整SHA/摘要、直接前提原件、每条命令/原始日志/浏览器附件。`--verify` 严格核验当前输入，`--ci` 对输入漂移只验证原件、不授予新HEAD准入。不得递归重跑全部上游或替换历史READY输入。

来源选择：只有显式MOCK_ENABLED=true使用演示fixture；非mock必须配置BFF且通过生成client及运行时schema，不回退fixture。严格按session → tenant/workspace → RBAC/capability → resource → mode → data：C01 session验证有效期/MFA，context绑定actor/tenant/workspace，C02使用后端实际ops.read，account/mode一致后才请求summary；summary必须属于该账户/模式且未过期，未知/无数据拒绝。每次运行独立状态，不共享跨账户缓存；取消/过期/拒绝不能发布投影，401清内存并跳登录，403/404同页，5xx维护。

当前功能只读；完整P02任务保留独立范围。页面展示受权上下文ID（C01没有工作区名称字段，不伪造名称）、实际mode/freshness/risk与nullable计数，未知不补零。网络恢复、手工刷新及会话/投影到期重跑守卫；不凭online事件或本地计时器刷新事实时间，也不重放写入。服务端权限、撤销和目标持久性独立负责。

12组限定检查包括一次BFF bin构建与真实loopback C01/C02消费者；两种前端构建分别验证显式mock及local-integrated非mock选择，这是不同必要配置路径而非重复三轮构建。浏览器非mock用受控响应，不宣称真实IdP或持久BFF联调。mock构建后重建本机Chromium/Darwin Command视觉基线，原PNG/catalog按字节保留；初始化不等于旧基线匹配，再以同一构建禁止更新比较。Linux/其他浏览器图不复制生成，跨平台迁移/正式设计签署NOT_RUN。

人工读屏、原生200%缩放、数据库/真实IdP与服务部署、同SHA远程CI、容量长稳及RELEASE不在本轮执行；NOT_RUN不能由fixture、CSS zoom或人工确认替代。人工确认绑定原UI102工程及完整稿，原receipt保持不变。
