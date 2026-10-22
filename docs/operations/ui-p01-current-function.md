# UI-P01 身份、访问申请与恢复

范围是 design/P01-Identity-Access-Recovery-High-Fidelity-v1.png 对应的五个 React Web 路由：`/login`、`/mfa`、`/access-request`、`/unauthorized`、`/offline`。继续复用 UI-102 PKCE/回调和 C01 生成类型、响应 schema、限时 transport；本轮不更改 BFF 契约。

登录仅跳转组织 IdP，PKCE pending 会话级存储后由回调一次消费。return_to 仅允许无参数、无编码的站内路径；认证与恢复路由自身回退 `/command`，防止循环。离线禁用登录；恢复仅由用户重新发起。MFA 六格支持键盘、粘贴、系统六位填充，拒绝时清码；401 返回安全登录路由，429 按实际 retryAfter 阻止提交。MFA 的结果未知时重新登录核查，不自动重放验证码。

申请支持 Research/Paper/Shadow、主要市场、用途、明确隐私同意和 honeypot；输入薄校验之后仅向 C01 发送原契约字段。202 必须满足生成 schema 且 status=accepted，显示关联 ID 与“受理不代表开通”。不重复发送并发点击；422 保留输入，429 受限时阻止重提；超时、网络中断、取消、5xx、畸形成功响应保留未知状态，先由用户通过组织既有渠道核查再明确允许手动重提。C01 未提供幂等键，不能声称恰好一次或自动恢复成功；刷新/新标签页无法保留此内存状态，核查责任仍适用。页面卸载及断网取消等待，不等于撤销服务器已执行的写入。

无权与未找到共享不可探测文案；关联 ID 仅白名单字符，剪贴板拒绝提供手动复制。帮助、隐私、安全说明可在当前页展开，无虚构外部支持地址。五页默认深色，随系统浅色偏好适配；小屏和 CSS zoom 重排，保留焦点/键盘和原生表单语义。设计稿的示例 ID、锁定时间和背景审计节点不作为业务事实展示。

验证入口：`node scripts/ui-p01-review.mjs --run docs/audit/evidence/ui-p01-local-20261022/function-attempt-NN`。工程文件须先提交；使用隔离的公开 local-mock 配置，排除生产凭据，只启动本机静态服务并使用受控 IdP/BFF HTTP 响应。记录单元、types、lint、直接浏览器回归、Chromium/WebKit 当前功能与独立 Firefox 启动诊断、Chromium 双主题视觉比较、20组页面/主题/浏览器 axe 和计划检查；`--verify` 核验当前输入/源码 SHA/命令/日志/附件。视觉初始化不计为独立设计验收，不替换原 UI-102 历史基线。

本机 Firefox 空白启动重复超时，伴随 sandbox_extension_issue_file_to_process 与 RenderCompositorSWGL 错误；完整矩阵第一次批次中断并保留原始130退出和报告，未运行项不计PASS。独立诊断记 BLOCKED_ENVIRONMENT，Firefox当前功能验证另待可用环境。

Gate 仅为当前页面工程与客户端契约组合；依赖任务按原记录引用，不递归重验或提升当前准入。INTEGRATION 保持 NOT_ASSESSED；真实 IdP/MFA、目标 BFF/数据库、原生200%缩放、人工读屏、远程同SHA CI、跨操作系统视觉、RELEASE 均 NOT_RUN。当前界面交付以设计稿简体中文为准；英文完整文案仍需后续专项完善。用户确认按项目统一规程另存新稿与原始答复，本轮不会自批 ACCEPTED。
