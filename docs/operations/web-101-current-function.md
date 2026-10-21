# WEB-101 当前功能复核

仅验证官网七页、公开访问申请C01与直接消费者；不递归重跑上游。`node scripts/web-101-review.mjs --run docs/audit/evidence/web-101-local-20261021/function-attempt-NN`在已提交工程输入执行限定检查，记录完整SHA/摘要、逐条命令/日志、实际loopback reference、浏览器axe/截图、Lighthouse和单次非mock官网构建。官网无mock业务分支，公开表单始终实际请求；本轮仅用公开本机origin/受控响应，未构建Terminal或其他无关应用。

访问申请前检查隐私同意、honeypot、trim后字段、Research/Paper/Shadow白名单；匿名credentials=omit、no-store、禁止重定向，经生成C01 client发送，无自动重试。202必须通过运行时AuditedAsyncAccepted验证，且status=accepted，才展示受理；受理不等于权限开通。错误只展示安全映射和经schema验证的参考号/retryAfter，不透出服务端message。

同步锁阻止重复提交；待请求期间锁字段，15秒期限覆盖响应体。网络中断、取消、5xx或畸形成功均保持结果未知与草稿，不声称未发送或未落库；恢复联网不重提。接口没有幂等重放保证，用户先核查状态，明确解除未知锁再手动提交。卸载取消，不发布迟到成功。不存储表单、令牌或个人信息到localStorage/日志。

BFF reference修复Research与公开模式白名单，live路径同步拒绝assisted_live，但其目标数据库/限速与审计持久性仍未验收。实际HTTP组合只对本机reference受信任Origin发请求；浏览器对本站受控接口测试，真实跨域官网Origin→目标BFF、邮件交付及组织认证独立NOT_RUN，不能由此声称完整联调通过。官网登录仅提供Web Terminal链接，桌面认证独立验收。

首期七页路由/搜索/导航/SEO/合规、表单成功/拒绝/恢复、1440深浅色/390与CSS zoom=2、键盘跳转和axe收集原始证据。截图是当前功能图审输入，不称为完整设计签署；人工读屏与原生200%均NOT_RUN。

固定Lighthouse12.8.2临时工具及Chromium只访问本机七页，桌面provided throttling采集性能、可访问性、最佳实践、SEO基线和HTML原始报告；评分门槛与真实目标环境性能留待RELEASE。临时工具安装未改变仓库依赖，lock/版本摘要归档。`--verify`验证当前相同输入；`--ci`输入变化只验证原范围，不授予新HEAD准入。INTEGRATION NOT_ASSESSED、formalAccepted=false、运行准入DENIED，人工确认需项目用户原始答复。
