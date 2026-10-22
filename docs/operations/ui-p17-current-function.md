# UI-P17 浏览器能力当前功能范围

依据 P17 高保真 v2 与 I1 执行计划，交付 `/settings/browser`。先验证 C01 session/context 身份、工作区、账户、mode、MFA、settings.read 和最早失效期限，再按需加载 C17 profile、browser policy 与下载历史；不读取其他安全/通知分区，不向静态 HTML 输出私有信息，不自动退回演示。

原生权限、API 存在与服务端策略分别呈现。检测仅采样浏览器/OS、API、secure context、当前 Service Worker controller、robots meta 与 origin-wide storage estimate；估算 2 秒超时/失败/非法值显示未知，不显示虚构健康状态。检测不请求权限、不建立 WS/SSE、不打开 IndexedDB、不注册 Service Worker。通知仅点击且 secure/default/服务端允许才请求，拒绝后按钮禁用；focus 或重检重读原生权限。API 存在不代表连接、投递、硬件或授权成功。

存储清理需精确短语 CLEAR LOCAL LAYOUT，只删除 quantos.command.layout.v1 并读回核验；不枚举存储、不输出原值、不清除 Cookie、sessionStorage、IndexedDB、Cache 或其他键。失败不显示成功。会话管理链接进入安全分区，无退出所有会话伪操作。CSP/SRI/日志脱敏及 Cookie HttpOnly/Secure/SameSite 在本页无法验证，明确留待目标环境；policy 中 cspEnforced/sessionProtected/businessPagesNoIndex 仅声明，不作验收事实。

下载显示已读取数、状态过滤、空态、按服务端 nextCursor 加载最多 5 页/500 条，拒绝重复 ID、循环/外来 cursor、超限与历史签名 URL。加载、过滤不申请租约。只有当前授权历史中精确源记录、ready、有效期内、路径匹配和策略允许才在明确点击时签发。保持 HTTP 状态供 401/403/404 路由处理；重复点击用同步 latch 拒绝。响应须 exportId 绑定、HTTPS 同 BFF origin、无 userinfo/query/hash、签名内容路径与最多 5 分钟期限；路径 UUID 为不透明 ticket，不误作 exportId。请求后再次验证在线、会话/权限、generation、卸载和到期，旧结果不发布。租约仅内存即时导航，不写存储或日志。

深链按钮固定本站 /auth/deep-link?return_to=%2Fsettings%2Fbrowser，不采用服务端声明 URL 导航，不包含账户、token 或业务数据；clipboard 成功后才提示，拒绝/不可用给手动复制。新标签 rel=noopener noreferrer；返回路由重新授权。离线冻结，恢复需明确读取快照，不自动重放。Web-only、角色裁剪与小屏高风险限制沿用现有边界。

P17 样式只作用 browser，使用冻结语义 tokens，继承已保存 profile 的主题/密度等。1440/1024/390、深浅主题、键盘焦点、CSS zoom=2 与 axe 自动扫描；原生缩放和人工读屏不冒认。Desktop/Mobile 卡片是布局示意，非真实设备认证。新双主题 Chromium/Darwin 基线与旧 browser Darwin 图迁移，原 catalog/PNG 逐字节保留，P15 security 原图应保持一致；其他 OS/browser 比较 NOT_RUN。

入口 `node scripts/ui-p17-review.mjs --run docs/audit/evidence/ui-p17-local-20261022/function-attempt-NN`，先冻结工程提交。限定功能单元、直接 C17/UI-104/P15 共享回归、必要 types/lint、双 profile 构建、浏览器与计划，不递归复验 16 项前提。受控浏览器契约 fixture 验证合规签名下载；真实 Rust reference 环回 HTTP + 内存种子通过原字节身份/CORS 测试桥通过实际 MFA/reauth/export API 在 reference 内存中准备未过期自有导出（仅 hash 保存安全响应），验证读取、无 audit:read 时 history 403 拒绝、失效身份和参考下载 URL 的安全拒绝。参考服务仍给 downloads.invalid/query-ticket，与前端签名地址约束不符，未重写响应或声称实际下载成功。live 服务使用 terminal origin 与前端 BFF origin 的目标拓扑兼容仍待授权环境核验，禁止放宽任意 URL 校验。

工程和客户端契约 PASS 与受控本机组合分开记账，用户确认 PENDING、INTEGRATION NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。Firefox 保留环境 BLOCKED，功能 NOT_RUN。全部既有 NOT_RUN 和原失败保留；真实 IdP/MFA/目标 BFF/数据库、Cookie/CORS、通知投递、实际 reference 下载投递、目标 headers/privacy、真实设备、原生 200%、人工读屏、跨 OS 图像、同 SHA 远端 CI、性能长稳及发布 NOT_RUN。不推送或部署，不使用生产凭据。P01/P02 已确认与 P15 待确认范围均不改绑。

WebKit 独立真实环回附件可接收，但 Playwright route.fulfill 同源/HTTPS 附件均收到 200 而不触发下载事件；三次原始超时与独立诊断保留。当前 WebKit 验证到签名内容导航响应，拦截环境附件接收 BLOCKED_ENVIRONMENT_TEST_INTERCEPTION / 功能 NOT_RUN；Chromium 实际附件落盘字节核验。此边界由门禁负向保护，不以网络成功替代附件验收。下载使用临时 anchor download + no-referrer，点击后移除，不持久化租约。
